/**
 * Script de migration Excel → Supabase
 * Usage: node scripts/migrate-excel.js chemin/vers/suivi_sport_nutrition.xlsx
 */

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const filePath = process.argv[2]
if (!filePath) {
  console.error('❌ Usage: node scripts/migrate-excel.js chemin/vers/fichier.xlsx')
  process.exit(1)
}

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'string') {
    const parts = val.split('/')
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
  }
  return null
}

function parseTime(val) {
  if (val === null || val === undefined || val === '—' || val === '') return null
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60)
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return String(val)
}

function parseNum(val) {
  const n = Number(val)
  return isNaN(n) || val === '—' || val === '' || val === null ? null : n
}

function parseInt_(val) {
  const n = parseNum(val)
  return n === null ? null : Math.round(n)
}

function parseRating(val) {
  const n = parseInt_(val)
  return n === null || n < 1 || n > 10 ? null : n
}

async function migrate() {
  console.log(`📂 Lecture du fichier : ${filePath}`)
  const wb = XLSX.readFile(filePath)

  // ── SPORT ──────────────────────────────────────────────
  const sportSheet = wb.Sheets['🏃 Sport']
  if (!sportSheet) { console.error('❌ Onglet "🏃 Sport" introuvable'); process.exit(1) }
  const sportRows = XLSX.utils.sheet_to_json(sportSheet, { header: 1, defval: null })

  const sessions = []
  for (let i = 4; i < sportRows.length; i++) {
    const row = sportRows[i]
    if (!row[1] || row[0] === '📈  SYNTHÈSE') break
    const date = parseDate(row[1])
    if (!date) continue
    const kcalTotales = parseNum(row[6])
    if (!kcalTotales) continue

    sessions.push({
      date,
      sport: row[2] || null,
      duree: row[3] && row[3] !== '—' ? String(row[3]) : null,
      distance: parseNum(row[4]),
      kcal_activite: parseInt_(row[5]),
      kcal_totales: Math.round(kcalTotales),
      kcal_heure: parseInt_(row[7]),
      fc_moyenne: parseInt_(row[8]),
      zone_cardiaque: row[9] && row[9] !== '—' ? String(row[9]) : null,
      rythme: row[10] && row[10] !== '—' ? String(row[10]) : null,
      cadence: parseInt_(row[11]),
      denivele: parseInt_(row[12]),
      observation: row[13] && row[13] !== '—' ? String(row[13]) : null,
      energie: parseRating(row[14]),
      douleurs: row[15] && row[15] !== '—' ? String(row[15]) : null,
      recup: parseRating(row[16]),
    })
  }

  if (sessions.length > 0) {
    console.log(`🏃 Migration de ${sessions.length} séances...`)
    const { error } = await supabase.from('sessions').upsert(sessions, { onConflict: 'date,sport' })
    if (error) console.error('❌ Erreur sessions:', error.message)
    else console.log(`✅ ${sessions.length} séances migrées`)
  }

  // ── NUTRITION ──────────────────────────────────────────
  const nutriSheet = wb.Sheets['🥗 Nourriture']
  if (nutriSheet) {
    const nutriRows = XLSX.utils.sheet_to_json(nutriSheet, { header: 1, defval: null })
    const nutri = []
    for (let i = 4; i < nutriRows.length; i++) {
      const row = nutriRows[i]
      if (!row[1] || row[0] === '📈') break
      const date = parseDate(row[1])
      if (!date) continue
      nutri.push({
        date,
        repas: row[2] || 'Repas',
        description: row[3] || '',
        kcal: parseInt_(row[4]),
        proteines: parseNum(row[5]),
        glucides: parseNum(row[6]),
        lipides: parseNum(row[7]),
        qualite: parseRating(row[8]),
        note: row[9] && row[9] !== '—' ? String(row[9]) : null,
      })
    }
    if (nutri.length > 0) {
      console.log(`🥗 Migration de ${nutri.length} repas...`)
      const { error } = await supabase.from('nutrition').upsert(nutri, { onConflict: 'date,repas' })
      if (error) console.error('❌ Erreur nutrition:', error.message)
      else console.log(`✅ ${nutri.length} repas migrés`)
    }
  }

  // ── SOMMEIL ────────────────────────────────────────────
  const sleepSheet = wb.Sheets['😴 Sommeil']
  if (sleepSheet) {
    const sleepRows = XLSX.utils.sheet_to_json(sleepSheet, { header: 1, defval: null })
    const sleepData = []
    for (let i = 4; i < sleepRows.length; i++) {
      const row = sleepRows[i]
      if (!row[1] || row[0] === '📈') break
      const date = parseDate(row[1])
      if (!date) continue
      sleepData.push({
        date,
        heure_coucher: parseTime(row[2]),
        heure_lever: parseTime(row[3]),
        duree_heures: parseNum(row[4]),
        qualite: parseRating(row[5]),
        sport_veille: row[6] && row[6] !== '—' ? String(row[6]) : null,
        kcal_veille: parseInt_(row[7]),
        reveils: parseInt_(row[8]),
        fatigue_matin: parseRating(row[9]),
        note: row[10] && row[10] !== '—' ? String(row[10]) : null,
        impact: row[11] && row[11] !== '—' ? String(row[11]) : null,
      })
    }
    if (sleepData.length > 0) {
      console.log(`😴 Migration de ${sleepData.length} nuits...`)
      const { error } = await supabase.from('sleep').upsert(sleepData, { onConflict: 'date' })
      if (error) console.error('❌ Erreur sommeil:', error.message)
      else console.log(`✅ ${sleepData.length} nuits migrées`)
    }
  }

  console.log('\n🎉 Migration terminée !')
}

migrate().catch(console.error)
