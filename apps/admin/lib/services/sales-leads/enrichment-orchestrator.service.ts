import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'
import { KvkService, KvkApiError } from './kvk.service'
import { MapsService, MapsApiError } from './maps.service'
import { ApolloService, ApolloApiError } from './apollo.service'
import { WebsiteService } from './website.service'
import { MistralService } from './mistral.service'
import { computePrimaryMaster } from './master-record'
import { generateDealNote } from './auto-note'
import type {
  RunEnrichments,
  PerSourceEnrichment,
  NormalizedFields,
  NormalizedContact,
  AuditLogEntry,
} from './types'

type SourceName = 'kvk' | 'google_maps' | 'apollo' | 'website'

export class EnrichmentOrchestratorService {
  private supabase = createServiceRoleClient()
  private kvk = new KvkService()
  private maps = new MapsService()
  private apollo = new ApolloService()
  private website = new WebsiteService()
  private mistral = new MistralService()

  /**
   * Re-run één specifieke bron op een bestaande run. Gebruikt door de
   * "Opnieuw" knop per source-card wanneer 1 bron faalde maar de andere
   * succesvol waren — voorkomt dat user de hele run moet over-doen.
   *
   * Touch'ed `run.status` NIET. De runner-method (runKvk/runMaps/etc) doet
   * `markRunning` op de source-entry, en de polling-hook activeert op
   * per-source 'running'-state. Daardoor blijft `showReview` in de UI
   * waar zodat master_record + andere bron-data zichtbaar blijven.
   *
   * `master_record` wordt NIET hercomputeerd — user heeft mogelijk al edits
   * gemaakt. Wil de user nieuwe data van de hergeruvde bron mergen, dan
   * doen ze dat handmatig of via candidate-promotion (Maps).
   */
  async runSingleSource(runId: string, source: SourceName): Promise<void> {
    const { input_url, input_domain, scrape_vacancies } = await this.loadRun(runId)
    switch (source) {
      case 'kvk':
        await this.runKvk(runId, input_domain)
        break
      case 'google_maps':
        await this.runMaps(runId, input_domain)
        break
      case 'apollo':
        await this.runApollo(runId, input_domain)
        break
      case 'website':
        await this.runWebsite(runId, input_url, scrape_vacancies)
        break
    }
    // Self-heal: als master_record ontbreekt (legacy/corrupted runs waar
    // finalize ooit niet voltooide), bouw hem op uit huidige enrichments.
    // Touch'ed niets als master_record al bestaat — user-edits blijven veilig.
    await this.rebuildMasterIfMissing(runId)
  }

