import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

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
        print(f'Created auth user: {email} (role={role})')
        if uid:
            profile = {'id': uid, 'email': email, 'full_name': name, 'role': role}
            if class_name:
                profile['class_name'] = class_name
            sb.table('users').insert(profile)
            print(f'  Profile created')
    else:
        err = str(data)
        if 'already exists' in err.lower():
            uid = data.get('id')
            print(f'User already exists: {email}')
            if uid:
                existing = sb.table('users').select(filters={'id': f'eq.{uid}'})
                if not existing:
                    profile = {'id': uid, 'email': email, 'full_name': name, 'role': role}
                    if class_name:
                        profile['class_name'] = class_name
                    sb.table('users').insert(profile)
                    print(f'  Profile created')
        else:
            print(f'ERROR {email}: {err[:300]}')

print('\nDone! You can now login with:')
print('  admin@forestry.edu / Admin123!  (Admin Portal)')
print('  teacher@forestry.edu / Teacher123!  (Teacher Portal)')
print('  student@forestry.edu / Student123!  (Student Portal)')
