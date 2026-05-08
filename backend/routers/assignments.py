from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Assignment, User, UserRole
from backend.utils import get_current_user

router = APIRouter()

@router.get("/all")
async def list_all_assignments(class_name: str = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Assignment)
    if class_name:
        query = query.where(Assignment.class_name == class_name)
    if user.role == UserRole.TEACHER:
        query = query.where(Assignment.teacher_id == user.id)
    result = await db.execute(query)
    assignments = result.scalars().all()
    return [{"id": a.id, "title": a.title, "file_name": a.file_name, "class_name": a.class_name, "teacher": a.teacher.full_name, "created_at": a.created_at} for a in assignments]

@router.get("/{assignment_id}")
async def get_assignment(assignment_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if user.role == UserRole.STUDENT and assignment.class_name != user.class_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": assignment.id,
        "title": assignment.title,
        "description": assignment.description,
        "file_name": assignment.file_name,
        "file_type": assignment.file_type,
        "class_name": assignment.class_name,
        "teacher": assignment.teacher.full_name,
        "created_at": assignment.created_at
    }

@router.delete("/{assignment_id}")
async def delete_assignment(assignment_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    import os
    from backend.models import Submission
    
    if user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if user.role == UserRole.TEACHER and assignment.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if os.path.exists(assignment.file_path):
        os.remove(assignment.file_path)
    
    await db.delete(assignment)
    await db.commit()
    
    from backend.utils import log_audit
    log_audit(db, user.id, "DELETE_ASSIGNMENT", f"Deleted assignment {assignment.title}")
    return {"message": "Assignment deleted successfully"}
