import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed } from 'next/font/google'
import BottomNav from './components/BottomNav'
import './globals.css'

// Typo d'affichage « scoreboard » — titres et grands chiffres.
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sport Tracker',
  description: 'Suivi sport, nutrition & sommeil',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Sport Tracker' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a101f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={display.variable}>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
