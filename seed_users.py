import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ['SUPABASE_SERVICE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphamZhaHl1Z2xoYmZ0cGhza3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI4MjM4NywiZXhwIjoyMDkzODU4Mzg3fQ.VzUQCQUvVPxAAhV16h_mFQ16grQlYuNa3A4tIRyafic'

import supabase_helper as sb

users = [
    ('admin@forestry.edu', 'Admin123!', 'System Administrator', 'admin', None),
    ('teacher@forestry.edu', 'Teacher123!', 'Default Instructor', 'teacher', 'BCF Year 1'),
    ('student@forestry.edu', 'Student123!', 'Default Student', 'student', 'BCF Year 1'),
]

for email, pw, name, role, class_name in users:
    status, data = sb.admin_create_user(email, pw, {'role': role, 'full_name': name})
    if status in (200, 201):
        uid = data.get('id')
        print(f'Created auth user: {email} (role={role}, id={uid})')
        if uid:
            profile = {'id': uid, 'email': email, 'full_name': name, 'role': role}
            if class_name:
                profile['class_name'] = class_name
            r = sb.table('users').insert(profile)
            print(f'  Profile inserted')
    else:
        err = str(data)
        print(f'Status {status} for {email}: {err[:200]}')
        uid = data.get('id')
        if uid:
            existing = sb.table('users').select(filters={'id': f'eq.{uid}'})
            if not existing:
                profile = {'id': uid, 'email': email, 'full_name': name, 'role': role}
                if class_name:
                    profile['class_name'] = class_name
                sb.table('users').insert(profile)
                print(f'  Profile created for existing user')
        else:
            print(f'  Could not get UID')
