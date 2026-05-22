import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import SouboryClient from './SouboryClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

const MEMBERS = ['Tobiáš', 'Jakub', 'Metoděj', 'Artur']

export default async function SouboryPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const [{ data: documents }, { data: { user } }] = await Promise.all([
    supabase.from('documents').select('*').eq('event_id', id).order('created_at', { ascending: false }),
    supabase.auth.getUser(),
  ])

  const name = user?.user_metadata?.name
  const initialUploader = name && MEMBERS.includes(name) ? name : MEMBERS[0]

  return (
    <SouboryClient
      id={id}
      initialDocuments={documents || []}
      initialUploader={initialUploader}
    />
  )
}
