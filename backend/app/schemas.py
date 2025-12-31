from pydantic import BaseModel, EmailStr, HttpUrl, Field
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# Admin schemas
class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class AdminToken(BaseModel):
    access_token: str
    token_type: str


class AdminResponse(BaseModel):
    id: UUID
    email: str
    role: str
    two_fa_enabled: bool

    class Config:
        from_attributes = True


# Block schemas
class BlockCreate(BaseModel):
    x_start: int = Field(..., ge=0, lt=1000)
    y_start: int = Field(..., ge=0, lt=1000)
    width: int = Field(..., ge=10, multiple_of=10)
    height: int = Field(..., ge=10, multiple_of=10)
    buyer_email: EmailStr


class BlockImageUpload(BaseModel):
    link_url: HttpUrl
    hover_title: str | None = Field(None, max_length=100)
    hover_description: str | None = Field(None, max_length=255)
    hover_cta: str | None = Field(None, max_length=50)


class BlockResponse(BaseModel):
    id: UUID
    x_start: int
    y_start: int
    width: int
    height: int
    pixel_count: int
    price_paid: Decimal
    buyer_email: str
    status: str
    purchased_at: datetime
    approved_at: datetime | None
    expires_at: datetime | None

    class Config:
        from_attributes = True


class BlockImageResponse(BaseModel):
    id: UUID
    block_id: UUID
    image_url: str
    link_url: str
    hover_title: str | None
    hover_description: str | None
    hover_cta: str | None

    class Config:
        from_attributes = True


class GridStateResponse(BaseModel):
    blocks: list[dict]  # Simplified grid data for frontend rendering


# Moderation schemas
class ModerationCheckResponse(BaseModel):
    id: UUID
    check_type: str
    flagged: bool
    confidence: Decimal | None
    flagged_categories: list[str] | None
    checked_at: datetime

    class Config:
        from_attributes = True


class ModerationDecision(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: str | None = None


# Payment schemas
class CheckoutSession(BaseModel):
    session_id: str
    url: str


class PaymentResponse(BaseModel):
    id: UUID
    block_id: UUID
    stripe_payment_id: str
    amount: Decimal
    status: str
    paid_at: datetime | None

    class Config:
        from_attributes = True


# Admin action schemas
class AdminActionCreate(BaseModel):
    action_type: str
    target_type: str
    target_id: UUID | None = None
    reason: str | None = None
    metadata: dict | None = None


class AdminActionResponse(BaseModel):
    id: UUID
    admin_id: UUID
    action_type: str
    target_type: str
    target_id: UUID | None
    reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# Grid availability
class GridAvailabilityCheck(BaseModel):
    x_start: int
    y_start: int
    width: int
    height: int


class GridAvailabilityResponse(BaseModel):
    available: bool
    conflicting_blocks: list[BlockResponse] | None = None
    price_per_pixel: Decimal
    total_price: Decimal
