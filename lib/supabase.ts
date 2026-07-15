import { createClient } from '@supabase/supabase-js'

// .trim() : évite tout espace parasite copié dans .env.local qui ferait
// échouer les requêtes côté navigateur.
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Session = {
  id?: number
  date: string
  sport: string
  duree: string | null
  distance: number | null
  kcal_activite: number | null
  kcal_totales: number
  kcal_heure: number | null
  fc_moyenne: number | null
  fc_max: number | null
  zone_cardiaque: string | null
  rythme: string | null
  cadence: number | null
  denivele: number | null
  observation: string | null
  energie: number | null
  douleurs: string | null
  recup: number | null
  rpe: number | null
  sans_montre?: boolean
  ai_recommendation?: string | null
  created_at?: string
}

export type Nutrition = {
  id?: number
  date: string
  repas: string
  description: string
  kcal: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  qualite: number | null
  note: string | null
  created_at?: string
}

export type Sleep = {
  id?: number
  date: string
  heure_coucher: string | null
  heure_lever: string | null
  duree_heures: number | null
  qualite: number | null
  sport_veille: string | null
  kcal_veille: number | null
  reveils: number | null
  fatigue_matin: number | null
  note: string | null
  impact: string | null
  created_at?: string
}

export function getZone(fc: number | null): string {
  if (!fc) return '—'
  if (fc < 120) return 'Zone 1 — Récupération'
  if (fc <= 135) return 'Zone 2 — Lipides ✅'
  if (fc <= 150) return 'Zone 3 — Mixte'
  return 'Zone 4 — Trop élevé ⚠️'
}

export function getZoneColor(zone: string): string {
  if (zone.includes('Zone 1')) return '#3498db'
  if (zone.includes('Zone 2')) return '#27ae60'
  if (zone.includes('Zone 3')) return '#f39c12'
  if (zone.includes('Zone 4')) return '#e74c3c'
  return '#6b7280'
}

export type Nap = {
  id?: number
  date: string
  heure_debut: string
  heure_fin: string
  duree_minutes?: number | null
  qualite?: number | null
  note?: string | null
  created_at?: string
}

/** Durée en minutes entre deux horaires "HH:MM" (gère le passage minuit). */
export function calcDureeMinutes(debut: string, fin: string): number {
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  let diff = (fh * 60 + fm) - (dh * 60 + dm)
  if (diff < 0) diff += 1440
  return diff
}
