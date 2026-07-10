'use client'
import { useEffect, useState } from 'react'
import { supabase, Session, Nutrition, Sleep, getZoneColor } from '@/lib/supabase'
import { useCountUp } from '@/lib/useCountUp'
import { useRequireAuth } from '@/lib/useRequireAuth'
import { Measurement, loadMeasurements, weightTrend, daysSinceWeighIn } from '@/lib/measurements'
import { Profile, loadProfile } from '@/lib/profile'
import { todayISO } from '@/lib/recovery'
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

function WeightChart({ measures, goal }: { measures: Measurement[]; goal: number | null }) {
  const pts = measures.filter(m => m.poids_kg != null).map(m => ({ d: m.date, w: m.poids_kg as number }))
  if (pts.length < 2) return (
    <div className="glass animate-in" style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center', animationDelay: '0.2s' }}>Ajoute au moins 2 pesées pour voir la courbe d'évolution.</div>
  )
  const W = 320, H = 120, pad = 10
  const ws = pts.map(p => p.w).concat(goal != null ? [goal] : [])
  const min = Math.min(...ws), max = Math.max(...ws), range = max - min || 1
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad)
  const y = (w: number) => pad + (1 - (w - min) / range) * (H - 2 * pad)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ')
  return (
    <div className="glass animate-in" style={{ padding: 16, animationDelay: '0.2s' }}>
      <div style={{ ...label, marginBottom: 12 }}>Évolution du poids</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {goal != null && <line x1={pad} y1={y(goal)} x2={W - pad} y2={y(goal)} stroke="var(--cyan)" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.8} />}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0,245,196,0.5))' }} />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.w)} r={2.6} fill="var(--accent)" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(pts[0].d).toLocaleDateString('fr-FR')}</span>
        {goal != null && <span style={{ fontSize: 10, color: 'var(--cyan)' }}>— — objectif {goal} kg</span>}
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(pts[pts.length - 1].d).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const authed = useRequireAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [nutrition, setNutrition] = useState<Nutrition[]>([])
  const [sleep, setSleep] = useState<Sleep[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'recup' | 'sport' | 'nutrition' | 'sommeil' | 'poids'>('recup')

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
        setMeasurements(await loadMeasurements())
        setProfile(await loadProfile())
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

  const wTrend = weightTrend(measurements, profile?.poids_objectif ?? null)
  const daysWeigh = daysSinceWeighIn(measurements, todayISO())
  const weighDue = daysWeigh === null || daysWeigh >= 3

  const card: React.CSSProperties = { padding: 16 }

  if (!authed || loading) return (
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
          <Link href="/nutrition" className="glass press" style={{ color: 'var(--accent)', borderRadius: 12, padding: '9px 12px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>🥗</Link>
          <Link href="/coach" className="glass press" style={{ color: 'var(--accent)', borderRadius: 12, padding: '9px 12px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>🤖</Link>
          <Link href="/log" className="press glow-accent" style={{ background: 'linear-gradient(135deg, var(--accent), var(--cyan))', color: '#04120e', borderRadius: 12, padding: '9px 16px', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>+ Log</Link>
        </div>
      </div>

      {/* Rappel pesée */}
      {weighDue && (
        <Link href="/log" className="glass press animate-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 14, textDecoration: 'none', border: '1px solid rgba(0,245,196,0.35)' }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>C'est l'heure de te peser</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{daysWeigh === null ? 'Aucune pesée enregistrée' : `Dernière pesée il y a ${daysWeigh} j`} · onglet Poids</div>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 20 }}>›</span>
        </Link>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <Kpi title="Séances" value={sessions.length} color="var(--accent)" delay={0.04} />
        <Kpi title="Kcal brûlées" value={totalKcal} color="var(--danger)" delay={0.09} />
        <Kpi title="FC moyenne" value={avgFc} suffix=" BPM" color="var(--yellow)" delay={0.14} />
        <Kpi title="Sommeil moy" value={avgSleep} decimals={1} suffix="h" color={badNights > 2 ? 'var(--danger)' : 'var(--accent)'} delay={0.19} />
      </div>

      {/* Tabs */}
      <div className="glass animate-in" style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, animationDelay: '0.22s' }}>
        {(['recup', 'sport', 'nutrition', 'sommeil', 'poids'] as const).map(t => (
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

      {/* Poids */}
      {activeTab === 'poids' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {wTrend.count === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Aucune pesée. Va dans <Link href="/log" style={{ color: 'var(--accent)' }}>Logger → Poids ⚖️</Link></p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="glass animate-in" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={label}>Poids actuel</div>
                  <div className="stat-num" style={{ fontSize: 27, fontWeight: 900, color: 'var(--accent)', marginTop: 5, letterSpacing: '-1px' }}>{wTrend.latest}<span style={{ fontSize: 14 }}> kg</span></div>
                </div>
                <div className="glass animate-in" style={{ padding: 16, textAlign: 'center', animationDelay: '0.05s' }}>
                  <div style={label}>Objectif</div>
                  <div className="stat-num" style={{ fontSize: 27, fontWeight: 900, color: 'var(--cyan)', marginTop: 5, letterSpacing: '-1px' }}>{profile?.poids_objectif != null ? <>{profile.poids_objectif}<span style={{ fontSize: 14 }}> kg</span></> : '—'}</div>
                </div>
                <div className="glass animate-in" style={{ padding: 16, textAlign: 'center', animationDelay: '0.1s' }}>
                  <div style={label}>Depuis le début</div>
                  <div className="stat-num" style={{ fontSize: 22, fontWeight: 800, color: (wTrend.deltaTotal ?? 0) <= 0 ? 'var(--accent)' : 'var(--warn)', marginTop: 5 }}>{wTrend.deltaTotal != null ? `${wTrend.deltaTotal > 0 ? '+' : ''}${wTrend.deltaTotal} kg` : '—'}</div>
                </div>
                <div className="glass animate-in" style={{ padding: 16, textAlign: 'center', animationDelay: '0.15s' }}>
                  <div style={label}>Reste à faire</div>
                  <div className="stat-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 5 }}>{wTrend.toGoal != null ? `${Math.abs(wTrend.toGoal).toFixed(1)} kg` : '—'}</div>
                </div>
              </div>
              <WeightChart measures={measurements} goal={profile?.poids_objectif ?? null} />
            </>
          )}
        </div>
      )}
    </main>
  )
}
