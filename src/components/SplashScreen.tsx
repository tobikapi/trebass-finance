'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen() {
  const [fadeOut, setFadeOut] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    document.fonts.ready.then(() => {
      setTimeout(() => {
        setFadeOut(true)
        setTimeout(() => setGone(true), 600)
      }, 700)
    })
  }, [])

  if (gone) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#0c0c0c',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '28px',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.6s ease',
      pointerEvents: 'none',
    }}>
      <Image
        src="/logo.png"
        alt="Třebass"
        width={160}
        height={60}
        style={{ objectFit: 'contain', height: '48px', width: 'auto' }}
        priority
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: '5px', height: '5px', borderRadius: '50%',
            backgroundColor: '#e05555',
            animation: `splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
