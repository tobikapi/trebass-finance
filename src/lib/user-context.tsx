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
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
      setLoading(false)
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // AUTH DOČASNĚ VYPNUTO — bez uživatele defaultujeme na admin
  const effectiveRole = profile?.role ?? (user ? null : 'admin' as const)

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