  private async rebuildMasterIfMissing(runId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('sales_lead_runs')
      .select('master_record')
      .eq('id', runId)
      .single()
    if (error || data?.master_record) return

    const run = await this.loadRun(runId)
    const hasParsed = (['kvk', 'google_maps', 'apollo', 'website'] as SourceName[]).some(
      (s) => !!run.enrichments[s]?.parsed,
    )
    if (!hasParsed) return

    const master = computePrimaryMaster(run.enrichments, run.input_url)
    master.deal_note_text = generateDealNote({
      master,
      enrichments: run.enrichments,
      selectedVacancies: master.vacancies,
    })
    await this.supabase
      .from('sales_lead_runs')
      .update({
        master_record: master as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }

  /**
   * Hoofdroute. Loopt synchronously asynchronously van Fase A → D.
   * Werkdomein: top-level errors worden in run.error opgeslagen + status='failed'.
   * Per-bron errors zijn al afgevangen in elke setSource-call.
   */
  async runEnrichment(runId: string): Promise<void> {
    try {
      const { input_url, input_domain, scrape_vacancies } = await this.loadRun(runId)

      // Fase A — parallel, allSettled zodat één fout niet de rest stopt
      await Promise.allSettled([
        this.runKvk(runId, input_domain),
        this.runMaps(runId, input_domain),
        this.runApollo(runId, input_domain),
        this.runWebsite(runId, input_url, scrape_vacancies),
      ])

      // Fase B — Apollo matchPerson voor website-namen die nog niet als
      // warm-lead in Apollo zaten. Sequentieel om credits te beperken.
      await this.runPersonMatching(runId)

      // Fase C — Mistral rankContacts
      await this.runContactRanking(runId)

      // Fase D — finalisatie
      await this.finalize(runId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await this.supabase
        .from('sales_lead_runs')
        .update({ status: 'failed', error: msg, updated_at: new Date().toISOString() })
        .eq('id', runId)
    }
  }

  // ─── Fase A — per-bron runners ─────────────────────────────────────────

  private async runKvk(runId: string, domain: string): Promise<void> {
    const startedAt = new Date().toISOString()
    await this.markRunning(runId, 'kvk', startedAt)
    const t0 = Date.now()
    try {
      const naamGuess = domainToCompanyGuess(domain)
      const parsed = await this.kvk.enrichByName(naamGuess)
      await this.completeSource(runId, 'kvk', startedAt, parsed)
      await this.appendAudit(runId, this.audit('kvk', 'GET /v1/basisprofielen', t0, 'ok'))
    } catch (e) {
      const reason = e instanceof KvkApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'kvk', startedAt, e, status)
      await this.appendAudit(runId, this.audit('kvk', 'GET /v1/basisprofielen', t0, status, e))
    }
  }

  private async runMaps(runId: string, domain: string): Promise<void> {
    const startedAt = new Date().toISOString()
    await this.markRunning(runId, 'google_maps', startedAt)
    const t0 = Date.now()
    try {
      const naamGuess = domainToCompanyGuess(domain)
      const candidates = await this.maps.enrichByQueryMulti(naamGuess)
      // Default: eerste candidate (Apify rank=1) als primaire parsed.
      // User kan via UI promoten naar candidates[1] of [2].
      await this.setSource(runId, 'google_maps', {
        status: 'completed',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        parsed: candidates[0],
        candidates,
        selected_candidate_index: 0,
      })
      await this.appendAudit(
        runId,
        this.audit('google_maps', `apify:${candidates.length}`, t0, 'ok'),
      )
    } catch (e) {
      const reason = e instanceof MapsApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'google_maps', startedAt, e, status)
      await this.appendAudit(runId, this.audit('google_maps', 'apify', t0, status, e))
    }
  }

  private async runApollo(runId: string, domain: string): Promise<void> {
    const startedAt = new Date().toISOString()
    await this.markRunning(runId, 'apollo', startedAt)
    const t0 = Date.now()
    try {
      const [orgRes, warmRes, coldRes] = await Promise.allSettled([
        this.apollo.enrichOrganization(domain),
        this.apollo.searchContactsByDomain(domain),
        this.apollo.searchPeopleByDomain(domain),
      ])

      let parsed: NormalizedFields = { source: 'apollo' }
      const warmContacts: NormalizedContact[] = []
      let cost_credits = 0

      if (orgRes.status === 'fulfilled') {
        parsed = { ...orgRes.value.normalized }
        cost_credits += orgRes.value.usage.cost_credits ?? 0
      } else if (orgRes.reason instanceof ApolloApiError && orgRes.reason.reason !== 'not_found') {
        throw orgRes.reason
      }

      if (warmRes.status === 'fulfilled') {
        warmContacts.push(...warmRes.value.contacts)
        cost_credits += warmRes.value.usage.cost_credits ?? 0
      }

      if (coldRes.status === 'fulfilled') {
        parsed.cold_candidates = coldRes.value.candidates.length ? coldRes.value.candidates : undefined
        cost_credits += coldRes.value.usage.cost_credits ?? 0
      }

      parsed.contacts = warmContacts.length ? warmContacts : undefined
      await this.completeSource(runId, 'apollo', startedAt, parsed)
      await this.appendAudit(runId, this.audit('apollo', 'enrich+contacts/search+mixed_people/api_search', t0, 'ok', undefined, cost_credits))
    } catch (e) {
      const reason = e instanceof ApolloApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'apollo', startedAt, e, status)
      await this.appendAudit(runId, this.audit('apollo', 'enrich+contacts/search+mixed_people/api_search', t0, status, e))
    }
  }

