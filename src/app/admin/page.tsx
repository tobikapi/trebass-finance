import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasPermission, type Permissions } from '@/lib/permissions'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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

  // Server component vrací data v prvotním HTML/RSC payloadu ještě před tím,
  // než by se stihl uplatnit jakýkoliv klientský PermissionGuard — seznam
  // lidí a rolí by jinak unikl komukoliv přihlášenému, kdo sem jen dojede
  // přímým odkazem. Kontrola proto musí být tady, ne (jen) v klientovi.
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profileRow } = await supabase.from('profiles').select('roles(permissions)').eq('id', user.id).single()
    const rel = (profileRow as Record<string, unknown> | null)?.roles
    const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
    if (!hasPermission(role?.permissions ?? null, 'manageUsers')) redirect('/')
  }

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, phone, role_id').order('name'),
    supabase.from('roles').select('id, name, color, permissions, is_system').order('name'),
  ])

  return <AdminClient initialProfiles={profiles || []} initialRoles={roles || []} />
}
