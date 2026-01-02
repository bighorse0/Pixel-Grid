from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
import secrets
from uuid import UUID
from ..database import get_db
from ..models import Block, BlockImage, GridRegion, BannedContent
from ..schemas import (
    BlockCreate, BlockResponse, BlockImageUpload, GridAvailabilityCheck,
    GridAvailabilityResponse, BlockImageResponse, GridBlockResponse
)
from ..services.storage import StorageService
from ..services.moderation import ModerationService
from ..config import get_settings

router = APIRouter(prefix="/blocks", tags=["blocks"])
settings = get_settings()


def check_grid_availability(db: Session, x_start: int, y_start: int, width: int, height: int) -> tuple[bool, list]:
    """Check if grid area is available"""
    x_end = x_start + width
    y_end = y_start + height

    # Check for overlapping blocks
    conflicting = db.query(Block).filter(
        Block.status.in_(['approved', 'pending_review']),
        or_(
            and_(
                Block.x_start < x_end,
                Block.x_start + Block.width > x_start,
                Block.y_start < y_end,
                Block.y_start + Block.height > y_start
            )
        )
    ).all()

    return len(conflicting) == 0, conflicting


def calculate_price(db: Session, x_start: int, y_start: int, width: int, height: int) -> float:
    """Calculate price based on region pricing"""
    regions = db.query(GridRegion).all()

    # Find matching region (simplified - takes first match)
    price_per_pixel = settings.default_price_per_pixel

    for region in regions:
        if (x_start >= region.x_start and
            y_start >= region.y_start and
            x_start + width <= region.x_start + region.width and
            y_start + height <= region.y_start + region.height):
            price_per_pixel = float(region.price_per_pixel)
            break

    return (width * height) * price_per_pixel


@router.post("/check-availability", response_model=GridAvailabilityResponse)
async def check_availability(
    data: GridAvailabilityCheck,
    db: Session = Depends(get_db)
):
    """Check if grid area is available and get pricing"""
    available, conflicting = check_grid_availability(
        db, data.x_start, data.y_start, data.width, data.height
    )

    total_price = calculate_price(db, data.x_start, data.y_start, data.width, data.height)
    price_per_pixel = total_price / (data.width * data.height)

    return {
        "available": available,
        "conflicting_blocks": conflicting if not available else None,
        "price_per_pixel": price_per_pixel,
        "total_price": total_price
    }


@router.post("/reserve", response_model=BlockResponse)
async def reserve_block(
    data: BlockCreate,
    db: Session = Depends(get_db)
):
    """
    Reserve a block (step 1: before payment)
    Creates block in 'draft' status with edit token
    """
    # Validate grid boundaries
    if (data.x_start + data.width > settings.grid_width or
        data.y_start + data.height > settings.grid_height):
        raise HTTPException(status_code=400, detail="Block exceeds grid boundaries")

    # Check availability
    available, conflicting = check_grid_availability(
        db, data.x_start, data.y_start, data.width, data.height
    )

    if not available:
        raise HTTPException(status_code=400, detail="Grid area is not available")

    # Calculate price
    price = calculate_price(db, data.x_start, data.y_start, data.width, data.height)

    # Create block
    edit_token = secrets.token_urlsafe(32)

    block = Block(
        x_start=data.x_start,
        y_start=data.y_start,
        width=data.width,
        height=data.height,
        price_paid=price,
        buyer_email=data.buyer_email,
        link_url=str(data.link_url),
        edit_token=edit_token,
        status='draft'
    )

    db.add(block)
    db.commit()
    db.refresh(block)

    return block


@router.post("/{block_id}/upload", response_model=BlockImageResponse)
async def upload_block_image(
    block_id: UUID,
    edit_token: str = Form(...),
    link_url: str = Form(...),
    hover_title: str | None = Form(None),
    hover_description: str | None = Form(None),
    hover_cta: str | None = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload image for a block (step 2: after payment, before moderation)
    Requires edit_token for security
    """
    # Verify block and edit token
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.edit_token != edit_token:
        raise HTTPException(status_code=403, detail="Invalid edit token")

    # Read image
    image_bytes = await image.read()

    # Validate file size
    if len(image_bytes) > settings.max_image_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image too large (max {settings.max_image_size_mb}MB)")

    # Process and upload image
    storage = StorageService()
    try:
        processed_image = storage.validate_and_process_image(
            image_bytes, block.width, block.height
        )
        s3_key, image_url = storage.upload_image(processed_image, str(block_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create block image record
    moderation = ModerationService(db)
    image_hash = moderation.calculate_image_hash(processed_image)

    # Check if image hash is banned
    if moderation.check_banned_hash(image_hash):
        storage.delete_image(s3_key)
        raise HTTPException(status_code=400, detail="This image has been banned")

    # Check if URL domain is banned
    if moderation.check_banned_domain(link_url):
        storage.delete_image(s3_key)
        raise HTTPException(status_code=400, detail="This domain has been banned")

    block_image = BlockImage(
        block_id=block_id,
        image_url=image_url,
        image_hash=image_hash,
        link_url=link_url,
        hover_title=hover_title,
        hover_description=hover_description,
        hover_cta=hover_cta
    )

    db.add(block_image)
    db.commit()
    db.refresh(block_image)

    # Run moderation in background (async in production)
    moderation_result = await moderation.run_full_moderation(
        processed_image, s3_key, link_url, str(block_image.id)
    )

    # Update block status based on moderation
    if moderation_result['auto_approve']:
        block.status = 'approved'
        block.approved_at = db.query(Block).filter(Block.id == block_id).first().approved_at
    else:
        block.status = 'pending_review'

    db.commit()

    return block_image


@router.get("/grid", response_model=list[GridBlockResponse])
async def get_grid_state(db: Session = Depends(get_db)):
    """Get all approved blocks for grid rendering"""
    blocks = db.query(Block).filter(Block.status == 'approved').all()

    # Transform blocks with their images
    grid_blocks = []
    for block in blocks:
        # Get the associated image if it exists
        image = db.query(BlockImage).filter(BlockImage.block_id == block.id).first()

        grid_blocks.append({
            'id': block.id,
            'x_start': block.x_start,
            'y_start': block.y_start,
            'width': block.width,
            'height': block.height,
            'image_url': image.image_url if image else None,
            'link_url': block.link_url,
            'hover_title': image.hover_title if image else None,
            'hover_description': image.hover_description if image else None,
            'hover_cta': image.hover_cta if image else None,
        })

    return grid_blocks


@router.get("/{block_id}", response_model=BlockResponse)
async def get_block(block_id: UUID, db: Session = Depends(get_db)):
    """Get block details"""
    block = db.query(Block).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return block
