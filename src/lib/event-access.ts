import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/permissions'

// Role === null (zatím nepřiřazená / doběhlá migrace) i role s přepínačem
// „admin" mají plný přístup — stejná logika jako hasPermission() v permissions.ts.
export function isFullAccessRole(role: Role | null): boolean {
  return role === null || role.permissions?.admin === true
}

// event_access řádky se čtou dohromady jako mapa event_id -> Set(profile_id),
// ať se nemusí dotazovat databáze pro každou akci zvlášť.
export async function fetchEventAccessMap(): Promise<Map<string, Set<string>>> {
  const { data } = await supabase.from('event_access').select('event_id, profile_id')
  const map = new Map<string, Set<string>>()
  for (const row of data || []) {
    if (!map.has(row.event_id)) map.set(row.event_id, new Set())
    map.get(row.event_id)!.add(row.profile_id)
  }
  return map
}

// Adminovi s admin_access_mode='all' (default) stačí být admin. Jinak (crew,
// nebo admin u akce omezené na „jen vybraní") musí být v event_access.
export function canAccessEvent(
  event: { admin_access_mode: 'all' | 'selected' },
  role: Role | null,
  userId: string | undefined,
  accessMap: Map<string, Set<string>>,
  eventId: string
): boolean {
  if (isFullAccessRole(role) && event.admin_access_mode !== 'selected') return true
  if (!userId) return false
  return accessMap.get(eventId)?.has(userId) ?? false
}
