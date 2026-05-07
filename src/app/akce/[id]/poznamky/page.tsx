'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import EventLayout from '@/components/EventLayout'
import { createNote, deleteNote } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
interface Note { id: string; author: string; content: string; created_at: string }

const MEMBERS = ['Tobiáš', 'Jakub', 'Metoděj', 'Artur']

export default function PoznamkyPage({ params }: Props) {
  const { id } = use(params)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [author, setAuthor] = useState(MEMBERS[0])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    const result = await createNote({ event_id: id, author, content: content.trim() })
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    setContent('')
    await load()
    setSaving(false)
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Smazat poznámku?')) return
    await deleteNote(noteId)
    await load()
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleDateString('cs-CZ') + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  }

  const MEMBER_COLORS: Record<string, string> = {
    'Tobiáš': '#f4978e', 'Jakub': '#60a5fa', 'Metoděj': '#34d399', 'Artur': '#fbbf24',
  }

  return (
    <EventLayout eventId={id}>
      {/* Input */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '24px', backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#9ca3af', flexShrink: 0 }}>Píše:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {MEMBERS.map(m => (
              <button
                key={m} type="button"
                onClick={() => setAuthor(m)}
                style={{
                  padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: author === m ? (MEMBER_COLORS[m] || '#e05555') : '#1e1e1e',
                  color: author === m ? '#0c0c0c' : '#9ca3af',
                }}
              >{m}</button>
            ))}
          </div>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Napiš poznámku pro tým..."
          rows={3}
          style={{ backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '8px', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px', resize: 'vertical', marginBottom: '12px' }}
        />
        <button
          type="submit" disabled={saving || !content.trim()}
          style={{ padding: '8px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', opacity: saving || !content.trim() ? 0.5 : 1 }}
        >
          {saving ? 'Odesílám...' : '+ Přidat poznámku'}
        </button>
      </form>

      {/* Notes list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Načítám...</div>
      ) : notes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#161616', border: '1px dashed #2d2d2d', borderRadius: '12px', color: '#4b5563' }}>
          Zatím žádné poznámky. Buď první!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notes.map(note => (
            <div key={note.id} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: MEMBER_COLORS[note.author] || '#e05555',
                    color: '#0c0c0c', fontSize: '11px', fontWeight: '700', flexShrink: 0,
                  }}>
                    {note.author.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: MEMBER_COLORS[note.author] || '#f4978e' }}>{note.author}</span>
                  <span style={{ fontSize: '11px', color: '#4b5563' }}>{formatTime(note.created_at)}</span>
                </div>
                <button onClick={() => handleDelete(note.id)} style={{ fontSize: '11px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Smazat
                </button>
              </div>
              <p style={{ fontSize: '14px', color: '#e2e8f0', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </EventLayout>
  )
}
