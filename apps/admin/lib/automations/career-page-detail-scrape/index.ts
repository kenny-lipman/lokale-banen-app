/**
 * Career-page detail-scrape automation.
 *
 * Pakt job_postings met needs_detail_scrape=true (aangemaakt door de
 * sales-lead career-page-flow), claimt ze batchgewijs en verrijkt ze met
 * detailpagina-data (salary/description/uren/opleiding/niveau). Verwerkt
 * meerdere batches binnen het tijdbudget; resterend werk wordt in de volgende
 * cron-tick opgepakt. Schaalt zo naar bronnen met heel veel vacatures zonder
 * de 300s lambda-limiet te raken.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { PlaywrightFetcher } from '@/lib/services/sales-leads/website/playwright-fetcher'
import { processDetail, type DetailOutcome } from './process-one'

const BATCH_SIZE = 10
const MAX_RUN_MS = 240_000 // ~60s buffer onder maxDuration=300
const ITEM_DELAY_MS = 1000 // polite delay; vacatures van 1 bron raken dezelfde host
const MAX_ROWS_PER_RUN = 200

export interface DetailScrapeStats {
  processed: number
  enriched: number
  no_data: number
  blocked: number
  error: number
  remaining: number
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function emptyStats(): DetailScrapeStats {
  return { processed: 0, enriched: 0, no_data: 0, blocked: 0, error: 0, remaining: 0 }
}

export async function run(): Promise<{ stats: DetailScrapeStats; success: boolean; error?: string }> {
  const supabase = getServiceClient()
  const stats = emptyStats()
  const startTime = Date.now()
  const playwright = new PlaywrightFetcher()

  try {
    while (Date.now() - startTime < MAX_RUN_MS && stats.processed < MAX_ROWS_PER_RUN) {
      // Kandidaten ophalen (oudste eerst).
      const { data: candidates, error: selErr } = await supabase
        .from('job_postings')
        .select('id, url')
        .eq('needs_detail_scrape', true)
        .not('url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)
      if (selErr) return { success: false, stats, error: selErr.message }
      if (!candidates || candidates.length === 0) break

      // Atomair claimen: zet de vlag uit voor deze ids. Een parallelle run die
      // dezelfde ids al claimde, krijgt ze hier niet terug (eq-guard).
      const ids = candidates.map((c) => c.id)
      const { data: claimed, error: claimErr } = await supabase
        .from('job_postings')
        .update({ needs_detail_scrape: false })
        .in('id', ids)
        .eq('needs_detail_scrape', true)
        .select('id, url')
      if (claimErr) return { success: false, stats, error: claimErr.message }
      if (!claimed || claimed.length === 0) continue

      for (const row of claimed) {
        if (!row.url) continue
        if (Date.now() - startTime >= MAX_RUN_MS || stats.processed >= MAX_ROWS_PER_RUN) break
        let outcome: DetailOutcome
        try {
          outcome = await processDetail(supabase, playwright, { id: row.id, url: row.url })
        } catch (e) {
          console.error(`[career-page-detail] ${row.url}:`, e instanceof Error ? e.message : e)
          outcome = 'error'
        }
        stats.processed++
        stats[outcome]++
        await sleep(ITEM_DELAY_MS)
      }
    }

    const { count } = await supabase
      .from('job_postings')
      .select('id', { count: 'exact', head: true })
      .eq('needs_detail_scrape', true)
    stats.remaining = count ?? 0

    return { success: true, stats }
  } catch (e) {
    return { success: false, stats, error: e instanceof Error ? e.message : String(e) }
  } finally {
    await playwright.dispose()
  }
}
