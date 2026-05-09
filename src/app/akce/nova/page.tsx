'use client'

import EventForm from '@/components/EventForm'

export default function NovaAkcePage() {
  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Nová akce</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: 0 }}>Vytvoř nový festival nebo událost</p>
      </div>
      <EventForm />
    </div>
  )
}
