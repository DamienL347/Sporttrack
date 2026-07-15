'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/lib/useRequireAuth'
import { todayISO } from '@/lib/recovery'
import { Photo, loadPhotos, addPhoto, deletePhoto, signPaths, fileToJpegBlob } from '@/lib/photos'

const label: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }

function fmt(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }

export default function PhotosPage() {
  const authed = useRequireAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const refresh = async () => {
    const ps = await loadPhotos()
    setPhotos(ps)
    setUrls(await signPaths(ps.map((p) => p.path)))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const upload = async (file: File, type: 'progress' | 'goal') => {
    setErr(null); setBusy(true)
    try {
      const blob = await fileToJpegBlob(file)
      const { error } = await addPhoto(blob, type, todayISO())
      if (error) setErr(error)
      else await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Erreur upload.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: Photo) => {
    setBusy(true)
    await deletePhoto(p)
    await refresh()
    setBusy(false)
  }

  const progress = photos.filter((p) => p.type === 'progress').sort((a, b) => a.date.localeCompare(b.date))
  const goal = photos.find((p) => p.type === 'goal') || null
  const avant = progress[0] || null
  const maintenant = progress[progress.length - 1] || null

  const Slot = ({ p, tag, tagColor }: { p: Photo | null; tag: string; tagColor: string }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p && urls[p.path]
          ? <img src={urls[p.path]} alt={tag} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 26, opacity: 0.5 }}>{tag === 'Objectif' ? '🎯' : '📷'}</span>}
      </div>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tagColor }}>{tag}</span>
        {p && <span style={{ fontSize: 11, color: 'var(--muted)' }}> · {fmt(p.date)}</span>}
      </div>
    </div>
  )

  if (!authed || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  return (
    <main className="page-pad" style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div className="animate-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 22 }}>←</Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📸 Progression</h1>
      </div>

      {err && <div style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14, wordBreak: 'break-word' }}>⚠️ {err} — as-tu exécuté la migration <b>migration_photos.sql</b> ?</div>}

      {/* Comparaison */}
      <div className="glass animate-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ ...label, marginBottom: 12 }}>Comparaison</div>
        {progress.length === 0 && !goal ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Ajoute ta première photo pour lancer le suivi 👇</div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Slot p={avant} tag="Avant" tagColor="var(--muted)" />
            <Slot p={maintenant && maintenant !== avant ? maintenant : (avant ? maintenant : null)} tag="Maintenant" tagColor="var(--accent)" />
            <Slot p={goal} tag="Objectif" tagColor="var(--cyan)" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <label className="glass press glow-accent" style={{ textAlign: 'center', padding: '14px 10px', cursor: 'pointer', border: '1px solid rgba(255,107,61,0.4)', opacity: busy ? 0.6 : 1 }}>
          <div style={{ fontSize: 22 }}>📷</div>
          <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4, color: 'var(--accent)' }}>Photo du jour</div>
          <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'progress')} />
        </label>
        <label className="glass press" style={{ textAlign: 'center', padding: '14px 10px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          <div style={{ fontSize: 22 }}>🎯</div>
          <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4, color: 'var(--cyan)' }}>{goal ? 'Changer l’objectif' : 'Définir l’objectif'}</div>
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'goal')} />
        </label>
      </div>

      {/* Galerie */}
      <div style={{ ...label, marginBottom: 12 }}>Historique ({progress.length})</div>
      {progress.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 30, fontSize: 13 }}>Aucune photo de progression.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[...progress].reverse().map((p, i) => (
            <div key={p.id || i} className="pop-in" style={{ position: 'relative', animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}>
              <div style={{ aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                {urls[p.path] && <img src={urls[p.path]} alt={p.date} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 3 }}>{fmt(p.date)}</div>
              <button onClick={() => remove(p)} disabled={busy} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', color: 'var(--danger)', border: 'none', borderRadius: 999, width: 22, height: 22, fontSize: 12, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
