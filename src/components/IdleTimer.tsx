'use client'

import { useEffect, useRef, useTransition } from 'react'
import { signOut } from '@/app/login/actions'
import { useUser } from '@/lib/user-context'
import { getIdleMinutes, IDLE_CHANGE_EVENT, LAST_ACTIVITY_KEY } from '@/lib/idle-setting'

// Automatické odhlášení po nečinnosti (čas si volí uživatel, viz idle-setting).
// Počítá se podle času poslední aktivity, ne podle běžícího časovače: na iPhonu
// se časovače na pozadí zastaví, takže po návratu do appky by se dřív neodhlásilo.
// Čas poslední aktivity je v localStorage — sdílí se mezi záložkami.
export default function IdleTimer() {
  const { user } = useUser()
  const [, startTransition] = useTransition()
  const signingOut = useRef(false)

  useEffect(() => {
    if (!user) return
    let lastWrite = 0

    const markActive = () => {
      const now = Date.now()
      if (now - lastWrite < 5000) return // zápis nejvýš jednou za 5 s
      lastWrite = now
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)) } catch {}
    }

    const check = () => {
      if (signingOut.current) return
      let last = Date.now()
      try { last = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now() } catch {}
      if (Date.now() - last >= getIdleMinutes() * 60_000) {
        signingOut.current = true
        startTransition(async () => { await signOut(); window.location.assign('/login') })
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    // Po přihlášení / načtení začíná odpočet znovu
    lastWrite = 0; markActive()

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    window.addEventListener(IDLE_CHANGE_EVENT, check)
    const id = setInterval(check, 15_000)

    return () => {
      clearInterval(id)
      events.forEach(e => window.removeEventListener(e, markActive))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      window.removeEventListener(IDLE_CHANGE_EVENT, check)
    }
  }, [user])

  return null
}
