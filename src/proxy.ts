import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !req.nextUrl.pathname.startsWith('/login')) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && req.nextUrl.pathname === '/login') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Nové/resetnuté heslo je jednorázové (admin ho zná a řekl ho osobně) —
  // dokud si člověk nenastaví vlastní, appka ho pustí jen na tuhle stránku.
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('must_change_password').eq('id', user.id).single()
    const mustChange = profile?.must_change_password === true
    if (mustChange && req.nextUrl.pathname !== '/zmena-hesla') {
      const url = req.nextUrl.clone()
      url.pathname = '/zmena-hesla'
      return NextResponse.redirect(url)
    }
    if (!mustChange && req.nextUrl.pathname === '/zmena-hesla') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)'],
}
