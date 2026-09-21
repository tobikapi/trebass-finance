'use client'

import { useEffect, useRef } from 'react'

interface Ember {
  x: number; y: number // y je world-space (dokumentová), ne obrazovková
  vx: number; vy: number
  size: number
  baseAlpha: number
  alpha: number
  flickerPhase: number
  flickerSpeed: number
  hue: number
}

interface Smoke {
  x: number; y: number
  vx: number; vy: number
  size: number
  baseAlpha: number
  alpha: number
  driftPhase: number
  driftSpeed: number
}

// Jednorázová jiskra z „škrtnutí" po kliknutí — na rozdíl od Ember nežije
// donekonečna, jen dohasne (life -> maxLife) a zmizí, nerespawnuje se.
interface Burst {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  hue: number
}

// Teplá, ohnivá paleta jisker — do oranžové/zlaté, žádná měkká růžová.
const EMBER_COLORS = [
  { r: 224, g: 85, b: 55 },
  { r: 251, g: 146, b: 60 },
  { r: 251, g: 191, b: 36 },
  { r: 224, g: 85, b: 85 },
]

// Jiskry a kouř v pozadí appky. Žijí v souřadnicích stránky (world-space),
// ne obrazovky — scrollováním se skrz ně reálně propluješ. Místo přímého
// letu nahoru je nese pomalu bloudící vítr (mění směr, ne jen sílu), takže
// se to rozptyluje po ploše jako od ohně ve vánku. Kurzor je odstrkuje pryč.
// Respektuje prefers-reduced-motion a pauzne se, když karta není vidět.
export default function EmberParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let width = 0, height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const embers: Ember[] = []
    const smokes: Smoke[] = []
    const bursts: Burst[] = []
    let mouseX = -9999, mouseY = -9999
    let scrollY = window.scrollY
    let rafId = 0
    let running = true

    function emberCountFor(w: number, h: number) {
      return Math.min(150, Math.max(50, Math.round((w * h) / 13000)))
    }
    function smokeCountFor(w: number, h: number) {
      return Math.min(26, Math.max(10, Math.round((w * h) / 90000)))
    }

    // Náhodná pozice kdekoliv v aktuálně viditelné ploše (world-space =
    // scrollY + obrazovka) — žádný preferovaný okraj, ať to necáká jen zezdola.
    function randomSpot() {
      return { x: Math.random() * width, y: scrollY + Math.random() * height }
    }

    function makeEmber(): Ember {
      const spot = randomSpot()
      return {
        ...spot,
        vx: 0, vy: 0,
        size: 0.8 + Math.random() * 2,
        baseAlpha: 0.35 + Math.random() * 0.45,
        alpha: 0,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerSpeed: 3 + Math.random() * 5,
        hue: Math.floor(Math.random() * EMBER_COLORS.length),
      }
    }

    function makeSmoke(): Smoke {
      const spot = randomSpot()
      return {
        ...spot,
        vx: 0, vy: 0,
        size: 50 + Math.random() * 70,
        baseAlpha: 0.03 + Math.random() * 0.06,
        alpha: 0,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.1 + Math.random() * 0.15,
      }
    }

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const emberTarget = emberCountFor(width, height)
      if (embers.length < emberTarget) { while (embers.length < emberTarget) embers.push(makeEmber()) }
      else embers.length = emberTarget

      const smokeTarget = smokeCountFor(width, height)
      if (smokes.length < smokeTarget) { while (smokes.length < smokeTarget) smokes.push(makeSmoke()) }
      else smokes.length = smokeTarget
    }

    function onMouseMove(e: MouseEvent) { mouseX = e.clientX; mouseY = e.clientY }
    function onMouseLeave() { mouseX = -9999; mouseY = -9999 }
    function onScroll() { scrollY = window.scrollY }

    // Škrtnutí zapalovače pod kurzorem — malý výbuch jisker do všech stran
    // + jasný záblesk, obojí rychle dohasne. pointerEvents:none na canvasu
    // klik nijak neblokuje, jen ho tady navíc zaznamenáme.
    function spawnBurst(clientX: number, clientY: number) {
      const worldY = clientY + scrollY
      const count = 20 + Math.floor(Math.random() * 12)
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 70 + Math.random() * 230
        bursts.push({
          x: clientX, y: worldY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30,
          life: 0, maxLife: 0.45 + Math.random() * 0.55,
          size: 1 + Math.random() * 1.8,
          hue: Math.floor(Math.random() * EMBER_COLORS.length),
        })
      }
      // záblesk škrtnutí — velký, jasný, hasne během chvilky
      bursts.push({
        x: clientX, y: worldY, vx: 0, vy: 0,
        life: 0, maxLife: 0.16, size: 11, hue: 2,
      })
    }
    function onClick(e: MouseEvent) { spawnBurst(e.clientX, e.clientY) }

    // Vítr jako celek pomalu bloudí ve směru i síle (dvě rozladěné siny
    // místo jedné periodické), ať to necuká pravidelně, ale jako opravdový
    // vánek. Sdílený mezi jiskrami i kouřem.
    function windAt(now: number) {
      const angle = Math.sin(now * 0.00011) * 0.9 + Math.sin(now * 0.00043 + 1.7) * 0.5
      const strength = 10 + Math.sin(now * 0.00023) * 6
      return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength * 0.35 }
    }

    let last = performance.now()
    function tick(now: number) {
      if (!running) return
      const dt = Math.min(48, now - last) / 1000
      last = now
      ctx!.clearRect(0, 0, width, height)
      const wind = windAt(now)

      // --- kouř: velké, pomalé, měkké obláčky, kreslené jako první vrstva ---
      ctx!.globalCompositeOperation = 'source-over'
      for (const p of smokes) {
        p.driftPhase += p.driftSpeed * dt
        const sway = Math.sin(p.driftPhase) * 5

        p.vx += wind.x * 0.35 * dt
        p.vy += (wind.y * 0.35 - 3) * dt
        p.vx *= 0.95
        p.vy *= 0.95

        p.x += p.vx * dt + sway * dt * 0.3
        p.y += p.vy * dt
        p.alpha += (p.baseAlpha - p.alpha) * Math.min(1, dt * 1.5)

        const drawY = p.y - scrollY
        if (drawY < -p.size || drawY > height + p.size || p.x < -p.size || p.x > width + p.size) {
          Object.assign(p, makeSmoke())
          p.alpha = 0
        }

        const grad = ctx!.createRadialGradient(p.x, drawY, 0, p.x, drawY, p.size)
        grad.addColorStop(0, `rgba(90,60,50,${p.alpha})`)
        grad.addColorStop(1, `rgba(90,60,50,0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(p.x, drawY, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }

      // --- jiskry: malé, jasné, nesené větrem + vlastním jemným chvěním ---
      ctx!.globalCompositeOperation = 'screen'
      for (const p of embers) {
        p.flickerPhase += p.flickerSpeed * dt
        const flicker = 0.75 + Math.sin(p.flickerPhase) * 0.25

        // vítr + slabý vztlak nahoru + náhodné chvění (rozptyl do prostoru)
        p.vx += wind.x * dt
        p.vy += (wind.y - 5) * dt
        p.vx += (Math.random() - 0.5) * 14 * dt
        p.vy += (Math.random() - 0.5) * 14 * dt

        // odpuzení od kurzoru (v obrazovkových souřadnicích)
        const screenY = p.y - scrollY
        const dx = p.x - mouseX, dy = screenY - mouseY
        const distSq = dx * dx + dy * dy
        const radius = 120
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 1
          const force = (1 - dist / radius) * 300
          p.vx += (dx / dist) * force * dt
          p.vy += (dy / dist) * force * dt
        }

        p.vx *= 0.94
        p.vy *= 0.94
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.alpha += (p.baseAlpha - p.alpha) * Math.min(1, dt * 2)

        const drawY = p.y - scrollY
        if (drawY < -30 || drawY > height + 30 || p.x < -30 || p.x > width + 30) {
          Object.assign(p, makeEmber())
          p.alpha = 0
        }

        const c = EMBER_COLORS[p.hue]
        const a = p.alpha * flicker
        const glowSize = p.size * 2.6
        const grad = ctx!.createRadialGradient(p.x, drawY, 0, p.x, drawY, glowSize)
        grad.addColorStop(0, `rgba(255,244,230,${a})`)
        grad.addColorStop(0.35, `rgba(${c.r},${c.g},${c.b},${a})`)
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(p.x, drawY, glowSize, 0, Math.PI * 2)
        ctx!.fill()
      }

      // --- jiskření po kliknutí: dohasíná a mizí, nerespawnuje se ---
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]
        b.life += dt
        if (b.life >= b.maxLife) { bursts.splice(i, 1); continue }

        b.vx *= 0.9
        b.vy = b.vy * 0.9 + 220 * dt // gravitace — jiskry padají, jak dohasínají
        b.x += b.vx * dt
        b.y += b.vy * dt

        const t = b.life / b.maxLife
        const a = (1 - t) * 0.9
        const drawY = b.y - scrollY
        const c = EMBER_COLORS[b.hue]
        const glowSize = b.size * 2.6 * (1 - t * 0.35)
        const grad = ctx!.createRadialGradient(b.x, drawY, 0, b.x, drawY, glowSize)
        grad.addColorStop(0, `rgba(255,244,230,${a})`)
        grad.addColorStop(0.35, `rgba(${c.r},${c.g},${c.b},${a})`)
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(b.x, drawY, glowSize, 0, Math.PI * 2)
        ctx!.fill()
      }

      rafId = requestAnimationFrame(tick)
    }

    function onVisibility() {
      running = !document.hidden
      if (running) {
        last = performance.now()
        rafId = requestAnimationFrame(tick)
      } else {
        cancelAnimationFrame(rafId)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibility)
    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
