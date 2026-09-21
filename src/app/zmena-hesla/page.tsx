'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

export default function ZmenaHeslaPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Heslo musí mít aspoň 6 znaků.'); return }
    if (password !== confirm) { setError('Hesla se neshodují.'); return }

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Přihlášení vypršelo, zkus se přihlásit znovu.'); return }

      const { error: pwError } = await supabase.auth.updateUser({ password })
      if (pwError) { setError(pwError.message); return }

      const { error: profileError } = await supabase
        .from('profiles').update({ must_change_password: false }).eq('id', user.id)
      if (profileError) { setError(profileError.message); return }

      window.location.href = '/'
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/photo-6.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,4,4,0.58)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, transparent 20%, rgba(4,2,2,0.72) 80%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(6,3,3,0.88) 0%, transparent 28%, transparent 62%, rgba(6,3,3,0.96) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(60,5,5,0.15)' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '400px',
        margin: '0 24px',
        backgroundColor: 'rgba(12,8,8,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100,25,25,0.5)',
        borderRadius: '18px',
        padding: '44px 36px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Třebass" style={{ height: '52px', width: 'auto', display: 'block', margin: '0 auto' }} />
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.22em' }}>
            NASTAVENÍ HESLA
          </div>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginBottom: '20px', lineHeight: 1.6 }}>
          Heslo, které jsi dostal, je jednorázové. Nastav si teď vlastní — dál ho uvidíš jen ty.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '7px', letterSpacing: '0.1em' }}>
              NOVÉ HESLO
            </label>
            <input
              type="password" required autoFocus autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', backgroundColor: 'rgba(12,12,12,0.8)', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '12px 14px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '7px', letterSpacing: '0.1em' }}>
              HESLO ZNOVU
            </label>
            <input
              type="password" required autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              style={{
                width: '100%', backgroundColor: 'rgba(12,12,12,0.8)', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '12px 14px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', backgroundColor: 'rgba(26,5,5,0.9)', border: '1px solid #5a1a1a',
              borderRadius: '8px', fontSize: '13px', color: '#f4978e',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{
              marginTop: '6px', padding: '14px',
              backgroundColor: isPending ? '#7a2e2e' : '#e05555',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontFamily: 'var(--font-awakenning), sans-serif',
              letterSpacing: '0.14em', cursor: isPending ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {isPending ? 'Ukládám…' : 'Nastavit heslo'}
          </button>
        </form>
      </div>
    </div>
  )
}
