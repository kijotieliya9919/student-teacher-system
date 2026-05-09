import os
import requests
from datetime import datetime

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://jajfahyuglhbftphsktk.supabase.co')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphamZhaHl1Z2xoYmZ0cGhza3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODIzODcsImV4cCI6MjA5Mzg1ODM4N30.XBIGvJZgFwdopeSotXqNMl1GWyBs-0A8DvtoIS4XsZU')

HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

def _headers(token=None):
    h = dict(HEADERS)
    if token:
        h['Authorization'] = f'Bearer {token}'
        if token == SERVICE_KEY and SERVICE_KEY:
            h['apikey'] = SERVICE_KEY
    return h

# ─── Auth ────────────────────────────────────────────────────────────

def sign_in(email, password):
    r = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        json={'email': email, 'password': password},
        headers={'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json'}
    )
    return r.status_code, r.json()

def sign_up(email, password, user_data=None):
    body = {'email': email, 'password': password}
    if user_data:
        body['data'] = user_data
    r = requests.post(
        f'{SUPABASE_URL}/auth/v1/signup',
        json=body,
        headers={'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json'}
    )
    return r.status_code, r.json()

def get_user(token):
    r = requests.get(
        f'{SUPABASE_URL}/auth/v1/user',
        headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}'}
    )
    return r.status_code, r.json()

def admin_create_user(email, password, user_metadata):
    """Uses service_role key — for seeding only. Requires SUPABASE_SERVICE_KEY env var."""
    key = os.getenv('SUPABASE_SERVICE_KEY', SUPABASE_ANON_KEY)
    r = requests.post(
        f'{SUPABASE_URL}/auth/v1/admin/users',
        json={'email': email, 'password': password, 'email_confirm': True, 'user_metadata': user_metadata},
        headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    )
    return r.status_code, r.json()

# ─── Database ────────────────────────────────────────────────────────

class Table:
    def __init__(self, name, token=None):
        self.name = name
        self.url = f'{SUPABASE_URL}/rest/v1/{name}'
        self.headers = _headers(token)
    
    def select(self, columns='*', filters=None, order=None, limit=None, single=False):
        params = {'select': columns}
        if filters:
            for k, v in filters.items():
                params[k] = v
        if order:
            params['order'] = order
        if limit:
            params['limit'] = limit
        r = requests.get(self.url, headers=self.headers, params=params)
        if r.status_code == 200:
            data = r.json()
            return data[0] if single and data else data
        return []
    
    def insert(self, data):
        r = requests.post(self.url, headers=self.headers, json=data)
        if r.status_code == 201:
            return r.json()
        body = r.json() if r.text else {}
        if 'error' in body or r.status_code >= 400:
            import logging
            logging.warning(f'INSERT {self.name} failed: status={r.status_code}, body={str(body)[:200]}')
        return body
    
    def update(self, data, filters):
        params = {}
        for k, v in filters.items():
            params[k] = f'eq.{v}'
        r = requests.patch(self.url, headers=self.headers, params=params, json=data)
        return r.status_code, r.json() if r.text else {}
    
    def delete(self, filters):
        params = {}
        for k, v in filters.items():
            params[k] = f'eq.{v}'
        r = requests.delete(self.url, headers=self.headers, params=params)
        return r.status_code, r.json() if r.text else {}
    
    def count(self, filters=None):
        headers = dict(self.headers)
        headers['Prefer'] = 'count=exact'
        headers['Accept'] = 'application/json'
        params = {'select': 'id'}
        if filters:
            for k, v in filters.items():
                params[k] = v
        r = requests.get(self.url, headers=headers, params=params)
        if r.status_code == 200:
            try:
                return len(r.json())
            except:
                pass
        return 0

def table(name, token=None):
    return Table(name, token)

# ─── Storage ─────────────────────────────────────────────────────────

def upload_file(bucket, path, file_data, content_type='application/octet-stream', token=None):
    url = f'{SUPABASE_URL}/storage/v1/object/{bucket}/{path}'
    headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token or SUPABASE_ANON_KEY}'}
    if content_type:
        headers['Content-Type'] = content_type
    r = requests.post(url, headers=headers, data=file_data)
    return r.status_code, r.json()

def download_file(bucket, path, token=None):
    url = f'{SUPABASE_URL}/storage/v1/object/{bucket}/{path}'
    headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token or SUPABASE_ANON_KEY}'}
    r = requests.get(url, headers=headers)
    return r.status_code, r.content

def get_public_url(bucket, path):
    return f'{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}'

def list_files(bucket, prefix='', token=None):
    url = f'{SUPABASE_URL}/storage/v1/object/list/{bucket}'
    headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token or SUPABASE_ANON_KEY}', 'Content-Type': 'application/json'}
    r = requests.post(url, headers=headers, json={'prefix': prefix})
    return r.status_code, r.json()

# ─── Role helpers ────────────────────────────────────────────────────

def get_user_role(token):
    status, data = get_user(token)
    if status != 200:
        return None
    meta = data.get('user_metadata', {})
    return meta.get('role')

def get_user_id(token):
    status, data = get_user(token)
    if status != 200:
        return None
    return data.get('id')

def get_user_email(token):
    status, data = get_user(token)
    if status != 200:
        return None
    return data.get('email')

def get_user_profile(token):
    status, data = get_user(token)
    if status != 200:
        return None
    uid = data.get('id')
    if not uid:
        return None
    users = table('users', token).select(filters={'id': f'eq.{uid}'}, single=True)
    if not users:
        return None
    if isinstance(users, list):
        users = users[0] if users else None
    return users
