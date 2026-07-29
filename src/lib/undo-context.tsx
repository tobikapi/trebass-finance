'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

interface UndoEntry {
  id: number
  label: string
  run: () => Promise<void>
}

interface Toast {
  id: number
  text: string
  isError: boolean
}

const UndoContext = createContext<{ pushUndo: (label: string, run: () => Promise<void>) => void }>({
  pushUndo: () => {},
})

const MAX_STACK = 20

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([])
  const nextId = useRef(0)
  const runningRef = useRef(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast(text: string, isError = false) {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, text, isError }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const pushUndo = useCallback((label: string, run: () => Promise<void>) => {
    const id = nextId.current++
    stackRef.current = [...stackRef.current, { id, label, run }].slice(-MAX_STACK)
  }, [])

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (!(e.key === 'z' || e.key === 'Z') || !(e.ctrlKey || e.metaKey) || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (runningRef.current) return
      const entry = stackRef.current[stackRef.current.length - 1]
      if (!entry) return
      e.preventDefault()
      stackRef.current = stackRef.current.slice(0, -1)
      runningRef.current = true
      try {
        await entry.run()
        showToast(`Vráceno zpět: ${entry.label}`)
      } catch {
        showToast(`Vrácení se nezdařilo: ${entry.label}`, true)
      } finally {
        runningRef.current = false
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <UndoContext.Provider value={{ pushUndo }}>
      {children}
      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
            backgroundColor: t.isError ? '#2d1515' : 'var(--bg-card-alt, #1a1a1a)',
            border: `1px solid ${t.isError ? '#e05555' : 'var(--border-card, #2d2d2d)'}`,
            color: t.isError ? '#f87171' : 'var(--text-primary, #fff)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {t.text}
          </div>
        ))}
      </div>
    </UndoContext.Provider>
  )
}

export function useUndo() {
  return useContext(UndoContext)
}
