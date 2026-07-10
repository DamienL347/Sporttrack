import Link from 'next/link'

const tiles = [
  { href: '/log', icon: '➕', title: 'Logger', sub: 'Séance · repas · sommeil', primary: true },
  { href: '/dashboard', icon: '📈', title: 'Dashboard', sub: 'Récupération & tendances' },
  { href: '/coach', icon: '🤖', title: 'Coach IA', sub: 'Conseils personnalisés' },
  { href: '/nutrition', icon: '🥗', title: 'Coach Nutrition', sub: 'Repas depuis ton frigo' },
]

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div className="animate-in" style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ fontSize: 52, marginBottom: 10, animation: 'floaty 4s ease-in-out infinite' }}>⚡</div>
        <h1 className="gradient-text" style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1.5px', margin: 0 }}>
          Sport Tracker
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, letterSpacing: 0 }}>
          Performance · récupération · nutrition
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>
        {tiles.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            className={`glass press animate-in ${t.primary ? 'glow-accent' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              textDecoration: 'none',
              color: 'var(--text)',
              animationDelay: `${0.08 * (i + 1)}s`,
              border: t.primary ? '1px solid rgba(0,245,196,0.4)' : undefined,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                background: t.primary ? 'linear-gradient(135deg, var(--accent), var(--cyan))' : 'rgba(255,255,255,0.05)',
                flexShrink: 0,
              }}
            >
              {t.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{t.sub}</div>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 20 }}>›</span>
          </Link>
        ))}

        <Link
          href="/profil"
          className="press animate-in"
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            textDecoration: 'none',
            fontSize: 13.5,
            fontWeight: 600,
            padding: '10px',
            animationDelay: '0.35s',
          }}
        >
          ⚙️ Mon profil
        </Link>
      </div>
    </main>
  )
}
