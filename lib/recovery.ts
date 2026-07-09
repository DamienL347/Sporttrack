/**
 * Moteur de récupération — métriques de sport-science calculées à partir
 * des données Supabase (séances + sommeil + nutrition).
 *
 * Toutes les fonctions sont pures : elles prennent les tableaux de données
 * et une date de référence ("aujourd'hui") et renvoient des objets sérialisables.
 */
import { Session, Sleep, Nutrition } from './supabase'
import { Profile, nutritionTargets, hrMax, zoneBounds } from './profile'

const DAY = 86400000
const SLEEP_TARGET = 8 // heures cible par nuit

function toTime(d: string): number {
  return new Date(d + 'T00:00:00').getTime()
}
function toISO(t: number): string {
  return new Date(t).toISOString().split('T')[0]
}
/** Nombre de jours entre `later` et `earlier` (later - earlier). */
export function ageInDays(today: string, date: string): number {
  return Math.round((toTime(today) - toTime(date)) / DAY)
}

/** Date du jour au format YYYY-MM-DD dans le fuseau LOCAL (évite le décalage UTC de minuit). */
export function todayISO(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

/** Durée d'une séance en minutes, à partir du champ texte "H:MM:SS" / "MM:SS". */
export function dureeMinutes(duree: string | null): number {
  if (!duree || duree === '—') return 0
  const parts = duree.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

/** RPE estimé depuis la zone cardiaque quand il n'est pas saisi manuellement. */
function estimatedRpe(s: Session): number {
  const z = s.zone_cardiaque || ''
  if (z.includes('Zone 1')) return 3
  if (z.includes('Zone 2')) return 4
  if (z.includes('Zone 3')) return 6
  if (z.includes('Zone 4')) return 8
  return 5
}

/**
 * Charge d'une séance en unités sRPE (RPE × minutes) — standard de Foster.
 * RPE manuel prioritaire ; sinon estimé depuis la zone. Unité cohérente pour
 * TOUTES les séances (indispensable pour un ACWR fiable).
 */
export function sessionLoad(s: Session): number {
  const rpe = s.rpe ?? estimatedRpe(s)
  const min = dureeMinutes(s.duree) || (s.kcal_totales ? 60 : 0)
  return Math.round(rpe * min)
}

// ── CHARGE D'ENTRAÎNEMENT ────────────────────────────────────────────
// On utilise les kcal totales comme proxy de charge (colonne la plus
// systématiquement remplie). Une séance = sa dépense énergétique totale.

/** Charge quotidienne cumulée (unités sRPE), indexée par date. */
export function dailyLoad(sessions: Session[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    if (!s.date) continue
    m.set(s.date, (m.get(s.date) || 0) + sessionLoad(s))
  }
  return m
}

/** Série jour par jour (0 inclus) sur `days` jours se terminant à `today`. */
export function loadSeries(
  sessions: Session[],
  today: string,
  days: number
): { date: string; load: number }[] {
  const loads = dailyLoad(sessions)
  const out: { date: string; load: number }[] = []
  const base = toTime(today)
  for (let i = days - 1; i >= 0; i--) {
    const date = toISO(base - i * DAY)
    out.push({ date, load: loads.get(date) || 0 })
  }
  return out
}

export type ACWR = {
  acute: number // charge cumulée 7 derniers jours
  chronicWeekly: number // charge hebdo moyenne sur 28 jours
  ratio: number | null // acute / chronicWeekly
  zone: 'detraining' | 'optimal' | 'caution' | 'danger' | 'insufficient'
  label: string
  color: string
}

/**
 * Acute:Chronic Workload Ratio — indicateur clé du risque de blessure.
 * Sweet spot 0.8–1.3 ; > 1.5 = pic de charge dangereux ; < 0.8 = désentraînement.
 */
export function computeACWR(sessions: Session[], today: string): ACWR {
  const loads = dailyLoad(sessions)
  let acute = 0
  let chronic = 0
  for (const [date, load] of loads) {
    const age = ageInDays(today, date)
    if (age < 0) continue
    if (age < 7) acute += load
    if (age < 28) chronic += load
  }
  const chronicWeekly = chronic / 4
  const ratio = chronicWeekly > 0 ? acute / chronicWeekly : null

  let zone: ACWR['zone'] = 'insufficient'
  let label = 'Données insuffisantes'
  let color = '#6b7280'
  if (ratio !== null) {
    if (ratio < 0.8) {
      zone = 'detraining'
      label = 'Sous-charge — désentraînement'
      color = '#3498db'
    } else if (ratio <= 1.3) {
      zone = 'optimal'
      label = 'Zone optimale ✅'
      color = '#27ae60'
    } else if (ratio <= 1.5) {
      zone = 'caution'
      label = 'Charge élevée — prudence'
      color = '#f39c12'
    } else {
      zone = 'danger'
      label = 'Pic de charge ⚠️ risque'
      color = '#e74c3c'
    }
  }
  return { acute, chronicWeekly, ratio, zone, label, color }
}

export type LoadStats = {
  monotony: number | null // moyenne / écart-type des charges quotidiennes (7j)
  strain: number | null // charge hebdo × monotonie
  weeklyLoad: number
}

/**
 * Monotonie & contrainte (méthode de Foster).
 * Monotonie élevée (> 2) + contrainte élevée = risque de surentraînement / maladie.
 */
export function computeLoadStats(sessions: Session[], today: string): LoadStats {
  const series = loadSeries(sessions, today, 7).map((d) => d.load)
  const weeklyLoad = series.reduce((a, b) => a + b, 0)
  const mean = weeklyLoad / series.length
  const variance =
    series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length
  const sd = Math.sqrt(variance)
  const monotony = sd > 0 ? mean / sd : null
  const strain = monotony !== null ? weeklyLoad * monotony : null
  return { monotony, strain, weeklyLoad }
}

// ── SOMMEIL ──────────────────────────────────────────────────────────

export type SleepStats = {
  latest: Sleep | null
  debt7: number | null // dette cumulée sur les nuits renseignées des 7 derniers jours
  avgDuration: number | null // moyenne durée nuits renseignées (7j)
  nightsLogged: number
}

export function computeSleepStats(sleep: Sleep[], today: string): SleepStats {
  const recent = sleep
    .filter((s) => s.date && ageInDays(today, s.date) >= 0 && ageInDays(today, s.date) < 7)
    .filter((s) => s.duree_heures != null)
  const latest = [...sleep]
    .filter((s) => s.date)
    .sort((a, b) => toTime(b.date) - toTime(a.date))[0] || null

  if (recent.length === 0) {
    return { latest, debt7: null, avgDuration: null, nightsLogged: 0 }
  }
  const debt7 = recent.reduce(
    (a, s) => a + ((s.duree_heures || 0) - SLEEP_TARGET),
    0
  )
  const avgDuration =
    recent.reduce((a, s) => a + (s.duree_heures || 0), 0) / recent.length
  return { latest, debt7, avgDuration, nightsLogged: recent.length }
}

// ── ENTRAÎNEMENT / REPOS ─────────────────────────────────────────────

export type TrainingCadence = {
  daysSinceLast: number | null
  consecutiveDays: number // jours consécutifs d'entraînement jusqu'à la dernière séance
}

export function computeCadence(sessions: Session[], today: string): TrainingCadence {
  const dates = Array.from(dailyLoad(sessions).keys())
    .filter((d) => ageInDays(today, d) >= 0)
    .sort((a, b) => toTime(b) - toTime(a))
  if (dates.length === 0) return { daysSinceLast: null, consecutiveDays: 0 }

  const daysSinceLast = ageInDays(today, dates[0])
  let consecutive = 1
  for (let i = 1; i < dates.length; i++) {
    if (ageInDays(dates[i - 1], dates[i]) === 1) consecutive++
    else break
  }
  return { daysSinceLast, consecutiveDays: consecutive }
}

// ── SCORE DE RÉCUPÉRATION COMPOSITE ──────────────────────────────────

export type RecoveryComponent = {
  label: string
  score: number // 0-100
  weight: number
  detail: string
}

export type RecoveryResult = {
  score: number | null // 0-100
  verdict: string
  color: string
  message: string
  components: RecoveryComponent[]
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

/** Durée de sommeil → score (8h = 100, 6h ≈ 50, 5h ≈ 25). */
function sleepDurationScore(h: number): number {
  if (h >= SLEEP_TARGET) return 100
  if (h <= 4) return 10
  // linéaire de 4h(10) à 8h(100)
  return clamp(10 + ((h - 4) / (SLEEP_TARGET - 4)) * 90)
}

/**
 * Score de récupération du jour : combine sommeil, ressenti subjectif,
 * équilibre de charge (ACWR) et douleurs. Les composantes sans données
 * sont ignorées et les poids re-normalisés.
 */
export function computeRecovery(
  sessions: Session[],
  sleep: Sleep[],
  today: string
): RecoveryResult {
  const sleepStats = computeSleepStats(sleep, today)
  const acwr = computeACWR(sessions, today)
  const cadence = computeCadence(sessions, today)

  const lastSession = [...sessions]
    .filter((s) => s.date)
    .sort((a, b) => toTime(b.date) - toTime(a.date))[0] || null

  const components: RecoveryComponent[] = []

  const night = sleepStats.latest
  if (night && night.duree_heures != null) {
    components.push({
      label: 'Durée de sommeil',
      score: sleepDurationScore(night.duree_heures),
      weight: 0.25,
      detail: `${night.duree_heures.toFixed(1)}h (cible ${SLEEP_TARGET}h)`,
    })
  }
  if (night && night.qualite != null) {
    components.push({
      label: 'Qualité du sommeil',
      score: night.qualite * 10,
      weight: 0.15,
      detail: `${night.qualite}/10`,
    })
  }
  if (night && night.fatigue_matin != null) {
    components.push({
      label: 'Fatigue au réveil',
      score: clamp(((10 - night.fatigue_matin) / 9) * 100),
      weight: 0.15,
      detail: `${night.fatigue_matin}/10`,
    })
  }
  if (sleepStats.debt7 != null) {
    // dette de -6h → 0, 0 ou plus → 100
    components.push({
      label: 'Dette de sommeil (7j)',
      score: clamp(100 + (sleepStats.debt7 / 6) * 100),
      weight: 0.1,
      detail: `${sleepStats.debt7 >= 0 ? '+' : ''}${sleepStats.debt7.toFixed(1)}h`,
    })
  }
  if (lastSession && lastSession.recup != null) {
    components.push({
      label: 'Récupération perçue',
      score: lastSession.recup * 10,
      weight: 0.15,
      detail: `${lastSession.recup}/10`,
    })
  }
  if (lastSession && lastSession.energie != null) {
    components.push({
      label: 'Énergie perçue',
      score: lastSession.energie * 10,
      weight: 0.1,
      detail: `${lastSession.energie}/10`,
    })
  }
  if (acwr.ratio != null) {
    // proximité de la zone optimale (0.8-1.3)
    let acwrScore = 100
    if (acwr.ratio < 0.8) acwrScore = clamp(60 + (acwr.ratio / 0.8) * 40)
    else if (acwr.ratio > 1.3) acwrScore = clamp(100 - (acwr.ratio - 1.3) * 120)
    components.push({
      label: 'Équilibre de charge (ACWR)',
      score: acwrScore,
      weight: 0.15,
      detail: acwr.ratio.toFixed(2),
    })
  }

  // Pénalité douleurs sur la dernière séance
  let painPenalty = 0
  if (
    lastSession &&
    lastSession.douleurs &&
    lastSession.douleurs !== 'Aucune' &&
    lastSession.douleurs !== '—' &&
    ageInDays(today, lastSession.date) <= 3
  ) {
    painPenalty = 12
  }

  if (components.length === 0) {
    return {
      score: null,
      verdict: 'Données insuffisantes',
      color: '#6b7280',
      message:
        'Ajoute au moins une séance et une nuit de sommeil pour calculer ton score de récupération.',
      components,
    }
  }

  const totalWeight = components.reduce((a, c) => a + c.weight, 0)
  const weighted =
    components.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight
  const score = Math.round(clamp(weighted - painPenalty))

  let verdict = 'Repos conseillé'
  let color = '#e74c3c'
  if (score >= 80) {
    verdict = 'Prêt à performer'
    color = '#27ae60'
  } else if (score >= 65) {
    verdict = 'Bonne forme'
    color = '#00d4aa'
  } else if (score >= 50) {
    verdict = 'Prudence'
    color = '#f39c12'
  }

  const message = buildMessage(score, acwr, sleepStats, cadence, painPenalty > 0)

  return { score, verdict, color, message, components }
}

function buildMessage(
  score: number,
  acwr: ACWR,
  sleep: SleepStats,
  cadence: TrainingCadence,
  pain: boolean
): string {
  const parts: string[] = []
  if (score >= 80) parts.push('Feu vert pour une séance intense.')
  else if (score >= 65) parts.push('Entraînement normal possible, reste à l’écoute.')
  else if (score >= 50)
    parts.push('Privilégie une séance Zone 2 modérée plutôt qu’intense.')
  else parts.push('Récupération active ou repos recommandé aujourd’hui.')

  if (acwr.zone === 'danger')
    parts.push('Ta charge a bondi cette semaine — allège pour éviter la blessure.')
  else if (acwr.zone === 'caution')
    parts.push('Charge en hausse : évite d’enchaîner une nouvelle grosse séance.')
  else if (acwr.zone === 'detraining')
    parts.push('Charge basse : tu peux progressivement remonter le volume.')

  if (sleep.debt7 != null && sleep.debt7 < -3)
    parts.push(`Dette de sommeil de ${Math.abs(sleep.debt7).toFixed(1)}h à combler.`)

  if (cadence.consecutiveDays >= 4)
    parts.push(`${cadence.consecutiveDays} jours d’affilée — pense à un jour off.`)

  if (pain) parts.push('Douleurs signalées récemment : surveille la zone concernée.')

  return parts.join(' ')
}

// ── CONTEXTE POUR LE COACH IA ────────────────────────────────────────

/** Moyenne d'apport quotidien (kcal, protéines) sur les N derniers jours renseignés. */
function nutritionAverages(nutrition: Nutrition[], today: string, days: number) {
  const byDay = new Map<string, { kcal: number; prot: number }>()
  for (const n of nutrition) {
    if (!n.date) continue
    const age = ageInDays(today, n.date)
    if (age < 0 || age >= days) continue
    const cur = byDay.get(n.date) || { kcal: 0, prot: 0 }
    cur.kcal += n.kcal || 0
    cur.prot += n.proteines || 0
    byDay.set(n.date, cur)
  }
  const daysLogged = byDay.size
  if (!daysLogged) return { kcal: null, prot: null, daysLogged: 0 }
  let k = 0, p = 0
  for (const v of byDay.values()) { k += v.kcal; p += v.prot }
  return { kcal: Math.round(k / daysLogged), prot: Math.round(p / daysLogged), daysLogged }
}

function arrow(cur: number, prev: number): string {
  if (prev === 0) return '→'
  const d = (cur - prev) / prev
  if (d > 0.1) return '↑'
  if (d < -0.1) return '↓'
  return '→'
}

/** Résumé compact, structuré et contextualisé des données + métriques, pour l'agent IA. */
export function buildCoachContext(
  sessions: Session[],
  nutrition: Nutrition[],
  sleep: Sleep[],
  today: string,
  profile?: Profile | null
): string {
  const recovery = computeRecovery(sessions, sleep, today)
  const acwr = computeACWR(sessions, today)
  const load = computeLoadStats(sessions, today)
  const sleepStats = computeSleepStats(sleep, today)
  const cadence = computeCadence(sessions, today)

  // Tendances 7j vs 7j précédents
  const series14 = loadSeries(sessions, today, 14)
  const loadThis = series14.slice(7).reduce((a, d) => a + d.load, 0)
  const loadPrev = series14.slice(0, 7).reduce((a, d) => a + d.load, 0)
  const sleepAvg = (from: number, to: number) => {
    const ns = sleep.filter((s) => s.date && ageInDays(today, s.date) >= from && ageInDays(today, s.date) < to && s.duree_heures != null)
    return ns.length ? ns.reduce((a, s) => a + (s.duree_heures || 0), 0) / ns.length : 0
  }
  const sleepThis = sleepAvg(0, 7), sleepPrev = sleepAvg(7, 14)

  // Nutrition : cibles vs réel
  const todayLoadKcal = [...sessions].filter((s) => s.date === today).reduce((a, s) => a + (s.kcal_totales || 0), 0)
  const targets = nutritionTargets(profile ?? null, todayLoadKcal)
  const nut7 = nutritionAverages(nutrition, today, 7)

  // Alertes précalculées
  const alerts: string[] = []
  if (acwr.zone === 'danger') alerts.push('⚠️ ACWR en zone danger (pic de charge, risque de blessure)')
  else if (acwr.zone === 'caution') alerts.push('⚠️ Charge en forte hausse (prudence)')
  if (sleepStats.debt7 != null && sleepStats.debt7 < -3) alerts.push(`⚠️ Dette de sommeil ${sleepStats.debt7.toFixed(1)}h`)
  if (load.monotony != null && load.monotony > 2) alerts.push('⚠️ Monotonie d\'entraînement élevée')
  if (cadence.consecutiveDays >= 4) alerts.push(`⚠️ ${cadence.consecutiveDays} jours d'entraînement consécutifs`)
  if (targets.proteines && nut7.prot != null && nut7.prot < targets.proteines * 0.8) alerts.push(`⚠️ Apport protéique bas (${nut7.prot} vs cible ${targets.proteines} g/j)`)

  const zb = zoneBounds(profile ?? null)
  const profileBlock = profile
    ? `PROFIL ATHLÈTE :
- ${profile.nom || 'Athlète'}${profile.sexe ? ' (' + profile.sexe + ')' : ''}${profile.age ? ', ' + profile.age + ' ans' : ''}${profile.poids_kg ? ', ' + profile.poids_kg + ' kg' : ''}${profile.taille_cm ? ', ' + profile.taille_cm + ' cm' : ''}
- FC max : ${hrMax(profile) ?? '?'} · FC repos : ${profile.fc_repos ?? '?'}${zb ? ` · Zones perso : Z2 ${zb.z2}-${zb.z3}, Z3 ${zb.z3}-${zb.z4}, Z4 >${zb.z4} BPM` : ''}
- Objectif : ${profile.objectif || 'non défini'}
- Calendrier / tournois : ${profile.calendrier || 'non renseigné'}
- Blessures / contraintes : ${profile.blessures || 'aucune'}
- Préférences alimentaires : ${profile.preferences_alim || 'aucune'}
${profile.notes_coach ? '- Mémoire (notes) : ' + profile.notes_coach : ''}`
    : 'PROFIL ATHLÈTE : non renseigné (invite l\'athlète à remplir son profil pour des conseils personnalisés).'

  const recentSessions = [...sessions]
    .filter((s) => s.date)
    .sort((a, b) => toTime(b.date) - toTime(a.date))
    .slice(0, 8)
    .map(
      (s) =>
        `- ${s.date} · ${s.sport} · ${s.duree || '?'} · ${s.kcal_totales} kcal · charge ${sessionLoad(s)} · ` +
        `FC ${s.fc_moyenne ?? '?'} (${s.zone_cardiaque ?? '?'}) · RPE ${s.rpe ?? 'est.'} · ` +
        `énergie ${s.energie ?? '?'}/10 · récup ${s.recup ?? '?'}/10` +
        (s.douleurs && s.douleurs !== 'Aucune' && s.douleurs !== '—' ? ` · douleurs: ${s.douleurs}` : '') +
        (s.observation ? ` · note: ${s.observation}` : '')
    )
    .join('\n')

  const recentSleep = [...sleep]
    .filter((s) => s.date)
    .sort((a, b) => toTime(b.date) - toTime(a.date))
    .slice(0, 7)
    .map(
      (s) =>
        `- ${s.date} · ${s.duree_heures ?? '?'}h · qualité ${s.qualite ?? '?'}/10 · ` +
        `réveils ${s.reveils ?? '?'} · fatigue matin ${s.fatigue_matin ?? '?'}/10` +
        (s.note ? ` · ${s.note}` : '')
    )
    .join('\n')

  const recentNutri = [...nutrition]
    .filter((n) => n.date)
    .sort((a, b) => toTime(b.date) - toTime(a.date))
    .slice(0, 6)
    .map(
      (n) =>
        `- ${n.date} · ${n.repas} · ${n.kcal ?? '?'} kcal · ` +
        `P${n.proteines ?? '?'}/G${n.glucides ?? '?'}/L${n.lipides ?? '?'} · ${n.description}`
    )
    .join('\n')

  return `DATE DU JOUR : ${today}

${profileBlock}

ALERTES : ${alerts.length ? alerts.join(' | ') : 'aucune'}

SCORE DE RÉCUPÉRATION : ${recovery.score ?? 'n/a'}/100 — ${recovery.verdict}
Reco système : ${recovery.message}

CHARGE D'ENTRAÎNEMENT (unités sRPE = RPE × minutes) :
- ACWR (aiguë 7j / chronique 28j) : ${acwr.ratio?.toFixed(2) ?? 'n/a'} — ${acwr.label}
- Charge 7j : ${Math.round(loadThis)} ${arrow(loadThis, loadPrev)} (7j préc. : ${Math.round(loadPrev)})
- Monotonie (7j) : ${load.monotony?.toFixed(2) ?? 'n/a'} · Contrainte : ${load.strain ? Math.round(load.strain) : 'n/a'}

SOMMEIL :
- Dette 7j : ${sleepStats.debt7?.toFixed(1) ?? 'n/a'}h · moyenne 7j : ${sleepThis ? sleepThis.toFixed(1) : 'n/a'}h ${arrow(sleepThis, sleepPrev)} (7j préc. : ${sleepPrev ? sleepPrev.toFixed(1) : 'n/a'}h)

NUTRITION (moyenne ${nut7.daysLogged} j) :
- Apport moyen : ${nut7.kcal ?? 'n/a'} kcal/j, ${nut7.prot ?? 'n/a'} g protéines/j
- Cibles : ${targets.kcal ?? 'n/a'} kcal/j, ${targets.proteines ?? 'n/a'} g protéines/j${targets.kcal == null ? ' (profil incomplet)' : ''}

CADENCE :
- Jours depuis dernière séance : ${cadence.daysSinceLast ?? 'n/a'} · jours consécutifs : ${cadence.consecutiveDays}

DERNIÈRES SÉANCES :
${recentSessions || '(aucune)'}

DERNIÈRES NUITS :
${recentSleep || '(aucune)'}

DERNIERS REPAS :
${recentNutri || '(aucun)'}`
}
