'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission, type PermissionKey, type Role } from '@/lib/permissions'

export interface Profile {
  id: string
  name: string
  email: string
  role_id: string | null
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  role: Role | null
  loading: boolean
  can: (key: PermissionKey) => boolean
}

const UserContext = createContext<UserContextType>({
  user: null, profile: null, role: null, loading: true, can: () => true,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Profil a role se načítají zvlášť schválně: kdyby tabulka `roles` ještě
    // neexistovala (nedoběhlá migrace), nesmí to shodit i načtení jména a e-mailu.
    async function loadFor(currentUser: User | null) {
      if (!currentUser) {
        if (mounted) { setProfile(null); setRole(null) }
        return
      }
      try {
        const { data } = await supabase.from('profiles')
          .select('id, name, email, role_id').eq('id', currentUser.id).single()
        if (mounted) setProfile(data)
        if (data?.role_id) {
          const { data: roleRow } = await supabase.from('roles')
            .select('id, name, color, permissions, is_system').eq('id', data.role_id).single()
          if (mounted) setRole(roleRow)
        } else if (mounted) {
          setRole(null)
        }
      } catch {
        // Role se nenačetla — necháváme null, což znamená plný přístup.
        // Server má vlastní kontrolu, tohle je jen skrývání v UI.
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      await loadFor(currentUser)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      await loadFor(currentUser)
      if (mounted) setLoading(false)
    })

    const timeout = setTimeout(() => { if (mounted) setLoading(false) }, 2000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  /**
   * Skrývání v UI. Dokud se role načítá, vrací `true` — tedy NIC neskrývá.
   *
   * Tohle je záměrné a je to poučení z prvního pokusu o role (květen 2026):
   * tehdejší `can()` vracelo při nenačtené roli `false`, takže při každém
   * zaškobrtnutí zmizela celá appka a systém se musel do druhého dne vypnout.
   * Skrývání v UI je kosmetika — skutečné omezení vynucuje server v actions.ts,
   * takže být během načítání vstřícný nic neriskuje.
   */
  function can(key: PermissionKey): boolean {
    if (loading) return true
    return hasPermission(role?.permissions ?? null, key)
  }

  return (
    <UserContext.Provider value={{ user, profile, role, loading, can }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
