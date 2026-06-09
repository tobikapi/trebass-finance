import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import TechnikaClient from './TechnikaClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function TechnikaPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: equipment } = await supabase
    .from('event_equipment')
    .select('*')
    .eq('event_id', id)
    .order('created_at')

  return <TechnikaClient id={id} initialEquipment={equipment || []} />
}
