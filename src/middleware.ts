import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization')

  if (auth) {
    const [scheme, encoded] = auth.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
      const colonIndex = decoded.indexOf(':')
      const user = decoded.slice(0, colonIndex)
      const pass = decoded.slice(colonIndex + 1)
      const validUser = process.env.AUTH_USER
      const validPass = process.env.AUTH_PASS
      if (user === validUser && pass === validPass) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Přístup zamítnut', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Trebass Finance"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
