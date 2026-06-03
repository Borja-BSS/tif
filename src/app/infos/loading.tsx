// Instant skeleton shown while the page streams — appears in <50ms
export default function InfosLoading() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Hero placeholder */}
      <div className="px-6 md:px-8 py-16 max-w-6xl mx-auto">
        <div className="h-4 w-48 rounded-full mb-4 animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-12 w-72 rounded-lg mb-3 animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-4 w-64 rounded-full animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
      </div>
      {/* Cards placeholder */}
      <div className="px-6 md:px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: 'var(--bg-secondary)', animationDelay: `${i*60}ms` }} />
            ))}
          </div>
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl h-16 animate-pulse" style={{ background: 'var(--bg-secondary)', animationDelay: `${i*80}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
