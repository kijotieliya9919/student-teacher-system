import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from './supabase/server'

export async function requireAuth(requiredRole?: 'student' | 'teacher' | 'admin') {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single()

  const role = profile?.role || ''

  if (requiredRole && role !== requiredRole) {
    redirect('/login')
  }

  return { userId: user!.id, role, profile, svc }
}
