import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasPermission, type Permissions, type Role } from '@/lib/permissions'
import { getActiveOrgId } from '@/lib/server-user'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  // Server component vrací data v prvotním HTML/RSC payloadu ještě před tím,
  // než by se stihl uplatnit jakýkoliv klientský PermissionGuard — seznam
  // lidí a rolí by jinak unikl komukoliv přihlášenému, kdo sem jen dojede
  // přímým odkazem. Kontrola proto musí být tady, ne (jen) v klientovi.
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = await getActiveOrgId()
  if (!user || !orgId) redirect('/')
  const { data: me } = await supabase.from('org_members').select('roles(permissions)')
    .eq('org_id', orgId).eq('profile_id', user.id).maybeSingle()
  const rel = (me as Record<string, unknown> | null)?.roles
  const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
  if (!me || !hasPermission(role?.permissions ?? null, 'manageUsers')) redirect('/')

  // Světy (firmy), kde přihlášený spravuje lidi — v nich vidí a nastavuje
  // přístupy. Role editor dole je jen pro aktivní firmu.
  const { data: mine } = await supabase.from('org_members')
    .select('org_id, organizations(name), roles(permissions)').eq('profile_id', user.id)
  type Mine = { org_id: string; organizations: { name: string } | null; roles: { permissions?: Permissions } | null }
  const worlds = ((mine || []) as unknown as Mine[])
    .filter(m => hasPermission(m.roles?.permissions ?? null, 'manageUsers'))
    .map(m => ({ id: m.org_id, name: m.organizations?.name || '?', isAdmin: m.roles?.permissions?.admin === true }))
    .sort((a, b) => (a.id === orgId ? -1 : b.id === orgId ? 1 : a.name.localeCompare(b.name, 'cs')))
  const worldIds = worlds.map(w => w.id)

  const [{ data: members }, { data: allRoles }] = await Promise.all([
    supabase.from('org_members').select('org_id, role_id, is_owner, profiles(id, name, email, phone)').in('org_id', worldIds),
    supabase.from('roles').select('id, name, color, permissions, is_system, org_id').in('org_id', worldIds).order('name'),
  ])

  type MemberRow = { org_id: string; role_id: string | null; is_owner: boolean; profiles: { id: string; name: string | null; email: string | null; phone: string | null } | null }
  const byId = new Map<string, { id: string; name: string | null; email: string | null; phone: string | null; access: Record<string, { role_id: string | null; is_owner: boolean }> }>()
  for (const m of (members || []) as unknown as MemberRow[]) {
    if (!m.profiles) continue
    const p = byId.get(m.profiles.id) ?? { ...m.profiles, access: {} }
    p.access[m.org_id] = { role_id: m.role_id, is_owner: m.is_owner }
    byId.set(p.id, p)
  }
  const profiles = [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'))
  const rolesByOrg: Record<string, typeof allRoles> = Object.fromEntries(worldIds.map(id => [id, (allRoles || []).filter(r => r.org_id === id)]))

  return (
    <AdminClient
      initialProfiles={profiles}
      initialRoles={rolesByOrg[orgId] || []}
      worlds={worlds}
      rolesByOrg={rolesByOrg as Record<string, Role[]>}
    />
  )
}
