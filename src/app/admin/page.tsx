import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasPermission, type Permissions } from '@/lib/permissions'
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

  const [{ data: members }, { data: roles }, { data: visible }] = await Promise.all([
    supabase.from('org_members').select('role_id, is_owner, profiles(id, name, email, phone)').eq('org_id', orgId),
    supabase.from('roles').select('id, name, color, permissions, is_system').eq('org_id', orgId).order('name'),
    // Lidé z mých ostatních firem — kandidáti na „Přidat do firmy"
    supabase.from('profiles').select('id, name, email').order('name'),
  ])

  type MemberRow = { role_id: string | null; is_owner: boolean; profiles: { id: string; name: string | null; email: string | null; phone: string | null } | null }
  const profiles = ((members || []) as unknown as MemberRow[])
    .filter(m => m.profiles)
    .map(m => ({ ...m.profiles!, role_id: m.role_id, is_owner: m.is_owner }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'))
  const memberIds = new Set(profiles.map(p => p.id))
  const candidates = (visible || []).filter(p => !memberIds.has(p.id))

  return <AdminClient initialProfiles={profiles} initialRoles={roles || []} candidates={candidates} />
}
