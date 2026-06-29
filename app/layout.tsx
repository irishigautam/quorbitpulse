import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'JobPulse — Post once. Reach everywhere.',
    template: '%s | JobPulse',
  },
  description:
    'List your jobs on JobPulse and reach every job board, AI assistant, and candidate platform that queries our open registry.',
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
