# BloxGrid - Modern Pixel Grid Marketplace

A modern reimagining of the Million Dollar Homepage with Roblox-inspired aesthetics, built with Next.js, FastAPI, and PostgreSQL, designed for AWS deployment.

## Features

### Core Functionality
- **Grid Selection**: Drag-to-select blocks on a 1000x1000 pixel grid
- **Minimum Block Size**: 10x10 pixels (prevents microscopic spam)
- **Dynamic Pricing**: Premium zones (above-the-fold) at higher prices
- **Image Upload & Preview**: Live preview before purchase
- **Stripe Payments**: Secure checkout with Stripe
- **No Account Required**: Buyers only need email (receives edit token)

### Safety & Moderation
- **Multi-Layer Auto-Moderation**:
  - OpenAI image moderation (NSFW, violence, hate)
  - AWS Rekognition (visual content)
  - OCR text extraction & keyword filtering
  - URL scanning & domain blacklist
- **Human Review Queue**: Flagged content goes to admin panel
- **Ban System**: Domain, image hash, and keyword blocking
- **Admin Audit Log**: Track all moderation decisions

### Admin System
- **Hidden Admin Login**: No public signup, `/admin/login` URL only
- **Role-Based Access**: Admin vs Moderator permissions
- **2FA Support**: Optional two-factor authentication
- **Moderation Dashboard**: Approve/reject blocks, ban content
- **Manual Admin Creation**: Seeded via database

### Roblox-Themed Design
- Blocky, voxel-style grid aesthetics
- Bright color palette (blue, green, red, yellow)
- Chunky UI with shadow effects
- "Blocks" terminology (not pixels)
- Game-inspired hover cards

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **PostgreSQL**: Relational database (AWS RDS)
- **SQLAlchemy**: ORM
- **Stripe**: Payment processing
- **AWS S3**: Image storage
- **AWS Rekognition**: Image moderation
- **OpenAI**: Content moderation

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first CSS
- **Canvas API**: Grid rendering
- **Axios**: HTTP client

### Infrastructure
- **AWS ECS (Fargate)**: Containerized deployments
- **AWS RDS (PostgreSQL)**: Managed database
- **AWS S3**: Image storage
- **AWS ALB**: Load balancing
- **Terraform**: Infrastructure as Code

## Project Structure

```
bloxgrid/
├── backend/
│   ├── app/
│   │   ├── routers/          # API endpoints
│   │   │   ├── admin.py      # Admin auth
│   │   │   ├── blocks.py     # Block CRUD
│   │   │   ├── moderation.py # Moderation endpoints
│   │   │   └── payments.py   # Stripe integration
│   │   ├── services/
│   │   │   ├── moderation.py # AI moderation service
│   │   │   └── storage.py    # S3 image handling
│   │   ├── config.py         # Settings
│   │   ├── database.py       # DB connection
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── auth.py           # JWT + 2FA
│   │   └── main.py           # FastAPI app
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── login/        # Admin login
│   │   │   └── dashboard/    # Moderation panel
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Main grid page
│   │   └── globals.css
│   ├── components/
│   │   └── GridCanvas.tsx    # Interactive grid
│   ├── lib/
│   │   └── api.ts            # API client
│   ├── package.json
│   └── Dockerfile
├── database/
│   ├── schema.sql            # Database schema
│   └── setup.sh              # DB setup script
└── infrastructure/
    ├── terraform/
    │   ├── main.tf           # AWS resources
    │   ├── variables.tf
    │   └── outputs.tf
    └── deploy.sh             # Deployment script
```

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 14+
- Docker
- AWS Account
- Stripe Account

### Local Development

#### 1. Database Setup

```bash
cd database
chmod +x setup.sh
./setup.sh
# Enter password: newpassword
```

Default admin credentials:
- Email: `admin@bloxgrid.local`
- Password: `admin123` (change immediately!)

#### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Run server
uvicorn app.main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs: http://localhost:8000/docs

#### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx" >> .env.local

# Run dev server
npm run dev
```

Frontend runs at: http://localhost:3000

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=postgresql://drewstorey:newpassword@localhost:5432/bloxgrid
SECRET_KEY=your-secret-key-change-in-production
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=bloxgrid-images
OPENAI_API_KEY=sk-xxxxx
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

## AWS Deployment

### 1. Prerequisites
- AWS CLI configured
- Terraform installed
- Docker installed

### 2. Create S3 Bucket for Terraform State
```bash
aws s3 mb s3://bloxgrid-terraform-state --region us-east-1
```

### 3. Deploy Infrastructure
```bash
cd infrastructure
chmod +x deploy.sh

