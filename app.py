import os
import sys
import json
import logging
from datetime import datetime
from functools import wraps
from dotenv import load_dotenv

if os.path.exists('.env'):
    load_dotenv()

from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
import supabase_helper as sb

app = Flask(__name__, static_folder='frontend')
CORS(app)

on_vercel = os.environ.get('VERCEL')
LOG_DIR = os.getenv('LOG_DIR', '/tmp/logs' if on_vercel else './logs')
os.makedirs(LOG_DIR, exist_ok=True)

handlers = [logging.StreamHandler(sys.stdout)]
try:
    handlers.append(logging.FileHandler(f'{LOG_DIR}/app.log'))
except (OSError, PermissionError):
    pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=handlers
)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'detail': 'No token provided'}), 401
        status, auth_data = sb.get_user(token)
        if status != 200:
            return jsonify({'detail': 'Invalid or expired token'}), 401
        auth_id = auth_data.get('id')
        if not auth_id:
            return jsonify({'detail': 'Invalid token payload'}), 401
        users = sb.table('users', token).select(filters={'id': f'eq.{auth_id}'})
        if not users:
            return jsonify({'detail': 'User not found'}), 404
        request.user = users[0] if isinstance(users, list) else users
        request.user['auth_id'] = auth_id
        request.token = token
        return f(*args, **kwargs)
    return decorated