  private async runWebsite(runId: string, inputUrl: string, scrapeVacancies: boolean): Promise<void> {
    const startedAt = new Date().toISOString()
    await this.markRunning(runId, 'website', startedAt)
    const t0 = Date.now()
    try {
      const parsed = await this.website.crawlAndParse(inputUrl, scrapeVacancies)
      await this.completeSource(runId, 'website', startedAt, parsed)
      await this.appendAudit(runId, this.audit('website', 'crawlAndParse', t0, 'ok'))
    } catch (e) {
      await this.failSource(runId, 'website', startedAt, e, 'failed')
      await this.appendAudit(runId, this.audit('website', 'crawlAndParse', t0, 'failed', e))
    }
  }

  // ─── Fase B — Apollo matchPerson voor website-namen ────────────────────

  private async runPersonMatching(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const enr = run.enrichments
    const websiteContacts = (enr.website?.parsed?.contacts ?? []).filter((c) => !!c.name)
    const apolloWarm = (enr.apollo?.parsed?.contacts ?? []).filter((c) => !!c.name)
    if (!websiteContacts.length) return

    const warmNames = new Set(apolloWarm.map((c) => normalizeName(c.name)))
    const matched: NormalizedContact[] = []

    for (const wc of websiteContacts) {
      if (warmNames.has(normalizeName(wc.name))) continue
      const t0 = Date.now()
      try {
        const r = await this.apollo.matchPerson({
          name: wc.name,
          domain: run.input_domain,
          organization_name: run.enrichments.kvk?.parsed?.company_name,
        })
        if (r.contact) {
          matched.push({
            ...wc,
            ...r.contact,
            source_origin: ['apollo', 'website'],
          })
        }
        await this.appendAudit(
          runId,
          this.audit('apollo', '/people/match', t0, r.contact ? 'ok' : 'not_found', undefined, r.usage.cost_credits),
        )
      } catch (e) {
        await this.appendAudit(runId, this.audit('apollo', '/people/match', t0, 'failed', e))
      }
    }

    const matchedNames = new Set(matched.map((c) => normalizeName(c.name)))
    const stillWebsiteOnly = websiteContacts.filter(
      (c) => !warmNames.has(normalizeName(c.name)) && !matchedNames.has(normalizeName(c.name)),
    )
    const allContacts = [...apolloWarm, ...matched, ...stillWebsiteOnly]

    const apolloEntry: PerSourceEnrichment = enr.apollo ?? { status: 'completed' }
    const apolloParsed: NormalizedFields = enr.apollo?.parsed ?? { source: 'apollo' }
    apolloParsed.contacts = allContacts
    await this.setSource(runId, 'apollo', { ...apolloEntry, parsed: apolloParsed })
  }

  // ─── Fase C — Mistral rankContacts ────────────────────────────────────

