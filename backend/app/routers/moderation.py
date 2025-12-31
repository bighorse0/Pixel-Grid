from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import get_db
from ..models import Block, BlockImage, ModerationCheck, AdminAction, BannedContent
from ..auth import get_current_admin
from ..schemas import ModerationDecision

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.get("/pending")
async def get_pending_blocks(
    skip: int = 0,
    limit: int = 20,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get blocks pending moderation review"""
    blocks = db.query(Block).filter(
        Block.status == 'pending_review'
    ).order_by(Block.purchased_at.desc()).offset(skip).limit(limit).all()

    result = []
    for block in blocks:
        # Get latest image
        image = db.query(BlockImage).filter(
            BlockImage.block_id == block.id
        ).order_by(BlockImage.moderation_version.desc()).first()

        # Get moderation checks
        checks = []
        if image:
            checks = db.query(ModerationCheck).filter(
                ModerationCheck.block_image_id == image.id
            ).all()

        result.append({
            'block': block,
            'image': image,
            'moderation_checks': checks
        })

    return result


@router.post("/{block_id}/decide")
async def moderate_block(
    block_id: UUID,
    decision: ModerationDecision,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Approve or reject a block"""
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.status != 'pending_review':
        raise HTTPException(status_code=400, detail="Block is not pending review")

    if decision.decision == 'approve':
        block.status = 'approved'
        block.approved_at = db.query(Block).filter(Block.id == block_id).first().approved_at

        # Log action
        action = AdminAction(
            admin_id=admin.id,
            action_type='approve',
            target_type='block',
            target_id=block_id,
            reason=decision.reason
        )
        db.add(action)

    elif decision.decision == 'reject':
        block.status = 'rejected'
        block.rejection_reason = decision.reason

        # Log action
        action = AdminAction(
            admin_id=admin.id,
            action_type='reject',
            target_type='block',
            target_id=block_id,
            reason=decision.reason
        )
        db.add(action)

    db.commit()

    return {"status": "success", "new_status": block.status}


@router.post("/{block_id}/remove")
async def remove_published_block(
    block_id: UUID,
    reason: str,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Remove a block that was previously approved"""
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.status != 'approved':
        raise HTTPException(status_code=400, detail="Block is not approved")

    block.status = 'removed_after_publish'
    block.rejection_reason = reason

    # Log action
    action = AdminAction(
        admin_id=admin.id,
        action_type='remove',
        target_type='block',
        target_id=block_id,
        reason=reason
    )
    db.add(action)
    db.commit()

    return {"status": "success", "message": "Block removed"}


@router.post("/ban/domain")
async def ban_domain(
    domain: str,
    reason: str,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Ban a domain"""
    existing = db.query(BannedContent).filter(
        BannedContent.ban_type == 'domain',
        BannedContent.value == domain
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Domain already banned")

    ban = BannedContent(
        ban_type='domain',
        value=domain,
        reason=reason,
        banned_by=admin.id
    )
    db.add(ban)

    # Log action
    action = AdminAction(
        admin_id=admin.id,
        action_type='ban_domain',
        target_type='domain',
        reason=reason,
        metadata={'domain': domain}
    )
    db.add(action)

    db.commit()

    return {"status": "success", "message": f"Domain {domain} banned"}


@router.post("/ban/image-hash")
async def ban_image_hash(
    image_hash: str,
    reason: str,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Ban an image hash"""
    existing = db.query(BannedContent).filter(
        BannedContent.ban_type == 'image_hash',
        BannedContent.value == image_hash
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Image hash already banned")

    ban = BannedContent(
        ban_type='image_hash',
        value=image_hash,
        reason=reason,
        banned_by=admin.id
    )
    db.add(ban)

    # Log action
    action = AdminAction(
        admin_id=admin.id,
        action_type='ban_image_hash',
        target_type='image_hash',
        reason=reason,
        metadata={'image_hash': image_hash}
    )
    db.add(action)

    db.commit()

    return {"status": "success", "message": "Image hash banned"}


@router.get("/banned")
async def get_banned_content(
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all banned content"""
    banned = db.query(BannedContent).order_by(BannedContent.banned_at.desc()).all()
    return banned
