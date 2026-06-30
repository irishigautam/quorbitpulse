/**
 * Quorbit Chrome Extension — Background Service Worker
 * Handles profile capture from content scripts and forwards to Quorbit API.
 */

const QUORBIT_API = 'https://quorbit.in/api/ext/capture'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_CANDIDATE') {
    handleCapture(message.profile)
      .then(result => sendResponse({ success: true, result }))
      .catch(err  => sendResponse({ success: false, error: err.message }))
    return true // async
  }

  if (message.type === 'GET_STATUS') {
    chrome.storage.sync.get(['apiKey', 'companyId', 'capturedCount'], data => {
      sendResponse(data)
    })
    return true
  }
})

async function handleCapture(profile) {
  const { apiKey, companyId } = await chrome.storage.sync.get(['apiKey', 'companyId'])

  if (!apiKey || !companyId) {
    throw new Error('Please configure your Quorbit API key in the extension settings.')
  }

  const res = await fetch(QUORBIT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Quorbit-Company': companyId,
    },
    body: JSON.stringify(profile),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `API error ${res.status}`)
  }

  // Increment captured count
  const { capturedCount = 0 } = await chrome.storage.sync.get('capturedCount')
  await chrome.storage.sync.set({ capturedCount: capturedCount + 1 })

  return await res.json()
}
