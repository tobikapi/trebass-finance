import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import LineupClient from './LineupClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function LineupPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const [{ data: artists }, { data: contacts }, { data: event }] = await Promise.all([
    supabase.from('lineup').select('*').eq('event_id', id).order('set_time').order('artist_name'),
    supabase.from('contacts').select('id, name, type, fee').in('type', ['DJ', 'MC', 'Stage manager', 'Technik', 'Produkce', 'Bednák', 'Security']).order('name'),
    supabase.from('events').select('stages, date, date_end').eq('id', id).single(),
  ])

  return (
    <LineupClient
      id={id}
      initialArtists={artists || []}
      initialContacts={contacts || []}
      initialStages={event?.stages || []}
      initialEventDates={{ date: event?.date || null, date_end: event?.date_end || null }}
    />
  )
}
