'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  name: string
  email: string
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
}

const UserContext = createContext<UserContextType>({
  user: null, profile: null, loading: true,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        try {
          const { data } = await supabase.from('profiles').select('id, name, email').eq('id', currentUser.id).single()
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
          const { data } = await supabase.from('profiles').select('id, name, email').eq('id', currentUser.id).single()
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

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
