from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database import get_db
from backend.models import User, UserRole, Assignment, Submission, Notification
from backend.utils import log_audit, get_current_user, validate_file_type
import os
from datetime import datetime

router = APIRouter()

async def require_teacher(user: User = Depends(get_current_user)):
    if user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user

@router.get("/assignments")
async def list_teacher_assignments(db: AsyncSession = Depends(get_db), teacher: User = Depends(require_teacher)):
    result = await db.execute(select(Assignment).where(Assignment.teacher_id == teacher.id))
    assignments = result.scalars().all()
    return [{"id": a.id, "title": a.title, "class_name": a.class_name, "file_name": a.file_name, "created_at": a.created_at} for a in assignments]

@router.post("/assignments")
async def upload_assignment(
    title: str,
    class_name: str,
    description: str = None,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher)
):
    upload_dir = os.getenv('UPLOAD_DIR', './uploads')
    ext = validate_file_type(file.filename)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
    
    assignment = Assignment(
        title=title,
        description=description,
        file_path=file_path,
        file_name=file.filename,
        file_type=ext,
        class_name=class_name,
        teacher_id=teacher.id
    )
    db.add(assignment)
    await db.commit()
    
    result = await db.execute(select(User).where(User.role == UserRole.STUDENT, User.class_name == class_name, User.is_active == True))
    students = result.scalars().all()
    
    for student in students:
        notification = Notification(
            user_id=student.id,
            subject=f'New Assignment: {title}',
            message=f'A new assignment "{title}" has been posted. Submit before: No deadline'
        )
        db.add(notification)
    await db.commit()
    
    log_audit(db, teacher.id, "UPLOAD_ASSIGNMENT", f"Uploaded {file.filename} for {class_name}")
    return {"message": f"Assignment uploaded successfully. Notified {len(students)} students.", "id": assignment.id}

@router.get("/students")
async def list_students(class_name: str = None, db: AsyncSession = Depends(get_db), teacher: User = Depends(require_teacher)):
    query = select(User).where(User.role == UserRole.STUDENT)
    if class_name:
        query = query.where(User.class_name == class_name)
    result = await db.execute(query)
    students = result.scalars().all()
    return [{"id": s.id, "email": s.email, "full_name": s.full_name, "class_name": s.class_name} for s in students]

@router.get("/submissions/{assignment_id}")
async def view_submissions(assignment_id: int, db: AsyncSession = Depends(get_db), teacher: User = Depends(require_teacher)):
    assignment = await db.execute(select(Assignment).where(Assignment.id == assignment_id, Assignment.teacher_id == teacher.id))
    assignment = assignment.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    result = await db.execute(select(Submission).where(Submission.assignment_id == assignment_id))
    submissions = result.scalars().all()
    return [{"id": s.id, "student_name": s.student.full_name, "grade": s.grade, "feedback": s.feedback, "submitted_at": s.submitted_at} for s in submissions]

@router.post("/grade/{submission_id}")
async def grade_submission(submission_id: int, grade: str, feedback: str = None, db: AsyncSession = Depends(get_db), teacher: User = Depends(require_teacher)):
    from backend.models import Submission
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission.grade = grade
    submission.feedback = feedback
    
    notification = Notification(
        user_id=submission.student_id,
        subject='Grade Received',
        message=f'You received grade: {grade}. Feedback: {feedback or "No feedback"}'
    )
    db.add(notification)
    
    await db.commit()
    
    log_audit(db, teacher.id, "GRADE_SUBMISSION", f"Graded submission {submission_id} with {grade}")
    return {"message": "Submission graded successfully"}
