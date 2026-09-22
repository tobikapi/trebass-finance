import { NextRequest, NextResponse } from 'next/server'
import * as actions from '@/app/actions'

type ActionFn = (...args: unknown[]) => Promise<unknown>
const dispatch = actions as unknown as Record<string, ActionFn>

// Tenhle endpoint se autentizuje jen cookie (žádný CSRF token) — bez kontroly
// Origin by šlo mutace spustit z cizí stránky (klasické CSRF přes fetch nebo
// <form enctype="text/plain">, který se otiskne jako platné JSON tělo).
// Next.js Server Actions tohle řeší samy, tenhle ruční dispatcher ne.
function isTrustedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // same-origin požadavky (ne-CORS) Origin hlavičku často nemají vůbec
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: 'Neplatný původ požadavku.' }, { status: 403 })
  }
  const { fn, args } = await req.json() as { fn: string; args: unknown[] }
  const handler = dispatch[fn]
  if (typeof handler !== 'function') {
    return NextResponse.json({ error: 'Neznámá akce: ' + fn }, { status: 400 })
  }
  try {
    const result = await handler(...(args || []))
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
