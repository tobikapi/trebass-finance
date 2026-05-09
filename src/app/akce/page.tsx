import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AkceClient from './AkceClient'

export const dynamic = 'force-dynamic'

export default async function AkcePage() {
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
  const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
  return <AkceClient initialEvents={data || []} />
}
