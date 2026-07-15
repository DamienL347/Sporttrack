import Link from 'next/link'

const tiles = [
  { href: '/log', icon: '➕', title: 'Logger', sub: 'Séance · repas · sommeil · poids', primary: true },
  { href: '/dashboard', icon: '📈', title: 'Dashboard', sub: 'Récupération & tendances' },
  { href: '/coach', icon: '🎾', title: 'Coach IA', sub: 'Conseils sur tes données' },
  { href: '/nutrition', icon: '🥗', title: 'Coach Nutrition', sub: 'Repas depuis ton frigo' },
  { href: '/photos', icon: '📸', title: 'Progression', sub: 'Photos avant / après' },
]

export default function Home() {
  return (
    <main
      className="page-pad"
      style={{
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 20px',
      }}
    >
      {/* Hero scoreboard */}
      <div className="animate-in" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 58, fontWeight: 800, lineHeight: 0.92, margin: 0 }}>
          Sport<br />
          <span className="gradient-text">Tracker</span>
        </h1>
        <div className="service-line" style={{ margin: '20px 0 12px' }} />
        <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0, letterSpacing: 0 }}>
          Tennis · Padel · Récupération · Nutrition
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {tiles.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            className={`glass press animate-in ${t.primary ? 'glow-accent' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 15,
              padding: '16px 18px',
              textDecoration: 'none',
              color: 'var(--text)',
              animationDelay: `${0.07 * (i + 1)}s`,
              border: t.primary ? '1px solid rgba(255,107,61,0.45)' : undefined,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 21,
                background: t.primary
                  ? 'linear-gradient(150deg, var(--accent), #e5522a)'
                  : 'rgba(210,225,255,0.05)',
                flexShrink: 0,
              }}
            >
              {t.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div
                className="eyebrow"
                style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: '0.06em', color: t.primary ? 'var(--accent)' : 'var(--text)' }}
              >
                {t.title}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{t.sub}</div>
            </div>
            <span style={{ color: t.primary ? 'var(--accent)' : 'var(--muted)', fontSize: 20 }}>›</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
