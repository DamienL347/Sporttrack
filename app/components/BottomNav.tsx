'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const S = 22 // taille des icônes

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function IconStats({ active }: { active: boolean }) {
  return (
    <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M4 21V13" />
      <path d="M10 21V7" />
      <path d="M16 21V11" />
      <path d="M22 21V4" />
    </svg>
  )
}
function IconCoach({ active }: { active: boolean }) {
  return (
    <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12Z" />
      <path d="M9 11h.01M13 11h.01M17 11h.01" />
    </svg>
  )
}
function IconUser({ active }: { active: boolean }) {
  return (
    <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.4-3.4 4.4-5 8-5s6.6 1.6 8 5" />
    </svg>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  const is = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <Link href="/" className={is('/') ? 'active' : ''} aria-label="Accueil">
        <IconHome active={is('/')} />
        <span className="nav-label">Accueil</span>
      </Link>
      <Link href="/dashboard" className={is('/dashboard') ? 'active' : ''} aria-label="Dashboard">
        <IconStats active={is('/dashboard')} />
        <span className="nav-label">Dashboard</span>
      </Link>
      <Link href="/log" className="nav-plus" aria-label="Logger une séance">
        <span>+</span>
      </Link>
      <Link href="/coach" className={is('/coach') ? 'active' : ''} aria-label="Coach IA">
        <IconCoach active={is('/coach')} />
        <span className="nav-label">Coach</span>
      </Link>
      <Link href="/profil" className={is('/profil') ? 'active' : ''} aria-label="Profil">
        <IconUser active={is('/profil')} />
        <span className="nav-label">Profil</span>
      </Link>
    </nav>
  )
}
