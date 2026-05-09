const SUPABASE_URL = 'https://jajfahyuglhbftphsktk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphamZhaHl1Z2xoYmZ0cGhza3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODIzODcsImV4cCI6MjA5Mzg1ODM4N30.XBIGvJZgFwdopeSotXqNMl1GWyBs-0A8DvtoIS4XsZU';

let supabaseClient = null;

async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
    });
    return supabaseClient;
}

async function getToken() {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
}

async function requireAuth(loginUrl) {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) {
        window.location.href = loginUrl || '/';
    }
    return sb;
}

async function logout(redirectUrl) {
    const sb = await getSupabase();
    await sb.auth.signOut();
    window.location.href = redirectUrl || '/';
}

async function authFetch(url, options = {}) {
    const token = await getToken();
    const headers = options.headers || {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
}

async function login(email, password, role) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const resp = await authFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role })
    });
    const result = await resp.json();
    if (!resp.ok) {
        await sb.auth.signOut();
        throw new Error(result.detail || 'Login failed');
    }
    return result;
}
