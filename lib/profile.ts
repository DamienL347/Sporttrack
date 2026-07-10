/**
 * Profil athlète : personnalisation des zones cardiaques (Karvonen) et des
 * cibles nutritionnelles (Mifflin-St Jeor), + chargement/sauvegarde Supabase.
 */
import { supabase } from './supabase'

export type Profile = {
  id?: number
  nom: string | null
  sexe: 'H' | 'F' | null
  age: number | null
  poids_kg: number | null
  taille_cm: number | null
  fc_max: number | null
  fc_repos: number | null
  poids_objectif: number | null
  objectif: string | null
  calendrier: string | null
  blessures: string | null
  preferences_alim: string | null
  notes_coach: string | null
}

export function emptyProfile(): Profile {
  return {
    nom: null, sexe: null, age: null, poids_kg: null, taille_cm: null,
    fc_max: null, fc_repos: null, poids_objectif: null, objectif: null, calendrier: null,
    blessures: null, preferences_alim: null, notes_coach: null,
  }
}

export async function loadProfile(): Promise<Profile | null> {
  try {
    // RLS filtre déjà par utilisateur ; on récupère la ligne du compte connecté.
    const { data, error } = await supabase.from('profile').select('*').maybeSingle()
    if (error) return null
    return data as Profile | null
  } catch {
    return null // table pas encore créée : dégradation silencieuse
  }
}

export async function saveProfile(p: Profile): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'Non connecté.' }
  const { id, ...rest } = p
  const { error } = await supabase
    .from('profile')
    .upsert({ ...rest, user_id: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return { error: error ? error.message : null }
}

// ── Fréquence cardiaque ──────────────────────────────────────────────
export function hrMax(p: Profile | null): number | null {
  if (p?.fc_max) return p.fc_max
  if (p?.age) return Math.round(207 - 0.7 * p.age) // Tanaka (plus juste que 220-âge)
  return null
}
export function hrRest(p: Profile | null): number {
  return p?.fc_repos || 60
}

/** Bornes de zones (BPM) via Karvonen (%FCR). Renvoie null si FC max inconnue. */
export function zoneBounds(p: Profile | null): { z2: number; z3: number; z4: number } | null {
  const max = hrMax(p)
  if (!max) return null
  const rest = hrRest(p)
  const hrr = max - rest
  const at = (pct: number) => Math.round(rest + pct * hrr)
  return { z2: at(0.6), z3: at(0.7), z4: at(0.8) }
}

/** Libellé de zone personnalisé (même format que l'app). Fallback fixe si pas de profil. */
export function getZonePerso(fc: number | null, p: Profile | null): string {
  if (!fc) return '—'
  const b = zoneBounds(p)
  const [z2, z3, z4] = b ? [b.z2, b.z3, b.z4] : [120, 135, 150]
  if (fc < z2) return 'Zone 1 — Récupération'
  if (fc <= z3) return 'Zone 2 — Lipides ✅'
  if (fc <= z4) return 'Zone 3 — Mixte'
  return 'Zone 4 — Trop élevé ⚠️'
}

// ── Cibles nutritionnelles ───────────────────────────────────────────
export type NutritionTargets = {
  kcal: number | null
  proteines: number | null
  bmr: number | null
}

/**
 * BMR Mifflin-St Jeor + facteur d'activité + dépense d'entraînement du jour.
 * Protéines : 1,6 g/kg (forme) → 2,0 g/kg (objectif perf/masse).
 */
export function nutritionTargets(p: Profile | null, trainingKcalToday = 0): NutritionTargets {
  if (!p?.poids_kg || !p?.taille_cm || !p?.age) return { kcal: null, proteines: null, bmr: null }
  const s = p.sexe === 'F' ? -161 : 5
  const bmr = Math.round(10 * p.poids_kg + 6.25 * p.taille_cm - 5 * p.age + s)
  const perf = /perf|masse|muscle/i.test(p.objectif || '')
  const cut = /perte|maigrir|s[eè]che/i.test(p.objectif || '')
  const activity = 1.4 // travail sédentaire ; l'entraînement est ajouté à part
  let kcal = Math.round(bmr * activity + trainingKcalToday)
  if (cut) kcal -= 400
  const proteines = Math.round(p.poids_kg * (perf ? 2.0 : 1.6))
  return { kcal, proteines, bmr }
}
