'use server'

import { createClient } from '@supabase/supabase-js'
import { getServerUserRole } from '@/lib/supabase-server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, '')
  )
}

export async function updateUserRole(userId: string, role: string) {
  const caller = await getServerUserRole()
  if (caller?.role !== 'admin') return { error: 'Unauthorized' }

  const supabase = getSupabase()
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  return { data: true }
}
