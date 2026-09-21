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

// Chladnější, tvrdší paleta — rozžhavený kov, ne vánoční světýlka. Žádná
// pastelová zlatá/růžová.
const EMBER_COLORS = [
  { r: 217, g: 70, b: 32 },   // syté oranžovo-rezavá
  { r: 180, g: 60, b: 30 },   // tmavší rez
  { r: 224, g: 90, b: 40 },   // rozžhavená oranžová
  { r: 150, g: 45, b: 30 },   // téměř zhaslá
]

// Jiskra se kreslí jako krátký pruh ve směru letu (ne měkký kulatý bokeh) —
// rychlejší = delší a výraznější stopa, pomalá = skoro tečka. Vypadá to
// jako od brusky/svařování, ne jako twinkle.
function drawSpark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, vx: number, vy: number,
  size: number, alpha: number, c: { r: number; g: number; b: number }
) {
  const speed = Math.hypot(vx, vy)
  const len = Math.min(34, Math.max(size * 1.3, speed * 0.045))
  const dirX = speed > 1 ? vx / speed : 0
  const dirY = speed > 1 ? vy / speed : 0
  const tailX = x - dirX * len
  const tailY = y - dirY * len

  const grad = ctx.createLinearGradient(x, y, tailX, tailY)
  grad.addColorStop(0, `rgba(255,238,214,${alpha})`)
  grad.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${alpha})`)
  grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`)
  ctx.strokeStyle = grad
  ctx.lineWidth = Math.max(1, size * 1.1)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(tailX, tailY)
  ctx.stroke()
}

// Jiskry a kouř v pozadí appky. Žijí v souřadnicích stránky (world-space),
// ne obrazovky — scrollováním se skrz ně reálně propluješ. Nese je pomalu
// bloudící vítr (mění směr, ne jen sílu), rozptýlené po ploše, ne let rovně
// nahoru. Kurzor je odstrkuje pryč. Respektuje prefers-reduced-motion
// a pauzne se, když karta není vidět.
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
      return Math.min(22, Math.max(8, Math.round((w * h) / 105000)))
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
        flickerSpeed: 6 + Math.random() * 10,
        hue: Math.floor(Math.random() * EMBER_COLORS.length),
      }
    }

    function makeSmoke(): Smoke {
      const spot = randomSpot()
      return {
        ...spot,
        vx: 0, vy: 0,
        size: 50 + Math.random() * 70,
        baseAlpha: 0.03 + Math.random() * 0.055,
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

    // Škrtnutí zapalovače pod kurzorem — jiskry vyletí do všech stran jako
    // v nulové gravitaci (žádný pád dolů, embery samy o sobě gravitaci
    // nemají) a zůstanou natrvalo, splynou s běžným hejnem. Jen záblesk
    // škrtnutí je jednorázový a rychle zhasne. pointerEvents:none na canvasu
    // klik nijak neblokuje, jen ho tady navíc zaznamenáme.
    const MAX_CLICK_EXTRA = 260
    function spawnBurst(clientX: number, clientY: number) {
      const worldY = clientY + scrollY
      const count = 24 + Math.floor(Math.random() * 14)
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 220 + Math.random() * 620
        embers.push({
          x: clientX, y: worldY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 0.8 + Math.random() * 2,
          baseAlpha: 0.4 + Math.random() * 0.45,
          alpha: 0.9,
          flickerPhase: Math.random() * Math.PI * 2,
          flickerSpeed: 6 + Math.random() * 10,
          hue: Math.floor(Math.random() * EMBER_COLORS.length),
        })
      }
      // ať klikání donekonečna nenafukuje pole — nejstarší extra jiskry pryč
      const cap = emberCountFor(width, height) + MAX_CLICK_EXTRA
      if (embers.length > cap) embers.splice(0, embers.length - cap)

      // záblesk škrtnutí — velký, jasný, hasne během chvilky (jediné, co mizí)
      bursts.push({
        x: clientX, y: worldY, vx: 0, vy: 0,
        life: 0, maxLife: 0.14, size: 10, hue: 2,
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

      // --- kouř: tmavé, sazovité, pomalé obláčky, kreslené jako první vrstva ---
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
        grad.addColorStop(0, `rgba(35,33,32,${p.alpha})`)
        grad.addColorStop(1, `rgba(35,33,32,0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(p.x, drawY, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }

      // --- jiskry: krátké pruhy ve směru letu, nesené větrem + chvěním ---
      ctx!.globalCompositeOperation = 'screen'
      for (const p of embers) {
        p.flickerPhase += p.flickerSpeed * dt
        // ostřejší, míň pravidelné blikání než hladká sinusovka — spíš prskání než twinkle
        const flicker = 0.7 + Math.abs(Math.sin(p.flickerPhase)) * 0.3

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

        drawSpark(ctx!, p.x, drawY, p.vx, p.vy, p.size, p.alpha * flicker, EMBER_COLORS[p.hue])
      }

      // --- jiskření po kliknutí: dohasíná a mizí, nerespawnuje se ---
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]
        b.life += dt
        if (b.life >= b.maxLife) { bursts.splice(i, 1); continue }

        const t = b.life / b.maxLife
        const a = (1 - t) * 0.95
        const drawY = b.y - scrollY
        const c = EMBER_COLORS[b.hue]
        const glowSize = b.size * (1 - t * 0.3)
        const grad = ctx!.createRadialGradient(b.x, drawY, 0, b.x, drawY, glowSize)
        grad.addColorStop(0, `rgba(255,244,230,${a})`)
        grad.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${a})`)
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
