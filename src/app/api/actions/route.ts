import { NextRequest, NextResponse } from 'next/server'
import * as actions from '@/app/actions'

type ActionFn = (...args: unknown[]) => Promise<unknown>
const dispatch = actions as unknown as Record<string, ActionFn>

export async function POST(req: NextRequest) {
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
