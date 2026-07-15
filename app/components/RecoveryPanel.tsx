'use client'
import { useEffect, useState } from 'react'
import { Session, Sleep } from '@/lib/supabase'
import { useCountUp } from '@/lib/useCountUp'
import {
  computeRecovery,
  computeACWR,
  computeLoadStats,
  computeSleepStats,
  computeCadence,
  loadSeries,
  todayISO,
} from '@/lib/recovery'

const label: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.9px',
  fontWeight: 700,
}

function Ring({ score, color, verdict }: { score: number | null; color: string; verdict: string }) {
  const r = 64
  const circ = 2 * Math.PI * r
  const pct = score ?? 0
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const shown = useCountUp(score, 1100)
  const offset = mounted ? circ * (1 - pct / 100) : circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 168, height: 168 }}>
        <svg width={168} height={168} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor="var(--cyan)" />
            </linearGradient>
          </defs>
          <circle cx={84} cy={84} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={13} />
          <circle
            cx={84}
            cy={84}
            r={r}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.3,1)', filter: `drop-shadow(0 0 8px ${color}88)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="stat-num" style={{ fontSize: 46, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-2px' }}>
            {score == null ? '—' : Math.round(shown)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3, letterSpacing: '1px', textTransform: 'uppercase' }}>/ 100</div>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{verdict}</div>
    </div>
  )
}

function Tile({ title, value, sub, color, delay }: { title: string; value: string; sub?: string; color?: string; delay: number }) {
  return (
    <div className="glass animate-in" style={{ padding: '14px 13px', animationDelay: `${delay}s` }}>
      <div style={label}>{title}</div>
      <div className="stat-num" style={{ fontSize: 23, fontWeight: 800, color: color || 'var(--text)', marginTop: 5, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function RecoveryPanel({ sessions, sleep }: { sessions: Session[]; sleep: Sleep[] }) {
  const today = todayISO()
  const recovery = computeRecovery(sessions, sleep, today)
  const acwr = computeACWR(sessions, today)
  const load = computeLoadStats(sessions, today)
  const sleepStats = computeSleepStats(sleep, today)
  const cadence = computeCadence(sessions, today)
  const series = loadSeries(sessions, today, 14)
  const maxLoad = Math.max(...series.map((d) => d.load), 1)

  const [barsIn, setBarsIn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsIn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Score principal */}
      <div className="glass glow-accent pop-in" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ ...label, marginBottom: 14 }}>Score de récupération</div>
        <Ring score={recovery.score} color={recovery.color} verdict={recovery.verdict} />
        <div
          style={{
            fontSize: 13,
            color: 'var(--text)',
            marginTop: 16,
            lineHeight: 1.55,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${recovery.color}44`,
            borderRadius: 12,
            padding: '11px 13px',
            textAlign: 'left',
          }}
        >
          💡 {recovery.message}
        </div>
      </div>

      {/* Tuiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Tile title="ACWR" value={acwr.ratio != null ? acwr.ratio.toFixed(2) : '—'} sub={acwr.label} color={acwr.color} delay={0.05} />
        <Tile
          title="Dette sommeil 7j"
          value={sleepStats.debt7 != null ? `${sleepStats.debt7 >= 0 ? '+' : ''}${sleepStats.debt7.toFixed(1)}h` : '—'}
          sub={sleepStats.avgDuration != null ? `moy ${sleepStats.avgDuration.toFixed(1)}h/nuit` : 'aucune nuit'}
          color={sleepStats.debt7 != null && sleepStats.debt7 < -3 ? 'var(--danger)' : 'var(--accent)'}
          delay={0.1}
        />
        <Tile title="Charge aiguë 7j" value={`${Math.round(acwr.acute)}`} sub="unités sRPE (7j)" color="var(--danger)" delay={0.15} />
        <Tile
          title="Monotonie 7j"
          value={load.monotony != null ? load.monotony.toFixed(2) : '—'}
          sub={load.monotony != null && load.monotony > 2 ? 'élevée ⚠️' : 'variée ✅'}
          color={load.monotony != null && load.monotony > 2 ? 'var(--warn)' : 'var(--accent)'}
          delay={0.2}
        />
        <Tile title="Jours consécutifs" value={`${cadence.consecutiveDays}`} sub={cadence.consecutiveDays >= 4 ? 'jour off conseillé' : 'ok'} color={cadence.consecutiveDays >= 4 ? 'var(--warn)' : 'var(--accent)'} delay={0.25} />
        <Tile title="Dernier effort" value={cadence.daysSinceLast != null ? `J-${cadence.daysSinceLast}` : '—'} sub="jours de repos" delay={0.3} />
      </div>

      {/* Tendance de charge 14 jours */}
      <div className="glass animate-in" style={{ padding: 16, animationDelay: '0.32s' }}>
        <div style={{ ...label, marginBottom: 14 }}>Charge — 14 derniers jours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 84 }}>
          {series.map((d, i) => {
            const h = d.load > 0 ? Math.max((d.load / maxLoad) * 74, 5) : 3
            const isToday = d.date === today
            return (
              <div key={d.date} title={`${d.date} — charge ${d.load}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div
                  style={{
                    height: barsIn ? h : 3,
                    borderRadius: 4,
                    background: d.load > 0 ? (isToday ? 'linear-gradient(180deg, var(--accent), var(--accent-2))' : 'linear-gradient(180deg, rgba(255,107,61,0.85), rgba(255,107,61,0.35))') : 'rgba(255,255,255,0.08)',
                    boxShadow: d.load > 0 && isToday ? '0 0 10px rgba(255,107,61,0.5)' : 'none',
                    transition: `height 0.7s cubic-bezier(0.2,0.7,0.3,1) ${i * 0.03}s`,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>-14j</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>aujourd'hui</span>
        </div>
      </div>

      {/* Détail des composantes */}
      {recovery.components.length > 0 && (
        <div className="glass animate-in" style={{ padding: 16, animationDelay: '0.4s' }}>
          <div style={{ ...label, marginBottom: 14 }}>Détail du score</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {recovery.components.map((c, i) => {
              const barColor = c.score >= 70 ? 'var(--accent)' : c.score >= 45 ? 'var(--warn)' : 'var(--danger)'
              return (
                <div key={c.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{c.label}</span>
                    <span className="stat-num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.detail}</span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: barsIn ? `${c.score}%` : '0%', height: '100%', background: barColor, borderRadius: 4, transition: `width 0.8s cubic-bezier(0.2,0.7,0.3,1) ${0.1 + i * 0.06}s`, boxShadow: `0 0 8px ${barColor}66` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
