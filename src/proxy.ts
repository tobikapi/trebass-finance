import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { ACTIVE_ORG_COOKIE, pickActiveOrg } from '@/lib/orgs'

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
    // Jedním dotazem i firmy, ve kterých člověk je — podle nich se ohlídá
    // cookie s aktivní firmou (stránky jí pak věří a filtrují podle ní;
    // databáze cizí firmu stejně nevydá).
    const { data: profile } = await supabase.from('profiles')
      .select('must_change_password, org_members(org_id)').eq('id', user.id).single()
    const memberOrgIds = ((profile?.org_members as { org_id: string }[] | null) || []).map(m => m.org_id)
    const current = req.cookies.get(ACTIVE_ORG_COOKIE)?.value
    const active = pickActiveOrg(memberOrgIds, current)
    if (active && active !== current) {
      req.cookies.set(ACTIVE_ORG_COOKIE, active)
      const fixed = NextResponse.next({ request: req })
      supabaseResponse.cookies.getAll().forEach(c => fixed.cookies.set(c))
      fixed.cookies.set(ACTIVE_ORG_COOKIE, active, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
      supabaseResponse = fixed
    }
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
