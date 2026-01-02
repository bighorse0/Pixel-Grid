from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from uuid import UUID
import stripe
from ..database import get_db
from ..models import Block, Payment
from ..schemas import CheckoutSession
from ..config import get_settings

router = APIRouter(prefix="/payments", tags=["payments"])
settings = get_settings()

stripe.api_key = settings.stripe_secret_key


@router.post("/{block_id}/checkout", response_model=CheckoutSession)
async def create_checkout_session(
    block_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for block payment"""
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.status != 'draft':
        raise HTTPException(status_code=400, detail="Block already paid")

    # Check if request is from test mode IP
    client_ip = request.client.host
    if settings.test_mode_enabled and client_ip in settings.test_mode_ips:
        # Skip Stripe and use test payment endpoint
        return {
            "session_id": "test_mode",
            "url": f"{settings.frontend_url}/test-checkout?block_id={block_id}"
        }

    # Create Stripe checkout session
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': int(float(block.price_paid) * 100),  # Convert to cents
                    'product_data': {
                        'name': f'BloxGrid Block ({block.width}x{block.height})',
                        'description': f'Grid position: ({block.x_start}, {block.y_start})',
                        'images': ['https://your-domain.com/logo.png'],  # Add your logo
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{settings.frontend_url}/checkout/success?block_id={block_id}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_url}/checkout/cancel?block_id={block_id}",
            customer_email=block.buyer_email,
            metadata={
                'block_id': str(block_id),
            },
        )

        # Create payment record
        payment = Payment(
            block_id=block_id,
            stripe_payment_id=session.id,
            amount=block.price_paid,
            status='pending'
        )
        db.add(payment)
        db.commit()

        return {
            "session_id": session.id,
            "url": session.url
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{block_id}/test-complete")
async def complete_test_payment(
    block_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """Complete test payment (bypass Stripe for testing)"""
    # Check if request is from test mode IP
    client_ip = request.client.host
    if not settings.test_mode_enabled or client_ip not in settings.test_mode_ips:
        raise HTTPException(status_code=403, detail="Test mode not available")

    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.status != 'draft':
        raise HTTPException(status_code=400, detail="Block already paid")

    # Create test payment record
    payment = Payment(
        block_id=block_id,
        stripe_payment_id=f"test_{block_id}",
        amount=block.price_paid,
        status='succeeded'
    )
    db.add(payment)

    # Update block status to pending review (ready for image upload)
    block.status = 'pending_review'

    db.commit()
    db.refresh(block)

    return {
        "status": "success",
        "block_id": str(block_id),
        "message": "Test payment completed successfully"
    }


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        block_id = session['metadata']['block_id']

        # Update payment status
        payment = db.query(Payment).filter(
            Payment.stripe_payment_id == session['id']
        ).first()

        if payment:
            payment.status = 'succeeded'
            payment.stripe_customer_id = session.get('customer')
            payment.paid_at = db.query(Payment).filter(Payment.id == payment.id).first().paid_at
            db.commit()

    elif event['type'] == 'charge.refunded':
        charge = event['data']['object']
        payment_intent_id = charge.get('payment_intent')

        # Find payment by payment intent
        payment = db.query(Payment).filter(
            Payment.stripe_payment_id.contains(payment_intent_id)
        ).first()

        if payment:
            payment.status = 'refunded'
            payment.refunded_at = db.query(Payment).filter(Payment.id == payment.id).first().refunded_at

            # Update block status
            block = db.query(Block).filter(Block.id == payment.block_id).first()
            if block:
                block.status = 'rejected'
                block.rejection_reason = 'Payment refunded'

            db.commit()

    return {"status": "success"}


@router.get("/{block_id}/status")
async def get_payment_status(
    block_id: UUID,
    db: Session = Depends(get_db)
):
    """Check payment status for a block"""
    payment = db.query(Payment).filter(
        Payment.block_id == block_id
    ).order_by(Payment.created_at.desc()).first()

    if not payment:
        return {"status": "no_payment"}

    return {
        "status": payment.status,
        "amount": payment.amount,
        "paid_at": payment.paid_at
    }
