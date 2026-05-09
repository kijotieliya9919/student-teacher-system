import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export async function requireAuth(requiredRole?: 'student' | 'teacher' | 'admin') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (requiredRole) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== requiredRole) {
      redirect('/login')
    }
  }

  return { supabase, user }
}
