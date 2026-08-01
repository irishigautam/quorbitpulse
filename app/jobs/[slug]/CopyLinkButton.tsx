'use client'

import { useState } from 'react'

/**
 * Extracted from app/jobs/[slug]/page.tsx (Gate 6 smoke test) — the button
 * previously had an inline onClick handler directly in the async Server
 * Component. Passing a function as a prop from a Server Component is not
 * allowed ("Event handlers cannot be passed to Client Component props") and
 * 500'd the whole page. This is a tiny Client Component instead, taking only
 * a plain string prop (serializable across the server/client boundary).
 */
export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="mt-3 w-full py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
    >
      {copied ? '✓ Copied' : '📋 Copy job link'}
    </button>
  )
}
