'use client'
import { useState, useEffect } from 'react'
import { supabase, calcDureeMinutes } from '@/lib/supabase'
import { Profile, loadProfile, getZonePerso } from '@/lib/profile'
import { todayISO } from '@/lib/recovery'
import { useRequireAuth } from '@/lib/useRequireAuth'
import { saveMeasurement } from '@/lib/measurements'
import Link from 'next/link'

type Tab = 'sport' | 'nutrition' | 'sommeil' | 'poids'

const SPORTS = [
  'Tennis', 'Padel', 'Course', 'Tournoi Tennis', 'Tournoi Padel',
  'Vélo', 'Natation', 'Musculation', 'Football', 'Randonnée',
  'Boxe', 'CrossFit', 'Yoga', 'Autre',
]
const REPAS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']
const DOULEURS = ['Aucune', 'Jambes', 'Bras', 'Dos', 'Épaules', 'Genoux']

function Chip({ label, active, onClick, danger }: { label: string; active: boolean; onClick: () => void; danger?: boolean }) {
  const activeColor = danger ? 'var(--danger)' : 'var(--accent)'
  const activeBg = danger ? 'rgba(255,77,109,0.14)' : 'rgba(0,245,196,0.14)'
  return (
    <button className="press" onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600,
      border: `1.5px solid ${active ? activeColor : 'var(--card-border)'}`,
      background: active ? activeBg : 'rgba(255,255,255,0.03)',
      color: active ? activeColor : 'var(--muted)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      boxShadow: active ? `0 0 12px ${danger ? 'rgba(255,77,109,0.25)' : 'rgba(0,245,196,0.25)'}` : 'none',
      transition: 'all 0.2s'
    }}>{label}</button>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{label}</label>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{value}</span>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}

