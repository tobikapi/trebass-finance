'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, Profile } from '@/lib/user-context'
import { ROLE_LABELS, ROLE_COLORS, Role } from '@/lib/permissions'
import { updateUserRole } from './actions'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const { role, loading } = useUser()
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!loading && role !== 'admin') router.push('/')
  }, [loading, role, router])

  useEffect(() => {
    if (role === 'admin') {
      supabase.from('profiles').select('*').order('created_at').then(({ data }) => {
        if (data) setProfiles(data as Profile[])
      })
    }
  }, [role])

  async function handleRoleChange(userId: string, newRole: string) {
    setSaving(userId)
    const result = await updateUserRole(userId, newRole)
    if (result.error) {
      setMessage('Chyba: ' + result.error)
    } else {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole as Role } : p))
      setMessage('Uloženo')
      setTimeout(() => setMessage(''), 2000)
    }
    setSaving(null)
  }

  if (loading || role !== 'admin') return null

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Správa uživatelů
        </h1>
        {message && <span style={{ fontSize: '13px', color: '#34d399' }}>{message}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
        {profiles.map(profile => (
          <div key={profile.id} style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {profile.name || '—'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {profile.email || profile.id}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                backgroundColor: `${ROLE_COLORS[profile.role]}22`,
                color: ROLE_COLORS[profile.role],
                border: `1px solid ${ROLE_COLORS[profile.role]}44`,
              }}>
                {ROLE_LABELS[profile.role]}
              </span>
              <select
                value={profile.role}
                disabled={saving === profile.id}
                onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)',
                  border: '1px solid #3d3d3d', borderRadius: '6px',
                  padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
                  opacity: saving === profile.id ? 0.5 : 1,
                }}
              >
                <option value="admin">Admin</option>
                <option value="clen">Člen</option>
                <option value="host">Host</option>
              </select>
            </div>
          </div>
        ))}

        {profiles.length === 0 && (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
            Zatím žádní uživatelé. Vytvoř je v Supabase → Authentication → Users.
          </div>
        )}
      </div>

      <div style={{
        padding: '16px 20px', backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-subtle)', borderRadius: '10px', marginBottom: '24px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Přidat nového uživatele
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
          Jdi na Supabase → Authentication → Users → Add user → Create new user.<br />
          Po vytvoření se uživatel automaticky objeví tady a můžeš mu nastavit roli.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        {([
          { r: 'admin' as Role, desc: 'Vše — přidávat, editovat, mazat, spravovat uživatele' },
          { r: 'clen' as Role, desc: 'Vidí vše, může editovat a přidávat, nemůže mazat' },
          { r: 'host' as Role, desc: 'Jen akce, lineup bez honorářů a soubory' },
        ]).map(({ r, desc }) => (
          <div key={r} style={{
            padding: '14px', backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)', borderRadius: '8px',
          }}>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
              fontSize: '11px', fontWeight: '600', marginBottom: '8px',
              backgroundColor: `${ROLE_COLORS[r]}22`, color: ROLE_COLORS[r],
            }}>
              {ROLE_LABELS[r]}
            </span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
