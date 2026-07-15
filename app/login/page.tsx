'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Déjà connecté → on renvoie à l'accueil
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/') })
  }, [router])

  const submit = async () => {
    setErr(null); setMsg(null)
    if (!email || !password) { setErr('Email et mot de passe requis.'); return }
    if (mode === 'up' && password.length < 6) { setErr('Mot de passe : 6 caractères minimum.'); return }
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace('/')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) router.replace('/') // confirmation email désactivée → connecté direct
        else setMsg('Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.')
      }
    } catch (e: any) {
      setErr(e?.message || 'Erreur.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="animate-in" style={{ textAlign: 'center', marginBottom: 28, width: '100%', maxWidth: 360 }}>
        <h1 className="gradient-text" style={{ fontSize: 46, fontWeight: 800, margin: 0, lineHeight: 1 }}>Sport Tracker</h1>
        <div className="service-line" style={{ marginTop: 18 }} />
      </div>

      <div className="glass animate-in" style={{ width: '100%', maxWidth: 360, padding: 22, animationDelay: '0.08s' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
          {(['in', 'up'] as const).map(m => (
            <button key={m} className="press" onClick={() => { setMode(m); setErr(null); setMsg(null) }} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
              background: mode === m ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
              color: mode === m ? 'var(--ink)' : 'var(--muted)', transition: 'all 0.2s',
            }}>{m === 'in' ? 'Connexion' : 'Inscription'}</button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit() }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="toi@email.com" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Mot de passe</label>
            <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {err && <div style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}
          {msg && <div style={{ background: 'rgba(255,107,61,0.10)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>✅ {msg}</div>}

          <button type="submit" disabled={busy} className="press glow-accent" style={{ width: '100%', padding: 15, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--ink)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 13, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? '…' : mode === 'in' ? 'Se connecter →' : 'Créer mon compte →'}
          </button>
        </form>
      </div>
    </main>
  )
}
