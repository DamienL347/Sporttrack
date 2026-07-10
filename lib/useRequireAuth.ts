'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

/** Garantit qu'un utilisateur est connecté ; sinon redirige vers /login. */
export function useRequireAuth(): boolean {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (!data.session) router.replace('/login')
      else setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      if (!session) router.replace('/login')
      else setReady(true)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [router])

  return ready
}

export async function signOut() {
  await supabase.auth.signOut()
}
