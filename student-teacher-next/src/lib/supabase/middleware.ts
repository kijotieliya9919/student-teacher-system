import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const loginUrl = new URL('/login', request.url)

  if (path.startsWith('/student') || path.startsWith('/teacher') || path.startsWith('/admin')) {
    if (!user) {
      const res = NextResponse.redirect(loginUrl)
      for (const c of supabaseResponse.cookies.getAll()) {
        res.cookies.set(c.name, c.value, c)
      }
      return res
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role || ''

    if (path.startsWith('/student') && role !== 'student') return NextResponse.redirect(loginUrl)
    if (path.startsWith('/teacher') && role !== 'teacher') return NextResponse.redirect(loginUrl)
    if (path.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(loginUrl)

    request.cookies.set('__uid', user.id)
    request.cookies.set('__role', role)
    supabaseResponse.cookies.set('__uid', user.id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 3600 })
    supabaseResponse.cookies.set('__role', role, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 3600 })
  }

  return supabaseResponse
}
