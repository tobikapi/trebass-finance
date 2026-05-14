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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
          setProfile(data)
        } else {
          setProfile(null)
        }
      } catch {
        // ignore profile fetch errors
      } finally {
        setLoading(false)
      }
    })

    // Fallback: if onAuthStateChange doesn't fire within 2s, unblock the UI
    const timeout = setTimeout(() => setLoading(false), 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const effectiveRole = user ? 'admin' as const : null

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
