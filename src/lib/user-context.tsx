'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission, type PermissionKey, type Role } from '@/lib/permissions'

export interface Profile {
  id: string
  name: string
  email: string
  role_id: string | null
}

const VIEW_AS_COOKIE = 'trebass_view_as'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}
function setCookie(name: string, value: string | null) {
  document.cookie = value === null
    ? `${name}=; path=/; max-age=0`
    : `${name}=${encodeURIComponent(value)}; path=/; max-age=86400`
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  role: Role | null       // efektivní role pro can() — při náhledu ta zvolená, jinak skutečná
  realRole: Role | null   // skutečná role z DB, nikdy „nenafejkovaná" — na tuhle se gatuje sám přepínač
  allRoles: Role[]        // pro nabídku v přepínači „Zobrazit jako"
  loading: boolean
  can: (key: PermissionKey) => boolean
  viewAsRoleId: string | null
  setViewAs: (roleId: string | null) => void
}

const UserContext = createContext<UserContextType>({
  user: null, profile: null, role: null, realRole: null, allRoles: [],
  loading: true, can: () => true, viewAsRoleId: null, setViewAs: () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [realRole, setRealRole] = useState<Role | null>(null)
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [viewAsRoleId, setViewAsRoleId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Profil a role se načítají zvlášť schválně: kdyby tabulka `roles` ještě
    // neexistovala (nedoběhlá migrace), nesmí to shodit i načtení jména a e-mailu.
    async function loadFor(currentUser: User | null) {
      if (!currentUser) {
        if (mounted) { setProfile(null); setRealRole(null) }
        return
      }
      try {
        const { data } = await supabase.from('profiles')
          .select('id, name, email, role_id').eq('id', currentUser.id).single()
        if (mounted) setProfile(data)
        if (data?.role_id) {
          const { data: roleRow } = await supabase.from('roles')
            .select('id, name, color, permissions, is_system').eq('id', data.role_id).single()
          if (mounted) setRealRole(roleRow)
        } else if (mounted) {
          setRealRole(null)
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

  const isRealAdmin = realRole?.permissions?.admin === true

  // Jen skuteční admini smí mít aktivní náhled jiné role — `effectiveViewAsId`
  // níž na tom trvá bez ohledu na tenhle state, takže ho stačí jen nastavit
  // pro adminy a nikdy explicitně resetovat (odvozená hodnota to ohlídá sama).
  useEffect(() => {
    if (!isRealAdmin) return
    supabase.from('roles').select('id, name, color, permissions, is_system').order('name')
      .then(({ data }) => setAllRoles(data || []))
    const saved = getCookie(VIEW_AS_COOKIE)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové obnovení z cookie při mountu, ne odvozený stav
    if (saved) setViewAsRoleId(saved)
  }, [isRealAdmin])

  const setViewAs = useCallback((roleId: string | null) => {
    setViewAsRoleId(roleId)
    setCookie(VIEW_AS_COOKIE, roleId)
  }, [])

  const effectiveViewAsId = isRealAdmin ? viewAsRoleId : null
  const role = effectiveViewAsId
    ? (allRoles.find(r => r.id === effectiveViewAsId) ?? realRole)
    : realRole

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
    <UserContext.Provider value={{
      user, profile, role, realRole, allRoles, loading, can,
      viewAsRoleId: effectiveViewAsId, setViewAs,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
