import os
import sqlite3
import hashlib
import hmac
import base64
import json
import secrets
import logging
from datetime import datetime
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__, static_folder='frontend')
CORS(app)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
UPLOAD_DIR = os.getenv('UPLOAD_DIR', './uploads')
LOG_DIR = os.getenv('LOG_DIR', './logs')

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'{LOG_DIR}/app.log'),
        logging.StreamHandler()
    ]
)

def get_db():
    conn = sqlite3.connect('student_teacher.db')
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    return hashlib.sha256(password.encode()).hexdigest() == password_hash

def make_token(user):
    payload = base64.urlsafe_b64encode(json.dumps({'id': user['id'], 'email': user['email'], 'role': user['role']}).encode()).decode()
    sig = hmac.new(app.config['SECRET_KEY'].encode(), payload.encode(), hashlib.sha256).hexdigest()
    return payload + '.' + sig

def decode_token(token):
    if '.' not in token:
        return None
    payload, sig = token.split('.', 1)
    expected = hmac.new(app.config['SECRET_KEY'].encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    return json.loads(base64.urlsafe_b64decode(payload + '=='))

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        user = decode_token(token)
        if not user:
            return jsonify({'detail': 'Invalid token'}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.user['role'] not in allowed_roles:
                return jsonify({'detail': 'Access denied'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'student',
            is_active INTEGER DEFAULT 1,
            must_change_password INTEGER DEFAULT 0,
            class_name TEXT,
            program_id INTEGER,
            course_id INTEGER,
            student_id TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (program_id) REFERENCES programs(id),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS programs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            department TEXT,
            duration_months INTEGER DEFAULT 12
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            program_id INTEGER,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            credits INTEGER DEFAULT 3,
            FOREIGN KEY (program_id) REFERENCES programs(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            course_id INTEGER,
            enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT,
            instructor_id INTEGER,
            deadline TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id),
            FOREIGN KEY (instructor_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            assignment_id INTEGER,
            file_path TEXT,
            grade TEXT,
            feedback TEXT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (assignment_id) REFERENCES assignments(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subject TEXT NOT NULL,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    if cursor.fetchone()[0] == 0:
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@forestry.edu')
        admin_password = os.getenv('ADMIN_PASSWORD', 'Admin123!')
        password_hash = hash_password(admin_password)
        cursor.execute('''
            INSERT INTO users (email, full_name, password_hash, role, must_change_password)
            VALUES (?, ?, ?, 'admin', 0)
        ''', (admin_email, 'System Administrator', password_hash))
        logging.info(f'Default admin created: {admin_email}')
    
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "teacher"')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO users (email, full_name, password_hash, role, class_name, must_change_password)
            VALUES (?, ?, ?, 'teacher', ?, 0)
        ''', ('teacher@forestry.edu', 'Default Instructor', hash_password('Teacher123!'), 'BCF Year 1'))
        logging.info('Default teacher created: teacher@forestry.edu')
    
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "student"')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO users (email, full_name, password_hash, role, class_name, must_change_password)
            VALUES (?, ?, ?, 'student', ?, 0)
        ''', ('student@forestry.edu', 'Default Student', hash_password('Student123!'), 'BCF Year 1'))
        logging.info('Default student created: student@forestry.edu')
    
    cursor.execute('SELECT COUNT(*) FROM programs')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO programs (name, code, department, duration_months)
            VALUES (?, ?, ?, ?)
        ''', ('Basic Certificate in Forestry', 'BCF', 'Forestry', 6))
        cursor.execute('''
            INSERT INTO programs (name, code, department, duration_months)
            VALUES (?, ?, ?, ?)
        ''', ('Technician Certificate in Forestry', 'TCF', 'Forestry Technology', 12))
        cursor.execute('''
            INSERT INTO programs (name, code, department, duration_months)
            VALUES (?, ?, ?, ?)
        ''', ('Ordinary Diploma in Forest', 'ODF', 'Forestry', 24))
        logging.info('Default programs created')
    
    conn.commit()
    conn.close()

init_db()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    requested_role = data.get('role')
    
    if not requested_role:
        return jsonify({'detail': 'Login type not specified'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', (email,))
    user = cursor.fetchone()
    
    if not user or not verify_password(password, user['password_hash']):
        conn.close()
        return jsonify({'detail': 'Invalid credentials'}), 401
    
    if user['role'] != requested_role:
        conn.close()
        return jsonify({'detail': f'This account is not registered as a {requested_role}. Please use the correct login page.'}), 403
    
    token = make_token(user)
    
    conn.close()
    return jsonify({
        'access_token': token,
        'token_type': 'bearer',
        'role': user['role'],
        'must_change_password': bool(user['must_change_password'])
    })

@app.route('/api/programs', methods=['GET'])
def get_programs_public():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM programs ORDER BY name')
    programs = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': p['id'], 'name': p['name'], 'code': p['code'],
        'department': p['department']
    } for p in programs])

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    role = data.get('role', 'student')
    program_id = data.get('program_id')
    program_name = data.get('program_name')
    
    if not email or not full_name or not password:
        return jsonify({'detail': 'Missing required fields'}), 400
    
    password_hash = hash_password(password)
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        if program_name and not program_id:
            cursor.execute('SELECT id FROM programs WHERE name = ? OR code = ?', (program_name, program_name))
            program = cursor.fetchone()
            if program:
                program_id = program['id']
            else:
                cursor.execute('''
                    INSERT INTO programs (name, code, department)
                    VALUES (?, ?, ?)
                ''', (program_name, program_name[:10].upper(), 'General'))
                program_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO users (email, full_name, password_hash, role, program_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (email, full_name, password_hash, role, program_id))
        conn.commit()
        logging.info(f'New user registered: {email} with role {role}')
        return jsonify({'message': 'Registration successful'})
    except sqlite3.IntegrityError:
        return jsonify({'detail': 'Email already exists'}), 400
    finally:
        conn.close()

@app.route('/api/auth/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({'detail': 'Missing password fields'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (request.user['id'],))
    user = cursor.fetchone()
    
    if not user or not verify_password(old_password, user['password_hash']):
        conn.close()
        return jsonify({'detail': 'Invalid old password'}), 400
    
    new_hash = hash_password(new_password)
    cursor.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', 
                   (new_hash, request.user['id']))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Password changed successfully'})

@app.route('/api/admin/audit-logs', methods=['GET'])
@login_required
@role_required('admin')
def get_audit_logs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT al.*, u.email as user_email FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.timestamp DESC
        LIMIT 500
    ''')
    logs = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': log['id'], 'timestamp': log['timestamp'], 'action': log['action'],
        'details': log['details'], 'user_email': log['user_email']
    } for log in logs])

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
@role_required('admin')
def admin_dashboard():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
    students = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'teacher'")
    teachers = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM courses")
    courses = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM assignments")
    assignments = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM submissions")
    submissions = cursor.fetchone()[0]
    
    conn.close()
    return jsonify({
        'total_students': students,
        'total_teachers': teachers,
        'total_courses': courses,
        'total_assignments': assignments,
        'total_submissions': submissions
    })

@app.route('/api/instructor/dashboard', methods=['GET'])
@login_required
@role_required('teacher')
def instructor_dashboard():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT COUNT(*) FROM courses c
        JOIN users u ON u.id = ?
        WHERE c.program_id = u.program_id OR c.id = u.course_id
    ''', (request.user['id'],))
    courses = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM assignments WHERE instructor_id = ?', (request.user['id'],))
    assignments = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT COUNT(*) FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE a.instructor_id = ? AND s.grade IS NULL
    ''', (request.user['id'],))
    pending = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT a.*, c.title as course_title FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.instructor_id = ?
        ORDER BY a.created_at DESC LIMIT 5
    ''', (request.user['id'],))
    recent = cursor.fetchall()
    
    conn.close()
    return jsonify({
        'total_courses': courses,
        'total_assignments': assignments,
        'pending_submissions': pending,
        'recent_assignments': [{
            'title': a['title'], 'course_title': a['course_title'], 'created_at': a['created_at']
        } for a in recent]
    })

@app.route('/api/admin/users', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_users():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        role = request.args.get('role')
        if role:
            cursor.execute('SELECT * FROM users WHERE role = ?', (role,))
        else:
            cursor.execute('SELECT * FROM users')
        users = cursor.fetchall()
        conn.close()
        return jsonify([{
            'id': u['id'], 'email': u['email'], 'full_name': u['full_name'],
            'role': u['role'], 'is_active': bool(u['is_active']), 'class_name': u['class_name']
        } for u in users])
    
    data = request.json
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    role = data.get('role', 'teacher')
    class_name = data.get('class_name', '')
    
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'detail': 'Email already exists'}), 400
    
    password_hash = hash_password(password)
    cursor.execute('''
        INSERT INTO users (email, full_name, password_hash, role, class_name)
        VALUES (?, ?, ?, ?, ?)
    ''', (email, full_name, password_hash, role, class_name))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User created successfully'})

@app.route('/api/admin/users/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
@role_required('admin')
def manage_user(user_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'detail': 'User not found'}), 404
    
    if request.method == 'PUT':
        data = request.json
        is_active = data.get('is_active')
        if is_active is not None:
            cursor.execute('UPDATE users SET is_active = ? WHERE id = ?', 
                           (1 if is_active else 0, user_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User updated successfully'})
    
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User deleted successfully'})

@app.route('/api/instructor/courses', methods=['GET'])
@login_required
@role_required('teacher')
def instructor_courses():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT c.*, p.name as program_name, p.code as program_code 
        FROM courses c
        LEFT JOIN programs p ON c.program_id = p.id
        WHERE c.program_id IN (
            SELECT program_id FROM users WHERE id = ? AND program_id IS NOT NULL
        )
        OR c.id IN (
            SELECT course_id FROM users WHERE id = ? AND course_id IS NOT NULL
        )
    ''', (request.user['id'], request.user['id']))
    courses = cursor.fetchall()
    conn.close()
    
    return jsonify([{
        'id': c['id'], 'code': c['code'], 'title': c['title'],
        'description': c['description'], 'credits': c['credits'],
        'program_name': c['program_name'], 'program_code': c['program_code']
    } for c in courses])

