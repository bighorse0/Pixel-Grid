from sqlalchemy import Column, String, Integer, Boolean, TIMESTAMP, Numeric, Text, ARRAY, ForeignKey, CheckConstraint, Computed
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    two_fa_enabled = Column(Boolean, default=False)
    two_fa_secret = Column(String(255))
    last_login = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    actions = relationship("AdminAction", back_populates="admin")


class Block(Base):
    __tablename__ = "blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    x_start = Column(Integer, nullable=False)
    y_start = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    pixel_count = Column(Integer, Computed("width * height"), nullable=False)
    price_paid = Column(Numeric(10, 2), nullable=False)
    buyer_email = Column(String(255), nullable=False)
    link_url = Column(String(500))
    edit_token = Column(String(255), unique=True, nullable=False)
    status = Column(String(50), nullable=False, default='draft')
    rejection_reason = Column(Text)
    purchased_at = Column(TIMESTAMP, server_default=func.now())
    approved_at = Column(TIMESTAMP)
    expires_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    images = relationship("BlockImage", back_populates="block", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="block", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint('width >= 10 AND width % 10 = 0', name='check_width'),
        CheckConstraint('height >= 10 AND height % 10 = 0', name='check_height'),
        CheckConstraint("status IN ('draft', 'pending_review', 'approved', 'rejected', 'removed_after_publish')", name='check_status'),
    )


class BlockImage(Base):
    __tablename__ = "block_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    block_id = Column(UUID(as_uuid=True), ForeignKey('blocks.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(String(500), nullable=False)
    image_hash = Column(String(64), nullable=False)
    link_url = Column(String(500), nullable=False)
    hover_title = Column(String(100))
    hover_description = Column(String(255))
    hover_cta = Column(String(50))
    moderation_version = Column(Integer, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())

    block = relationship("Block", back_populates="images")
    moderation_checks = relationship("ModerationCheck", back_populates="block_image", cascade="all, delete-orphan")


class ModerationCheck(Base):
    __tablename__ = "moderation_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    block_image_id = Column(UUID(as_uuid=True), ForeignKey('block_images.id', ondelete='CASCADE'), nullable=False)
    check_type = Column(String(50), nullable=False)
    result = Column(JSONB, nullable=False)
    flagged = Column(Boolean, nullable=False)
    confidence = Column(Numeric(5, 4))
    flagged_categories = Column(ARRAY(Text))
    checked_at = Column(TIMESTAMP, server_default=func.now())

    block_image = relationship("BlockImage", back_populates="moderation_checks")

    __table_args__ = (
        CheckConstraint("check_type IN ('openai_image', 'aws_rekognition', 'google_vision', 'ocr_text', 'url_scan')", name='check_type_constraint'),
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    block_id = Column(UUID(as_uuid=True), ForeignKey('blocks.id', ondelete='CASCADE'), nullable=False)
    stripe_payment_id = Column(String(255), unique=True, nullable=False)
    stripe_customer_id = Column(String(255))
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default='USD')
    status = Column(String(50), nullable=False)
    refund_reason = Column(Text)
    paid_at = Column(TIMESTAMP)
    refunded_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())

    block = relationship("Block", back_populates="payments")

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'succeeded', 'failed', 'refunded')", name='check_payment_status'),
    )


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey('admins.id'), nullable=False)
    action_type = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(UUID(as_uuid=True))
    reason = Column(Text)
    meta_data = Column(JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())

    admin = relationship("Admin", back_populates="actions")

    __table_args__ = (
        CheckConstraint("action_type IN ('approve', 'reject', 'remove', 'refund', 'lock_region', 'ban_domain', 'ban_image_hash')", name='check_action_type'),
        CheckConstraint("target_type IN ('block', 'domain', 'image_hash')", name='check_target_type'),
    )


class BannedContent(Base):
    __tablename__ = "banned_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ban_type = Column(String(50), nullable=False)
    value = Column(String(500), nullable=False)
    reason = Column(Text)
    banned_by = Column(UUID(as_uuid=True), ForeignKey('admins.id'))
    banned_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        CheckConstraint("ban_type IN ('domain', 'image_hash', 'keyword')", name='check_ban_type'),
    )


class GridRegion(Base):
    __tablename__ = "grid_regions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    x_start = Column(Integer, nullable=False)
    y_start = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    price_per_pixel = Column(Numeric(5, 2), default=1.00)
    is_locked = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    meta_data = Column(JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())
