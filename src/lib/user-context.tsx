'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Role, Permission, can as canFn } from '@/lib/permissions'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  role: Role | null
  can: (permission: Permission) => boolean
  loading: boolean
}

const UserContext = createContext<UserContextType>({
  user: null, profile: null, role: null,
  can: () => false, loading: true,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Read session from localStorage immediately — avoids nav flash on first render
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
          if (mounted) setProfile(data)
        } catch { /* ignore */ }
      }
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      try {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
          if (mounted) setProfile(data)
        } else {
          if (mounted) setProfile(null)
        }
      } catch {
        // ignore profile fetch errors
      } finally {
        if (mounted) setLoading(false)
      }
    })

    const timeout = setTimeout(() => { if (mounted) setLoading(false) }, 2000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // During loading, assume admin — proxy.ts guarantees only authenticated users reach here.
  // Without this, nav items flash invisible until getSession() resolves (~200ms).
  const effectiveRole = (loading || user) ? 'admin' as const : null

  return (
    <UserContext.Provider value={{
      user,
      profile,
      role: effectiveRole,
      can: (p) => canFn(effectiveRole, p),
      loading,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
