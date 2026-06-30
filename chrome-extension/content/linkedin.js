/**
 * imp1 — LinkedIn profile capture content script.
 * Injected on linkedin.com/in/* and linkedin.com/search/results/people/*
 *
 * Strategy: parse DOM for public profile data already rendered on-page.
 * Does NOT make additional network requests to avoid detection.
 */

;(function () {
  'use strict'

  const BUTTON_ID = 'quorbit-capture-btn'
  if (document.getElementById(BUTTON_ID)) return // already injected

  function extractProfilePage() {
    const name = document.querySelector('h1.text-heading-xlarge, h1[class*="name"]')?.textContent?.trim() ?? null
    const title = document.querySelector('.text-body-medium.break-words, [class*="headline"]')?.textContent?.trim() ?? null
    const location = document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ?? null
    const company = document.querySelector('[class*="pv-entity__secondary-title"] span:last-child, [aria-label*="Current company"]')?.textContent?.trim() ?? null

    // Skills from skills section
    const skillEls = document.querySelectorAll('[class*="pv-skill-category-entity__name"], [aria-label*="skill"]')
    const skills = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean).slice(0, 20)

    return {
      full_name:       name,
      current_title:   title,
      current_company: company,
      location,
      linkedin_url:    window.location.href.split('?')[0],
      skills,
      source:          'linkedin_ext',
    }
  }

  function injectButton() {
    const target = document.querySelector('.pv-text-details__left-panel, .ph5.pb5')
    if (!target) return

    const btn = document.createElement('button')
    btn.id = BUTTON_ID
    btn.textContent = '➕ Save to Quorbit'
    btn.style.cssText = [
      'background:#4F46E5', 'color:#fff', 'border:none', 'border-radius:6px',
      'padding:8px 14px', 'font-size:13px', 'font-weight:600', 'cursor:pointer',
      'margin-top:8px', 'display:inline-flex', 'align-items:center', 'gap:6px',
    ].join(';')

    btn.addEventListener('click', async () => {
      btn.textContent = 'Saving…'
      btn.disabled = true
      const profile = extractProfilePage()
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_CANDIDATE', profile })
      btn.textContent = response.success ? '✓ Saved to Quorbit' : '✗ ' + (response.error ?? 'Error')
      btn.style.background = response.success ? '#059669' : '#EF4444'
      setTimeout(() => {
        btn.textContent = '➕ Save to Quorbit'
        btn.style.background = '#4F46E5'
        btn.disabled = false
      }, 3000)
    })

    target.appendChild(btn)
  }

  // Try to inject on page load + after dynamic navigation
  function tryInject() {
    if (window.location.href.includes('linkedin.com/in/')) {
      setTimeout(injectButton, 1500)
    }
  }

  tryInject()

  // Handle LinkedIn's SPA navigation
  let lastUrl = location.href
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      document.getElementById(BUTTON_ID)?.remove()
      tryInject()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
})()
