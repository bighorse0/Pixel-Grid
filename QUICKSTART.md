# BloxGrid - Quick Start Guide

Get BloxGrid running locally in 10 minutes.

## Prerequisites Check

```bash
# Check versions
node --version    # Should be 20+
python --version  # Should be 3.11+
psql --version    # Should be 14+
docker --version  # For deployment
```

## Step 1: Database (2 minutes)

```bash
# Start PostgreSQL if not running
# macOS: brew services start postgresql@14
# Linux: sudo systemctl start postgresql

# Create database
cd bloxgrid/database
chmod +x setup.sh
./setup.sh
# Password: newpassword
```

**Default Admin Login:**
- Email: `admin@bloxgrid.local`
- Password: `admin123` (change this!)

## Step 2: Backend (3 minutes)

```bash
cd ../backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env - MINIMUM required:
# DATABASE_URL=postgresql://drewstorey:newpassword@localhost:5432/bloxgrid
# SECRET_KEY=change-this-to-random-string
# STRIPE_SECRET_KEY=sk_test_YOUR_KEY
# OPENAI_API_KEY=sk-YOUR_KEY
# AWS keys (can use dummy values for local testing)

# Start backend
uvicorn app.main:app --reload --port 8000
```

Backend running at: http://localhost:8000

## Step 3: Frontend (3 minutes)

Open a new terminal:

```bash
cd bloxgrid/frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY" >> .env.local

# Start frontend
npm run dev
```

Frontend running at: http://localhost:3000

## Step 4: Test It Out (2 minutes)

### Public Flow
1. Go to http://localhost:3000
2. Drag on the grid to select a block (minimum 10x10 pixels)
3. Enter your email
4. Continue to payment (use Stripe test card: `4242 4242 4242 4242`)

### Admin Flow
1. Go to http://localhost:3000/admin/login
2. Login with `admin@bloxgrid.local` / `admin123`
3. View pending blocks in moderation queue
4. Approve or reject submissions

## Common Issues

### Database Connection Error
```bash
# Check if PostgreSQL is running
psql -U drewstorey -d postgres -c "SELECT 1;"
```

### Port Already in Use
```bash
# Backend (8000)
lsof -ti:8000 | xargs kill -9

# Frontend (3000)
lsof -ti:3000 | xargs kill -9
```

### Missing Environment Variables
Check that you've set:
- `DATABASE_URL`
- `SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `OPENAI_API_KEY`

## Getting Test API Keys

### Stripe
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy "Publishable key" (starts with `pk_test_`)
3. Copy "Secret key" (starts with `sk_test_`)

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-`)

### AWS (for image storage)
1. Go to AWS IAM Console
2. Create new user with S3 and Rekognition permissions
3. Generate access key

## What's Working

After setup, you should have:
- ✅ Interactive grid selection
- ✅ Price calculation
- ✅ Email capture
- ✅ Stripe checkout (test mode)
- ✅ Image upload
- ✅ Auto-moderation (if API keys configured)
- ✅ Admin login
- ✅ Moderation dashboard

## Next Steps

1. **Change Admin Password**
   ```sql
   psql -U drewstorey -d bloxgrid
   -- Update password in database
   ```

2. **Configure Moderation APIs**
   - Add OpenAI API key for image moderation
   - Add AWS credentials for Rekognition
   - Test with sample uploads

3. **Customize Branding**
   - Edit `frontend/app/layout.tsx` for site title
   - Update colors in `tailwind.config.ts`
   - Add your logo

4. **Test Payment Flow**
   - Use Stripe test cards
   - Check webhook integration
   - Verify refund flow

## Development Tips

### Hot Reload
Both backend and frontend have hot reload enabled. Changes appear automatically.

### API Documentation
FastAPI provides interactive docs at:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)

### Database Management
```bash
# Connect to database
psql -U drewstorey -d bloxgrid

# List tables
\dt

# View blocks
SELECT * FROM blocks;

# View admins
SELECT * FROM admins;
```

### Logs
- Backend: Check terminal running uvicorn
- Frontend: Check browser console
- Database: Check PostgreSQL logs

## Production Deployment

When ready to deploy to AWS:

```bash
cd infrastructure
./deploy.sh
```

See README.md for full deployment guide.

## Support

Questions? Check:
1. README.md - Full documentation
2. Backend API docs - http://localhost:8000/docs
3. Database schema - `database/schema.sql`

---

Happy building! 🚀
