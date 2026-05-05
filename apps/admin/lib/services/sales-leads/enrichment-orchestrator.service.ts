import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'
import { KvkService, KvkApiError } from './kvk.service'
import { MapsService, MapsApiError } from './maps.service'
import { ApolloService, ApolloApiError } from './apollo.service'
import { WebsiteService, WebsiteServiceError } from './website.service'
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
    await this.markRunning(runId, 'kvk')
    const t0 = Date.now()
    try {
      // KvK heeft geen domein-zoek; we gebruiken de domain-stem als naam-guess
      const naamGuess = domainToCompanyGuess(domain)
      const parsed = await this.kvk.enrichByName(naamGuess)
      await this.completeSource(runId, 'kvk', { parsed })
      await this.appendAudit(runId, this.audit('kvk', 'GET /v1/basisprofielen', t0, 'ok'))
    } catch (e) {
      const reason = e instanceof KvkApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'kvk', e, status)
      await this.appendAudit(runId, this.audit('kvk', 'GET /v1/basisprofielen', t0, status, e))
    }
  }

  private async runMaps(runId: string, domain: string): Promise<void> {
    await this.markRunning(runId, 'google_maps')
    const t0 = Date.now()
    try {
      const naamGuess = domainToCompanyGuess(domain)
      const parsed = await this.maps.enrichByQuery(naamGuess)
      await this.completeSource(runId, 'google_maps', { parsed })
      await this.appendAudit(runId, this.audit('google_maps', 'enrichByQuery', t0, 'ok'))
    } catch (e) {
      const reason = e instanceof MapsApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'google_maps', e, status)
      await this.appendAudit(runId, this.audit('google_maps', 'enrichByQuery', t0, status, e))
    }
  }

  private async runApollo(runId: string, domain: string): Promise<void> {
    await this.markRunning(runId, 'apollo')
    const t0 = Date.now()
    try {
      // Org-enrich + warm-lead-search beide tegelijk
      const [orgRes, warmRes] = await Promise.allSettled([
        this.apollo.enrichOrganization(domain),
        this.apollo.searchContactsByDomain(domain),
      ])

      let parsed: NormalizedFields = { source: 'apollo' }
      const warmContacts: NormalizedContact[] = []
      let cost_credits = 0

      if (orgRes.status === 'fulfilled') {
        parsed = { ...orgRes.value.normalized }
        cost_credits += orgRes.value.usage.cost_credits ?? 0
      } else if (orgRes.reason instanceof ApolloApiError && orgRes.reason.reason !== 'not_found') {
        // Echte fout: gooi door; not_found = OK voor parsed leeg
        throw orgRes.reason
      }

      if (warmRes.status === 'fulfilled') {
        warmContacts.push(...warmRes.value.contacts)
        cost_credits += warmRes.value.usage.cost_credits ?? 0
      }
      // Warm-search-fout is niet-blocking; alleen org-enrich is essentieel.

      parsed.contacts = warmContacts.length ? warmContacts : undefined
      await this.completeSource(runId, 'apollo', { parsed })
      await this.appendAudit(runId, this.audit('apollo', 'enrich+contacts/search', t0, 'ok', undefined, cost_credits))
    } catch (e) {
      const reason = e instanceof ApolloApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'apollo', e, status)
      await this.appendAudit(runId, this.audit('apollo', 'enrich+contacts/search', t0, status, e))
    }
  }

  private async runWebsite(runId: string, inputUrl: string, scrapeVacancies: boolean): Promise<void> {
    await this.markRunning(runId, 'website')
    const t0 = Date.now()
    try {
      const parsed = await this.website.crawlAndParse(inputUrl, scrapeVacancies)
      await this.completeSource(runId, 'website', { parsed })
      await this.appendAudit(runId, this.audit('website', 'crawlAndParse', t0, 'ok'))
    } catch (e) {
      const reason = e instanceof WebsiteServiceError ? e.reason : 'unknown'
      void reason // rapport-only (geen status-mapping voor website specific reasons)
      const status = 'failed'
      await this.failSource(runId, 'website', e, status)
      await this.appendAudit(runId, this.audit('website', 'crawlAndParse', t0, status, e))
    }
  }

  // ─── Fase B — Apollo matchPerson voor website-namen ────────────────────

  private async runPersonMatching(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const enr = run.enrichments
    const websiteContacts = enr.website?.parsed?.contacts ?? []
    const apolloWarm = enr.apollo?.parsed?.contacts ?? []
    if (!websiteContacts.length) return // niets te matchen

    // Set warm-lead-namen om dubbel-match te voorkomen
    const warmNames = new Set(apolloWarm.map((c) => c.name.toLowerCase()))
    const matched: NormalizedContact[] = []

    for (const wc of websiteContacts) {
      if (warmNames.has(wc.name.toLowerCase())) continue // al warm
      const t0 = Date.now()
      try {
        const r = await this.apollo.matchPerson({
          name: wc.name,
          domain: run.input_domain,
          organization_name: run.enrichments.kvk?.parsed?.company_name,
        })
        if (r.contact) {
          // Merge website-data met Apollo enrichment
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
        // door; één gefaalde match stopt niet de rest
      }
    }

    // Merge: warm contacts + matched (apollo-enriched) + ongematchte website-contacts
    const matchedNames = new Set(matched.map((c) => c.name.toLowerCase()))
    const stillWebsiteOnly = websiteContacts.filter(
      (c) => !warmNames.has(c.name.toLowerCase()) && !matchedNames.has(c.name.toLowerCase()),
    )
    const allContacts = [...apolloWarm, ...matched, ...stillWebsiteOnly]

    // Schrijf merged terug naar enrichments.apollo.parsed.contacts
    const apolloParsed: NormalizedFields = enr.apollo?.parsed ?? { source: 'apollo' }
    apolloParsed.contacts = allContacts
    await this.setSourceParsed(runId, 'apollo', apolloParsed)
  }

  // ─── Fase C — Mistral rankContacts ────────────────────────────────────

  private async runContactRanking(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const enr = run.enrichments
    const contacts = enr.apollo?.parsed?.contacts ?? []
    if (!contacts.length) return

    const orgCtx = enr.apollo?.parsed ?? enr.kvk?.parsed ?? {}
    const ranking = await this.mistral.rankContacts({
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

    // Schrijf ai_priority_score + ai_priority_reason terug naar elke matching contact
    const enriched = contacts.map((c): NormalizedContact => {
      if (ranking.person_1?.name === c.name) {
        return { ...c, ai_priority_score: ranking.person_1.score, ai_priority_reason: ranking.person_1.reason }
      }
      if (ranking.person_2?.name === c.name) {
        return { ...c, ai_priority_score: ranking.person_2.score, ai_priority_reason: ranking.person_2.reason }
      }
      return c
    })

    const apolloParsed: NormalizedFields = enr.apollo?.parsed ?? { source: 'apollo' }
    apolloParsed.contacts = enriched
    await this.setSourceParsed(runId, 'apollo', apolloParsed)
    await this.appendAudit(runId, this.audit('mistral', 'rankContacts', 0, ranking.fallback_used ? 'failed' : 'ok'))

    // Pre-select top-2 in selected_contacts
    const top2 = enriched
      .filter((c) => c.ai_priority_score != null)
      .sort((a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0))
      .slice(0, 2)
    await this.supabase
      .from('sales_lead_runs')
      .update({ selected_contacts: top2 as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', runId)
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

    // Decide finale status
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

  private async markRunning(runId: string, source: SourceName): Promise<void> {
    const partial: PerSourceEnrichment = {
      status: 'running',
      started_at: new Date().toISOString(),
    }
    await this.setSourceFull(runId, source, partial)
  }

  private async completeSource(
    runId: string,
    source: SourceName,
    data: { parsed: NormalizedFields; raw?: unknown },
  ): Promise<void> {
    const cur = await this.getSource(runId, source)
    const partial: PerSourceEnrichment = {
      ...cur,
      status: 'completed',
      completed_at: new Date().toISOString(),
      parsed: data.parsed,
      ...(data.raw !== undefined ? { raw: data.raw } : {}),
    }
    await this.setSourceFull(runId, source, partial)
  }

  private async failSource(
    runId: string,
    source: SourceName,
    err: unknown,
    status: 'failed' | 'not_found',
  ): Promise<void> {
    const cur = await this.getSource(runId, source)
    const partial: PerSourceEnrichment = {
      ...cur,
      status,
      completed_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }
    await this.setSourceFull(runId, source, partial)
  }

  private async getSource(runId: string, source: SourceName): Promise<PerSourceEnrichment> {
    const { data } = await this.supabase
      .from('sales_lead_runs')
      .select('enrichments')
      .eq('id', runId)
      .single()
    const enr = (data?.enrichments ?? {}) as RunEnrichments
    return enr[source] ?? { status: 'pending' }
  }

  /**
   * Atomic per-source jsonb_set update via Postgres RPC of inline UPDATE.
   * Supabase JS heeft geen directe jsonb_set helper, dus we doen een SELECT
   * van de hele enrichments → merge in code → UPDATE. Postgres serialiseert
   * UPDATEs op dezelfde rij (sectie 6.3 spec) — geen lost updates omdat
   * Promise.allSettled in Fase A 4 separate UPDATEs op aparte sub-keys doet.
   *
   * KNOWN: bij hoge concurrency (4 parallel writes binnen ms) kunnen reads
   * stale enrichments zien. Voor V1 acceptabel — Postgres locks op de UPDATE
   * voorkomen lost-write. Bij V2 een SQL function `sales_lead_runs_set_source`
   * met directe jsonb_set toepassen.
   */
  private async setSourceFull(
    runId: string,
    source: SourceName,
    value: PerSourceEnrichment,
  ): Promise<void> {
    const { data } = await this.supabase
      .from('sales_lead_runs')
      .select('enrichments')
      .eq('id', runId)
      .single()
    const enr = (data?.enrichments ?? {}) as RunEnrichments
    enr[source] = value
    await this.supabase
      .from('sales_lead_runs')
      .update({ enrichments: enr as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', runId)
  }

  private async setSourceParsed(
    runId: string,
    source: SourceName,
    parsed: NormalizedFields,
  ): Promise<void> {
    const cur = await this.getSource(runId, source)
    await this.setSourceFull(runId, source, { ...cur, parsed })
  }

  private async appendAudit(runId: string, entry: AuditLogEntry): Promise<void> {
    const { data } = await this.supabase
      .from('sales_lead_runs')
      .select('audit_log')
      .eq('id', runId)
      .single()
    const audit = ((data?.audit_log ?? []) as AuditLogEntry[]).concat(entry)
    await this.supabase
      .from('sales_lead_runs')
      .update({ audit_log: audit as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', runId)
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
      duration_ms: t0 > 0 ? Date.now() - t0 : 0,
      status,
      ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}),
      ...(cost_credits != null ? { cost_credits } : {}),
    }
  }
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
