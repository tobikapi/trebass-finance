import { createClient } from '@supabase/supabase-js'
import AkceClient from './AkceClient'

export const dynamic = 'force-dynamic'

export default async function AkcePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, '')
  )
  const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
  return <AkceClient initialEvents={data || []} />
}
