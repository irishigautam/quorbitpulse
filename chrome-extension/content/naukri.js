/**
 * imp2 — Naukri profile capture content script.
 * Injected on naukri.com search results and profile pages.
 * Naukri is more permissive than LinkedIn with public profile data.
 */

;(function () {
  'use strict'

  const BUTTON_ID = 'quorbit-naukri-btn'
  if (document.getElementById(BUTTON_ID)) return

  function extractNaukriProfile() {
    // Profile detail page
    const name     = document.querySelector('.name-container h1, [class*="nameContainer"] h1')?.textContent?.trim() ?? null
    const title    = document.querySelector('.designation, [class*="designation"]')?.textContent?.trim() ?? null
    const company  = document.querySelector('.current-company, [class*="companyName"]')?.textContent?.trim() ?? null
    const location = document.querySelector('.location, [class*="location"]')?.textContent?.trim() ?? null
    const yoeEl    = document.querySelector('.experience-years, [class*="expInMonths"]')?.textContent?.trim()
    const yoe      = yoeEl ? parseInt(yoeEl) : null

    // Skills
    const skillEls = document.querySelectorAll('[class*="skillsList"] li, [class*="chip-label"]')
    const skills   = Array.from(skillEls).map(el => el.textContent?.trim()).filter(Boolean).slice(0, 20)

    return {
      full_name:       name,
      current_title:   title,
      current_company: company,
      location,
      years_experience: yoe,
      skills,
      source: 'naukri_ext',
      naukri_url: window.location.href.split('?')[0],
    }
  }

  function injectButton() {
    // Try various Naukri profile containers
    const target = document.querySelector(
      '.name-container, [class*="profile-header"], [class*="profileBasicInfo"]'
    )
    if (!target || document.getElementById(BUTTON_ID)) return

    const btn = document.createElement('button')
    btn.id = BUTTON_ID
    btn.textContent = '➕ Save to Quorbit'
    btn.style.cssText = [
      'background:#4F46E5', 'color:#fff', 'border:none', 'border-radius:6px',
      'padding:8px 14px', 'font-size:13px', 'font-weight:600', 'cursor:pointer',
      'margin-top:10px', 'display:block',
    ].join(';')

    btn.addEventListener('click', async () => {
      btn.textContent = 'Saving…'
      btn.disabled = true
      const profile = extractNaukriProfile()
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

  setTimeout(injectButton, 1500)
})()
