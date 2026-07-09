'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Profile, emptyProfile, loadProfile, saveProfile, zoneBounds, hrMax, nutritionTargets } from '@/lib/profile'

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 16px', marginBottom: 14 }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }
const field: React.CSSProperties = { marginBottom: 14 }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

export default function ProfilPage() {
  const [p, setP] = useState<Profile>(emptyProfile())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    loadProfile().then((data) => {
      if (data) setP({ ...emptyProfile(), ...data })
      setLoading(false)
    })
  }, [])

  const num = (v: string): number | null => (v === '' ? null : Number(v))
  const set = (k: keyof Profile, v: any) => setP((prev) => ({ ...prev, [k]: v }))

  const submit = async () => {
    setSaving(true)
    setErr(null)
    const { error } = await saveProfile(p)
    setSaving(false)
    if (error) setErr(error)
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const zb = zoneBounds(p)
  const targets = nutritionTargets(p)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05060c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>Chargement…</div>
  )

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Mon profil</h1>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Identité</div>
        <div style={field}><label style={label}>Nom / surnom</label><input value={p.nom || ''} onChange={(e) => set('nom', e.target.value)} placeholder="Damien" /></div>
        <div style={row2}>
          <div style={field}><label style={label}>Sexe</label>
            <select value={p.sexe || ''} onChange={(e) => set('sexe', e.target.value || null)}>
              <option value="">—</option><option value="H">Homme</option><option value="F">Femme</option>
            </select>
          </div>
          <div style={field}><label style={label}>Âge</label><input type="number" value={p.age ?? ''} onChange={(e) => set('age', num(e.target.value))} placeholder="30" /></div>
        </div>
        <div style={row2}>
          <div style={field}><label style={label}>Poids (kg)</label><input type="number" value={p.poids_kg ?? ''} onChange={(e) => set('poids_kg', num(e.target.value))} placeholder="75" /></div>
          <div style={field}><label style={label}>Taille (cm)</label><input type="number" value={p.taille_cm ?? ''} onChange={(e) => set('taille_cm', num(e.target.value))} placeholder="180" /></div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Fréquence cardiaque</div>
        <div style={row2}>
          <div style={field}><label style={label}>FC max (BPM)</label><input type="number" value={p.fc_max ?? ''} onChange={(e) => set('fc_max', num(e.target.value))} placeholder="190" /></div>
          <div style={field}><label style={label}>FC repos (BPM)</label><input type="number" value={p.fc_repos ?? ''} onChange={(e) => set('fc_repos', num(e.target.value))} placeholder="55" /></div>
        </div>
        <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: zb ? 'var(--accent)' : 'var(--muted)', lineHeight: 1.6 }}>
          {zb
            ? <>Zones perso (Karvonen) · FC max {hrMax(p)}<br />Z1 &lt;{zb.z2} · Z2 {zb.z2}-{zb.z3} · Z3 {zb.z3}-{zb.z4} · Z4 &gt;{zb.z4} BPM</>
            : 'Renseigne FC max (ou ton âge) pour des zones cardiaques personnalisées.'}
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Objectifs & contexte</div>
        <div style={field}><label style={label}>Objectif principal</label><input value={p.objectif || ''} onChange={(e) => set('objectif', e.target.value)} placeholder="Performance padel / Perte de poids / Forme…" /></div>
        <div style={field}><label style={label}>Calendrier / tournois à venir</label><textarea value={p.calendrier || ''} onChange={(e) => set('calendrier', e.target.value)} placeholder="Tournoi padel le 20/07, championnat tennis en septembre…" style={{ resize: 'none', height: 60 }} /></div>
        <div style={field}><label style={label}>Blessures / contraintes</label><textarea value={p.blessures || ''} onChange={(e) => set('blessures', e.target.value)} placeholder="Épaule fragile, genou droit sensible…" style={{ resize: 'none', height: 50 }} /></div>
        <div style={field}><label style={label}>Préférences / restrictions alimentaires</label><textarea value={p.preferences_alim || ''} onChange={(e) => set('preferences_alim', e.target.value)} placeholder="Peu de lactose, pas de porc, végétarien le midi…" style={{ resize: 'none', height: 50 }} /></div>
        <div style={field}><label style={label}>Notes pour le coach (mémoire)</label><textarea value={p.notes_coach || ''} onChange={(e) => set('notes_coach', e.target.value)} placeholder="Ce que le coach doit toujours garder en tête sur toi…" style={{ resize: 'none', height: 60 }} /></div>
        {targets.kcal && (
          <div style={{ background: '#05060c', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--text)' }}>
            🎯 Cibles estimées : <strong style={{ color: 'var(--accent)' }}>{targets.kcal} kcal/j</strong> · <strong style={{ color: 'var(--accent)' }}>{targets.proteines} g protéines/j</strong>
          </div>
        )}
      </div>

      {err && <div style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>⚠️ {err} — as-tu exécuté la migration SQL (supabase/migration_profil_rpe.sql) ?</div>}

      <button onClick={submit} disabled={saving} style={{ width: '100%', padding: 16, background: saved ? '#27ae60' : 'var(--accent)', color: '#05060c', fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Enregistrement…' : saved ? '✓ Profil enregistré !' : 'Enregistrer mon profil →'}
      </button>
    </main>
  )
}
