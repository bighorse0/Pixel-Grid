-- BloxGrid Database Schema
-- PostgreSQL 14+

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Admins table (manually seeded, no public signup)
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'moderator')),
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    two_fa_secret VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Grid blocks (the "pixels" users buy)
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    x_start INTEGER NOT NULL,
    y_start INTEGER NOT NULL,
    width INTEGER NOT NULL CHECK (width >= 10 AND width % 10 = 0),
    height INTEGER NOT NULL CHECK (height >= 10 AND height % 10 = 0),
    pixel_count INTEGER GENERATED ALWAYS AS (width * height) STORED,
    price_paid DECIMAL(10, 2) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    edit_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'removed_after_publish')),
    rejection_reason TEXT,
    purchased_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    expires_at TIMESTAMP, -- NULL = permanent, otherwise time-based ownership
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_grid_position UNIQUE (x_start, y_start)
);

-- Block images
CREATE TABLE block_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL, -- S3 URL
    image_hash VARCHAR(64) NOT NULL, -- SHA256 for duplicate detection
    link_url VARCHAR(500) NOT NULL,
    hover_title VARCHAR(100),
    hover_description VARCHAR(255),
    hover_cta VARCHAR(50),
    moderation_version INTEGER DEFAULT 1, -- Track re-uploads
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT one_image_per_block UNIQUE (block_id, moderation_version)
);

-- Automated moderation results
CREATE TABLE moderation_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_image_id UUID NOT NULL REFERENCES block_images(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('openai_image', 'aws_rekognition', 'google_vision', 'ocr_text', 'url_scan')),
    result JSONB NOT NULL, -- Store full API response
    flagged BOOLEAN NOT NULL,
    confidence DECIMAL(5, 4), -- 0-1 score
    flagged_categories TEXT[], -- e.g., ['sexual', 'violence']
    checked_at TIMESTAMP DEFAULT NOW()
);

-- Payment records (Stripe)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    stripe_payment_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    refund_reason TEXT,
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Admin actions log (audit trail)
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('approve', 'reject', 'remove', 'refund', 'lock_region', 'ban_domain', 'ban_image_hash')),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('block', 'domain', 'image_hash')),
    target_id UUID,
    reason TEXT,
    meta_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Banned content
CREATE TABLE banned_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ban_type VARCHAR(50) NOT NULL CHECK (ban_type IN ('domain', 'image_hash', 'keyword')),
    value VARCHAR(500) NOT NULL,
    reason TEXT,
    banned_by UUID REFERENCES admins(id),
    banned_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_ban UNIQUE (ban_type, value)
);

-- Grid regions (for locking, premium pricing, etc.)
CREATE TABLE grid_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    x_start INTEGER NOT NULL,
    y_start INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    price_per_pixel DECIMAL(5, 2) DEFAULT 1.00,
    is_locked BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    meta_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_blocks_status ON blocks(status);
CREATE INDEX idx_blocks_buyer_email ON blocks(buyer_email);
CREATE INDEX idx_blocks_position ON blocks(x_start, y_start);
CREATE INDEX idx_moderation_flagged ON moderation_checks(flagged);
CREATE INDEX idx_payments_stripe_id ON payments(stripe_payment_id);
CREATE INDEX idx_admin_actions_timestamp ON admin_actions(created_at);
CREATE INDEX idx_block_images_hash ON block_images(image_hash);

-- Seed initial admin (change password immediately)
-- Password: admin123 (hashed with bcrypt, cost 12)
INSERT INTO admins (email, password_hash, role) VALUES
('admin@bloxgrid.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfXxPU.W.2', 'admin');

-- Seed default grid regions
INSERT INTO grid_regions (name, x_start, y_start, width, height, price_per_pixel, is_premium) VALUES
('Above the Fold', 0, 0, 1000, 400, 2.00, TRUE),
('Standard Grid', 0, 400, 1000, 600, 1.00, FALSE);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
