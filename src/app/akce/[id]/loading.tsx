export default function Loading() {
  return (
    <div>
      {/* Back link skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ width: '100px', height: '14px', backgroundColor: '#1e1e1e', borderRadius: '4px', marginBottom: '12px' }} />
        <div style={{ width: '260px', height: '28px', backgroundColor: '#1e1e1e', borderRadius: '6px', marginBottom: '8px' }} />
        <div style={{ width: '180px', height: '14px', backgroundColor: '#161616', borderRadius: '4px' }} />
      </div>

      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {[90, 80, 80, 70, 100, 80].map((w, i) => (
          <div key={i} style={{ width: w, height: '36px', backgroundColor: '#161616', borderRadius: '7px' }} />
        ))}
      </div>

      {/* Content skeleton */}
      <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ flex: 2, height: '14px', backgroundColor: '#1e1e1e', borderRadius: '4px' }} />
            <div style={{ flex: 1, height: '14px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
            <div style={{ flex: 1, height: '14px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
            <div style={{ width: '60px', height: '14px', backgroundColor: '#1e1e1e', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        div[style*="background-color: #1e1e1e"], div[style*="background-color: #161616"], div[style*="background-color: #1a1a1a"] {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
