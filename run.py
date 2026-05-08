import os
import sqlite3
import hashlib
import secrets
import logging
from datetime import datetime
from pathlib import Path
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

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

tokens = {}

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token or token not in tokens:
            return jsonify({'detail': 'Invalid token'}), 401
        request.user = tokens[token]
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT,
            class_name TEXT NOT NULL,
            teacher_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES users(id)
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
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    if cursor.fetchone()[0] == 0:
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@system.com')
        admin_password = os.getenv('ADMIN_PASSWORD', 'Admin123!')
        password_hash = hash_password(admin_password)
        cursor.execute('''
            INSERT INTO users (email, full_name, password_hash, role, must_change_password)
            VALUES (?, ?, ?, 'admin', 1)
        ''', (admin_email, 'System Administrator', password_hash))
        logging.info(f'Default admin created: {admin_email}')
    
    conn.commit()
    conn.close()

init_db()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', (email,))
    user = cursor.fetchone()
    
    if not user or not verify_password(password, user['password_hash']):
        conn.close()
        return jsonify({'detail': 'Invalid credentials'}), 401
    
    token = secrets.token_hex(16)
    tokens[token] = {'id': user['id'], 'email': user['email'], 'role': user['role']}
    
    conn.close()
    return jsonify({
        'access_token': token,
        'token_type': 'bearer',
        'role': user['role'],
        'must_change_password': bool(user['must_change_password'])
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    class_name = data.get('class_name')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'detail': 'Email already registered'}), 400
    
    password_hash = hash_password(password)
    cursor.execute('''
        INSERT INTO users (email, full_name, password_hash, role, class_name)
        VALUES (?, ?, ?, 'student', ?)
    ''', (email, full_name, password_hash, class_name))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Registration successful'})

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
    
    cursor.execute("SELECT COUNT(*) FROM assignments")
    assignments = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM submissions")
    submissions = cursor.fetchone()[0]
    
    conn.close()
    return jsonify({
        'total_students': students,
        'total_teachers': teachers,
        'total_assignments': assignments,
        'total_submissions': submissions
    })

@app.route('/api/teacher/assignments', methods=['GET', 'POST'])
@login_required
@role_required('teacher', 'admin')
def teacher_assignments():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT * FROM assignments WHERE teacher_id = ?', (request.user['id'],))
        assignments = cursor.fetchall()
        conn.close()
        return jsonify([{
            'id': a['id'], 'title': a['title'], 'class_name': a['class_name'],
            'file_name': a['file_name'], 'created_at': a['created_at']
        } for a in assignments])
    
    title = request.form.get('title')
    class_name = request.form.get('class_name')
    description = request.form.get('description', '')
    file = request.files.get('file')
    
    if not file or not title or not class_name:
        conn.close()
        return jsonify({'detail': 'Missing required fields'}), 400
    
    allowed_extensions = {'.pdf', '.docx', '.xlsx', '.doc', '.xls'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        conn.close()
        return jsonify({'detail': 'File type not allowed'}), 400
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    file.save(file_path)
    
    cursor.execute('''
        INSERT INTO assignments (title, description, file_path, file_name, file_type, class_name, teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (title, description, file_path, file.filename, ext, class_name, request.user['id']))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Assignment uploaded successfully'})

@app.route('/api/student/assignments', methods=['GET'])
@login_required
@role_required('student')
def student_assignments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    
    if not student:
        conn.close()
        return jsonify({'detail': 'Student not found'}), 404
    
    cursor.execute('SELECT * FROM assignments WHERE class_name = ?', (student['class_name'],))
    assignments = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': a['id'], 'title': a['title'], 'description': a['description'],
        'file_name': a['file_name'], 'file_type': a['file_type'], 'created_at': a['created_at']
    } for a in assignments])

@app.route('/api/student/download/<int:assignment_id>', methods=['GET'])
@login_required
@role_required('student')
def download_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT class_name FROM users WHERE id = ?', (request.user['id'],))
    student = cursor.fetchone()
    
    cursor.execute('SELECT * FROM assignments WHERE id = ? AND class_name = ?', 
                   (assignment_id, student['class_name']))
    assignment = cursor.fetchone()
    conn.close()
    
    if not assignment:
        return jsonify({'detail': 'Assignment not found'}), 404
    
    return send_file(assignment['file_path'], download_name=assignment['file_name'], as_attachment=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'System is operational'})

if __name__ == '__main__':
    logging.info('Starting application')
    app.run(debug=True, host='0.0.0.0', port=5000)
