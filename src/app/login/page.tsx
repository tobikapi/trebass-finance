'use client'

import { useState, useTransition } from 'react'
import { signIn } from './actions'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>

      {/* === Pozadí — stejný treatment jako splash screen === */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        {/* Foto */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/photo-6.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
        {/* Tmavý základ */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,4,4,0.58)' }} />
        {/* Vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, transparent 20%, rgba(4,2,2,0.72) 80%)' }} />
        {/* Top + bottom gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(6,3,3,0.88) 0%, transparent 28%, transparent 62%, rgba(6,3,3,0.96) 100%)' }} />
        {/* Červený tint */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(60,5,5,0.15)' }} />
        {/* Grain textura */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '200px 200px',
        }} />
      </div>

      {/* === Formulář === */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '400px',
        margin: '0 24px',
        backgroundColor: 'rgba(12,8,8,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100,25,25,0.5)',
        borderRadius: '18px',
        padding: '44px 36px',
        animation: 'fadeUp 0.5s ease both',
        animationDelay: '0.1s',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Glow za logem */}
          <div style={{
            position: 'relative', display: 'inline-block',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px', height: '80px',
              background: 'radial-gradient(ellipse, rgba(180,30,30,0.3) 0%, transparent 70%)',
              filter: 'blur(16px)',
              pointerEvents: 'none',
            }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Třebass" style={{ height: '52px', width: 'auto', display: 'block', position: 'relative' }} />
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.22em' }}>
            FINANCE SYSTEM
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '7px', letterSpacing: '0.1em' }}>
              UŽIVATELSKÉ JMÉNO
            </label>
            <input
              name="username" type="text" required autoFocus autoComplete="username"
              placeholder="admin / clen / host"
              style={{
                width: '100%', backgroundColor: 'rgba(12,12,12,0.8)', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '12px 14px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '7px', letterSpacing: '0.1em' }}>
              HESLO
            </label>
            <input
              name="password" type="password" required
              placeholder="••••••••"
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
              transition: 'background-color 0.15s, transform 0.1s',
              width: '100%',
            }}
          >
            {isPending ? 'Přihlašuji...' : 'Vstoupit'}
          </button>
        </form>
      </div>
    </div>
  )
}
