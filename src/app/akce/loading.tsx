export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ width: '80px', height: '28px', backgroundColor: '#1e1e1e', borderRadius: '6px', marginBottom: '8px' }} />
          <div style={{ width: '200px', height: '14px', backgroundColor: '#161616', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '110px', height: '40px', backgroundColor: '#2d1515', borderRadius: '8px' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[60, 110, 80, 100, 110].map((w, i) => (
          <div key={i} style={{ width: w, height: '32px', backgroundColor: '#1e1e1e', borderRadius: '20px' }} />
        ))}
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px 24px', marginBottom: '12px' }}>
          <div style={{ width: '200px', height: '16px', backgroundColor: '#1e1e1e', borderRadius: '4px', marginBottom: '10px' }} />
          <div style={{ width: '280px', height: '13px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        div[style*="background-color: #1e1e1e"], div[style*="background-color: #161616"], div[style*="background-color: #1a1a1a"], div[style*="background-color: #2d1515"] {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
