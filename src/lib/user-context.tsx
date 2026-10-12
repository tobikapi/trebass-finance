'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission, type PermissionKey, type Role } from '@/lib/permissions'
import type { InitialUser } from '@/lib/server-user'

export interface Profile {
  id: string
  name: string
  email: string
  role_id: string | null
}

const VIEW_AS_COOKIE = 'trebass_view_as'

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

export function UserProvider({ children, initial }: { children: React.ReactNode; initial: InitialUser }) {
  // Výchozí stav přichází ze serveru (root layout) — první vykreslení tak
  // rovnou zná jméno i roli a nic neproblikne v omezeném pohledu.
  const [user, setUser] = useState<User | null>(initial.user)
  const [profile, setProfile] = useState<Profile | null>(initial.profile)
  const [realRole, setRealRole] = useState<Role | null>(initial.realRole)
  const [allRoles, setAllRoles] = useState<Role[]>(initial.allRoles)
  const [loading, setLoading] = useState(false)
  const [viewAsRoleId, setViewAsRoleId] = useState<string | null>(initial.viewAsRoleId)
  const userIdRef = useRef<string | null>(initial.user?.id ?? null)
  const loadSeq = useRef(0)

  useEffect(() => {
    let mounted = true

    // Profil a role se načítají zvlášť schválně: kdyby tabulka `roles` ještě
    // neexistovala (nedoběhlá migrace), nesmí to shodit i načtení jména a e-mailu.
    // loadSeq: když se dvě načtení překryjí, uloží se jen to poslední —
    // dřív starší (pomalejší) načtení umělo přepsat novější výsledek.
    async function loadFor(currentUser: User | null) {
      const seq = ++loadSeq.current
      const isCurrent = () => mounted && seq === loadSeq.current
      if (!currentUser) {
        if (isCurrent()) { setProfile(null); setRealRole(null); setAllRoles([]) }
        return
      }
      setLoading(true)
      try {
        const { data } = await supabase.from('profiles')
          .select('id, name, email, role_id').eq('id', currentUser.id).maybeSingle()
        let roleRow: Role | null = null
        if (data?.role_id) {
          const res = await supabase.from('roles')
            .select('id, name, color, permissions, is_system').eq('id', data.role_id).maybeSingle()
          roleRow = res.data
        }
        let roles: Role[] = []
        if (roleRow?.permissions?.admin === true) {
          const res = await supabase.from('roles').select('id, name, color, permissions, is_system').order('name')
          roles = res.data || []
        }
        if (isCurrent()) { setProfile(data); setRealRole(roleRow); setAllRoles(roles) }
      } catch {
        // Role se nenačetla — necháváme předchozí stav.
        // Server a databáze mají vlastní kontrolu, tohle je jen skrývání v UI.
      } finally {
        if (isCurrent()) setLoading(false)
      }
    }

    // Znovu načítat jen při skutečné změně přihlášeného člověka. Obnovení
    // tokenu (TOKEN_REFRESHED) ani úvodní INITIAL_SESSION pro stejného
    // uživatele nic nemění — data už přišla ze serveru.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      const newId = currentUser?.id ?? null
      if (newId === userIdRef.current) return
      userIdRef.current = newId
      if (!currentUser) {
        // Odhlášení (i v jiné záložce) — plné načtení vyčistí vše v paměti.
        window.location.assign('/login')
        return
      }
      setUser(currentUser)
      // Supabase doporučuje v callbacku nevolat další dotazy synchronně.
      setTimeout(() => { loadFor(currentUser) }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isRealAdmin = realRole?.permissions?.admin === true

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
