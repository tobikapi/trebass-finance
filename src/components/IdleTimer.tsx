'use client'

import { useEffect, useRef, useTransition } from 'react'
import { signOut } from '@/app/login/actions'
import { useUser } from '@/lib/user-context'

const IDLE_MS = 10 * 60 * 1000 // 10 minut

export default function IdleTimer() {
  const { user } = useUser()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!user) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        startTransition(() => signOut())
      }, IDLE_MS)
    }

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [user])

  return null
}
