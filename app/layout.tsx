import type { Metadata } from 'next'
import './globals.css'
import CookieConsent from './components/CookieConsent'

export const metadata: Metadata = {
  title: {
    default: 'JobPulse — Your candidates, finally scored.',
    template: '%s | JobPulse',
  },
  description:
    'Import candidates from LinkedIn, Naukri, Apollo, or a CSV. JobPulse scores every one against your open roles and validates readiness with an AI chat — plus auto-distributes your postings to 14 job boards.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'),
  openGraph: {
    type: 'website',
    siteName: 'JobPulse',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
