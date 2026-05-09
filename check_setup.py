import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SRV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphamZhaHl1Z2xoYmZ0cGhza3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI4MjM4NywiZXhwIjoyMDkzODU4Mzg3fQ.VzUQCQUvVPxAAhV16h_mFQ16grQlYuNa3A4tIRyafic'
os.environ['SUPABASE_SERVICE_KEY'] = SRV_KEY

import supabase_helper as sb
import requests

headers = {
    'apikey': sb.SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SRV_KEY}',
    'Content-Type': 'application/json'
}

# Check if users table exists
r = requests.get(f'{sb.SUPABASE_URL}/rest/v1/users', headers=headers, params={'select': 'id', 'limit': 1})
print(f'Users table: status={r.status_code}')
if r.status_code == 200:
    print('  Table EXISTS')
elif r.status_code == 404:
    print('  Table NOT FOUND (need to run migration)')
elif r.status_code == 400:
    print(f'  Response: {r.text[:200]}')
else:
    print(f'  Response: {r.text[:200]}')

# Try running SQL via various endpoints
for endpoint, payload in [
    ('/rest/v1/rpc/exec_sql', {'sql': 'SELECT 1'}),
    ('/rest/v1/rpc/pg_query', {'query': 'SELECT 1'}),
    ('/rest/v1/sql', {'query': 'SELECT 1'}),
]:
    try:
        r2 = requests.post(f'{sb.SUPABASE_URL}{endpoint}', headers=headers, json=payload)
        print(f'{endpoint}: status={r2.status_code}')
        if r2.status_code == 200:
            print(f'  response: {r2.text[:200]}')
    except Exception as e:
        print(f'{endpoint}: error={e}')
