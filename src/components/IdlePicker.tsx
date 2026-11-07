'use client'

import { useSyncExternalStore } from 'react'
import { getIdleMinutes, setIdleMinutes, IDLE_OPTIONS, idleLabel, IDLE_DEFAULT, IDLE_CHANGE_EVENT, type IdleMinutes } from '@/lib/idle-setting'

function subscribe(cb: () => void) {
  window.addEventListener(IDLE_CHANGE_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(IDLE_CHANGE_EVENT, cb); window.removeEventListener('storage', cb) }
}

// Volba „automaticky odhlásit po…“. variant=segments (panel Více na mobilu),
// variant=select (desktopová lišta vedle Odhlásit).
export default function IdlePicker({ variant = 'segments' }: { variant?: 'segments' | 'select' }) {
  // Na serveru výchozí hodnota, v prohlížeči uložená volba (bez nesouladu při hydrataci)
  const value = useSyncExternalStore(subscribe, getIdleMinutes, () => IDLE_DEFAULT)
  const choose = (m: IdleMinutes) => setIdleMinutes(m)

  if (variant === 'select') {
    return (
      <label title="Automaticky odhlásit po nečinnosti" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span aria-hidden="true">⏱</span>
        <select aria-label="Automaticky odhlásit po nečinnosti" value={value} onChange={e => choose(Number(e.target.value) as IdleMinutes)}
          style={{ background: 'var(--bg-card-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', padding: '4px 6px', cursor: 'pointer' }}>
          {IDLE_OPTIONS.map(m => <option key={m} value={m}>{idleLabel(m)}</option>)}
        </select>
      </label>
    )
  }

  return (
    <div style={{ padding: '6px 14px 10px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Automaticky odhlásit po nečinnosti</div>
      <div role="radiogroup" aria-label="Automaticky odhlásit po nečinnosti" style={{ display: 'flex', gap: '6px' }}>
        {IDLE_OPTIONS.map(m => {
          const active = value === m
          return (
            <button key={m} type="button" role="radio" aria-checked={active} onClick={() => choose(m)} className="num"
              style={{ flex: 1, minWidth: 0, minHeight: '44px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-card)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}>
              {m === 60 ? '1 h' : m}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>Minuty · platí pro toto zařízení · teď {idleLabel(value)}</div>
    </div>
  )
}
