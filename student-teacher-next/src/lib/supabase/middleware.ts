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
    if (!user) return NextResponse.redirect(loginUrl)

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role

    if (path.startsWith('/student') && role !== 'student') return NextResponse.redirect(loginUrl)
    if (path.startsWith('/teacher') && role !== 'teacher') return NextResponse.redirect(loginUrl)
    if (path.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(loginUrl)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-role', role || '')

    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
    const cookiesToSet: { name: string; value: string; options?: any }[] = []
    const s = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookies) { cookiesToSet.push(...cookies) },
        },
      }
    )
    const { data: { user: u } } = await s.auth.getUser()
    void u
    cookiesToSet.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, options)
    )
  }

  return supabaseResponse
}
