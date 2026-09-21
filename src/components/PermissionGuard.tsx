'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/user-context'
import type { PermissionKey } from '@/lib/permissions'

// Vykreslí nic, jen po načtení role přesměruje pryč, když na stránku nemá
// uživatel právo (nav skrývání je jen doplněk, tohle brání i přímému URL).
export default function PermissionGuard({ permission, redirectTo = '/ukoly' }: { permission: PermissionKey; redirectTo?: string }) {
  const { can, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !can(permission)) router.replace(redirectTo)
  }, [loading, can, permission, redirectTo, router])

  return null
}
