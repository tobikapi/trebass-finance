'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { callAction } from '@/lib/call-action'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import { defaultBg, type OrgLook } from '@/lib/orgs'

// Zmenší fotku v prohlížeči (max 2400 px, JPEG), ať se pozadí rychle načítá
// i na mobilu — fotka z telefonu má běžně 4–8 MB.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Obrázek nejde načíst.')); i.src = url
    })
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Převod obrázku selhal.')), 'image/jpeg', 0.82))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Vzhled světa — jen pro admina aktivní firmy. Změna se projeví po obnovení
// stránky u všech členů firmy (nastavení se načítá na serveru).
export default function OrgLookCard() {
  const { orgId, orgLook, brand, realRole } = useUser()
  const { notify } = useDialog()
  const [look, setLook] = useState<OrgLook>(orgLook)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (realRole?.permissions?.admin !== true || !orgId) return null

  const shown = look.bgUrl ?? defaultBg(orgId)

  async function save(patch: Partial<{ bgUrl: string | null; bgDim: number; bgMobile: boolean }>, optimistic: OrgLook) {
    const prev = look
    setLook(optimistic)
    const r = await callAction<{ data?: unknown; error?: string }>('updateOrgLook', patch)
    if (r.error) { setLook(prev); notify(r.error); return false }
    return true
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('Vyber obrázek (JPG, PNG, HEIC…).'); return }
    setBusy(true)
    try {
      const blob = await shrink(file)
      const path = `${orgId}/pozadi-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('branding').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) { notify(`Nahrání se nepovedlo: ${error.message}`); return }
      const url = supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
      if (await save({ bgUrl: url }, { ...look, bgUrl: url })) notify('Pozadí uloženo. Ostatním se projeví po obnovení stránky.')
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const btn: React.CSSProperties = { minHeight: '44px', padding: '0 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }

  return (
    <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-alt)', marginBottom: '20px' }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Vzhled světa · {brand.name}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>Obrázek v pozadí appky pro všechny v tomhle světě. Ostatní světy se nemění.</div>

      {/* Náhled */}
      <div aria-label="Náhled pozadí" style={{ position: 'relative', aspectRatio: '16 / 9', maxWidth: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', marginBottom: '14px' }}>
        {shown && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${shown}")`, backgroundSize: 'cover', backgroundPosition: 'center 40%' }} />}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--bg-base)', opacity: shown ? look.bgDim / 100 : 1 }} />
        <div style={{ position: 'absolute', left: '14px', bottom: '12px', right: '14px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Ukázka textu</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{shown ? (look.bgUrl ? 'Vlastní obrázek' : 'Výchozí obrázek') : 'Bez obrázku'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} style={{ ...btn, backgroundColor: 'var(--accent)', color: '#0b0f18', border: 'none' }}>
          {busy ? 'Nahrávám…' : 'Nahrát obrázek'}
        </button>
        {look.bgUrl && (
          <button type="button" disabled={busy} onClick={() => save({ bgUrl: null }, { ...look, bgUrl: null })}
            style={{ ...btn, backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Vrátit výchozí
          </button>
        )}
      </div>

      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', maxWidth: '520px' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ztmavení (čitelnost textu)</span><span className="num">{look.bgDim} %</span></span>
        <input type="range" min={0} max={95} step={1} value={look.bgDim} disabled={busy}
          onChange={e => setLook(l => ({ ...l, bgDim: Number(e.target.value) }))}
          onPointerUp={e => save({ bgDim: Number((e.target as HTMLInputElement).value) }, { ...look, bgDim: Number((e.target as HTMLInputElement).value) })}
          onKeyUp={e => save({ bgDim: Number((e.target as HTMLInputElement).value) }, { ...look, bgDim: Number((e.target as HTMLInputElement).value) })}
          style={{ width: '100%', marginTop: '8px', accentColor: 'var(--accent)' }} />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={look.bgMobile} disabled={busy} onChange={e => save({ bgMobile: e.target.checked }, { ...look, bgMobile: e.target.checked })} />
        Zobrazit obrázek i na mobilu
      </label>
    </div>
  )
}
