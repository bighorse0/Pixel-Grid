from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from ..database import get_db
from ..models import Admin, AdminAction
from ..schemas import AdminLogin, AdminToken, AdminResponse
from ..auth import verify_password, create_access_token, get_current_admin, get_password_hash
from ..config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


@router.post("/login", response_model=AdminToken)
async def login(credentials: AdminLogin, db: Session = Depends(get_db)):
    """
    Admin login endpoint - HIDDEN, no public signup
    Only accessible via direct URL (/admin/login)
    """
    admin = db.query(Admin).filter(Admin.email == credentials.email).first()

    if not admin or not verify_password(credentials.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login
    admin.last_login = db.query(Admin).filter(Admin.id == admin.id).first().last_login
    db.commit()

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": admin.email, "role": admin.role},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=AdminResponse)
async def get_current_admin_info(admin: Admin = Depends(get_current_admin)):
    """Get current admin user info"""
    return admin


@router.get("/actions")
async def get_admin_actions(
    skip: int = 0,
    limit: int = 50,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get admin action history (audit log)"""
    actions = db.query(AdminAction).order_by(AdminAction.created_at.desc()).offset(skip).limit(limit).all()
    return actions
