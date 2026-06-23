export async function callAction<T = { data?: unknown; error?: string }>(fn: string, ...args: unknown[]): Promise<T> {
  const res = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args }),
  })
  if (!res.ok && res.status >= 500) {
    return { error: `Server error (${res.status})` } as T
  }
  return res.json()
}
