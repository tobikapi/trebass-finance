'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { EVENT_PERMISSION_KEYS, type PermissionKey, type Permissions } from '@/lib/permissions'

// Výjimky přihlášeného člověka v jedné akci (event_access.permissions).
// Paměť mezi záložkami stejné akce — jinak by se při každém přepnutí
// znovu stahovaly a záložky by na chvíli problikly.
const cache = new Map<string, Permissions>()

/**
 * Oprávnění uvnitř konkrétní akce = role NEBO výjimka v té akci.
 * Stejná logika jako has_event_perm() v databázi — tady jde jen o to,
 * co appka ukáže, vynucuje to databáze.
 * Při náhledu „Zobrazit jako" se výjimky ignorují (náhled ukazuje roli).
 */
export function useEventPermissions(eventId: string) {
  const { user, can, viewAsRoleId } = useUser()
  const [exceptions, setExceptions] = useState<Permissions>(() => cache.get(eventId) ?? {})

  useEffect(() => {
    if (!user) return
    let active = true
    supabase.from('event_access').select('permissions')
      .eq('event_id', eventId).eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return
        const perms = (data?.permissions ?? {}) as Permissions
        cache.set(eventId, perms)
        setExceptions(perms)
      })
    return () => { active = false }
  }, [eventId, user])

  const canInEvent = useCallback((key: PermissionKey) => {
    if (can(key)) return true
    if (viewAsRoleId) return false
    return EVENT_PERMISSION_KEYS.includes(key) && exceptions[key] === true
  }, [can, viewAsRoleId, exceptions])

  return { canInEvent, exceptions }
}