export default function LogPage() {
  const authed = useRequireAuth()
  const [tab, setTab] = useState<Tab>('sport')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => { loadProfile().then(setProfile) }, [])

  const today = todayISO()

  // Sport state
  const [sport, setSport] = useState({
    date: today, sport: 'Tennis', sportCustom: '', duree: '', kcal: '', fc: '', fcmax: '',
    energie: 7, rpe: 6, douleurs: ['Aucune'], recup: 7, note: '',
    sansMontre: false, aiReco: '', aiConfiance: '',
  })
  const [aiEstimating, setAiEstimating] = useState(false)

  // Nutrition state
  const [nutri, setNutri] = useState({ date: today, repas: 'Déjeuner', description: '', kcal: '', proteines: '', glucides: '', lipides: '', qualite: 7, note: '', commentaire: '', confiance: '' })
  const [nutriImg, setNutriImg] = useState<{ preview: string; media_type: string; data: string } | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimated, setEstimated] = useState(false)

  // Sleep state
  const [sleep, setSleep] = useState({ date: today, coucher: '', lever: '', qualite: 7, reveils: '0', fatigue: 5, note: '' })

  // Siestes state
  const [naps, setNaps] = useState<{ debut: string; fin: string; qualite: number; note: string }[]>([])
  const addNap = () => setNaps(n => [...n, { debut: '', fin: '', qualite: 7, note: '' }])
  const updateNap = (i: number, key: string, val: string | number) =>
    setNaps(n => n.map((nap, idx) => idx === i ? { ...nap, [key]: val } : nap))
  const removeNap = (i: number) => setNaps(n => n.filter((_, idx) => idx !== i))

  // Poids state
  const [poids, setPoids] = useState({ date: today, poids: '', taille: '', masse: '', note: '' })

  const calcSommeil = () => {
    if (!sleep.coucher || !sleep.lever) return null
    const [ch, cm] = sleep.coucher.split(':').map(Number)
    const [lh, lm] = sleep.lever.split(':').map(Number)
    let diff = (lh * 60 + lm) - (ch * 60 + cm)
    if (diff < 0) diff += 1440
    return Math.round(diff / 60 * 100) / 100
  }

  const toggleDouleur = (d: string) => {
    if (d === 'Aucune') { setSport(s => ({ ...s, douleurs: ['Aucune'] })); return }
    setSport(s => {
      const without = s.douleurs.filter(x => x !== 'Aucune')
      if (without.includes(d)) return { ...s, douleurs: without.filter(x => x !== d) || ['Aucune'] }
      return { ...s, douleurs: [...without, d] }
    })
  }

  const estimateSport = async () => {
    setErrMsg(null)
    if (!sport.duree.trim()) { setErrMsg('Renseigne au moins la durée.'); return }
    setAiEstimating(true)
    try {
      const res = await fetch('/api/ai-sport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: sport.sport === 'Autre' ? sport.sportCustom : sport.sport,
          duree: sport.duree,
          note: sport.note,
          date: sport.date,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErrMsg(d.error || 'Échec de l’estimation.'); return }
      setSport(p => ({
        ...p,
        kcal: String(d.kcal ?? ''),
        fc: String(d.fc_moyenne ?? ''),
        aiReco: d.conseil || '',
        aiConfiance: d.confiance || '',
      }))
    } catch (e: any) {
      setErrMsg(e?.message || 'Erreur réseau pendant l’estimation.')
    } finally {
      setAiEstimating(false)
    }
  }

  // Redimensionne la photo (max 1024px, JPEG q0.8) → réduit payload et coût vision
  const handlePhoto = (file: File) => {
    setErrMsg(null)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1024
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setNutriImg({ preview: dataUrl, media_type: 'image/jpeg', data: dataUrl.split(',')[1] })
        setEstimated(false)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const estimateNutri = async () => {
    if (!nutri.description.trim() && !nutriImg) {
      setErrMsg('Décris ton repas ou ajoute une photo.')
      return
    }
    setEstimating(true)
    setErrMsg(null)
    try {
      const res = await fetch('/api/nutrition-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nutri.description,
          repas: nutri.repas,
          image: nutriImg ? { media_type: nutriImg.media_type, data: nutriImg.data } : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setErrMsg(d.error || 'Échec de l’estimation.')
        return
      }
      setNutri((p) => ({
        ...p,
        description: d.description || p.description,
        kcal: String(d.kcal ?? ''),
        proteines: String(d.proteines ?? ''),
        glucides: String(d.glucides ?? ''),
        lipides: String(d.lipides ?? ''),
        qualite: d.qualite ?? p.qualite,
        commentaire: d.commentaire || '',
        confiance: d.confiance || '',
      }))
      setEstimated(true)
    } catch (e: any) {
      setErrMsg(e?.message || 'Erreur réseau pendant l’estimation.')
    } finally {
      setEstimating(false)
    }
  }

  // Garde-fou : valeur numérique dans une plage plausible, sinon message.
  const guard = (val: number | null, min: number, max: number, nom: string): boolean => {
    if (val != null && (val < min || val > max)) {
      setErrMsg(`${nom} hors plage (${min}–${max}). Vérifie la saisie.`)
      return false
    }
    return true
  }

  const saveSport = async () => {
    setErrMsg(null)
    const sportName = sport.sport === 'Autre' ? (sport.sportCustom.trim() || 'Autre') : sport.sport
    const zone = getZonePerso(Number(sport.fc) || null, profile)
    const kcal = Number(sport.kcal) || 0
    const fc = Number(sport.fc) || null
    if (!guard(kcal, 0, 6000, 'Kcal') || !guard(fc, 30, 230, 'FC moyenne')) return
    setSaving(true)
    const [h, m] = sport.duree ? sport.duree.split(':').map(Number) : [0, 0]
    const heures = h + (m || 0) / 60
    const payload: Record<string, any> = {
      date: sport.date, sport: sportName, duree: sport.duree || null,
      kcal_totales: kcal, kcal_heure: heures > 0 ? Math.round(kcal / heures) : null,
      fc_moyenne: fc, fc_max: Number(sport.fcmax) || null,
      zone_cardiaque: zone, energie: sport.energie, rpe: sport.rpe,
      douleurs: sport.douleurs.join(', '), recup: sport.recup,
      observation: sport.note || null,
      sans_montre: sport.sansMontre, ai_recommendation: sport.aiReco || null,
    }
    let { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'user_id,date,sport' })
    // Fallback si la migration RPE / sans-montre n'a pas encore été lancée
    if (error && /rpe/i.test(error.message)) {
      delete payload.rpe
      ;({ error } = await supabase.from('sessions').upsert(payload, { onConflict: 'user_id,date,sport' }))
    }
    if (error && /(sans_montre|ai_recommendation)/i.test(error.message)) {
      delete payload.sans_montre
      delete payload.ai_recommendation
      ;({ error } = await supabase.from('sessions').upsert(payload, { onConflict: 'user_id,date,sport' }))
    }
    finishSave(error)
  }

  const saveNutri = async () => {
    setErrMsg(null)
    if (!guard(Number(nutri.kcal) || null, 0, 6000, 'Kcal')) return
    setSaving(true)
    const { error } = await supabase.from('nutrition').upsert({
      date: nutri.date, repas: nutri.repas, description: nutri.description,
      kcal: Number(nutri.kcal) || null, proteines: Number(nutri.proteines) || null,
      glucides: Number(nutri.glucides) || null, lipides: Number(nutri.lipides) || null,
      qualite: nutri.qualite, note: nutri.note || null
    }, { onConflict: 'user_id,date,repas' })
    finishSave(error)
  }

  const saveSleep = async () => {
    setSaving(true)
    setErrMsg(null)
    const { error } = await supabase.from('sleep').upsert({
      date: sleep.date, heure_coucher: sleep.coucher || null,
      heure_lever: sleep.lever || null, duree_heures: calcSommeil(),
      qualite: sleep.qualite, reveils: Number(sleep.reveils) || 0,
      fatigue_matin: sleep.fatigue, note: sleep.note || null
    }, { onConflict: 'user_id,date' })
    if (!error) {
      const rows = naps
        .filter(n => n.debut && n.fin)
        .map(n => ({
          date: sleep.date, heure_debut: n.debut, heure_fin: n.fin,
          duree_minutes: calcDureeMinutes(n.debut, n.fin),
          qualite: n.qualite, note: n.note || null,
        }))
      if (rows.length) {
        const { error: napError } = await supabase.from('naps').insert(rows)
        finishSave(napError)
        return
      }
    }
    finishSave(error)
  }

  const savePoids = async () => {
    setErrMsg(null)
    const kg = Number(poids.poids) || null
    if (!kg) { setErrMsg('Renseigne au moins ton poids.'); return }
    if (!guard(kg, 20, 400, 'Poids')) return
    setSaving(true)
    const { error } = await saveMeasurement({
      date: poids.date,
      poids_kg: kg,
      tour_taille_cm: Number(poids.taille) || null,
      masse_grasse_pct: Number(poids.masse) || null,
      note: poids.note || null,
    })
    finishSave(error ? { message: error } : null)
  }

  const finishSave = (error: { message: string } | null) => {
    setSaving(false)
    if (error) {
      setErrMsg(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const s: React.CSSProperties = { marginBottom: 14 }
  const label: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 16px', marginBottom: 14 }
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
  )

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Logger</h1>
      </div>

      {/* Tabs */}
      <div className="glass" style={{ display: 'flex', gap: 4, marginBottom: 20, padding: 4 }}>
        {(['sport', 'nutrition', 'sommeil', 'poids'] as Tab[]).map(t => (
          <button key={t} className="press" onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 2px', borderRadius: 12, border: 'none',
            background: tab === t ? 'linear-gradient(135deg, var(--accent), var(--cyan))' : 'transparent',
            color: tab === t ? '#05060c' : 'var(--muted)',
            fontWeight: 800, fontSize: 12, cursor: 'pointer',
            textTransform: 'capitalize',
            boxShadow: tab === t ? '0 0 16px rgba(0,245,196,0.35)' : 'none',
            transition: 'all 0.25s'
          }}>{t === 'sport' ? '🏃' : t === 'nutrition' ? '🥗' : t === 'sommeil' ? '😴' : '⚖️'} {t}</button>
        ))}
      </div>

      {/* SPORT */}
      {tab === 'sport' && (
        <>
          <div style={card}>
            <div style={sectionTitle}>Séance</div>
            <div style={s}><label style={label}>Date</label><input type="date" value={sport.date} onChange={e => setSport(p => ({ ...p, date: e.target.value }))} /></div>
            <div style={s}>
              <label style={label}>Sport</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SPORTS.map(sp => <Chip key={sp} label={sp} active={sport.sport === sp} onClick={() => setSport(p => ({ ...p, sport: sp }))} />)}
              </div>
            </div>
            {sport.sport === 'Autre' && (
              <div style={s}><label style={label}>Précise le sport</label>
                <input type="text" placeholder="Quel sport ?" value={sport.sportCustom} onChange={e => setSport(p => ({ ...p, sportCustom: e.target.value }))} /></div>
            )}
            <div style={row2}>
              <div style={s}><label style={label}>Durée</label><input type="text" placeholder="1:30:00" value={sport.duree} onChange={e => setSport(p => ({ ...p, duree: e.target.value }))} /></div>
              <div style={s}><label style={label}>Kcal totales</label><input type="number" placeholder="950" value={sport.kcal} onChange={e => setSport(p => ({ ...p, kcal: e.target.value }))} /></div>
            </div>
            <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 14px' }}>
              <label style={{ ...label, margin: 0 }}>⌚ Sans montre — estimation IA</label>
              <div onClick={() => setSport(p => ({ ...p, sansMontre: !p.sansMontre }))}
                style={{ width: 44, height: 24, borderRadius: 12, background: sport.sansMontre ? 'var(--accent)' : 'var(--card-border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: sport.sansMontre ? 23 : 3, transition: 'left 0.2s' }} />
              </div>
            </div>
            {sport.sansMontre ? (
              <>
                <button onClick={estimateSport} disabled={aiEstimating || !sport.duree.trim()} style={{ width: '100%', padding: '13px', background: 'rgba(0,245,196,0.10)', border: '1.5px solid var(--accent)', color: 'var(--accent)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 14, opacity: aiEstimating || !sport.duree.trim() ? 0.6 : 1 }}>
                  {aiEstimating ? '🤖 Estimation en cours…' : '🤖 Estimer avec l’IA'}
                </button>
                {sport.aiReco && (
                  <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--text)', marginBottom: 14, lineHeight: 1.5 }}>
                    💬 {sport.aiReco}
                    {sport.aiConfiance && <span style={{ color: 'var(--muted)', fontSize: 11 }}> · confiance {sport.aiConfiance}</span>}
                  </div>
                )}
                {sport.fc && <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--accent)', marginBottom: 14 }}>
                  FC estimée : {sport.fc} BPM · Zone : {getZonePerso(Number(sport.fc), profile)}
                </div>}
              </>
            ) : (
              <>
                <div style={row2}>
                  <div style={s}><label style={label}>FC moy (BPM)</label><input type="number" placeholder="130" value={sport.fc} onChange={e => setSport(p => ({ ...p, fc: e.target.value }))} /></div>
                  <div style={s}><label style={label}>FC max (BPM)</label><input type="number" placeholder="165" value={sport.fcmax} onChange={e => setSport(p => ({ ...p, fcmax: e.target.value }))} /></div>
                </div>
                {sport.fc && <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--accent)', marginTop: -4 }}>
                  Zone : {getZonePerso(Number(sport.fc), profile)}{!profile?.fc_max && !profile?.age ? ' (zones génériques — renseigne ton profil)' : ''}
                </div>}
              </>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>Ressenti post-séance</div>
            <Slider label="Intensité perçue (RPE)" value={sport.rpe} onChange={v => setSport(p => ({ ...p, rpe: v }))} />
            <Slider label="Énergie" value={sport.energie} onChange={v => setSport(p => ({ ...p, energie: v }))} />
            <Slider label="Récupération perçue" value={sport.recup} onChange={v => setSport(p => ({ ...p, recup: v }))} />
            <div style={s}>
              <label style={label}>Douleurs</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DOULEURS.map(d => <Chip key={d} label={d} active={sport.douleurs.includes(d)} onClick={() => toggleDouleur(d)} danger={d !== 'Aucune'} />)}
              </div>
            </div>
            <div style={s}><label style={label}>Note libre</label><textarea value={sport.note} onChange={e => setSport(p => ({ ...p, note: e.target.value }))} placeholder="Conditions, niveau, ressentis..." style={{ resize: 'none', height: 70 }} /></div>
          </div>
        </>
      )}

      {/* NUTRITION */}
      {tab === 'nutrition' && (
        <div style={card}>
          <div style={sectionTitle}>Repas</div>
          <div style={s}><label style={label}>Date</label><input type="date" value={nutri.date} onChange={e => setNutri(p => ({ ...p, date: e.target.value }))} /></div>
          <div style={s}>
            <label style={label}>Repas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {REPAS.map(r => <Chip key={r} label={r} active={nutri.repas === r} onClick={() => setNutri(p => ({ ...p, repas: r }))} />)}
            </div>
          </div>

          <div style={s}>
            <label style={label}>Décris ton repas</label>
            <textarea value={nutri.description} onChange={e => { setNutri(p => ({ ...p, description: e.target.value })); setEstimated(false) }} placeholder="Ex : pâtes bolognaise, une salade verte, un yaourt et un verre de vin" style={{ resize: 'none', height: 70 }} />
          </div>

          <div style={s}>
            <label style={label}>…ou ajoute une photo</label>
            {!nutriImg ? (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--card-border)', borderRadius: 10, padding: '16px', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>
                📷 Prendre / choisir une photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
              </label>
            ) : (
              <div style={{ position: 'relative' }}>
                <img src={nutriImg.preview} alt="repas" style={{ width: '100%', borderRadius: 10, maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => { setNutriImg(null); setEstimated(false) }} style={{ position: 'absolute', top: 8, right: 8, background: '#05060c', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✕ Retirer</button>
              </div>
            )}
          </div>

          <button onClick={estimateNutri} disabled={estimating} style={{ width: '100%', padding: '13px', background: 'rgba(0,245,196,0.10)', border: '1.5px solid var(--accent)', color: 'var(--accent)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 14, opacity: estimating ? 0.6 : 1 }}>
            {estimating ? '🤖 Estimation en cours…' : '🤖 Estimer les valeurs avec l’IA'}
          </button>

          {nutri.commentaire && (
            <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--text)', marginBottom: 14, lineHeight: 1.5 }}>
              💬 {nutri.commentaire}
              {nutri.confiance && <span style={{ color: 'var(--muted)', fontSize: 11 }}> · confiance {nutri.confiance}</span>}
            </div>
          )}

          <div style={{ ...label, marginBottom: 8 }}>{estimated ? 'Estimation IA — ajuste si besoin' : 'Valeurs (optionnel)'}</div>
          <div style={row2}>
            <div style={s}><label style={label}>Kcal</label><input type="number" placeholder="650" value={nutri.kcal} onChange={e => setNutri(p => ({ ...p, kcal: e.target.value }))} /></div>
            <div style={s}><label style={label}>Qualité /10</label><input type="number" min={1} max={10} placeholder="7" value={nutri.qualite} onChange={e => setNutri(p => ({ ...p, qualite: Number(e.target.value) }))} /></div>
          </div>
          <div style={row2}>
            <div style={s}><label style={label}>Protéines (g)</label><input type="number" placeholder="45" value={nutri.proteines} onChange={e => setNutri(p => ({ ...p, proteines: e.target.value }))} /></div>
            <div style={s}><label style={label}>Glucides (g)</label><input type="number" placeholder="60" value={nutri.glucides} onChange={e => setNutri(p => ({ ...p, glucides: e.target.value }))} /></div>
          </div>
          <div style={s}><label style={label}>Lipides (g)</label><input type="number" placeholder="25" value={nutri.lipides} onChange={e => setNutri(p => ({ ...p, lipides: e.target.value }))} /></div>
          <div style={s}><label style={label}>Note</label><textarea value={nutri.note} onChange={e => setNutri(p => ({ ...p, note: e.target.value }))} placeholder="Contexte, restaurant, maison..." style={{ resize: 'none', height: 60 }} /></div>
        </div>
      )}

      {/* SOMMEIL */}
      {tab === 'sommeil' && (
        <>
          <div style={card}>
            <div style={sectionTitle}>Nuit</div>
            <div style={s}><label style={label}>Date (nuit du)</label><input type="date" value={sleep.date} onChange={e => setSleep(p => ({ ...p, date: e.target.value }))} /></div>
            <div style={row2}>
              <div style={s}><label style={label}>Coucher</label><input type="time" value={sleep.coucher} onChange={e => setSleep(p => ({ ...p, coucher: e.target.value }))} /></div>
              <div style={s}><label style={label}>Lever</label><input type="time" value={sleep.lever} onChange={e => setSleep(p => ({ ...p, lever: e.target.value }))} /></div>
            </div>
            {calcSommeil() && <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: (calcSommeil() || 0) >= 7.5 ? 'var(--accent)' : 'var(--danger)', marginBottom: 14 }}>
              Durée : {calcSommeil()}h {(calcSommeil() || 0) >= 7.5 ? '✅' : '⚠️ Insuffisant'}
            </div>}
            <Slider label="Qualité du sommeil" value={sleep.qualite} onChange={v => setSleep(p => ({ ...p, qualite: v }))} />
            <div style={row2}>
              <div style={s}><label style={label}>Réveils</label><input type="number" min={0} value={sleep.reveils} onChange={e => setSleep(p => ({ ...p, reveils: e.target.value }))} /></div>
              <div style={s}><label style={label}>Fatigue matin /10</label><input type="number" min={1} max={10} value={sleep.fatigue} onChange={e => setSleep(p => ({ ...p, fatigue: Number(e.target.value) }))} /></div>
            </div>
            <div style={s}><label style={label}>Note</label><textarea value={sleep.note} onChange={e => setSleep(p => ({ ...p, note: e.target.value }))} placeholder="Chaleur, moustiques, stress..." style={{ resize: 'none', height: 60 }} /></div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ ...sectionTitle, marginBottom: 0 }}>😴 Siestes</div>
              <button className="press" onClick={addNap} style={{ background: 'rgba(0,245,196,0.10)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ajouter</button>
            </div>
            {naps.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Aucune sieste</p>}
            {naps.map((nap, i) => (
              <div key={i} style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Sieste {i + 1}</span>
                  <button onClick={() => removeNap(i)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={row2}>
                  <div style={s}><label style={label}>Début</label><input type="time" value={nap.debut} onChange={e => updateNap(i, 'debut', e.target.value)} /></div>
                  <div style={s}><label style={label}>Fin</label><input type="time" value={nap.fin} onChange={e => updateNap(i, 'fin', e.target.value)} /></div>
                </div>
                {nap.debut && nap.fin && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>Durée : {calcDureeMinutes(nap.debut, nap.fin)} min</div>}
                <div style={row2}>
                  <div><label style={label}>Qualité /10</label><input type="number" min={1} max={10} value={nap.qualite} onChange={e => updateNap(i, 'qualite', Number(e.target.value))} /></div>
                  <div><label style={label}>Note</label><input type="text" placeholder="Réparatrice ?" value={nap.note} onChange={e => updateNap(i, 'note', e.target.value)} /></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* POIDS */}
      {tab === 'poids' && (
        <div style={card}>
          <div style={sectionTitle}>Pesée</div>
          <div style={s}><label style={label}>Date</label><input type="date" value={poids.date} onChange={e => setPoids(p => ({ ...p, date: e.target.value }))} /></div>
          <div style={s}><label style={label}>Poids (kg)</label><input type="number" step="0.1" placeholder="75.4" value={poids.poids} onChange={e => setPoids(p => ({ ...p, poids: e.target.value }))} /></div>
          <div style={row2}>
            <div style={s}><label style={label}>Tour de taille (cm)</label><input type="number" step="0.1" placeholder="82" value={poids.taille} onChange={e => setPoids(p => ({ ...p, taille: e.target.value }))} /></div>
            <div style={s}><label style={label}>Masse grasse (%)</label><input type="number" step="0.1" placeholder="16" value={poids.masse} onChange={e => setPoids(p => ({ ...p, masse: e.target.value }))} /></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
            💡 Pèse-toi le matin à jeun, dans les mêmes conditions. Tour de taille et masse grasse sont optionnels (seulement si ta balance les donne).
          </div>
          <div style={s}><label style={label}>Note</label><textarea value={poids.note} onChange={e => setPoids(p => ({ ...p, note: e.target.value }))} placeholder="Contexte (après tournoi, gonflé, etc.)" style={{ resize: 'none', height: 50 }} /></div>
        </div>
      )}

      {/* Error banner */}
      {errMsg && (
        <div style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12, wordBreak: 'break-word' }}>
          ⚠️ Échec de l’enregistrement : {errMsg}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={tab === 'sport' ? saveSport : tab === 'nutrition' ? saveNutri : tab === 'sommeil' ? saveSleep : savePoids}
        disabled={saving}
        style={{ width: '100%', padding: 16, background: saved ? '#27ae60' : 'var(--accent)', color: '#05060c', fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.2s' }}
      >
        {saving ? 'Enregistrement...' : saved ? '✓ Enregistré !' : 'Enregistrer →'}
      </button>
    </main>
  )
}
