import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from './supabase/server'

export async function getUserFromHeaders() {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = h.get('x-user-role')
  return { userId, role }
}

export async function requireAuth(requiredRole?: 'student' | 'teacher' | 'admin') {
  const { userId, role } = await getUserFromHeaders()

  if (!userId) redirect('/login')
  if (requiredRole && role !== requiredRole) redirect('/login')

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return { userId, role, profile, svc }
}
