'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// Po přihlášení se nepřesměrovává tady (redirect() ze server action), ale
// v prohlížeči plným načtením — jinak zůstal klientský stav „nepřihlášen"
// a appka do refreshe ukazovala omezený pohled bez jména.
export async function signIn(formData: FormData): Promise<{ error?: string; ok?: true }> {
  const username = (formData.get('username') as string).trim().toLowerCase()
  const password = formData.get('password') as string
  const email = `${username}@trebass.cz`

  const cookieStore = await cookies()
  const supabase = makeSupabase(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Špatné uživatelské jméno nebo heslo.' }

  return { ok: true }
}

export async function signOut() {
  const cookieStore = await cookies()
  const supabase = makeSupabase(cookieStore)
  await supabase.auth.signOut()
  // Přesměrování dělá volající plným načtením (viz signIn výš).
}
