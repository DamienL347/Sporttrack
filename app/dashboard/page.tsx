'use client'
import { useEffect, useState } from 'react'
import { supabase, Session, Nutrition, Sleep, getZoneColor } from '@/lib/supabase'
import { useCountUp } from '@/lib/useCountUp'
import RecoveryPanel from '@/app/components/RecoveryPanel'
import Link from 'next/link'

const label: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }

function Kpi({ title, value, decimals = 0, suffix = '', color, delay }: { title: string; value: number; decimals?: number; suffix?: string; color: string; delay: number }) {
  const n = useCountUp(value)
  const shown = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('fr')
  return (
    <div className="glass animate-in" style={{ textAlign: 'center', padding: 16, animationDelay: `${delay}s` }}>
      <div style={label}>{title}</div>
      <div className="stat-num" style={{ fontSize: 27, fontWeight: 900, color, marginTop: 5, letterSpacing: '-1px' }}>
        {value > 0 || title === 'Séances' ? shown : '—'}{value > 0 ? suffix : ''}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [nutrition, setNutrition] = useState<Nutrition[]>([])
  const [sleep, setSleep] = useState<Sleep[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'recup' | 'sport' | 'nutrition' | 'sommeil'>('recup')

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, nRes, slRes] = await Promise.all([
          supabase.from('sessions').select('*').order('date', { ascending: false }),
          supabase.from('nutrition').select('*').order('date', { ascending: false }),
          supabase.from('sleep').select('*').order('date', { ascending: false }),
        ])
        const err = sRes.error || nRes.error || slRes.error
        if (err) throw new Error(err.message)
        setSessions(sRes.data || [])
        setNutrition(nRes.data || [])
        setSleep(slRes.data || [])
      } catch (e: any) {
        setLoadError(e?.message || 'Impossible de charger les données (réseau ?).')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalKcal = sessions.reduce((a, s) => a + (s.kcal_totales || 0), 0)
  const avgFc = sessions.filter(s => s.fc_moyenne).reduce((a, s, _, arr) => a + (s.fc_moyenne || 0) / arr.length, 0)
  const avgSleep = sleep.filter(s => s.duree_heures).reduce((a, s, _, arr) => a + (s.duree_heures || 0) / arr.length, 0)
  const badNights = sleep.filter(s => (s.duree_heures || 0) < 7).length

  const card: React.CSSProperties = { padding: 16 }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div className="spinner" />
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</div>
    </div>
  )

  if (loadError) return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>📡</div>
      <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 16 }}>Impossible de charger les données</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 340, wordBreak: 'break-word' }}>{loadError}</div>
      <button className="press" onClick={() => location.reload()} style={{ background: 'var(--accent)', color: '#04120e', border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 800, cursor: 'pointer' }}>Réessayer</button>
      <Link href="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← Accueil</Link>
    </main>
  )

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 22 }}>←</Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/profil" className="glass press" style={{ color: 'var(--muted)', borderRadius: 12, padding: '9px 12px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>⚙️</Link>
          <Link href="/coach" className="glass press" style={{ color: 'var(--accent)', borderRadius: 12, padding: '9px 14px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>🤖 Coach</Link>
          <Link href="/log" className="press glow-accent" style={{ background: 'linear-gradient(135deg, var(--accent), var(--cyan))', color: '#04120e', borderRadius: 12, padding: '9px 16px', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>+ Log</Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <Kpi title="Séances" value={sessions.length} color="var(--accent)" delay={0.04} />
        <Kpi title="Kcal brûlées" value={totalKcal} color="var(--danger)" delay={0.09} />
        <Kpi title="FC moyenne" value={avgFc} suffix=" BPM" color="var(--yellow)" delay={0.14} />
        <Kpi title="Sommeil moy" value={avgSleep} decimals={1} suffix="h" color={badNights > 2 ? 'var(--danger)' : 'var(--accent)'} delay={0.19} />
      </div>

      {/* Tabs */}
      <div className="glass animate-in" style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, animationDelay: '0.22s' }}>
        {(['recup', 'sport', 'nutrition', 'sommeil'] as const).map(t => (
          <button key={t} className="press" onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
            background: activeTab === t ? 'linear-gradient(135deg, var(--accent), var(--cyan))' : 'transparent',
            color: activeTab === t ? '#04120e' : 'var(--muted)',
            fontWeight: 800, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
            boxShadow: activeTab === t ? '0 0 16px rgba(0,245,196,0.35)' : 'none',
            transition: 'all 0.25s',
          }}>{t === 'recup' ? 'récup' : t}</button>
        ))}
      </div>

      {/* Recovery panel */}
      {activeTab === 'recup' && <RecoveryPanel sessions={sessions} sleep={sleep} />}

      {/* Sessions list */}
      {activeTab === 'sport' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Aucune séance enregistrée</p>}
          {sessions.map((s, i) => (
            <div key={s.id || i} className="glass animate-in" style={{ ...card, animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{s.sport}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{new Date(s.date).toLocaleDateString('fr-FR')} {s.duree ? `· ${s.duree}` : ''}</div>
                </div>
                {s.zone_cardiaque && (
                  <div style={{ background: getZoneColor(s.zone_cardiaque), color: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {s.fc_moyenne} BPM
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div><div style={label}>Kcal</div><div className="stat-num" style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 18 }}>{s.kcal_totales}</div></div>
                {s.rpe && <div><div style={label}>RPE</div><div className="stat-num" style={{ fontWeight: 800, color: 'var(--cyan)', fontSize: 18 }}>{s.rpe}/10</div></div>}
                {s.energie && <div><div style={label}>Énergie</div><div className="stat-num" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 18 }}>{s.energie}/10</div></div>}
                {s.recup && <div><div style={label}>Récup</div><div className="stat-num" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 18 }}>{s.recup}/10</div></div>}
              </div>
              {s.douleurs && s.douleurs !== 'Aucune' && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>⚠️ {s.douleurs}</div>}
              {s.observation && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>{s.observation}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Nutrition list */}
      {activeTab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nutrition.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Aucun repas enregistré</p>}
          {nutrition.map((n, i) => (
            <div key={n.id || i} className="glass animate-in" style={{ ...card, animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{n.repas}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(n.date).toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="stat-num" style={{ fontWeight: 900, color: 'var(--danger)', fontSize: 20 }}>{n.kcal || '—'}<span style={{ fontSize: 11, color: 'var(--muted)' }}> kcal</span></div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>{n.description}</div>
              {(n.proteines || n.glucides || n.lipides) && (
                <div style={{ display: 'flex', gap: 18 }}>
                  {n.proteines != null && <div><div style={label}>Prot.</div><div className="stat-num" style={{ color: 'var(--accent)', fontWeight: 800 }}>{n.proteines}g</div></div>}
                  {n.glucides != null && <div><div style={label}>Gluc.</div><div className="stat-num" style={{ color: 'var(--yellow)', fontWeight: 800 }}>{n.glucides}g</div></div>}
                  {n.lipides != null && <div><div style={label}>Lip.</div><div className="stat-num" style={{ color: 'var(--warn)', fontWeight: 800 }}>{n.lipides}g</div></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sleep list */}
      {activeTab === 'sommeil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sleep.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Aucune nuit enregistrée</p>}
          {sleep.map((s, i) => (
            <div key={s.id || i} className="glass animate-in" style={{ ...card, animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Nuit du {new Date(s.date).toLocaleDateString('fr-FR')}</div>
                  {s.heure_coucher && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.heure_coucher} → {s.heure_lever}</div>}
                </div>
                <div className="stat-num" style={{ fontWeight: 900, fontSize: 24, color: (s.duree_heures || 0) >= 7.5 ? 'var(--accent)' : 'var(--danger)' }}>
                  {s.duree_heures ? `${s.duree_heures}h` : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18 }}>
                {s.qualite && <div><div style={label}>Qualité</div><div className="stat-num" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 18 }}>{s.qualite}/10</div></div>}
                {s.reveils !== null && <div><div style={label}>Réveils</div><div className="stat-num" style={{ fontWeight: 800, color: (s.reveils || 0) > 0 ? 'var(--warn)' : 'var(--accent)', fontSize: 18 }}>{s.reveils}</div></div>}
                {s.fatigue_matin && <div><div style={label}>Fatigue</div><div className="stat-num" style={{ fontWeight: 800, color: s.fatigue_matin > 6 ? 'var(--danger)' : 'var(--accent)', fontSize: 18 }}>{s.fatigue_matin}/10</div></div>}
              </div>
              {s.note && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>{s.note}</div>}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
