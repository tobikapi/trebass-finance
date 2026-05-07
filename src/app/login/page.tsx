'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
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
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#0c0c0c' }}>

      {/* Left — form */}
      <div style={{
        width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px', flexShrink: 0,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ marginBottom: '48px' }}>
          <Image src="/logo.png" alt="Třebass" width={140} height={52}
            style={{ objectFit: 'contain', height: '44px', width: 'auto' }} />
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#4b5563', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.14em' }}>
            Finance System
          </div>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 6px 0', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.06em' }}>
          Přihlásit se
        </h1>
        <p style={{ fontSize: '14px', color: '#4b5563', margin: '0 0 36px 0' }}>
          Přístup pouze pro členy Třebass
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '8px', letterSpacing: '0.1em' }}>
              EMAIL
            </label>
            <input
              name="email" type="email" required autoFocus
              placeholder="tvuj@email.cz"
              style={{
                width: '100%', backgroundColor: '#111111', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '13px 16px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '8px', letterSpacing: '0.1em' }}>
              HESLO
            </label>
            <input
              name="password" type="password" required
              placeholder="••••••••"
              style={{
                width: '100%', backgroundColor: '#111111', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '13px 16px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', backgroundColor: '#1a0505', border: '1px solid #5a1a1a',
              borderRadius: '8px', fontSize: '13px', color: '#f4978e',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{
              padding: '14px', marginTop: '4px',
              backgroundColor: isPending ? '#7a2e2e' : '#e05555',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'Awakenning, sans-serif',
              letterSpacing: '0.12em', cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {isPending ? 'Přihlašuji...' : 'Vstoupit'}
          </button>
        </form>
      </div>

      {/* Right — photo */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }} className="login-photo-panel">
        <Image
          src="/photos/photo-6.jpg"
          alt="Třebass"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
        />
        {/* gradient overlay — plynule přechází do černé zleva */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #0c0c0c 0%, rgba(12,12,12,0.5) 40%, rgba(12,12,12,0.1) 100%)',
        }} />
        {/* subtle vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(12,12,12,0.6) 0%, transparent 50%)',
        }} />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-photo-panel { display: none; }
        }
      `}</style>
    </div>
  )
}