# Set environment variables
export AWS_REGION=us-east-1
export TF_VAR_db_password="your-secure-password"

# Run deployment
./deploy.sh
```

### 4. Post-Deployment Steps

1. **Run Database Migrations**
```bash
# SSH into ECS task or use AWS CLI
psql -h <RDS_ENDPOINT> -U bloxgrid -d bloxgrid -f database/schema.sql
```

2. **Configure Environment Variables in ECS**
Update task definitions with production environment variables.

3. **Set Up Domain & SSL**
- Point your domain to ALB DNS name
- Create ACM certificate
- Update ALB listener to use HTTPS

4. **Configure Stripe Webhook**
- Set webhook URL: `https://yourdomain.com/payments/webhook`
- Add webhook secret to environment

## API Documentation

### Public Endpoints

#### Check Grid Availability
```http
POST /blocks/check-availability
Content-Type: application/json

{
  "x_start": 0,
  "y_start": 0,
  "width": 50,
  "height": 50
}
```

#### Reserve Block
```http
POST /blocks/reserve
Content-Type: application/json

{
  "x_start": 0,
  "y_start": 0,
  "width": 50,
  "height": 50,
  "buyer_email": "user@example.com"
}
```

#### Upload Image
```http
POST /blocks/{block_id}/upload
Content-Type: multipart/form-data

edit_token: <token-from-email>
image: <file>
link_url: https://example.com
hover_title: My Brand
hover_description: Check out our site!
hover_cta: Visit Now
```

### Admin Endpoints (Require Auth)

#### Login
```http
POST /admin/login
Content-Type: application/json

{
  "email": "admin@bloxgrid.local",
  "password": "admin123"
}
```

#### Get Pending Blocks
```http
GET /moderation/pending
Authorization: Bearer <token>
```

#### Approve/Reject Block
```http
POST /moderation/{block_id}/decide
Authorization: Bearer <token>
Content-Type: application/json

{
  "decision": "approve",  // or "reject"
  "reason": "Looks good"
}
```

## Security Considerations

### Authentication
- Admin passwords hashed with bcrypt (cost 12)
- JWT tokens for session management
- Optional 2FA with TOTP
- Rate limiting on login endpoint

### Content Moderation
- Multiple AI services for redundancy
- Hash-based duplicate detection
- Domain blacklist
- Keyword filtering
- Human review queue

### Payment Security
- No credit card data stored
- Stripe handles all PCI compliance
- Webhook signature verification
- Refund capabilities

### Infrastructure Security
- Private subnets for RDS
- Security groups with least privilege
- S3 bucket with CORS restrictions
- CloudWatch logging enabled
- ECS task role with minimal permissions

## Content Policy

### Prohibited Content
- Pornographic or sexually explicit material
- Violence, gore, or hate symbols
- Scams or fraudulent schemes
- Illegal content
- Malicious links
- Spam or misleading advertising

### Enforcement
1. Auto-rejection (high-confidence AI flags)
2. Human review queue (moderate confidence)
3. Post-publication removal (user reports, periodic audits)
4. Refunds for rejected blocks

## Monitoring & Maintenance

### CloudWatch Metrics
- ECS task CPU/memory usage
- RDS connections
- ALB request count
- S3 storage usage

### Logs
- Backend: `/ecs/bloxgrid-backend`
- Frontend: `/ecs/bloxgrid-frontend`
- RDS: PostgreSQL logs

### Backup Strategy
- RDS automated backups (7 days retention)
- S3 versioning for images
- Database dump before major changes

## Roadmap

### Phase 1 (MVP) ✅
- [x] Grid selection and purchase
- [x] Payment integration
- [x] Image upload and moderation
- [x] Admin panel
- [x] AWS deployment

### Phase 2 (Enhancements)
- [ ] Time-based block ownership (30/90/365 days)
- [ ] Hover card customization
- [ ] Creator leaderboards
- [ ] Featured blocks marketplace
- [ ] Email notifications

### Phase 3 (Growth)
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations
- [ ] Analytics dashboard for buyers
- [ ] Referral program
- [ ] Community contests

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Email: support@bloxgrid.com
- GitHub Issues (if open-source)

---

Built with ❤️ using Next.js, FastAPI, and AWS
