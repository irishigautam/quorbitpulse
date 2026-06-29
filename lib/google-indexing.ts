/**
 * Google Indexing API integration.
 * Pings Google to crawl/remove a URL when jobs are posted or expired.
 * Non-blocking — never throws; logs errors only.
 */

type IndexingType = 'URL_UPDATED' | 'URL_DELETED'

async function getAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT ?? '{}')

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  return data.access_token
}

export async function pingGoogleIndexing(url: string, type: IndexingType = 'URL_UPDATED'): Promise<void> {
  // Fire and forget — called without await from job posting handlers
  ;(async () => {
    try {
      if (!process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT) return
      const token = await getAccessToken()
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[google-indexing] Error:', res.status, err)
      }
    } catch (err) {
      console.error('[google-indexing] Unexpected error:', err)
    }
  })()
}
