'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

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

export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const username = (formData.get('username') as string).trim().toLowerCase()
  const password = formData.get('password') as string
  const email = `${username}@trebass.cz`

  const cookieStore = await cookies()
  const supabase = makeSupabase(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Špatné uživatelské jméno nebo heslo.' }

  redirect('/')
}

export async function signOut() {
  const cookieStore = await cookies()
  const supabase = makeSupabase(cookieStore)
  await supabase.auth.signOut()
  redirect('/login')
}
