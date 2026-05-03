'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Event } from '@/lib/types'
import EventForm from '@/components/EventForm'

export default function UpravitAkciPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).single().then(({ data }) => {
      setEvent(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>Načítám...</div>
  if (!event) return <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>Akce nenalezena.</div>

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Upravit akci</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>{event.name}</p>
      </div>
      <EventForm existing={event} />
    </div>
  )
}
