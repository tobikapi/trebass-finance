'use client'

import { useEffect, useState, use, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import EventLayout from '@/components/EventLayout'
import { deleteDocument } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
interface Document {
  id: string; name: string; file_path: string
  file_size: number | null; file_type: string | null
  uploaded_by: string | null; created_at: string
}

const MEMBERS = ['Tobiáš', 'Jakub', 'Metoděj', 'Artur']

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileIcon(type: string | null) {
  if (!type) return '📄'
  if (type.includes('pdf')) return '📕'
  if (type.includes('image')) return '🖼️'
  if (type.includes('word') || type.includes('document')) return '📘'
  if (type.includes('sheet') || type.includes('excel')) return '📗'
  if (type.includes('zip') || type.includes('rar')) return '🗜️'
  return '📄'
}

export default function SouboryPage({ params }: Props) {
  const { id } = use(params)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploader, setUploader] = useState(MEMBERS[0])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const filePath = `${id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)
      if (uploadError) { alert('Chyba při nahrávání: ' + uploadError.message); continue }
      await supabase.from('documents').insert([{
        event_id: id,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: uploader,
      }])
    }
    await load()
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Smazat "${doc.name}"?`)) return
    await deleteDocument(doc.id, doc.file_path)
    await load()
  }

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath)
    return data.publicUrl
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleDateString('cs-CZ') + ' ' +
      new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <EventLayout eventId={id}>
      {/* Uploader selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>Nahrává:</span>
        {MEMBERS.map(m => (
          <button key={m} onClick={() => setUploader(m)}
            style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', border: 'none', cursor: 'pointer',
              backgroundColor: uploader === m ? '#e05555' : '#1e1e1e',
              color: uploader === m ? '#fff' : '#9ca3af' }}>
            {m}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#e05555' : '#2d1515'}`,
          borderRadius: '12px', padding: '40px', textAlign: 'center',
          backgroundColor: dragOver ? '#1a0a0a' : '#161616',
          cursor: 'pointer', marginBottom: '24px',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
        <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', marginBottom: '4px' }}>
          {uploading ? 'Nahrávám...' : 'Klikni nebo přetáhni soubory sem'}
        </div>
        <div style={{ fontSize: '12px', color: '#4b5563' }}>PDF, obrázky, dokumenty, cokoliv</div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)} />
      </div>

      {/* Files list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Načítám...</div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#161616', border: '1px dashed #2d2d2d', borderRadius: '12px', color: '#4b5563' }}>
          Zatím žádné soubory.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '24px', flexShrink: 0 }}>{fileIcon(doc.file_type)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>
                    {formatSize(doc.file_size)}{doc.file_size ? ' · ' : ''}{doc.uploaded_by && <span>{doc.uploaded_by} · </span>}{formatTime(doc.created_at)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, marginLeft: '16px' }}>
                <a
                  href={getPublicUrl(doc.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#f4978e', textDecoration: 'none', padding: '4px 12px', border: '1px solid #2d1515', borderRadius: '6px' }}
                >
                  Otevřít
                </a>
                <button onClick={() => handleDelete(doc)}
                  style={{ fontSize: '12px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </EventLayout>
  )
}
