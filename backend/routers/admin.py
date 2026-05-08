from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from backend.database import get_db
from backend.models import User, UserRole, AuditLog, Assignment, Submission
from backend.utils import log_audit, get_current_user
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

router = APIRouter()

class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str
    class_name: str = None

class UserUpdateRequest(BaseModel):
    full_name: str = None
    is_active: bool = None
    class_name: str = None

async def require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    students = await db.execute(select(func.count()).select_from(User).where(User.role == UserRole.STUDENT))
    teachers = await db.execute(select(func.count()).select_from(User).where(User.role == UserRole.TEACHER))
    assignments = await db.execute(select(func.count()).select_from(Assignment))
    submissions = await db.execute(select(func.count()).select_from(Submission))
    
    return {
        "total_students": students.scalar(),
        "total_teachers": teachers.scalar(),
        "total_assignments": assignments.scalar(),
        "total_submissions": submissions.scalar()
    }

@router.get("/users")
async def list_users(role: str = None, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query)
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active, "class_name": u.class_name} for u in users]

@router.post("/users")
async def create_user(request: UserCreateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    from backend.utils import get_password_hash
    
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    role = UserRole.TEACHER if request.role == "teacher" else UserRole.STUDENT
    user = User(
        email=request.email,
        full_name=request.full_name,
        hashed_password=get_password_hash(request.password),
        role=role,
        class_name=request.class_name
    )
    db.add(user)
    await db.commit()
    
    log_audit(db, admin.id, "CREATE_USER", f"Created user {request.email} with role {request.role}")
    return {"message": "User created successfully"}

@router.put("/users/{user_id}")
async def update_user(user_id: int, request: UserUpdateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.full_name is not None:
        user.full_name = request.full_name
    if request.is_active is not None:
        user.is_active = request.is_active
    if request.class_name is not None:
        user.class_name = request.class_name
    
    await db.commit()
    log_audit(db, admin.id, "UPDATE_USER", f"Updated user {user.email}")
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
    log_audit(db, admin.id, "DELETE_USER", f"Deleted user {user.email}")
    return {"message": "User deleted successfully"}

@router.get("/audit-logs")
async def audit_logs(limit: int = 100, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit))
    logs = result.scalars().all()
    return [{"id": l.id, "user_id": l.user_id, "action": l.action, "details": l.details, "timestamp": l.timestamp} for l in logs]
