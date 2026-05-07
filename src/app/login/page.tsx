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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>

      {/* Pozadí — foto */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: "url('/photos/photo-6.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(12,12,12,0.72)' }} />
        {/* gradient zespoda */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,12,12,0.8) 0%, transparent 60%)' }} />
      </div>

      {/* Formulář */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '400px',
        margin: '0 24px',
        backgroundColor: 'rgba(16,16,16,0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(80,20,20,0.6)',
        borderRadius: '16px',
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ position: 'relative', width: '140px', height: '52px', margin: '0 auto' }}>
            <Image src="/logo.png" alt="Třebass" fill priority style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#4b5563', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.14em' }}>
            Finance System
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
              marginTop: '6px', padding: '13px',
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
    </div>
  )
}
