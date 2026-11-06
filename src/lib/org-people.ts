import type { SupabaseClient } from '@supabase/supabase-js'

export interface OrgPerson {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role_id: string | null
  is_owner: boolean
  roles: { name: string; color: string } | null
}

interface Row {
  role_id: string | null
  is_owner: boolean
  profiles: { id: string; name: string | null; email: string | null; phone: string | null } | null
  roles: { name: string; color: string } | null
}

// Lidé jedné firmy (členové) seřazení podle jména. Nahrazuje dřívější
// select z `profiles`, který vracel všechny lidi v systému.
export async function orgPeople(supabase: SupabaseClient, orgId: string | null): Promise<OrgPerson[]> {
  if (!orgId) return []
  const { data } = await supabase.from('org_members')
    .select('role_id, is_owner, profiles(id, name, email, phone), roles(name, color)')
    .eq('org_id', orgId)
  return ((data || []) as unknown as Row[])
    .filter(r => r.profiles)
    .map(r => ({ ...r.profiles!, role_id: r.role_id, is_owner: r.is_owner, roles: r.roles }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'))
}
