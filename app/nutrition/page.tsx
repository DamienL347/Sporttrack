'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase, Session, Nutrition, Sleep } from '@/lib/supabase'
import { buildCoachContext, todayISO } from '@/lib/recovery'
import { Profile, loadProfile } from '@/lib/profile'
import { Measurement, loadMeasurements } from '@/lib/measurements'
import { useRequireAuth } from '@/lib/useRequireAuth'
import Link from 'next/link'

type Img = { preview: string; media_type: string; data: string }
type Msg = { role: 'user' | 'assistant'; content: string; image?: Img }

const SUGGESTIONS = [
  '📷 Voici mon frigo, propose-moi des repas',
  'J’ai du poulet, du riz et des brocolis',
  'Idées repas post-match riches en protéines',
  'Un dîner léger qui rentre dans mes calories',
]

export default function NutritionPage() {
  const authed = useRequireAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [nutrition, setNutrition] = useState<Nutrition[]>([])
  const [sleep, setSleep] = useState<Sleep[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [img, setImg] = useState<Img | null>(null)
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, nRes, slRes] = await Promise.all([
          supabase.from('sessions').select('*').order('date', { ascending: false }),
          supabase.from('nutrition').select('*').order('date', { ascending: false }),
          supabase.from('sleep').select('*').order('date', { ascending: false }),
        ])
        setSessions(sRes.data || [])
        setNutrition(nRes.data || [])
        setSleep(slRes.data || [])
        setProfile(await loadProfile())
        setMeasurements(await loadMeasurements())
      } catch {
        /* utilisable sans données */
      } finally {
        setDataReady(true)
      }
    }
    load()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const handlePhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const im = new Image()
      im.onload = () => {
        const max = 1024
        const scale = Math.min(1, max / Math.max(im.width, im.height))
        const w = Math.round(im.width * scale), h = Math.round(im.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(im, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setImg({ preview: dataUrl, media_type: 'image/jpeg', data: dataUrl.split(',')[1] })
      }
      im.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const send = async (text: string) => {
    const q = text.trim()
    if ((!q && !img) || streaming) return
    setInput('')
    const attached = img
    setImg(null)
    const userMsg: Msg = { role: 'user', content: q, image: attached || undefined }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const context = buildCoachContext(sessions, nutrition, sleep, todayISO(), profile, measurements)
      const payloadMsgs = history.map((m) => ({
        role: m.role,
        content: m.content,
        image: m.image ? { media_type: m.image.media_type, data: m.image.data } : undefined,
      }))
      const res = await fetch('/api/meal-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMsgs, context }),
      })
      if (!res.ok || !res.body) {
        let err = 'Erreur du chef.'
        try { err = (await res.json()).error || err } catch {}
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: `⚠️ ${err}` }; return c })
        setStreaming(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c })
      }
    } catch (e: any) {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: `⚠️ ${e?.message || 'Erreur réseau.'}` }; return c })
    } finally {
      setStreaming(false)
    }
  }

  if (!authed) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', padding: '20px 16px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>🥗 Coach Nutrition</h1>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Photo du frigo ou liste d’aliments → repas sur mesure</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="glass" style={{ padding: 16, color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
              Dis-moi ce que tu as (ou prends ton frigo en photo 📷) et je te propose des repas taillés pour tes objectifs.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="press" onClick={() => send(s)} disabled={!dataReady} style={{ padding: '8px 12px', borderRadius: 999, border: '1.5px solid var(--card-border)', background: 'rgba(255,255,255,0.03)', color: 'var(--accent)', fontSize: 12.5, cursor: dataReady ? 'pointer' : 'default', opacity: dataReady ? 1 : 0.5 }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="pop-in" style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
            background: m.role === 'user' ? 'linear-gradient(135deg, var(--accent), var(--cyan))' : 'rgba(255,255,255,0.05)',
            color: m.role === 'user' ? '#05060c' : 'var(--text)',
            border: m.role === 'user' ? 'none' : '1px solid var(--card-border)',
            backdropFilter: m.role === 'user' ? 'none' : 'blur(14px)',
            WebkitBackdropFilter: m.role === 'user' ? 'none' : 'blur(14px)',
            borderRadius: 16,
            borderBottomRightRadius: m.role === 'user' ? 5 : 16,
            borderBottomLeftRadius: m.role === 'user' ? 16 : 5,
            padding: m.image ? 6 : '11px 14px',
            fontSize: 14, fontWeight: m.role === 'user' ? 600 : 400, lineHeight: 1.55,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {m.image && <img src={m.image.preview} alt="aliments" style={{ width: '100%', borderRadius: 11, marginBottom: m.content ? 8 : 0, display: 'block' }} />}
            <div style={{ padding: m.image ? '0 8px 6px' : 0 }}>{m.content || (streaming && i === messages.length - 1 ? '…' : '')}</div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
        {img && (
          <div style={{ position: 'relative', width: 66, height: 66, marginBottom: 8 }}>
            <img src={img.preview} alt="frigo" style={{ width: 66, height: 66, objectFit: 'cover', borderRadius: 10 }} />
            <button onClick={() => setImg(null)} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 999, width: 20, height: 20, fontSize: 12, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="press" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer' }}>
            📷
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={!dataReady || streaming} onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          </label>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={dataReady ? 'Cite tes aliments…' : 'Chargement…'} disabled={!dataReady || streaming} style={{ flex: 1, fontSize: 15 }} />
          <button type="submit" disabled={!dataReady || streaming || (!input.trim() && !img)} className="press" style={{ flexShrink: 0, padding: '0 16px', height: 44, background: 'linear-gradient(135deg, var(--accent), var(--cyan))', color: '#05060c', fontWeight: 800, fontSize: 18, border: 'none', borderRadius: 12, cursor: 'pointer', opacity: !dataReady || streaming || (!input.trim() && !img) ? 0.5 : 1 }}>{streaming ? '…' : '↑'}</button>
        </form>
      </div>
    </main>
  )
}
