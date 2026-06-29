'use client'

import { useState, useEffect } from 'react'

export default function LiveJobCounter() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/v1/jobs?limit=1')
      .then(r => r.json())
      .then(data => setCount(data.total ?? 0))
      .catch(() => setCount(0))
  }, [])

  if (count === null) return <span>Loading job registry…</span>
  return <span>{count.toLocaleString()} jobs live right now</span>
}
