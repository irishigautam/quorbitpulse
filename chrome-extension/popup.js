// Load saved settings
chrome.storage.sync.get(['apiKey', 'companyId', 'capturedCount'], data => {
  if (data.apiKey)    document.getElementById('apiKey').value    = data.apiKey
  if (data.companyId) document.getElementById('companyId').value = data.companyId
  document.getElementById('count').textContent = data.capturedCount ?? 0
})

document.getElementById('save').addEventListener('click', () => {
  const apiKey    = document.getElementById('apiKey').value.trim()
  const companyId = document.getElementById('companyId').value.trim()

  if (!apiKey || !companyId) {
    document.getElementById('status').textContent = 'Both fields are required.'
    document.getElementById('status').style.color = '#EF4444'
    return
  }

  chrome.storage.sync.set({ apiKey, companyId }, () => {
    document.getElementById('status').textContent = '✓ Settings saved'
    document.getElementById('status').style.color = '#059669'
    setTimeout(() => { document.getElementById('status').textContent = '' }, 2500)
  })
})
