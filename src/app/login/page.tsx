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
    <div style={{
      minHeight: '100vh', backgroundColor: '#0c0c0c',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Image src="/logo.png" alt="Třebass" width={160} height={60}
            style={{ objectFit: 'contain', height: '52px', width: 'auto' }} />
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#4b5563', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.12em' }}>
            Finance System
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          backgroundColor: '#161616', border: '1px solid #2d1515',
          borderRadius: '14px', padding: '32px',
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '8px', letterSpacing: '0.06em' }}>
              EMAIL
            </label>
            <input
              name="email" type="email" required autoFocus
              placeholder="tvuj@email.cz"
              style={{
                width: '100%', backgroundColor: '#0c0c0c', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '12px 14px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '8px', letterSpacing: '0.06em' }}>
              HESLO
            </label>
            <input
              name="password" type="password" required
              placeholder="••••••••"
              style={{
                width: '100%', backgroundColor: '#0c0c0c', border: '1px solid #2d1515',
                borderRadius: '8px', padding: '12px 14px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '20px', padding: '10px 14px',
              backgroundColor: '#2d0a0a', border: '1px solid #5a1a1a',
              borderRadius: '8px', fontSize: '13px', color: '#f4978e',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: isPending ? '#7a2e2e' : '#e05555',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'Awakenning, sans-serif',
              letterSpacing: '0.1em', cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {isPending ? 'Přihlašuji...' : 'Přihlásit se'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#374151' }}>
          Přístup pouze pro členy Třebass
        </div>
      </div>
    </div>
  )
}
