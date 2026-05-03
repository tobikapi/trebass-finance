'use client'

import EventForm from '@/components/EventForm'

export default function NovaAkcePage() {
  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Nová akce</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Vytvoř nový festival nebo událost</p>
      </div>
      <EventForm />
    </div>
  )
}
