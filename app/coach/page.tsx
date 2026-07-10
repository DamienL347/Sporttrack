'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase, Session, Nutrition, Sleep } from '@/lib/supabase'
import { buildCoachContext, computeRecovery, todayISO } from '@/lib/recovery'
import { Profile, loadProfile } from '@/lib/profile'
import { Measurement, loadMeasurements } from '@/lib/measurements'
import { useRequireAuth } from '@/lib/useRequireAuth'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Comment je récupère en ce moment ?',
  'Que faire à l’entraînement aujourd’hui ?',
  'Analyse ma charge de la semaine',
  'Comment mieux dormir avant un tournoi ?',
]

export default function CoachPage() {
  const authed = useRequireAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [nutrition, setNutrition] = useState<Nutrition[]>([])
  const [sleep, setSleep] = useState<Sleep[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
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
        // le coach reste utilisable même sans données ; contexte allégé
      } finally {
        setDataReady(true)
      }
    }
    load()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const recovery = dataReady ? computeRecovery(sessions, sleep, todayISO()) : null

  const authGate = !authed ? (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
  ) : null

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || streaming) return
    setInput('')
    const history: Msg[] = [...messages, { role: 'user', content: q }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const context = buildCoachContext(sessions, nutrition, sleep, todayISO(), profile, measurements)
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context }),
      })

      if (!res.ok || !res.body) {
        let err = 'Erreur du coach.'
        try {
          err = (await res.json()).error || err
        } catch {}
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${err}` }
          return copy
        })
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
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: acc }
          return copy
        })
      }
    } catch (e: any) {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${e?.message || 'Erreur réseau.'}` }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  if (authGate) return authGate

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px 12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20 }}>
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>🤖 Coach IA</h1>
          {recovery && recovery.score != null && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Récup {recovery.score}/100 · {recovery.verdict}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--card-border)',
                borderRadius: 14,
                padding: 16,
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              Salut ! Je connais tes séances, ton sommeil et ta récupération. Pose-moi une
              question ou choisis une suggestion 👇
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!dataReady}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 20,
                    border: '1.5px solid var(--card-border)',
                    background: '#05060c',
                    color: 'var(--accent)',
                    fontSize: 12.5,
                    cursor: dataReady ? 'pointer' : 'default',
                    opacity: dataReady ? 1 : 0.5,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className="pop-in"
            style={{
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
              padding: '11px 14px',
              fontSize: 14,
              fontWeight: m.role === 'user' ? 600 : 400,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dataReady ? 'Pose ta question…' : 'Chargement des données…'}
          disabled={!dataReady || streaming}
          style={{ flex: 1, fontSize: 15 }}
        />
        <button
          type="submit"
          disabled={!dataReady || streaming || !input.trim()}
          style={{
            padding: '0 18px',
            background: 'var(--accent)',
            color: '#05060c',
            fontWeight: 700,
            fontSize: 15,
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            opacity: !dataReady || streaming || !input.trim() ? 0.5 : 1,
          }}
        >
          {streaming ? '…' : '↑'}
        </button>
      </form>
    </main>
  )
}
