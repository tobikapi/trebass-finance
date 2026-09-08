'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Náhrada za window.alert(). Nativní alert blokuje celé vlákno prohlížeče, což
// mimo jiné znemožňuje testování přes browser-automation (dialog se zasekne).
// Tenhle modal je běžný DOM, takže je testovatelný a drží styl appky.
const DialogContext = createContext<{ notify: (message: string) => void }>({
  notify: () => {},
})

export function DialogProvider({ children }: { children: React.ReactNode }) {
  // Fronta, ne jediná zpráva: alert() volání blokovalo a čekalo, tohle ne, takže
  // se ve smyčce (např. nahrávání více souborů) může sejít víc hlášek za sebou.
  const [queue, setQueue] = useState<string[]>([])
  const okRef = useRef<HTMLButtonElement>(null)
  const current = queue.length > 0 ? queue[0] : null

  const notify = useCallback((message: string) => {
    setQueue(prev => [...prev, message])
  }, [])

  const dismiss = useCallback(() => {
    setQueue(prev => prev.slice(1))
  }, [])

  useEffect(() => {
    if (!current) return
    okRef.current?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [current, dismiss])

  return (
    <DialogContext.Provider value={{ notify }}>
      {children}
      {current && (
        <div
          className="no-print"
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', backgroundColor: 'rgba(0, 0, 0, 0.55)',
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            data-testid="app-dialog"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px', width: '100%',
              padding: '22px 24px 18px', borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #111118)',
              border: '1px solid var(--border-card, #1e1e2e)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div style={{
              fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              color: 'var(--text-primary, #f1f5f9)',
            }}>
              {current}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                ref={okRef}
                onClick={dismiss}
                data-testid="app-dialog-ok"
                style={{
                  padding: '8px 22px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, color: '#fff',
                  backgroundColor: '#8b5cf6', border: 'none',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}
