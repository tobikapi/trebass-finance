'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'gone'>('in')

  useEffect(() => {
    document.fonts.ready.then(() => {
      // logo fade-in → hold → fade-out
      setTimeout(() => setPhase('hold'), 100)
      setTimeout(() => setPhase('out'), 1800)
      setTimeout(() => setPhase('gone'), 2500)
    })
  }, [])

  if (phase === 'gone') return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: phase === 'out' ? 0 : 1,
      transition: phase === 'out' ? 'opacity 0.7s ease' : 'none',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>

      {/* --- Foto na pozadí --- */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Image
          src="/photos/photo-6.jpg"
          alt=""
          fill
          style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
          priority
        />
      </div>

      {/* --- Overlaye --- */}

      {/* Tmavý základ */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,4,4,0.55)' }} />

      {/* Radiální vignette — tmavší okraje, světlejší střed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, transparent 20%, rgba(4,2,2,0.75) 80%)',
      }} />

      {/* Top + bottom gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(6,3,3,0.85) 0%, transparent 25%, transparent 65%, rgba(6,3,3,0.95) 100%)',
      }} />

      {/* Jemný červený tint — váže na brand */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(60,5,5,0.18)' }} />

      {/* Grain textura — SVG noise */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.22,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
      }} />

      {/* --- Logo + text --- */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        opacity: phase === 'in' ? 0 : 1,
        transform: phase === 'in' ? 'scale(0.92) translateY(8px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}>

        {/* Glow za logem */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '280px', height: '120px',
          background: 'radial-gradient(ellipse, rgba(180,30,30,0.35) 0%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />

        <Image
          src="/logo.png"
          alt="Třebass"
          width={180}
          height={68}
          style={{ objectFit: 'contain', height: '56px', width: 'auto', position: 'relative' }}
          priority
        />

        <div style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.35)',
          fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.28em',
        }}>
          FINANCE SYSTEM
        </div>

        {/* Loading dots */}
        <div style={{ display: 'flex', gap: '7px', marginTop: '4px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: '4px', height: '4px', borderRadius: '50%',
              backgroundColor: '#e05555',
              animation: `splash-dot 1.4s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.15; transform: scale(0.7); }
          40%            { opacity: 1;    transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}
