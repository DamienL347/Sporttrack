import { supabase } from './supabase'

export type Measurement = {
  id?: number
  date: string
  poids_kg: number | null
  tour_taille_cm: number | null
  masse_grasse_pct: number | null
  note: string | null
}

export async function loadMeasurements(): Promise<Measurement[]> {
  try {
    const { data, error } = await supabase.from('measurements').select('*').order('date', { ascending: true })
    if (error) return []
    return (data as Measurement[]) || []
  } catch {
    return []
  }
}

export async function saveMeasurement(m: Measurement): Promise<{ error: string | null }> {
  // user_id est rempli par le défaut auth.uid() côté base ; conflit sur (user_id, date).
  const { error } = await supabase.from('measurements').upsert(
    {
      date: m.date,
      poids_kg: m.poids_kg,
      tour_taille_cm: m.tour_taille_cm,
      masse_grasse_pct: m.masse_grasse_pct,
      note: m.note,
    },
    { onConflict: 'user_id,date' }
  )
  return { error: error ? error.message : null }
}

export type WeightTrend = {
  latest: number | null
  latestDate: string | null
  previous: number | null // ~14 jours avant la dernière pesée
  deltaTotal: number | null // dernière − première
  toGoal: number | null // dernière − objectif (négatif = au-dessus de l'objectif)
  count: number
}

const DAY = 86400000
function t(d: string) { return new Date(d + 'T00:00:00').getTime() }

export function weightTrend(measures: Measurement[], objectif: number | null): WeightTrend {
  const withW = measures.filter((m) => m.poids_kg != null)
  if (withW.length === 0) return { latest: null, latestDate: null, previous: null, deltaTotal: null, toGoal: null, count: 0 }
  const sorted = [...withW].sort((a, b) => t(a.date) - t(b.date))
  const latest = sorted[sorted.length - 1]
  const first = sorted[0]
  // point le plus proche de 14 jours avant la dernière pesée
  const target = t(latest.date) - 14 * DAY
  let prev: Measurement | null = null
  for (const m of sorted) {
    if (t(m.date) <= target) prev = m
  }
  return {
    latest: latest.poids_kg,
    latestDate: latest.date,
    previous: prev?.poids_kg ?? (sorted.length > 1 ? first.poids_kg : null),
    deltaTotal: latest.poids_kg != null && first.poids_kg != null ? Math.round((latest.poids_kg - first.poids_kg) * 10) / 10 : null,
    toGoal: objectif != null && latest.poids_kg != null ? Math.round((latest.poids_kg - objectif) * 10) / 10 : null,
    count: withW.length,
  }
}

/** Jours depuis la dernière pesée (null si aucune). */
export function daysSinceWeighIn(measures: Measurement[], today: string): number | null {
  const withW = measures.filter((m) => m.poids_kg != null)
  if (withW.length === 0) return null
  const last = withW.reduce((a, b) => (t(a.date) > t(b.date) ? a : b))
  return Math.round((t(today) - t(last.date)) / DAY)
}