@app.route('/api/instructor/assignments', methods=['GET', 'POST'])
@login_required
@role_required('teacher', 'admin')
def instructor_assignments():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT a.*, c.title as course_title FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.instructor_id = ?', (request.user['id'],))
        assignments = cursor.fetchall()
        conn.close()
        return jsonify([{
            'id': a['id'], 'title': a['title'], 'course_title': a['course_title'],
            'file_name': a['file_name'], 'created_at': a['created_at']
        } for a in assignments])
    
    title = request.form.get('title')
    course_name = request.form.get('course_name')
    description = request.form.get('description', '')
    file = request.files.get('file')
    deadline = request.form.get('deadline', None)
    
    if not file or not title or not course_name:
        conn.close()
        return jsonify({'detail': 'Missing required fields'}), 400
    
    allowed_extensions = {'.pdf', '.docx', '.xlsx', '.doc', '.xls'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        conn.close()
        return jsonify({'detail': 'File type not allowed'}), 400
    
    cursor.execute('SELECT id FROM courses WHERE title = ?', (course_name,))
    course = cursor.fetchone()
    if course:
        course_id = course['id']
    else:
        cursor.execute('''
            INSERT INTO courses (program_id, code, title, description)
            VALUES (?, ?, ?, ?)
        ''', (None, course_name[:10].upper(), course_name, ''))
        course_id = cursor.lastrowid
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    file.save(file_path)
    
    cursor.execute('''
        INSERT INTO assignments (course_id, title, description, file_path, file_name, file_type, instructor_id, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (course_id, title, description, file_path, file.filename, ext, request.user['id'], deadline))
    
    cursor.execute('''
        SELECT e.student_id, u.email, u.full_name FROM enrollments e 
        JOIN users u ON e.student_id = u.id 
        WHERE e.course_id = ? AND e.status = 'active'
    ''', (course_id,))
    students = cursor.fetchall()
    
    for student in students:
        cursor.execute('''
            INSERT INTO notifications (user_id, subject, message)
            VALUES (?, ?, ?)
        ''', (student['student_id'], f'New Assignment: {title}', 
                 f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Assignment uploaded successfully. Notified {len(students)} students.'})

@app.route('/api/teacher/assignments', methods=['POST'])
@login_required
@role_required('teacher', 'admin')
def teacher_upload_assignment():
    conn = get_db()
    cursor = conn.cursor()
    
    title = request.form.get('title')
    class_name = request.form.get('class_name')
    description = request.form.get('description', '')
    file = request.files.get('file')
    deadline = request.form.get('deadline', None)
    
    if not file or not title or not class_name:
        conn.close()
        return jsonify({'detail': 'Missing required fields'}), 400
    
    allowed_extensions = {'.pdf', '.docx', '.xlsx', '.doc', '.xls'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        conn.close()
        return jsonify({'detail': 'File type not allowed'}), 400
    
    # Find or create the course
    cursor.execute('SELECT id FROM courses WHERE title = ?', (class_name,))
    course = cursor.fetchone()
    if course:
        course_id = course['id']
    else:
        cursor.execute('''
            INSERT INTO courses (program_id, code, title, description)
            VALUES (?, ?, ?, ?)
        ''', (None, class_name[:10].upper(), class_name, ''))
        course_id = cursor.lastrowid
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    file.save(file_path)
    
    cursor.execute('''
        INSERT INTO assignments (course_id, title, description, file_path, file_name, file_type, instructor_id, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (course_id, title, description, file_path, file.filename, ext, request.user['id'], deadline))
    
    cursor.execute('''
        SELECT e.student_id, u.full_name FROM enrollments e
        JOIN users u ON e.student_id = u.id
        WHERE e.course_id = ? AND e.status = 'active'
    ''', (course_id,))
    enrolled = cursor.fetchall()
    
    cursor.execute('''
        SELECT id, full_name FROM users
        WHERE role = 'student' AND class_name = ? AND is_active = 1
    ''', (class_name,))
    by_class = cursor.fetchall()
    
    notified = set()
    for student in enrolled:
        notified.add(student['student_id'])
        cursor.execute('''
            INSERT INTO notifications (user_id, subject, message)
            VALUES (?, ?, ?)
        ''', (student['student_id'], f'New Assignment: {title}',
                 f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'))
    
    for student in by_class:
        if student['id'] not in notified:
            cursor.execute('''
                INSERT INTO notifications (user_id, subject, message)
                VALUES (?, ?, ?)
            ''', (student['id'], f'New Assignment: {title}',
                     f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Assignment uploaded successfully. Notified {len(notified)} students.'})

@app.route('/api/teacher/assignments', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_list_assignments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, c.title as class_name FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.instructor_id = ?
        ORDER BY a.created_at DESC
    ''', (request.user['id'],))
    assignments = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': a['id'], 'title': a['title'], 'class_name': a['class_name'],
        'file_name': a['file_name'], 'created_at': a['created_at']
    } for a in assignments])

@app.route('/api/teacher/submissions/download/<int:submission_id>', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_download_submission(submission_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, a.instructor_id FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.id = ? AND a.instructor_id = ?
    ''', (submission_id, request.user['id']))
    submission = cursor.fetchone()
    conn.close()
    
    if not submission:
        return jsonify({'detail': 'Submission not found or access denied'}), 404
    
    if not os.path.exists(submission['file_path']):
        return jsonify({'detail': 'File not found'}), 404
    
    return send_file(submission['file_path'], download_name=os.path.basename(submission['file_path']), as_attachment=True)

@app.route('/api/teacher/submissions/<int:assignment_id>', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_view_submissions(assignment_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT instructor_id FROM assignments WHERE id = ?', (assignment_id,))
    assignment = cursor.fetchone()
    if not assignment or assignment['instructor_id'] != request.user['id']:
        conn.close()
        return jsonify({'detail': 'Assignment not found or access denied'}), 404

    cursor.execute('''
        SELECT s.*, u.full_name as student_name FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.assignment_id = ?
    ''', (assignment_id,))
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': s['id'], 'student_name': s['student_name'],
        'grade': s['grade'], 'feedback': s['feedback'],
        'submitted_at': s['submitted_at']
    } for s in submissions])

@app.route('/api/teacher/submissions/<int:submission_id>/grade', methods=['POST'])
@login_required
@role_required('teacher', 'admin')
def teacher_grade_submission(submission_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT s.*, a.instructor_id, a.title FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.id = ?
    ''', (submission_id,))
    submission = cursor.fetchone()

    if not submission or submission['instructor_id'] != request.user['id']:
        conn.close()
        return jsonify({'detail': 'Submission not found or access denied'}), 404

    data = request.json
    grade = data.get('grade')
    feedback = data.get('feedback', '')

    cursor.execute('UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?',
                   (grade, feedback, submission_id))

    cursor.execute('SELECT student_id FROM submissions WHERE id = ?', (submission_id,))
    student_id = cursor.fetchone()['student_id']
    cursor.execute('''
        INSERT INTO notifications (user_id, subject, message)
        VALUES (?, ?, ?)
    ''', (student_id, f'Grade Received', f'You received grade: {grade}. Feedback: {feedback or "No feedback"}'))

    conn.commit()
    conn.close()
    return jsonify({'message': 'Grade submitted successfully'})

@app.route('/api/teacher/students', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_list_students():
    class_name = request.args.get('class_name', '')
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT id, email, full_name, class_name FROM users WHERE role = 'student'"
    params = []
    if class_name:
        query += " AND class_name = ?"
        params.append(class_name)

    cursor.execute(query, params)
    students = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': s['id'], 'email': s['email'],
        'full_name': s['full_name'], 'class_name': s['class_name']
    } for s in students])

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
@login_required
@role_required('teacher', 'admin')
def teacher_delete_assignment_alt(assignment_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM assignments WHERE id = ? AND instructor_id = ?',
                   (assignment_id, request.user['id']))
    assignment = cursor.fetchone()

    if not assignment:
        conn.close()
        return jsonify({'detail': 'Assignment not found or access denied'}), 404

    if os.path.exists(assignment['file_path']):
        os.remove(assignment['file_path'])

    cursor.execute('DELETE FROM submissions WHERE assignment_id = ?', (assignment_id,))
    cursor.execute('DELETE FROM assignments WHERE id = ?', (assignment_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Assignment deleted successfully'})

@app.route('/api/teacher/assignments/<int:assignment_id>', methods=['DELETE'])
@login_required
@role_required('teacher', 'admin')
def delete_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM assignments WHERE id = ? AND instructor_id = ?', 
                   (assignment_id, request.user['id']))
    assignment = cursor.fetchone()
    
    if not assignment:
        conn.close()
        return jsonify({'detail': 'Assignment not found or access denied'}), 404
    
    if os.path.exists(assignment['file_path']):
        os.remove(assignment['file_path'])
    
    cursor.execute('DELETE FROM submissions WHERE assignment_id = ?', (assignment_id,))
    cursor.execute('DELETE FROM assignments WHERE id = ?', (assignment_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Assignment deleted successfully'})

@app.route('/api/instructor/submissions', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def get_submissions():
    conn = get_db()
    cursor = conn.cursor()
    
    assignment_id = request.args.get('assignment_id')
    course_id = request.args.get('course_id')
    
    if assignment_id:
        cursor.execute('''
            SELECT s.*, u.full_name as student_name, a.title as assignment_title, c.title as course_title 
            FROM submissions s 
            JOIN users u ON s.student_id = u.id 
            JOIN assignments a ON s.assignment_id = a.id
            JOIN courses c ON a.course_id = c.id
            WHERE s.assignment_id = ?
        ''', (assignment_id,))
    elif course_id:
        cursor.execute('''
            SELECT s.*, u.full_name as student_name, a.title as assignment_title, c.title as course_title 
            FROM submissions s 
            JOIN users u ON s.student_id = u.id 
            JOIN assignments a ON s.assignment_id = a.id
            JOIN courses c ON a.course_id = c.id
            WHERE a.course_id = ?
        ''', (course_id,))
    else:
        cursor.execute('''
            SELECT s.*, u.full_name as student_name, a.title as assignment_title, c.title as course_title 
            FROM submissions s 
            JOIN users u ON s.student_id = u.id 
            JOIN assignments a ON s.assignment_id = a.id
            JOIN courses c ON a.course_id = c.id
            WHERE a.instructor_id = ?
        ''', (request.user['id'],))
    
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': s['id'], 'student_name': s['student_name'],
        'assignment_title': s['assignment_title'], 'course_title': s['course_title'],
        'grade': s['grade'], 'feedback': s['feedback'],
        'submitted_at': s['submitted_at']
    } for s in submissions])

@app.route('/api/instructor/submissions/<int:submission_id>/grade', methods=['POST'])
@login_required
@role_required('teacher', 'admin')
def grade_submission(submission_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.*, a.instructor_id, a.title, a.course_id 
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        WHERE s.id = ?
    ''', (submission_id,))
    submission = cursor.fetchone()
    
    if not submission or submission['instructor_id'] != request.user['id']:
        conn.close()
        return jsonify({'detail': 'Submission not found or access denied'}), 404
    
    data = request.json
    grade = data.get('grade')
    feedback = data.get('feedback', '')
    
    cursor.execute('UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?', 
                   (grade, feedback, submission_id))
    
    cursor.execute('SELECT student_id FROM submissions WHERE id = ?', (submission_id,))
    student_id = cursor.fetchone()['student_id']
    
    cursor.execute('''
        INSERT INTO notifications (user_id, subject, message)
        VALUES (?, ?, ?)
    ''', (student_id, 
             f'Grade Received: {submission["title"]}',
             f'You received grade: {grade}. Feedback: {feedback or "No feedback"}'))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Grade submitted successfully'})

@app.route('/api/admin/programs', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_programs():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT * FROM programs ORDER BY name')
        programs = cursor.fetchall()
        conn.close()
        return jsonify([{
            'id': p['id'], 'name': p['name'], 'code': p['code'],
            'department': p['department'], 'duration_months': p['duration_months']
        } for p in programs])
    
    data = request.json
    cursor.execute('''
        INSERT INTO programs (name, code, department, duration_months)
        VALUES (?, ?, ?, ?)
    ''', (data.get('name'), data.get('code'), data.get('department', ''), data.get('duration_months', 12)))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Program created successfully'})

@app.route('/api/admin/courses', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_courses():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT c.*, p.name as program_name FROM courses c LEFT JOIN programs p ON c.program_id = p.id')
        courses = cursor.fetchall()
        conn.close()
        return jsonify([{
            'id': c['id'], 'code': c['code'], 'title': c['title'],
            'program_name': c['program_name'], 'credits': c['credits']
        } for c in courses])
    
    data = request.json
    cursor.execute('''
        INSERT INTO courses (program_id, code, title, description, credits)
        VALUES (?, ?, ?, ?, ?)
    ''', (data.get('program_id'), data.get('code'), data.get('title'), 
             data.get('description', ''), data.get('credits', 3)))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Course created successfully'})

@app.route('/api/student/gpa', methods=['GET'])
@login_required
@role_required('student')
def student_gpa():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.grade, c.credits FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE s.student_id = ? AND s.grade IS NOT NULL
    ''', (request.user['id'],))
    grades = cursor.fetchall()
    conn.close()
    
    if not grades:
        return jsonify({'gpa': None, 'message': 'No graded submissions yet'})
    
    grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
    total_points = 0
    total_credits = 0
    
    for g in grades:
        if g['grade'] in grade_points:
            total_points += grade_points[g['grade']] * g['credits']
            total_credits += g['credits']
    
    gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0
    return jsonify({'gpa': gpa, 'total_credits': total_credits})

@app.route('/api/student/enroll', methods=['POST'])
@login_required
@role_required('student')
def enroll_course():
    data = request.json
    course_id = data.get('course_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO enrollments (student_id, course_id, status)
            VALUES (?, ?, 'active')
        ''', (request.user['id'], course_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Enrolled successfully'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Already enrolled in this course'}), 400

@app.route('/api/student/notifications', methods=['GET'])
@login_required
@role_required('student')
def get_notifications():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', (request.user['id'],))
    notifications = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': n['id'], 'subject': n['subject'], 'message': n['message'],
        'is_read': bool(n['is_read']), 'created_at': n['created_at']
    } for n in notifications])

@app.route('/api/student/notifications/<int:notification_id>/read', methods=['PUT'])
@login_required
@role_required('student')
def mark_notification_read(notification_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', 
                   (notification_id, request.user['id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Notification marked as read'})

@app.route('/api/student/assignments', methods=['GET'])
@login_required
@role_required('student')
def student_list_assignments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    student_class = (student['class_name'] or '') if student else ''

    cursor.execute('''
        SELECT DISTINCT a.*, c.title as course_title FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.course_id IN (
            SELECT course_id FROM enrollments
            WHERE student_id = ? AND status = 'active'
        )
        OR (? != '' AND c.title = ?)
        ORDER BY a.created_at DESC
    ''', (request.user['id'], student_class, student_class))
    assignments = cursor.fetchall()

    if not assignments:
        cursor.execute('''
            SELECT a.*, c.title as course_title FROM assignments a
            JOIN courses c ON a.course_id = c.id
            ORDER BY a.created_at DESC
        ''')
        assignments = cursor.fetchall()

    conn.close()
    now = datetime.now()
    active = []
    for a in assignments:
        dl = a['deadline']
        if dl:
            try:
                dl_dt = datetime.strptime(dl, '%Y-%m-%dT%H:%M')
            except ValueError:
                try:
                    dl_dt = datetime.strptime(dl, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    dl_dt = None
            if dl_dt and dl_dt < now:
                continue
        active.append({
            'id': a['id'], 'title': a['title'], 'description': a['description'],
            'file_name': a['file_name'], 'file_type': a['file_type'],
            'course_title': a['course_title'],
            'created_at': a['created_at'], 'deadline': a['deadline']
        })
    return jsonify(active)

@app.route('/api/student/download/<int:assignment_id>', methods=['GET'])
@login_required
@role_required('student')
def download_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    student_class = (student['class_name'] or '') if student else ''
    
    cursor.execute('''
        SELECT a.* FROM assignments a
        LEFT JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ? AND e.status = 'active'
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.id = ? AND (e.id IS NOT NULL OR (? != '' AND c.title = ?))
    ''', (request.user['id'], assignment_id, student_class, student_class))
    assignment = cursor.fetchone()

    if not assignment:
        cursor.execute('SELECT * FROM assignments WHERE id = ?', (assignment_id,))
        assignment = cursor.fetchone()
    
    conn.close()
    
    if not assignment:
        return jsonify({'detail': 'Assignment not found or access denied'}), 404
    
    return send_file(assignment['file_path'], download_name=assignment['file_name'], as_attachment=True)

@app.route('/api/student/submit/<int:assignment_id>', methods=['POST'])
@login_required
@role_required('student')
def submit_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    student_class = (student['class_name'] or '') if student else ''
    
    cursor.execute('''
        SELECT a.*, c.id as course_id, c.title as class_title FROM assignments a 
        JOIN courses c ON a.course_id = c.id
        WHERE a.id = ?
    ''', (assignment_id,))
    assignment = cursor.fetchone()
    
    if not assignment:
        conn.close()
        return jsonify({'detail': 'Assignment not found'}), 404
    
    cursor.execute('''
        SELECT e.* FROM enrollments e 
        WHERE e.student_id = ? AND e.course_id = ? AND e.status = 'active'
    ''', (request.user['id'], assignment['course_id']))
    enrolled = cursor.fetchone()
    if not enrolled and student_class != '' and assignment['class_title'] != student_class:
        cursor.execute('SELECT COUNT(*) as cnt FROM enrollments')
        if cursor.fetchone()['cnt'] > 0:
            conn.close()
            return jsonify({'detail': 'Not enrolled in this course'}), 403
    
    if assignment['deadline']:
        try:
            deadline = datetime.strptime(assignment['deadline'], '%Y-%m-%dT%H:%M')
        except ValueError:
            deadline = datetime.strptime(assignment['deadline'], '%Y-%m-%d %H:%M:%S')
        if datetime.now() > deadline:
            conn.close()
            return jsonify({'detail': 'Submission deadline has passed'}), 403
    
    if 'file' not in request.files:
        conn.close()
        return jsonify({'detail': 'No file provided'}), 400
    
    file = request.files['file']
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"submission_{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    file.save(file_path)
    
    cursor.execute('''
        INSERT INTO submissions (student_id, assignment_id, file_path)
        VALUES (?, ?, ?)
    ''', (request.user['id'], assignment_id, file_path))
    
    cursor.execute('SELECT instructor_id FROM assignments WHERE id = ?', (assignment_id,))
    instructor = cursor.fetchone()
    cursor.execute('SELECT full_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    
    if instructor:
        cursor.execute('''
            INSERT INTO notifications (user_id, subject, message)
            VALUES (?, ?, ?)
        ''', (instructor['instructor_id'], 
                 f"New Submission: {student['full_name']}",
                 f"Student {student['full_name']} submitted assignment: {assignment['title']}"))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Assignment submitted successfully'})

@app.route('/api/student/export-data', methods=['GET'])
@login_required
@role_required('student')
def export_student_data():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE id = ?', (request.user['id'],))
    user = cursor.fetchone()
    
    cursor.execute('''
        SELECT a.*, c.title as course_title FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON e.course_id = c.id
        WHERE e.student_id = ? AND e.status = 'active'
    ''', (request.user['id'],))
    assignments = cursor.fetchall()
    
    cursor.execute('''
        SELECT s.*, a.title as assignment_title FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.student_id = ?
    ''', (request.user['id'],))
    submissions = cursor.fetchall()
    
    cursor.execute('SELECT * FROM notifications WHERE user_id = ?', (request.user['id'],))
    notifications = cursor.fetchall()
    
    conn.close()
    
    export_data = {
        'user_info': {
            'email': user['email'], 'full_name': user['full_name'], 
            'role': user['role'], 'created_at': user['created_at']
        },
        'assignments': [dict(a) for a in assignments],
        'submissions': [dict(s) for s in submissions],
        'notifications': [dict(n) for n in notifications]
    }
    
    return jsonify(export_data)

@app.route('/api/student/progress', methods=['GET'])
@login_required
@role_required('student')
def student_progress():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()

    cursor.execute('SELECT COUNT(*) FROM assignments a JOIN courses c ON a.course_id = c.id WHERE c.title = ?',
                   (student['class_name'],))
    total = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM submissions WHERE student_id = ?', (request.user['id'],))
    submitted = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM submissions WHERE student_id = ? AND grade IS NOT NULL',
                   (request.user['id'],))
    graded = cursor.fetchone()[0]

    conn.close()
    return jsonify({
        'total_assignments': total,
        'submitted': submitted,
        'graded': graded,
        'pending': total - submitted,
        'progress_percentage': int((submitted / total) * 100) if total > 0 else 0
    })

@app.route('/api/student/submissions', methods=['GET'])
@login_required
@role_required('student')
def student_list_submissions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, a.title as assignment_title FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.student_id = ?
        ORDER BY s.submitted_at DESC
    ''', (request.user['id'],))
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': s['id'], 'assignment_title': s['assignment_title'],
        'grade': s['grade'], 'feedback': s['feedback'],
        'submitted_at': s['submitted_at']
    } for s in submissions])

@app.route('/api/notifications', methods=['GET'])
@login_required
def notifications_redirect():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', (request.user['id'],))
    notifications = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': n['id'], 'subject': n['subject'], 'message': n['message'],
        'is_read': bool(n['is_read']), 'created_at': n['created_at']
    } for n in notifications])

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'System is operational'})

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('api/'):
        return jsonify({'detail': 'API endpoint not found'}), 404
    if os.path.exists(os.path.join(app.static_folder, filename)):
        return app.send_static_file(filename)
    return app.send_static_file('index.html')

if __name__ == '__main__':
    logging.info('Starting application')
    app.run(debug=True, host='0.0.0.0', port=5000)
