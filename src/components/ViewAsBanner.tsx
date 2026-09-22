'use client'

import { useUser } from '@/lib/user-context'

// Trvalý pruh při aktivním náhledu „Zobrazit jako role" — schválně nezávisí
// na oprávněních nafejkované role (na rozdíl od zbytku appky), ať se admin
// nikdy nezacyklí v náhledu bez možnosti se z něj dostat ven.
export default function ViewAsBanner() {
  const { viewAsRoleId, role, setViewAs } = useUser()
  if (!viewAsRoleId || !role) return null

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
      padding: '8px 16px', fontSize: '13px',
      backgroundColor: '#3d2005', color: '#fbbf24', borderBottom: '1px solid #5c4000',
    }}>
      <span>👁 Prohlížíš appku jako <strong>{role.name}</strong> — vidíš a smíš přesně to, co ona.</span>
      <button
        onClick={() => setViewAs(null)}
        style={{
          padding: '3px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          backgroundColor: '#fbbf24', color: '#1a1206', border: 'none',
        }}
      >
        Ukončit náhled
      </button>
    </div>
  )
}
