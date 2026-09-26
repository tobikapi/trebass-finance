import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '80px 20px', minHeight: '60vh',
    }}>
      <div style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.1em',
        fontSize: '96px', color: '#e05555', lineHeight: 1, marginBottom: '8px',
        textShadow: '0 0 40px rgba(224,85,85,0.35)',
      }}>
        404
      </div>
      <h1 style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
        fontSize: '22px', color: 'var(--text-primary)', margin: '0 0 10px',
      }}>
        Tady nic není
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '360px', margin: '0 0 28px' }}>
        Stránka, kterou hledáš, neexistuje nebo se přesunula. Zkontroluj adresu, nebo se vrať zpátky.
      </p>
      <Link href="/" style={{
        padding: '10px 24px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px',
        fontSize: '14px', fontWeight: 600, textDecoration: 'none',
      }}>
        Zpět na Dashboard
      </Link>
    </div>
  )
}
