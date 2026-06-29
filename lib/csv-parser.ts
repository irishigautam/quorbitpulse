/**
 * Simple RFC-4180 CSV parser — no extra dependencies.
 * Handles quoted fields, commas inside quotes, newlines in quoted fields.
 */

export function parseCSV(text: string): Record<string, string>[] {
  const rows = splitCSVRows(text.trim())
  if (rows.length < 2) return []

  const headers = parseCSVRow(rows[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))

  const records: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].trim()
    if (!row) continue
    const values = parseCSVRow(row)
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? '').trim()
    })
    records.push(record)
  }
  return records
}

function splitCSVRows(text: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++
      rows.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current) rows.push(current)
  return rows
}

function parseCSVRow(row: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/**
 * Normalise a raw CSV row into a canonical candidate shape.
 * Accepts flexible column names (linkedin, linkedin_url, LinkedIn URL, etc.)
 */
export function normaliseCandidateRow(row: Record<string, string>): {
  full_name: string | null
  email: string | null
  linkedin_url: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  phone: string | null
  notes: string | null
} {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] || row[k.replace(/_/g, ' ')] || row[k.replace(/ /g, '_')]
      if (v && v.trim()) return v.trim()
    }
    return null
  }

  const full_name = get('full_name', 'name', 'candidate_name', 'fullname', 'full name')
  const email = get('email', 'email_address', 'e_mail')
  const linkedin_raw = get('linkedin_url', 'linkedin', 'linkedin_profile', 'linkedin url', 'linkedin profile')
  const linkedin_url = linkedin_raw ? normaliseLinkedIn(linkedin_raw) : null
  const current_title = get('current_title', 'title', 'job_title', 'position', 'role', 'current title', 'job title')
  const current_company = get('current_company', 'company', 'employer', 'organization', 'organisation', 'current company')
  const location = get('location', 'city', 'city_location', 'current_location', 'current location')
  const phone = get('phone', 'phone_number', 'mobile', 'contact', 'phone number')
  const notes = get('notes', 'note', 'comments', 'comment', 'additional_info', 'additional info')

  return { full_name, email, linkedin_url, current_title, current_company, location, phone, notes }
}

function normaliseLinkedIn(url: string): string {
  // Turn "johndoe" or "in/johndoe" into full URL
  url = url.trim()
  if (!url) return url
  if (url.startsWith('http')) return url.split('?')[0].replace(/\/$/, '')
  if (url.startsWith('linkedin.com')) return 'https://' + url.split('?')[0].replace(/\/$/, '')
  if (url.startsWith('in/')) return 'https://linkedin.com/' + url.replace(/\/$/, '')
  // bare username — wrap
  return 'https://linkedin.com/in/' + url.replace(/\/$/, '')
}