def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.user.get('role') not in allowed_roles:
                return jsonify({'detail': 'Access denied'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def _log_audit(user_id, action, details=''):
    try:
        sb.table('audit_logs').insert({
            'user_id': user_id, 'action': action, 'details': details
        })
    except Exception as e:
        logging.warning(f'Failed to log audit: {e}')


def _make_public_url(bucket, path):
    return sb.get_public_url(bucket, path)


def _svc_key():
    return os.environ.get('SUPABASE_SERVICE_KEY', '')


def _service_table(name):
    return sb.table(name, _svc_key())



# ─── Auth ─────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    requested_role = data.get('role')

    if not requested_role:
        return jsonify({'detail': 'Login type not specified'}), 400

    status, auth_data = sb.sign_in(email, password)
    if status != 200:
        return jsonify({'detail': 'Invalid credentials'}), 401

    access_token = auth_data.get('access_token')
    auth_id = auth_data.get('user', {}).get('id')
    user_email = auth_data.get('user', {}).get('email')

    if not access_token or not auth_id:
        return jsonify({'detail': 'Authentication failed'}), 401

    users = sb.table('users', access_token).select(filters={'id': f'eq.{auth_id}'})
    if not users:
        return jsonify({'detail': 'User account not set up. Contact admin.'}), 403

    user = users[0] if isinstance(users, list) else users

    if not user.get('is_active', True):
        return jsonify({'detail': 'Account is deactivated. Contact admin.'}), 403

    if user.get('role') != requested_role:
        return jsonify({'detail': f'This account is not registered as a {requested_role}. Please use the correct login page.'}), 403

    _log_audit(auth_id, 'login', f'{requested_role} logged in')

    return jsonify({
        'access_token': access_token,
        'token_type': 'bearer',
        'role': user['role'],
        'must_change_password': bool(user.get('must_change_password', False))
    })


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

    status, auth_data = sb.sign_up(email, password, {'role': role, 'full_name': full_name})
    if status not in (200, 201):
        msg = auth_data.get('error_description') or auth_data.get('msg') or 'Registration failed'
        if 'already' in msg.lower():
            return jsonify({'detail': 'Email already registered'}), 400
        return jsonify({'detail': msg}), 400

    auth_id = auth_data.get('user', {}).get('id')
    if not auth_id:
        return jsonify({'detail': 'Registration failed — no user ID returned'}), 500

    if program_name and not program_id:
        progs = sb.table('programs').select(filters={'name': f'eq.{program_name}'})
        if progs:
            program_id = progs[0]['id'] if isinstance(progs, list) else progs['id']

    _service_table('users').insert({
        'id': auth_id, 'email': email, 'full_name': full_name,
        'role': role, 'program_id': program_id
    })

    logging.info(f'New user registered: {email} with role {role}')
    _log_audit(auth_id, 'register', f'{role} registered')
    return jsonify({'message': 'Registration successful'})


@app.route('/api/auth/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    if not old_password or not new_password:
        return jsonify({'detail': 'Missing password fields'}), 400

    email = request.user.get('email')
    status, _ = sb.sign_in(email, old_password)
    if status != 200:
        return jsonify({'detail': 'Invalid old password'}), 400

    sb.table('users', request.token).update(
        {'must_change_password': False},
        {'id': request.user['auth_id']}
    )
    return jsonify({'message': 'Password change must be done via Supabase. Use "Forgot Password" flow.'})


@app.route('/api/auth/me', methods=['GET'])
@login_required
def auth_me():
    return jsonify({
        'id': request.user.get('auth_id'),
        'email': request.user.get('email'),
        'full_name': request.user.get('full_name'),
        'role': request.user.get('role'),
        'class_name': request.user.get('class_name'),
        'program_id': request.user.get('program_id')
    })


# ─── Public ───────────────────────────────────────────────────────────

@app.route('/api/programs', methods=['GET'])
def get_programs_public():
    programs = sb.table('programs').select(order='name')
    return jsonify([{
        'id': p['id'], 'name': p['name'], 'code': p['code'],
        'department': p.get('department')
    } for p in (programs or [])])


# ─── Admin ────────────────────────────────────────────────────────────

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
@role_required('admin')
def admin_dashboard():
    students = _service_table('users').count(filters={'role': 'eq.student'})
    teachers = _service_table('users').count(filters={'role': 'eq.teacher'})
    courses = sb.table('courses').count()
    assignments = sb.table('assignments').count()
    submissions = sb.table('submissions').count()
    return jsonify({
        'total_students': students,
        'total_teachers': teachers,
        'total_courses': courses,
        'total_assignments': assignments,
        'total_submissions': submissions
    })


@app.route('/api/admin/users', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_users():
    if request.method == 'GET':
        role = request.args.get('role')
        filters = {'role': f'eq.{role}'} if role else None
        users = _service_table('users').select(filters=filters)
        return jsonify([{
            'id': u['id'], 'email': u['email'], 'full_name': u['full_name'],
            'role': u['role'], 'is_active': bool(u.get('is_active', True)),
            'class_name': u.get('class_name')
        } for u in (users or [])])

    data = request.json
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    role = data.get('role', 'teacher')
    class_name = data.get('class_name', '')

    existing = _service_table('users').select(filters={'email': f'eq.{email}'})
    if existing:
        return jsonify({'detail': 'Email already exists'}), 400

    status, auth_data = sb.admin_create_user(email, password, {'role': role, 'full_name': full_name})
    if status in (200, 201):
        auth_id = auth_data.get('id')
    elif 'already exists' in str(auth_data).lower() or 'email_exists' in str(auth_data).lower():
        auth_status, auth_data2 = sb.sign_in(email, password)
        if auth_status != 200:
            return jsonify({'detail': 'Email exists in system but password does not match existing account'}), 400
        auth_id = auth_data2.get('user', {}).get('id')
    else:
        return jsonify({'detail': f'Failed to create auth user: {str(auth_data)[:200]}'}), 400

    if auth_id:
        _service_table('users').insert({
            'id': auth_id, 'email': email, 'full_name': full_name,
            'role': role, 'class_name': class_name
        })

    _log_audit(request.user['auth_id'], 'create_user', f'Created {role}: {email}')
    return jsonify({'message': 'User created successfully'})


@app.route('/api/admin/users/<user_id>', methods=['PUT', 'DELETE'])
@login_required
@role_required('admin')
def manage_user(user_id):
    if request.method == 'PUT':
        data = request.json
        is_active = data.get('is_active')
        if is_active is not None:
            _service_table('users').update(
                {'is_active': bool(is_active)},
                {'id': user_id}
            )
        return jsonify({'message': 'User updated successfully'})

    _service_table('users').delete({'id': user_id})
    _log_audit(request.user['auth_id'], 'delete_user', f'Deleted user {user_id}')
    return jsonify({'message': 'User deleted successfully'})


@app.route('/api/admin/audit-logs', methods=['GET'])
@login_required
@role_required('admin')
def get_audit_logs():
    logs = sb.table('audit_logs').select(order='timestamp.desc', limit=500)
    result = []
    for log in (logs or []):
        u = _service_table('users').select(filters={'id': f'eq.{log["user_id"]}'}, single=True)
        result.append({
            'id': log['id'], 'timestamp': log.get('timestamp'),
            'action': log['action'], 'details': log.get('details'),
            'user_email': u.get('email') if u else None
        })
    return jsonify(result)


@app.route('/api/admin/programs', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_programs():
    if request.method == 'GET':
        programs = sb.table('programs').select(order='name')
        return jsonify([{
            'id': p['id'], 'name': p['name'], 'code': p['code'],
            'department': p.get('department'), 'duration_months': p.get('duration_months')
        } for p in (programs or [])])

    data = request.json
    sb.table('programs', request.token).insert({
        'name': data.get('name'), 'code': data.get('code'),
        'department': data.get('department', ''), 'duration_months': data.get('duration_months', 12)
    })
    return jsonify({'message': 'Program created successfully'})


@app.route('/api/admin/courses', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def manage_courses():
    if request.method == 'GET':
        courses = sb.table('courses').select()
        result = []
        for c in (courses or []):
            p = sb.table('programs').select(filters={'id': f'eq.{c["program_id"]}'}, single=True) if c.get('program_id') else None
            result.append({
                'id': c['id'], 'code': c['code'], 'title': c['title'],
                'program_name': p.get('name') if p else None, 'credits': c.get('credits')
            })
        return jsonify(result)

    data = request.json
    sb.table('courses', request.token).insert({
        'program_id': data.get('program_id'), 'code': data.get('code'),
        'title': data.get('title'), 'description': data.get('description', ''),
        'credits': data.get('credits', 3)
    })
    return jsonify({'message': 'Course created successfully'})


# ─── Instructor / Teacher ────────────────────────────────────────────

@app.route('/api/instructor/dashboard', methods=['GET'])
@login_required
@role_required('teacher')
def instructor_dashboard():
    uid = request.user['auth_id']
    assignments = sb.table('assignments').select(filters={'instructor_id': f'eq.{uid}'}, order='created_at.desc', limit=5)
    total_a = sb.table('assignments').count(filters={'instructor_id': f'eq.{uid}'})

    courses_set = set()
    for a in (assignments or []):
        if a.get('course_id'):
            courses_set.add(a['course_id'])
    # Also find courses linked to teacher's program
    if request.user.get('program_id'):
        prog_courses = sb.table('courses').select(filters={'program_id': f'eq.{request.user["program_id"]}'})
        for c in (prog_courses or []):
            courses_set.add(c['id'])

    # Count pending submissions (ungraded) for this teacher's assignments
    pending = 0
    all_a = sb.table('assignments').select(filters={'instructor_id': f'eq.{uid}'})
    for a in (all_a or []):
        subs = sb.table('submissions').count(filters={
            'assignment_id': f'eq.{a["id"]}',
            'grade': 'is.null'
        })
        pending += subs

    recent = []
    for a in (assignments or []):
        c = None
        if a.get('course_id'):
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True)
        recent.append({
            'title': a['title'],
            'course_title': c.get('title') if c else None,
            'created_at': a.get('created_at')
        })

    return jsonify({
        'total_courses': len(courses_set),
        'total_assignments': total_a,
        'pending_submissions': pending,
        'recent_assignments': recent
    })


@app.route('/api/instructor/courses', methods=['GET'])
@login_required
@role_required('teacher')
def instructor_courses():
    uid = request.user['auth_id']
    courses = []
    seen = set()

    # Courses from teacher's assignments
    teacher_a = sb.table('assignments').select(filters={'instructor_id': f'eq.{uid}'})
    for a in (teacher_a or []):
        cid = a.get('course_id')
        if cid and cid not in seen:
            seen.add(cid)
            c = sb.table('courses').select(filters={'id': f'eq.{cid}'}, single=True)
            if c:
                p = sb.table('programs').select(filters={'id': f'eq.{c.get("program_id")}'}, single=True) if c.get('program_id') else None
                courses.append({
                    'id': c['id'], 'code': c.get('code'), 'title': c.get('title'),
                    'description': c.get('description'), 'credits': c.get('credits'),
                    'program_name': p.get('name') if p else None,
                    'program_code': p.get('code') if p else None
                })

    # Courses from teacher's program
    if request.user.get('program_id'):
        prog_courses = sb.table('courses').select(filters={'program_id': f'eq.{request.user["program_id"]}'})
        for c in (prog_courses or []):
            if c['id'] not in seen:
                seen.add(c['id'])
                p = sb.table('programs').select(filters={'id': f'eq.{c.get("program_id")}'}, single=True) if c.get('program_id') else None
                courses.append({
                    'id': c['id'], 'code': c.get('code'), 'title': c.get('title'),
                    'description': c.get('description'), 'credits': c.get('credits'),
                    'program_name': p.get('name') if p else None,
                    'program_code': p.get('code') if p else None
                })

    return jsonify(courses)


@app.route('/api/instructor/assignments', methods=['GET', 'POST'])
@login_required
@role_required('teacher', 'admin')
def instructor_assignments():
    uid = request.user['auth_id']

    if request.method == 'GET':
        assignments = sb.table('assignments', request.token).select(
            filters={'instructor_id': f'eq.{uid}'}, order='created_at.desc'
        )
        result = []
        for a in (assignments or []):
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a.get('course_id') else None
            result.append({
                'id': a['id'], 'title': a['title'],
                'course_title': c.get('title') if c else None,
                'file_name': a.get('file_name'), 'created_at': a.get('created_at'),
                'deadline': a.get('deadline')
            })
        return jsonify(result)

    title = request.form.get('title')
    course_name = request.form.get('course_name')
    description = request.form.get('description', '')
    file = request.files.get('file')
    deadline = request.form.get('deadline')

    if not file or not title or not course_name:
        return jsonify({'detail': 'Missing required fields'}), 400

    allowed_extensions = {'.pdf', '.docx', '.xlsx', '.doc', '.xls'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({'detail': 'File type not allowed'}), 400

    course = sb.table('courses').select(filters={'title': f'eq.{course_name}'}, single=True)
    if course:
        course_id = course['id']
    else:
        inserted = sb.table('courses', request.token).insert({
            'program_id': None, 'code': course_name[:10].upper(),
            'title': course_name, 'description': ''
        })
        course_id = inserted[0]['id'] if isinstance(inserted, list) else inserted.get('id', inserted)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    storage_path = f"{timestamp}_{file.filename}"
    status, _ = sb.upload_file('assignments', storage_path, file.read(), content_type=file.content_type, token=request.token)
    if status not in (200, 201):
        return jsonify({'detail': 'Failed to upload file to storage'}), 500

    file_path = f"assignments/{storage_path}"
    sb.table('assignments', request.token).insert({
        'course_id': course_id, 'title': title, 'description': description,
        'file_path': file_path, 'file_name': file.filename, 'file_type': ext,
        'instructor_id': uid, 'deadline': deadline or None
    })

    enrolled = sb.table('enrollments').select(filters={
        'course_id': f'eq.{course_id}', 'status': 'eq.active'
    })
    notified = 0
    for enr in (enrolled or []):
        sb.table('notifications', request.token).insert({
            'user_id': enr['student_id'], 'subject': f'New Assignment: {title}',
            'message': f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'
        })
        notified += 1

    _log_audit(uid, 'upload_assignment', f'Uploaded "{title}" for course {course_name}')
    return jsonify({'message': f'Assignment uploaded successfully. Notified {notified} students.'})


@app.route('/api/teacher/assignments', methods=['GET', 'POST'])
@login_required
@role_required('teacher', 'admin')
def teacher_assignments():
    uid = request.user['auth_id']

    if request.method == 'GET':
        assignments = sb.table('assignments', request.token).select(
            filters={'instructor_id': f'eq.{uid}'}, order='created_at.desc'
        )
        result = []
        for a in (assignments or []):
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a.get('course_id') else None
            result.append({
                'id': a['id'], 'title': a['title'],
                'class_name': c.get('title') if c else None,
                'file_name': a.get('file_name'), 'created_at': a.get('created_at')
            })
        return jsonify(result)

    title = request.form.get('title')
    class_name = request.form.get('class_name')
    description = request.form.get('description', '')
    file = request.files.get('file')
    deadline = request.form.get('deadline')

    if not file or not title or not class_name:
        return jsonify({'detail': 'Missing required fields'}), 400

    allowed_extensions = {'.pdf', '.docx', '.xlsx', '.doc', '.xls'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({'detail': 'File type not allowed'}), 400

    course = sb.table('courses').select(filters={'title': f'eq.{class_name}'}, single=True)
    if course:
        course_id = course['id']
    else:
        inserted = sb.table('courses', request.token).insert({
            'program_id': None, 'code': class_name[:10].upper(),
            'title': class_name, 'description': ''
        })
        course_id = inserted[0]['id'] if isinstance(inserted, list) else inserted.get('id', inserted)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    storage_path = f"{timestamp}_{file.filename}"
    status, _ = sb.upload_file('assignments', storage_path, file.read(), content_type=file.content_type, token=request.token)
    if status not in (200, 201):
        return jsonify({'detail': 'Failed to upload file to storage'}), 500

    file_path = f"assignments/{storage_path}"
    sb.table('assignments', request.token).insert({
        'course_id': course_id, 'title': title, 'description': description,
        'file_path': file_path, 'file_name': file.filename, 'file_type': ext,
        'instructor_id': uid, 'deadline': deadline or None
    })

    enrolled = sb.table('enrollments').select(filters={
        'course_id': f'eq.{course_id}', 'status': 'eq.active'
    })
    by_class = _service_table('users').select(filters={
        'role': 'eq.student', 'is_active': 'eq.true', 'class_name': f'eq.{class_name}'
    })

    notified = set()
    for enr in (enrolled or []):
        notified.add(enr['student_id'])
        sb.table('notifications', request.token).insert({
            'user_id': enr['student_id'], 'subject': f'New Assignment: {title}',
            'message': f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'
        })

    for stu in (by_class or []):
        sid = stu['id']
        if sid not in notified:
            notified.add(sid)
            sb.table('notifications', request.token).insert({
                'user_id': sid, 'subject': f'New Assignment: {title}',
                'message': f'A new assignment "{title}" has been posted. Submit before: {deadline or "No deadline"}'
            })

    _log_audit(uid, 'upload_assignment', f'Uploaded "{title}" for class {class_name}')
    return jsonify({'message': f'Assignment uploaded successfully. Notified {len(notified)} students.'})


@app.route('/api/instructor/submissions', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def get_submissions():
    uid = request.user['auth_id']
    assignment_id = request.args.get('assignment_id')
    course_id = request.args.get('course_id')

    filters = {}
    if assignment_id:
        filters['assignment_id'] = f'eq.{assignment_id}'
    elif course_id:
        filters2 = {}
        all_a = sb.table('assignments').select(filters={'course_id': f'eq.{course_id}'})
        return jsonify(_build_submissions_list(all_a, uid))
    else:
        all_a = sb.table('assignments').select(filters={'instructor_id': f'eq.{uid}'})

    submissions = sb.table('submissions').select(filters=filters) if filters else []
    return jsonify(_build_submissions_list(submissions, uid, is_submissions=True))


def _build_submissions_list(items, uid, is_submissions=False):
    result = []
    if is_submissions:
        for s in (items or []):
            a = sb.table('assignments').select(filters={'id': f'eq.{s["assignment_id"]}'}, single=True) if s.get('assignment_id') else None
            if a and a.get('instructor_id') != uid:
                continue
            u = sb.table('users').select(filters={'id': f'eq.{s["student_id"]}'}, single=True) if s.get('student_id') else None
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a and a.get('course_id') else None
            result.append({
                'id': s['id'], 'student_name': u.get('full_name') if u else 'Unknown',
                'assignment_title': a.get('title') if a else 'Unknown',
                'course_title': c.get('title') if c else None,
                'grade': s.get('grade'), 'feedback': s.get('feedback'),
                'submitted_at': s.get('submitted_at')
            })
    else:
        for a in (items or []):
            if a.get('instructor_id') != uid:
                continue
            subs = sb.table('submissions').select(filters={'assignment_id': f'eq.{a["id"]}'})
            for s in (subs or []):
                u = sb.table('users').select(filters={'id': f'eq.{s["student_id"]}'}, single=True) if s.get('student_id') else None
                c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a.get('course_id') else None
                result.append({
                    'id': s['id'], 'student_name': u.get('full_name') if u else 'Unknown',
                    'assignment_title': a.get('title'),
                    'course_title': c.get('title') if c else None,
                    'grade': s.get('grade'), 'feedback': s.get('feedback'),
                    'submitted_at': s.get('submitted_at')
                })
    return result


@app.route('/api/teacher/submissions/<int:assignment_id>', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_view_submissions(assignment_id):
    uid = request.user['auth_id']
    a = sb.table('assignments').select(filters={'id': f'eq.{assignment_id}'}, single=True)
    if not a or a.get('instructor_id') != uid:
        return jsonify({'detail': 'Assignment not found or access denied'}), 404

    submissions = sb.table('submissions').select(filters={'assignment_id': f'eq.{assignment_id}'})
    result = []
    for s in (submissions or []):
        u = sb.table('users').select(filters={'id': f'eq.{s["student_id"]}'}, single=True) if s.get('student_id') else None
        result.append({
            'id': s['id'], 'student_name': u.get('full_name') if u else 'Unknown',
            'grade': s.get('grade'), 'feedback': s.get('feedback'),
            'submitted_at': s.get('submitted_at')
        })
    return jsonify(result)


@app.route('/api/instructor/submissions/<int:submission_id>/grade', methods=['POST'])
@login_required
@role_required('teacher', 'admin')
def grade_submission(submission_id):
    uid = request.user['auth_id']
    s = sb.table('submissions').select(filters={'id': f'eq.{submission_id}'}, single=True)
    if not s:
        return jsonify({'detail': 'Submission not found'}), 404

    a = sb.table('assignments').select(filters={'id': f'eq.{s["assignment_id"]}'}, single=True)
    if not a or a.get('instructor_id') != uid:
        return jsonify({'detail': 'Access denied'}), 403

    data = request.json
    grade = data.get('grade')
    feedback = data.get('feedback', '')

    sb.table('submissions', request.token).update(
        {'grade': grade, 'feedback': feedback},
        {'id': submission_id}
    )

    sb.table('notifications', request.token).insert({
        'user_id': s['student_id'], 'subject': f'Grade Received: {a.get("title")}',
        'message': f'You received grade: {grade}. Feedback: {feedback or "No feedback"}'
    })

    return jsonify({'message': 'Grade submitted successfully'})


@app.route('/api/teacher/submissions/<int:submission_id>/grade', methods=['POST'])
@login_required
@role_required('teacher', 'admin')
def teacher_grade_submission(submission_id):
    return grade_submission(submission_id)


@app.route('/api/teacher/students', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_list_students():
    class_name = request.args.get('class_name', '')
    filters = {'role': 'eq.student'}
    if class_name:
        filters['class_name'] = f'eq.{class_name}'
    students = _service_table('users').select(filters=filters)
    return jsonify([{
        'id': s['id'], 'email': s['email'],
        'full_name': s['full_name'], 'class_name': s.get('class_name')
    } for s in (students or [])])


# ─── Assignment delete ────────────────────────────────────────────────

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
@app.route('/api/teacher/assignments/<int:assignment_id>', methods=['DELETE'])
@login_required
@role_required('teacher', 'admin')
def delete_assignment(assignment_id):
    uid = request.user['auth_id']
    a = sb.table('assignments').select(filters={'id': f'eq.{assignment_id}'}, single=True)
    if not a or a.get('instructor_id') != uid:
        return jsonify({'detail': 'Assignment not found or access denied'}), 404

    sb.table('submissions', request.token).delete({'assignment_id': assignment_id})
    sb.table('assignments', request.token).delete({'id': assignment_id})
    _log_audit(uid, 'delete_assignment', f'Deleted assignment {assignment_id}')
    return jsonify({'message': 'Assignment deleted successfully'})


# ─── Student ──────────────────────────────────────────────────────────

@app.route('/api/student/assignments', methods=['GET'])
@login_required
@role_required('student')
def student_list_assignments():
    uid = request.user['auth_id']
    student_class = request.user.get('class_name', '') or ''

    enrolled = sb.table('enrollments').select(filters={'student_id': f'eq.{uid}', 'status': 'eq.active'})
    course_ids = [e['course_id'] for e in (enrolled or [])]

    all_assignments = sb.table('assignments').select(order='created_at.desc')
    now = datetime.now()
    active = []

    for a in (all_assignments or []):
        cid = a.get('course_id')
        if cid in course_ids:
            pass
        elif student_class:
            c = sb.table('courses').select(filters={'id': f'eq.{cid}'}, single=True) if cid else None
            if not c or c.get('title') != student_class:
                continue
        else:
            continue

        dl = a.get('deadline')
        if dl:
            try:
                dl_dt = datetime.fromisoformat(dl.replace('Z', '+00:00'))
                if dl_dt < now:
                    continue
            except (ValueError, AttributeError):
                pass

        c = sb.table('courses').select(filters={'id': f'eq.{cid}'}, single=True) if cid else None
        active.append({
            'id': a['id'], 'title': a['title'], 'description': a.get('description'),
            'file_name': a.get('file_name'), 'file_type': a.get('file_type'),
            'course_title': c.get('title') if c else None,
            'created_at': a.get('created_at'), 'deadline': a.get('deadline')
        })

    return jsonify(active)


@app.route('/api/student/download/<int:assignment_id>', methods=['GET'])
@login_required
@role_required('student')
def download_assignment(assignment_id):
    a = sb.table('assignments').select(filters={'id': f'eq.{assignment_id}'}, single=True)
    if not a:
        return jsonify({'detail': 'Assignment not found'}), 404

    file_path = a.get('file_path', '')
    if file_path.startswith('assignments/'):
        storage_path = file_path[len('assignments/'):]
        public_url = _make_public_url('assignments', storage_path)
        return redirect(public_url)

    return jsonify({'detail': 'File not found'}), 404


@app.route('/api/student/download/<int:assignment_id>/file', methods=['GET'])
@login_required
@role_required('student')
def download_assignment_direct(assignment_id):
    return download_assignment(assignment_id)


@app.route('/api/student/submit/<int:assignment_id>', methods=['POST'])
@login_required
@role_required('student')
def submit_assignment(assignment_id):
    uid = request.user['auth_id']
    student_class = request.user.get('class_name', '') or ''

    a = sb.table('assignments').select(filters={'id': f'eq.{assignment_id}'}, single=True)
    if not a:
        return jsonify({'detail': 'Assignment not found'}), 404

    cid = a.get('course_id')
    enrolled = sb.table('enrollments').select(filters={
        'student_id': f'eq.{uid}', 'course_id': f'eq.{cid}', 'status': 'eq.active'
    }, single=True)

    if not enrolled:
        c = sb.table('courses').select(filters={'id': f'eq.{cid}'}, single=True) if cid else None
        if not c or c.get('title') != student_class:
            all_enrollments = sb.table('enrollments').count()
            if all_enrollments > 0:
                return jsonify({'detail': 'Not enrolled in this course'}), 403

    if a.get('deadline'):
        try:
            deadline = datetime.fromisoformat(a['deadline'].replace('Z', '+00:00'))
            if datetime.now() > deadline:
                return jsonify({'detail': 'Submission deadline has passed'}), 403
        except (ValueError, AttributeError):
            pass

    if 'file' not in request.files:
        return jsonify({'detail': 'No file provided'}), 400

    file = request.files['file']
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    storage_path = f"submission_{timestamp}_{file.filename}"

    status, _ = sb.upload_file('submissions', storage_path, file.read(), content_type=file.content_type, token=request.token)
    if status not in (200, 201):
        return jsonify({'detail': 'Failed to upload submission'}), 500

    file_path = f"submissions/{storage_path}"
    sb.table('submissions', request.token).insert({
        'student_id': uid, 'assignment_id': assignment_id, 'file_path': file_path
    })

    instructor_id = a.get('instructor_id')
    if instructor_id:
        sb.table('notifications', request.token).insert({
            'user_id': instructor_id, 'subject': f"New Submission: {request.user.get('full_name')}",
            'message': f"Student {request.user.get('full_name')} submitted assignment: {a.get('title')}"
        })

    return jsonify({'message': 'Assignment submitted successfully'})


@app.route('/api/student/submissions', methods=['GET'])
@login_required
@role_required('student')
def student_list_submissions():
    uid = request.user['auth_id']
    submissions = sb.table('submissions').select(
        filters={'student_id': f'eq.{uid}'}, order='submitted_at.desc'
    )
    result = []
    for s in (submissions or []):
        a = sb.table('assignments').select(filters={'id': f'eq.{s["assignment_id"]}'}, single=True) if s.get('assignment_id') else None
        result.append({
            'id': s['id'], 'assignment_title': a.get('title') if a else 'Unknown',
            'grade': s.get('grade'), 'feedback': s.get('feedback'),
            'submitted_at': s.get('submitted_at')
        })
    return jsonify(result)


@app.route('/api/student/progress', methods=['GET'])
@login_required
@role_required('student')
def student_progress():
    uid = request.user['auth_id']
    student_class = request.user.get('class_name', '') or ''

    total = 0
    if student_class:
        total = sb.table('assignments').count()
        # count assignments matching student's class
        all_a = sb.table('assignments').select()
        total = 0
        for a in (all_a or []):
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a.get('course_id') else None
            if c and c.get('title') == student_class:
                total += 1

    submitted = sb.table('submissions').count(filters={'student_id': f'eq.{uid}'})
    graded = sb.table('submissions').count(filters={'student_id': f'eq.{uid}'})
    all_subs = sb.table('submissions').select(filters={'student_id': f'eq.{uid}'})
    graded = 0
    for s in (all_subs or []):
        if s.get('grade'):
            graded += 1

    return jsonify({
        'total_assignments': total,
        'submitted': submitted,
        'graded': graded,
        'pending': total - submitted,
        'progress_percentage': int((submitted / total) * 100) if total > 0 else 0
    })


@app.route('/api/student/gpa', methods=['GET'])
@login_required
@role_required('student')
def student_gpa():
    uid = request.user['auth_id']
    submissions = sb.table('submissions').select(filters={'student_id': f'eq.{uid}'})

    grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
    total_points = 0
    total_credits = 0

    for s in (submissions or []):
        if s.get('grade') in grade_points:
            a = sb.table('assignments').select(filters={'id': f'eq.{s["assignment_id"]}'}, single=True) if s.get('assignment_id') else None
            c = sb.table('courses').select(filters={'id': f'eq.{a["course_id"]}'}, single=True) if a and a.get('course_id') else None
            credits = c.get('credits', 3) if c else 3
            total_points += grade_points[s['grade']] * credits
            total_credits += credits

    gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0
    return jsonify({'gpa': gpa, 'total_credits': total_credits})


@app.route('/api/student/enroll', methods=['POST'])
@login_required
@role_required('student')
def enroll_course():
    uid = request.user['auth_id']
    data = request.json
    course_id = data.get('course_id')

    existing = sb.table('enrollments').select(filters={
        'student_id': f'eq.{uid}', 'course_id': f'eq.{course_id}'
    }, single=True)
    if existing:
        return jsonify({'error': 'Already enrolled in this course'}), 400

    sb.table('enrollments', request.token).insert({
        'student_id': uid, 'course_id': course_id, 'status': 'active'
    })
    return jsonify({'message': 'Enrolled successfully'})


@app.route('/api/student/notifications', methods=['GET'])
@login_required
@role_required('student')
def get_notifications():
    uid = request.user['auth_id']
    notifications = sb.table('notifications').select(
        filters={'user_id': f'eq.{uid}'}, order='created_at.desc'
    )
    return jsonify([{
        'id': n['id'], 'subject': n['subject'], 'message': n.get('message'),
        'is_read': bool(n.get('is_read', False)), 'created_at': n.get('created_at')
    } for n in (notifications or [])])


@app.route('/api/student/notifications/<int:notification_id>/read', methods=['PUT'])
@login_required
@role_required('student')
def mark_notification_read(notification_id):
    uid = request.user['auth_id']
    sb.table('notifications', request.token).update(
        {'is_read': True},
        {'id': notification_id, 'user_id': uid}
    )
    return jsonify({'message': 'Notification marked as read'})


@app.route('/api/notifications', methods=['GET'])
@login_required
def notifications_redirect():
    uid = request.user['auth_id']
    notifications = sb.table('notifications').select(
        filters={'user_id': f'eq.{uid}'}, order='created_at.desc'
    )
    return jsonify([{
        'id': n['id'], 'subject': n['subject'], 'message': n.get('message'),
        'is_read': bool(n.get('is_read', False)), 'created_at': n.get('created_at')
    } for n in (notifications or [])])


@app.route('/api/student/export-data', methods=['GET'])
@login_required
@role_required('student')
def export_student_data():
    uid = request.user['auth_id']
    user = request.user
    assignments = sb.table('assignments').select()
    submissions = sb.table('submissions').select(filters={'student_id': f'eq.{uid}'})
    notifications = sb.table('notifications').select(filters={'user_id': f'eq.{uid}'})

    return jsonify({
        'user_info': {
            'email': user.get('email'), 'full_name': user.get('full_name'),
            'role': user.get('role'), 'created_at': user.get('created_at')
        },
        'assignments': assignments or [],
        'submissions': submissions or [],
        'notifications': notifications or []
    })


# ─── Teacher download (redirect to Supabase) ──────────────────────────

@app.route('/api/teacher/submissions/download/<int:submission_id>', methods=['GET'])
@login_required
@role_required('teacher', 'admin')
def teacher_download_submission(submission_id):
    uid = request.user['auth_id']
    s = sb.table('submissions').select(filters={'id': f'eq.{submission_id}'}, single=True)
    if not s:
        return jsonify({'detail': 'Submission not found'}), 404

    a = sb.table('assignments').select(filters={'id': f'eq.{s["assignment_id"]}'}, single=True)
    if not a or a.get('instructor_id') != uid:
        return jsonify({'detail': 'Access denied'}), 403

    file_path = s.get('file_path', '')
    if file_path.startswith('submissions/'):
        storage_path = file_path[len('submissions/'):]
        public_url = _make_public_url('submissions', storage_path)
        return redirect(public_url)

    return jsonify({'detail': 'File not found'}), 404


# ─── Serve frontend & health ──────────────────────────────────────────

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'System is operational'})

_seeded = False

@app.route('/api/seed', methods=['GET'])
def seed_users():
    global _seeded
    svc_key = os.environ.get('SUPABASE_SERVICE_KEY', '')
    if not svc_key or svc_key == sb.SUPABASE_ANON_KEY:
        return jsonify({'error': 'SUPABASE_SERVICE_KEY not set in environment variables'}), 400
    seeded = []
    skipped = []
    errors = []
    for email, pw, name, role, class_name in [
        ('admin@forestry.edu', 'Admin123!', 'System Administrator', 'admin', None),
        ('teacher@forestry.edu', 'Teacher123!', 'Default Instructor', 'teacher', 'BCF Year 1'),
        ('student@forestry.edu', 'Student123!', 'Default Student', 'student', 'BCF Year 1'),
    ]:
        try:
            status, data = sb.admin_create_user(email, pw, {'role': role, 'full_name': name})
            if status in (200, 201):
                uid = data.get('id')
            elif 'already exists' in str(data).lower() or 'email_exists' in str(data).lower():
                auth_status, auth_data = sb.sign_in(email, pw)
                if auth_status == 200:
                    uid = auth_data.get('user', {}).get('id')
                else:
                    errors.append(f'{email}: auth user exists but cannot sign in')
                    continue
            else:
                errors.append(f'{email}: {str(data)[:200]}')
                continue
            if uid:
                existing_user = _service_table('users').select(filters={'id': f'eq.{uid}'})
                if existing_user:
                    skipped.append(email)
                else:
                    profile = {'id': uid, 'email': email, 'full_name': name, 'role': role}
                    if class_name:
                        profile['class_name'] = class_name
                    _service_table('users').insert(profile)
                    seeded.append(email)
        except Exception as e:
            errors.append(f'{email}: {str(e)[:200]}')
    _seeded = True
    return jsonify({'seeded': seeded, 'skipped': skipped, 'errors': errors})


@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('api/'):
        return jsonify({'detail': 'API endpoint not found'}), 404
    if os.path.exists(os.path.join(app.static_folder, filename)):
        return app.send_static_file(filename)
    return app.send_static_file('index.html')


if __name__ == '__main__':
    logging.info('Starting application with Supabase backend')
    app.run(debug=True, host='0.0.0.0', port=5000)
