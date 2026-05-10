export default function Loading() {
  return (
    <div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .skeleton { animation: pulse 1.5s ease-in-out infinite; background-color: var(--bg-card-dark) !important; }
      `}</style>

      {/* Back link skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <div className="skeleton" style={{ width: '100px', height: '14px', borderRadius: '4px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '260px', height: '28px', borderRadius: '6px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '180px', height: '14px', borderRadius: '4px' }} />
      </div>

      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {[90, 80, 80, 70, 100, 80].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: '36px', borderRadius: '7px' }} />
        ))}
      </div>

      {/* Content skeleton */}
      <div style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '24px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <div className="skeleton" style={{ flex: 2, height: '14px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ flex: 1, height: '14px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ flex: 1, height: '14px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
