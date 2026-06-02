/**
 * Verrijk één career-page job_posting met detailpagina-data (achtergrond-worker,
 * vangnet voor de overflow die de inline website-stap niet meenam).
 *
 * De rij bestaat al en is al geclaimd (needs_detail_scrape staat op false)
 * voordat deze functie draait; we updaten hier alleen de data + detail_scraped_at.
 * De extractie zelf zit in de gedeelde vacancy-detail/extract.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesUpdate } from '@/lib/supabase'
import type { PlaywrightFetcher } from '@/lib/services/sales-leads/website/playwright-fetcher'
import {
  fetchAndExtractVacancyDetail,
  detailFieldsToJobPostingUpdate,
  gotUsefulDetail,
} from '@/lib/services/sales-leads/vacancy-detail/extract'

type SB = SupabaseClient<Database>

export interface DetailRow {
  id: string
  url: string
}

export type DetailOutcome = 'enriched' | 'no_data' | 'blocked' | 'error'

export async function processDetail(
  supabase: SB,
  playwright: PlaywrightFetcher,
  row: DetailRow,
): Promise<DetailOutcome> {
  const now = new Date().toISOString()
  const result = await fetchAndExtractVacancyDetail(playwright, row.url)

  if (result.status !== 'ok') {
    // Blocked/error: markeer als geprobeerd (geen retry, zoals werkenindekempen).
    await persist(supabase, row.id, now, {})
    return result.status === 'blocked' ? 'blocked' : 'error'
  }

  await persist(supabase, row.id, now, detailFieldsToJobPostingUpdate(result.fields))
  return gotUsefulDetail(result.fields) ? 'enriched' : 'no_data'
}

async function persist(
  supabase: SB,
  id: string,
  now: string,
  fields: TablesUpdate<'job_postings'>,
): Promise<void> {
  const { error } = await supabase
    .from('job_postings')
    .update({ ...fields, detail_scraped_at: now, updated_at: now })
    .eq('id', id)
  if (error) throw new Error(`career-page-detail update ${id}: ${error.message}`)
}
