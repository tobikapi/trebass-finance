'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission, type PermissionKey, type Role } from '@/lib/permissions'
import type { InitialUser } from '@/lib/server-user'
import { ACTIVE_ORG_COOKIE, brandOf, LOOK_DEFAULT, type OrgBrand, type OrgLook, type OrgMembership } from '@/lib/orgs'

export interface Profile {
  id: string
  name: string
  email: string
  role_id: string | null
}

const VIEW_AS_COOKIE = 'trebass_view_as'

function setCookie(name: string, value: string | null, maxAge = 86400) {
  document.cookie = value === null
    ? `${name}=; path=/; max-age=0`
    : `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
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
  orgs: OrgMembership[]          // firmy, ve kterých člověk je
  orgId: string | null           // aktivní firma — podle ní se filtrují seznamy a zapisují nové záznamy
  brand: OrgBrand                // vzhled aktivní firmy
  isOwner: boolean               // majitel v aktivní firmě
  orgLook: OrgLook               // vzhled aktivní firmy (pozadí)
  switchOrg: (orgId: string, path?: string) => void
}

const UserContext = createContext<UserContextType>({
  user: null, profile: null, role: null, realRole: null, allRoles: [],
  loading: true, can: () => true, viewAsRoleId: null, setViewAs: () => {},
  orgs: [], orgId: null, brand: brandOf(null), isOwner: false, orgLook: LOOK_DEFAULT, switchOrg: () => {},
})

export function UserProvider({ children, initial }: { children: React.ReactNode; initial: InitialUser }) {
  // Výchozí stav přichází ze serveru (root layout) — první vykreslení tak
  // rovnou zná jméno i roli a nic neproblikne v omezeném pohledu.
  const user = initial.user
  const profile = initial.profile
  const realRole = initial.realRole
  const allRoles = initial.allRoles
  const loading = false
  const [viewAsRoleId, setViewAsRoleId] = useState<string | null>(initial.viewAsRoleId)
  const userIdRef = useRef<string | null>(initial.user?.id ?? null)

  useEffect(() => {
    let mounted = true

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
      // Přihlásil se někdo jiný (např. v jiné záložce) — role a firmy se
      // počítají na serveru, nejjistější je načíst appku znovu.
      window.location.reload()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isRealAdmin = realRole?.permissions?.admin === true

  // Přepnutí firmy: cookie + plné načtení. Všechno (seznamy, role, vzhled,
  // undo historie) patří k firmě, takže čistý start je nejbezpečnější.
  // Náhled „Zobrazit jako" se ruší — role jsou v každé firmě jiné.
  const switchOrg = useCallback((orgId: string, path = '/') => {
    setCookie(ACTIVE_ORG_COOKIE, orgId, 60 * 60 * 24 * 365)
    setCookie(VIEW_AS_COOKIE, null)
    window.location.assign(path)
  }, [])

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
      orgs: initial.orgs, orgId: initial.activeOrgId, brand: brandOf(initial.activeOrgId),
      isOwner: initial.isOwner, orgLook: initial.orgLook, switchOrg,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
