from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from backend.database import get_db
from backend.models import User, UserRole, Assignment, Submission, Notification
from backend.utils import log_audit, get_current_user
import os
from datetime import datetime

router = APIRouter()

async def require_student(user: User = Depends(get_current_user)):
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Student access required")
    return user

@router.get("/assignments")
async def list_assignments(db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    if student.class_name:
        result = await db.execute(select(Assignment).where(Assignment.class_name == student.class_name))
        assignments = result.scalars().all()
    else:
        result = await db.execute(select(Assignment))
        assignments = result.scalars().all()
    return [{"id": a.id, "title": a.title, "description": a.description, "file_name": a.file_name, "file_type": a.file_type, "created_at": a.created_at} for a in assignments]

@router.get("/download/{assignment_id}")
async def download_assignment(assignment_id: int, db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    if student.class_name:
        result = await db.execute(select(Assignment).where(Assignment.id == assignment_id, Assignment.class_name == student.class_name))
    else:
        result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if not os.path.exists(assignment.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    log_audit(db, student.id, "DOWNLOAD_ASSIGNMENT", f"Downloaded {assignment.file_name}")
    return {"file_path": f"/uploads/{os.path.basename(assignment.file_path)}", "file_name": assignment.file_name}

@router.post("/submit/{assignment_id}")
async def submit_assignment(
    assignment_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_student)
):
    upload_dir = os.getenv('UPLOAD_DIR', './uploads')
    
    if student.class_name:
        result = await db.execute(select(Assignment).where(Assignment.id == assignment_id, Assignment.class_name == student.class_name))
    else:
        result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    result = await db.execute(select(Submission).where(Submission.student_id == student.id, Submission.assignment_id == assignment_id))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Already submitted")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"submission_{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")
    
    submission = Submission(
        student_id=student.id,
        assignment_id=assignment_id,
        file_path=file_path
    )
    db.add(submission)
    
    if assignment.teacher_id:
        notification = Notification(
            user_id=assignment.teacher_id,
            subject=f"New Submission: {student.full_name}",
            message=f"Student {student.full_name} submitted assignment: {assignment.title}"
        )
        db.add(notification)
    
    await db.commit()
    
    log_audit(db, student.id, "SUBMIT_ASSIGNMENT", f"Submitted for assignment {assignment_id}")
    return {"message": "Assignment submitted successfully"}

@router.get("/notifications")
async def list_notifications(db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    result = await db.execute(
        select(Notification).where(Notification.user_id == student.id).order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [{
        "id": n.id, "subject": n.subject, "message": n.message,
        "is_read": n.is_read, "created_at": n.created_at
    } for n in notifications]

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == student.id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}

@router.get("/progress")
async def view_progress(db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    total = await db.execute(select(Assignment).where(Assignment.class_name == student.class_name))
    total = len(total.scalars().all())
    
    submitted = await db.execute(select(Submission).where(Submission.student_id == student.id))
    submitted = len(submitted.scalars().all())
    
    graded = await db.execute(select(Submission).where(and_(Submission.student_id == student.id, Submission.grade != None)))
    graded = len(graded.scalars().all())
    
    return {
        "total_assignments": total,
        "submitted": submitted,
        "graded": graded,
        "pending": total - submitted,
        "progress_percentage": int((submitted / total) * 100) if total > 0 else 0
    }

@router.get("/submissions")
async def view_submissions(db: AsyncSession = Depends(get_db), student: User = Depends(require_student)):
    result = await db.execute(select(Submission).where(Submission.student_id == student.id))
    submissions = result.scalars().all()
    return [{"id": s.id, "assignment_title": s.assignment.title, "grade": s.grade, "feedback": s.feedback, "submitted_at": s.submitted_at} for s in submissions]
