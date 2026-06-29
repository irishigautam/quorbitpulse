'use client'

/**
 * CookieConsent — lc1
 *
 * Shows a bottom banner on first visit asking for analytics consent.
 * On accept: injects Google Analytics script and stores 'granted' in localStorage.
 * On decline: stores 'denied', never loads GA.
 * On subsequent loads: respects stored preference silently (no banner).
 *
 * Consent key: 'analytics_consent'  values: 'granted' | 'denied'
 */

import { useEffect, useState } from 'react'
import Script from 'next/script'

const CONSENT_KEY = 'analytics_consent'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

type Consent = 'granted' | 'denied' | null

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as Consent | null
    if (stored === 'granted') {
      setConsent('granted')
    } else if (stored === 'denied') {
      setConsent('denied')
    } else {
      // No preference yet — show banner after a short delay so it doesn't flash on hydration
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'granted')
    setConsent('granted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'denied')
    setConsent('denied')
    setVisible(false)
  }

  return (
    <>
      {/* Load GA only when consent is granted and GA_ID is configured */}
      {consent === 'granted' && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `}</Script>
        </>
      )}

      {/* Consent banner */}
      {visible && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: 'calc(100% - 2rem)',
            maxWidth: '520px',
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
              We use analytics cookies
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>
              We'd like to use Google Analytics to understand how people use Pulse so we can improve it.
              No personal data is sold. You can change your preference any time.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button
              onClick={accept}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                borderRadius: '0.625rem',
                border: 'none',
                background: '#7C3AED',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Accept
            </button>
            <button
              onClick={decline}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                borderRadius: '0.625rem',
                border: '1px solid #E5E7EB',
                background: '#fff',
                color: '#374151',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  )
}
