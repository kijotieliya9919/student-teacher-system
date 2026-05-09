import os, sys, json
sys.path.insert(0, r'C:\Users\MR PETER\Videos\ftihub\student-teacher-system')
os.chdir(r'C:\Users\MR PETER\Videos\ftihub\student-teacher-system')
from dotenv import load_dotenv
load_dotenv()
import supabase_helper as sb

token = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjJkNzVhZjQ2LWJjMjctNGM1ZS05ZWI0LWVhOGMxZDlmNzZhYiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2phamZhaHl1Z2xoYmZ0cGhza3RrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlY2ZiOTk0Yi05ZDNlLTRhYjItYWFjMi1mZjEzNDliYTVmNDkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4MzQ0OTA3LCJpYXQiOjE3NzgzNDEzMDcsImVtYWlsIjoic3R1ZGVudEBmb3Jlc3RyeS5lZHUiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJEZWZhdWx0IFN0dWRlbnQiLCJyb2xlIjoic3R1ZGVudCJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc4MzQxMzA3fV0sInNlc3Npb25faWQiOiIyY2Q0NmI4OS1kMDI3LTQ5Y2EtYjhhYS01ODZkY2RiYzJhMWUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.uZpYOltInqjDXuOLnTxV-46taYtGCnDVCt_IpZUnrit6lBnBUkoKhsi1j4PyiM6R0VQBacZqrYJJw09Q6ObylA'

# Test 1: Query assignments with student token
print('=== With student token ===')
assignments = sb.table('assignments', token).select(order='created_at.desc')
print(f'Assignments count: {len(assignments)}')
for a in (assignments or []):
    print(f'  Assignment: id={a.get("id")}, title={a.get("title")}, course_id={a.get("course_id")}')

# Test 2: Query courses with student token
print()
print('=== Courses with token ===')
courses = sb.table('courses', token).select()
for c in (courses or []):
    print(f'  Course: id={c.get("id")}, title={c.get("title")}')

# Test 3: Query assignments without token (anon)
print()
print('=== Without token (anon) ===')
assignments2 = sb.table('assignments').select(order='created_at.desc')
print(f'Assignments count: {len(assignments2)}')
for a in (assignments2 or []):
    print(f'  Assignment: id={a.get("id")}, title={a.get("title")}')

# Test 4: Query enrollments
print()
print('=== Enrollments with token ===')
enrollments = sb.table('enrollments', token).select()
print(f'Enrollments count: {len(enrollments)}')

# Test 5: Query notifications  
print()
print('=== Notifications with token ===')
notifs = sb.table('notifications', token).select()
print(f'Notifications count: {len(notifs)}')
for n in (notifs or []):
    print(f'  Notification: {n.get("subject")}')

# Test 6: Check student profile
print()
print('=== Student profile ===')
users = sb.table('users', token).select(filters={'id': f'eq.{token}'})
print(f'Users: {json.dumps(users, indent=2)[:300]}')
