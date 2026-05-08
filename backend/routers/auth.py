from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import User, UserRole
from backend.utils import verify_password, get_password_hash, create_access_token, log_audit
from pydantic import BaseModel, EmailStr
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
security = HTTPBearer()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = None

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    class_name: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    must_change_password: bool

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    from jose import JWTError, jwt
    from backend.utils import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.hashed_password):
        log_audit(db, user.id if user else None, "LOGIN_FAILED", f"Failed login for {request.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    if request.role and user.role != request.role:
        raise HTTPException(status_code=403, detail=f"This account is not registered as a {request.role}. Please use the correct login page.")
    
    token = create_access_token({"sub": user.email, "role": user.role})
    log_audit(db, user.id, "LOGIN", f"User logged in")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "must_change_password": user.must_change_password
    }

@router.post("/register")
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=request.email,
        full_name=request.full_name,
        hashed_password=get_password_hash(request.password),
        role=UserRole.STUDENT,
        class_name=request.class_name,
        is_active=True
    )
    db.add(user)
    await db.commit()
    
    log_audit(db, user.id, "REGISTER", f"Student registered: {request.email}")
    return {"message": "Registration successful. You can now login."}

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid old password")
    
    current_user.hashed_password = get_password_hash(request.new_password)
    current_user.must_change_password = False
    await db.commit()
    
    log_audit(db, current_user.id, "PASSWORD_CHANGE", "Password changed")
    return {"message": "Password changed successfully"}
