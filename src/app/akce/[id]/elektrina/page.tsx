import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ElektrinaClient from './ElektrinaClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function ElektrinaPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const [{ data: equipment }, { data: ev }] = await Promise.all([
    supabase.from('event_equipment').select('*').eq('event_id', id).order('created_at'),
    supabase.from('events').select('equipment_locations').eq('id', id).single(),
  ])

  return <ElektrinaClient id={id} initialEquipment={equipment || []} initialLocations={ev?.equipment_locations || []} />
}
