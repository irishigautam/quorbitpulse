import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'
import { parseCSV, normaliseCandidateRow } from '@/lib/csv-parser'
import { LIMITS } from '@/lib/security/rate-limit'
import type { ImportResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()

    // Rate limit: 20 imports / hour / company
    const rl = LIMITS.candidateImport(company.id)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Import rate limit reached. Max 20 imports per hour.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
      )
    }

    const supabase = await createClient()

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.match(/\.(csv|txt)$/i)) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV. Check the file format.' }, { status: 400 })
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 candidates per import. Split into multiple files.' }, { status: 400 })
    }

    // Create import batch record
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        company_id: company.id,
        source: 'csv',
        filename: file.name,
        total_rows: rows.length,
        status: 'processing',
      })
      .select()
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: 'Failed to create import batch' }, { status: 500 })
    }

    // Fetch existing candidates for this company to dedup
    const { data: existing } = await supabase
      .from('imported_candidates')
      .select('email, linkedin_url')
      .eq('company_id', company.id)

    const existingEmails = new Set(
      (existing ?? []).map(c => c.email?.toLowerCase()).filter(Boolean)
    )
    const existingLinkedIns = new Set(
      (existing ?? []).map(c => c.linkedin_url?.toLowerCase()).filter(Boolean)
    )

    // Process rows
    const toInsert: Record<string, unknown>[] = []
    let skipped_dups = 0
    let failed = 0

    for (const row of rows) {
      const normalised = normaliseCandidateRow(row)

      // Must have at least a name
      if (!normalised.full_name) {
        failed++
        continue
      }

      // Dedup check
      const emailKey = normalised.email?.toLowerCase()
      const linkedInKey = normalised.linkedin_url?.toLowerCase()

      if (emailKey && existingEmails.has(emailKey)) {
        skipped_dups++
        continue
      }
      if (linkedInKey && existingLinkedIns.has(linkedInKey)) {
        skipped_dups++
        continue
      }

      // Mark as seen so within-batch duplicates are also caught
      if (emailKey) existingEmails.add(emailKey)
      if (linkedInKey) existingLinkedIns.add(linkedInKey)

      toInsert.push({
        company_id: company.id,
        import_batch_id: batch.id,
        import_source: 'csv',
        full_name: normalised.full_name,
        email: normalised.email || null,
        linkedin_url: normalised.linkedin_url || null,
        current_title: normalised.current_title || null,
        current_company: normalised.current_company || null,
        location: normalised.location || null,
        phone: normalised.phone || null,
        notes: normalised.notes || null,
        raw_data: row,
        status: 'new',
      })
    }

    // Batch insert
    let inserted = 0
    let insertedCandidates: Record<string, unknown>[] = []

    if (toInsert.length > 0) {
      const { data: insertedData, error: insertErr } = await supabase
        .from('imported_candidates')
        .insert(toInsert)
        .select()

      if (insertErr) {
        await supabase
          .from('import_batches')
          .update({ status: 'failed' })
          .eq('id', batch.id)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }

      inserted = insertedData?.length ?? 0
      insertedCandidates = insertedData ?? []
    }

    // Update batch summary
    await supabase
      .from('import_batches')
      .update({ inserted, skipped_dups, failed, total_rows: rows.length, status: 'complete' })
      .eq('id', batch.id)

    const result: ImportResult = {
      batch_id: batch.id,
      total_rows: rows.length,
      inserted,
      skipped_dups,
      failed,
      candidates: insertedCandidates as never,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Unexpected error during import' }, { status: 500 })
  }
}