  private async runContactRanking(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const enr = run.enrichments
    const contacts = (enr.apollo?.parsed?.contacts ?? []).filter((c) => !!c.name)
    if (!contacts.length) return

    const t0 = Date.now()
    const orgCtx = enr.apollo?.parsed ?? enr.kvk?.parsed ?? {}

    let ranking
    try {
      ranking = await this.mistral.rankContacts({
        contacts: contacts.map((c) => ({
          name: c.name,
          title: c.title,
          seniority: c.seniority,
          department: c.department,
          email: c.email,
          email_verified: c.email_verified,
          linkedin_url: c.linkedin_url,
          source_origin: c.source_origin,
        })),
        company_name: orgCtx.company_name,
        industry: orgCtx.industry,
        employee_count: orgCtx.employee_count,
        departmental_head_count: enr.apollo?.parsed?.departmental_head_count,
      })
    } catch (e) {
      await this.appendAudit(runId, this.audit('mistral', 'rankContacts', t0, 'failed', e))
      return
    }

    const p1Norm = ranking.person_1 ? normalizeName(ranking.person_1.name) : null
    const p2Norm = ranking.person_2 ? normalizeName(ranking.person_2.name) : null
    const enriched = contacts.map((c): NormalizedContact => {
      const cNorm = normalizeName(c.name)
      if (p1Norm && p1Norm === cNorm && ranking.person_1) {
        return { ...c, ai_priority_score: ranking.person_1.score, ai_priority_reason: ranking.person_1.reason }
      }
      if (p2Norm && p2Norm === cNorm && ranking.person_2) {
        return { ...c, ai_priority_score: ranking.person_2.score, ai_priority_reason: ranking.person_2.reason }
      }
      return c
    })

    const apolloEntry: PerSourceEnrichment = enr.apollo ?? { status: 'completed' }
    const apolloParsed: NormalizedFields = enr.apollo?.parsed ?? { source: 'apollo' }
    apolloParsed.contacts = enriched
    await this.setSource(runId, 'apollo', { ...apolloEntry, parsed: apolloParsed })
    await this.appendAudit(runId, this.audit('mistral', 'rankContacts', t0, ranking.fallback_used ? 'failed' : 'ok'))

    const top2 = enriched
      .filter((c) => c.ai_priority_score != null)
      .sort((a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0))
      .slice(0, 2)
    await this.supabase
      .from('sales_lead_runs')
      .update({ selected_contacts: top2 as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', runId)
  }

  /**
   * Reveal Apollo cold candidates → bulk_match → mergen in `contacts` →
   * Mistral re-rank. Aangeroepen door de UI wanneer user N contacten
   * geselecteerd heeft om te verrijken (1 credit per contact).
   */
  async revealColdContacts(
    runId: string,
    apolloIds: string[],
  ): Promise<{ revealed: NormalizedContact[]; remaining_cold: number }> {
    if (apolloIds.length === 0) return { revealed: [], remaining_cold: 0 }
    const t0 = Date.now()
    const run = await this.loadRun(runId)
    const apolloEntry: PerSourceEnrichment = run.enrichments.apollo ?? { status: 'completed' }
    const apolloParsed: NormalizedFields = apolloEntry.parsed ?? { source: 'apollo' }
    const cold = apolloParsed.cold_candidates ?? []
    const requested = new Set(apolloIds)
    const validIds = cold.filter((c) => requested.has(c.apollo_id)).map((c) => c.apollo_id)

    let bulkRes
    try {
      bulkRes = await this.apollo.bulkMatchPeople(validIds)
    } catch (e) {
      await this.appendAudit(runId, this.audit('apollo', '/people/bulk_match', t0, 'failed', e))
      throw e
    }

    const revealedKeys = new Set(
      bulkRes.contacts.map((c) => normalizeName(c.name)).filter((k) => !!k),
    )
    const existing = (apolloParsed.contacts ?? []).filter(
      (c) => !revealedKeys.has(normalizeName(c.name)),
    )
    apolloParsed.contacts = [...existing, ...bulkRes.contacts]
    apolloParsed.cold_candidates = cold.filter((c) => !requested.has(c.apollo_id))
    if (apolloParsed.cold_candidates.length === 0) delete apolloParsed.cold_candidates

    await this.setSource(runId, 'apollo', { ...apolloEntry, parsed: apolloParsed })
    await this.appendAudit(
      runId,
      this.audit('apollo', '/people/bulk_match', t0, 'ok', undefined, bulkRes.usage.cost_credits),
    )

    // Mistral rank opnieuw zodat de nieuwe contacten een score krijgen.
    await this.runContactRanking(runId)

    return { revealed: bulkRes.contacts, remaining_cold: apolloParsed.cold_candidates?.length ?? 0 }
  }

  // ─── Fase D — master_record + auto-note + status='review' ─────────────

  private async finalize(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const master = computePrimaryMaster(run.enrichments, run.input_url)
    master.deal_note_text = generateDealNote({
      master,
      enrichments: run.enrichments,
      selectedVacancies: master.vacancies,
    })

    const sources: PerSourceEnrichment[] = [
      run.enrichments.kvk,
      run.enrichments.google_maps,
      run.enrichments.apollo,
      run.enrichments.website,
    ].filter((s): s is PerSourceEnrichment => !!s)
    const hasUsableData = sources.some(
      (s) => s.status === 'completed' || s.status === 'not_found',
    )
    const finalStatus = hasUsableData ? 'review' : 'failed'

    await this.supabase
      .from('sales_lead_runs')
      .update({
        status: finalStatus,
        master_record: master as unknown as Json,
        updated_at: new Date().toISOString(),
        ...(finalStatus === 'failed'
          ? { error: 'Alle 4 enrichments faalden zonder bruikbare data' }
          : {}),
      })
      .eq('id', runId)
  }

  // ─── DB helpers ────────────────────────────────────────────────────────

  private async loadRun(runId: string): Promise<{
    input_url: string
    input_domain: string
    scrape_vacancies: boolean
    enrichments: RunEnrichments
  }> {
    const { data, error } = await this.supabase
      .from('sales_lead_runs')
      .select('input_url,input_domain,scrape_vacancies,enrichments')
      .eq('id', runId)
      .single()
    if (error || !data) throw new Error(`Run ${runId} niet gevonden: ${error?.message ?? ''}`)
    return {
      input_url: data.input_url,
      input_domain: data.input_domain,
      scrape_vacancies: data.scrape_vacancies,
      enrichments: (data.enrichments ?? {}) as RunEnrichments,
    }
  }

  private async markRunning(runId: string, source: SourceName, startedAt: string): Promise<void> {
    await this.setSource(runId, source, { status: 'running', started_at: startedAt })
  }

  private async completeSource(
    runId: string,
    source: SourceName,
    startedAt: string,
    parsed: NormalizedFields,
  ): Promise<void> {
    await this.setSource(runId, source, {
      status: 'completed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      parsed,
    })
  }

  private async failSource(
    runId: string,
    source: SourceName,
    startedAt: string,
    err: unknown,
    status: 'failed' | 'not_found',
  ): Promise<void> {
    await this.setSource(runId, source, {
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Atomic write via sales_lead_runs_set_source rpc — geen lost-update race meer.
  private async setSource(
    runId: string,
    source: SourceName,
    value: PerSourceEnrichment,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('sales_lead_runs_set_source', {
      p_run_id: runId,
      p_source: source,
      p_value: value as unknown as Json,
    })
    if (error) throw new Error(`set_source ${source} failed: ${error.message}`)
  }

  private async appendAudit(runId: string, entry: AuditLogEntry): Promise<void> {
    const { error } = await this.supabase.rpc('sales_lead_runs_append_audit', {
      p_run_id: runId,
      p_entry: entry as unknown as Json,
    })
    if (error) console.error(`append_audit failed: ${error.message}`)
  }

  private audit(
    source: AuditLogEntry['source'],
    endpoint: string,
    t0: number,
    status: AuditLogEntry['status'],
    err?: unknown,
    cost_credits?: number,
  ): AuditLogEntry {
    return {
      ts: new Date().toISOString(),
      source,
      endpoint,
      duration_ms: Date.now() - t0,
      status,
      ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}),
      ...(cost_credits != null ? { cost_credits } : {}),
    }
  }
}

/**
 * Normaliseer een persoonsnaam voor case/whitespace-tolerante matching.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * "wetarget.nl" → "WeTarget" (eerste segment, capitalize).
 * KvK Zoeken v2 doet whole-text match — een naam-guess uit het domein is
 * de minst-precieze maar bruikbare fallback wanneer de user geen naam meegaf.
 */
function domainToCompanyGuess(domain: string): string {
  const stem = domain.split('.')[0] ?? domain
  return stem.charAt(0).toUpperCase() + stem.slice(1)
}
