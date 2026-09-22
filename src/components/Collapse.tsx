'use client'

// Plynulé rozbalení/sbalení libovolně vysokého obsahu bez JS měření výšky —
// grid-template-rows 0fr→1fr trik. Obsah zůstává v DOMu i zavřený (jen 0px
// vysoký a overflow: hidden), díky čemu jde animovat i zavírání, ne jen otevření.
export default function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.22s ease' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}
