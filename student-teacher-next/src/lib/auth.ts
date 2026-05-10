import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from './supabase/server'

export async function requireAuth(requiredRole?: 'student' | 'teacher' | 'admin') {
  const cookieStore = await cookies()
  let userId = cookieStore.get('__uid')?.value
  let role = cookieStore.get('__role')?.value

  if (!userId) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      redirect('/login')
    }
    userId = user!.id

    const svc = createServiceClient()
    const { data: profile } = await svc
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    role = profile?.role || ''
  }

  if (requiredRole && role !== requiredRole) {
    redirect('/login')
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return { userId, role, profile, svc }
}
