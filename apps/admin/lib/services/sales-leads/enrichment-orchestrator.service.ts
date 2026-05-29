import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'
import { KvkService, KvkApiError } from './kvk.service'
import { MapsService, MapsApiError } from './maps.service'
import { ApolloService, ApolloApiError } from './apollo.service'
import { WebsiteService } from './website.service'
import { MistralService } from './mistral.service'
import { computePrimaryMaster } from './master-record'
import { generateDealNote } from './auto-note'
import { getBrancheOptions } from './branche-options.service'
import { upsertCompanyFromRun, upsertCareerPageSource } from './internal-linking'
import { extractApex } from '@/lib/utils/url'
import type {
  RunEnrichments,
  PerSourceEnrichment,
  NormalizedFields,
  NormalizedContact,
  AuditLogEntry,
  MasterRecord,
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
  /**
   * Re-run KvK met expliciete user-input (manual override via UI of een
   * suggestion-chip uit een andere bron). Bypassed `runSingleSource` zodat
   * deze method niet vervuilt met source-specifieke override-params.
   */
  async runKvkWithOverride(runId: string, override: KvkLookupOverride): Promise<void> {
    const { input_domain } = await this.loadRun(runId)
    await this.runKvk(runId, input_domain, override)
    await this.rebuildMasterIfMissing(runId)
  }

  async runSingleSource(runId: string, source: SourceName): Promise<void> {
    const run = await this.loadRun(runId)
    const { input_url, input_domain, scrape_vacancies } = run
    switch (source) {
      case 'kvk':
        // Gebruik website-data als die er al ligt (sterker signaal dan domein-guess).
        await this.runKvk(runId, input_domain, pickKvkInputFromWebsite(run.enrichments, input_domain) ?? undefined)
        break
      case 'google_maps':
        await this.runMaps(runId, input_domain)
        break
      case 'apollo':
        await this.runApollo(runId, input_domain)
        break
      case 'website':
        await this.runWebsite(runId, input_url, scrape_vacancies)
        // pages_crawled is een single-source veld dat de UI-sitemap aanstuurt
        // en niet door user wordt geëdit — bij website-replay altijd resyncen
        // zodat de geparsede sitemap meebeweegt met de nieuwe crawl.
        await this.syncPagesCrawledToMaster(runId)
        break
    }
    // Self-heal: als master_record ontbreekt (legacy/corrupted runs waar
    // finalize ooit niet voltooide), bouw hem op uit huidige enrichments.
    // Touch'ed niets als master_record al bestaat — user-edits blijven veilig.
    await this.rebuildMasterIfMissing(runId)
  }

  private async syncPagesCrawledToMaster(runId: string): Promise<void> {
    const { data } = await this.supabase
      .from('sales_lead_runs')
      .select('master_record, enrichments')
      .eq('id', runId)
      .single()
    if (!data?.master_record) return
    const websiteParsed = (data.enrichments as RunEnrichments | null)?.website?.parsed
    const pages = websiteParsed?.pages_crawled
    const discovered = websiteParsed?.pages_discovered
    if (!pages?.length && !discovered?.length) return
    const master: Record<string, unknown> = { ...(data.master_record as Record<string, unknown>) }
    if (pages?.length) master.pages_crawled = pages
    if (discovered?.length) master.pages_discovered = discovered
    await this.supabase
      .from('sales_lead_runs')
      .update({ master_record: master as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', runId)
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
    master.deal_note_text = await generateDealNote({
      master,
      selectedVacancies: master.vacancies,
      supabase: this.supabase,
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

      // Fase A.5 — KvK-retry met website-data. Veel domeinen condenseren
      // meerdere woorden zonder spatie (flexwonennh.nl, werkenindekempen.nl);
      // de Zoeken-API doet whole-text match dus die guess geeft 404. Als
      // Mistral op de site een KvK-nummer of betere bedrijfsnaam vond,
      // gebruiken we die alsnog. Voor runPersonMatching omdat Apollo
      // /people/match `organization_name` uit kvk.parsed leest.
      await this.retryKvkWithWebsiteData(runId)

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

  /**
   * KvK-lookup. Default: bedrijfsnaam-guess uit het domein.
   * `override` wint wanneer aanwezig — gebruikt door de website-retry-pad en
   * door `runSingleSource('kvk')` als website-data al beschikbaar is.
   */
  private async runKvk(
    runId: string,
    domain: string,
    override?: KvkLookupOverride,
  ): Promise<void> {
    const startedAt = new Date().toISOString()
    await this.markRunning(runId, 'kvk', startedAt)
    const t0 = Date.now()
    const endpoint = override?.kvkNumber
      ? `GET /v1/basisprofielen/${override.kvkNumber} (via ${override.via ?? 'website'})`
      : override?.name
      ? `GET /v2/zoeken (naam via ${override.via ?? 'website'})`
      : 'GET /v1/basisprofielen'
    try {
      let parsed: NormalizedFields
      if (override?.kvkNumber) {
        parsed = await this.kvk.enrichByKvkNumber(override.kvkNumber)
      } else if (override?.name) {
        parsed = await this.kvk.enrichByName(override.name)
      } else {
        parsed = await this.kvk.enrichByName(domainToCompanyGuess(domain))
      }
      await this.completeSource(runId, 'kvk', startedAt, parsed)
      await this.appendAudit(runId, this.audit('kvk', endpoint, t0, 'ok'))
    } catch (e) {
      const reason = e instanceof KvkApiError ? e.reason : 'unknown'
      const status = reason === 'not_found' ? 'not_found' : 'failed'
      await this.failSource(runId, 'kvk', startedAt, e, status)
      await this.appendAudit(runId, this.audit('kvk', endpoint, t0, status, e))
    }
  }

  /**
   * Re-run KvK met website-data wanneer Phase-A op `not_found` eindigde.
   * Geen-op als: KvK is gelukt, of website is gefaald, of website geen
   * bruikbaar signaal opleverde (alleen domain-guess herhalen heeft geen zin).
   */
  private async retryKvkWithWebsiteData(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    if (run.enrichments.kvk?.status !== 'not_found') return
    if (run.enrichments.website?.status !== 'completed') return
    const override = pickKvkInputFromWebsite(run.enrichments, run.input_domain)
    if (!override) return
    await this.runKvk(runId, run.input_domain, override)
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

  /**
   * Inject altijd een "Afdeling Personeelszaken"-contact in apollo.parsed.contacts
   * zodat sales hem als fallback kan selecteren ook wanneer Mistral/Apollo geen
   * HR-persoon hebben gevonden en de site geen generieke mailbox heeft.
   *
   * Dedupe: skipt als de website-scrape (via isPlaceholderContactName-normalisatie)
   * al een 'Afdeling Personeelszaken'-record heeft toegevoegd; die heeft vaak een
   * specifiekere email gehaald uit een /contact-pagina.
   *
   * Email-resolutie: master.email -> info@{apex}. Phone: master.phone.
   * `ai_priority_score=10` zodat hij standaard onderaan staat tegenover echte
   * HR-personen (die scoren typisch 60-95 via Mistral rankContacts).
   */
  private async injectSyntheticPersoneelszaken(
    runId: string,
    inputDomain: string,
    master: MasterRecord,
  ): Promise<void> {
    const run = await this.loadRun(runId)
    const apolloEntry: PerSourceEnrichment = run.enrichments.apollo ?? { status: 'completed' }
    const apolloParsed: NormalizedFields = apolloEntry.parsed ?? { source: 'apollo' }
    const existing = apolloParsed.contacts ?? []
    const targetNorm = normalizeName('Afdeling Personeelszaken')
    if (existing.some((c) => normalizeName(c.name) === targetNorm)) {
      return
    }

    const apex = inputDomain ? extractApex(inputDomain) : null
    const email = master.email ?? (apex ? `info@${apex}` : undefined)
    const phone = master.phone ?? undefined
    if (!email && !phone) return

    const synthetic: NormalizedContact = {
      name: 'Afdeling Personeelszaken',
      first_name: 'Afdeling Personeelszaken',
      last_name: '',
      title: undefined,
      email,
      phone_mobile: phone && /^(\+?316|00316|06)/.test(phone.replace(/\s+/g, '')) ? phone : undefined,
      phone_other: phone && !/^(\+?316|00316|06)/.test(phone.replace(/\s+/g, '')) ? phone : undefined,
      department: 'human_resources',
      source_origin: ['synthetic'],
      ai_priority_score: 10,
      ai_priority_reason: 'Synthetic fallback - bedrijfsemail en telefoon',
    }
    apolloParsed.contacts = [...existing, synthetic]
    await this.setSource(runId, 'apollo', { ...apolloEntry, parsed: apolloParsed })
  }

  private async finalize(runId: string): Promise<void> {
    const run = await this.loadRun(runId)
    const master = computePrimaryMaster(run.enrichments, run.input_url)

    // Altijd "Afdeling Personeelszaken" beschikbaar maken in de contact-lijst,
    // ook wanneer Mistral/Apollo geen HR-persoon vonden en de site geen generieke
    // mailbox heeft. Sales kan hem als laatste-resort-contact aanvinken.
    await this.injectSyntheticPersoneelszaken(runId, run.input_domain, master)

    // Branche-classificatie via Mistral, met actieve Pipedrive-opties als context.
    // Slaagt het: master.branche_suggestion wordt door auto-note + sync gebruikt.
    // Faalt het (Mistral down, geen opties): auto-note + sync vallen terug op
    // SBI-prefix mapping via BrancheOptionsService.findEnumIdForSbi.
    try {
      const branches = await getBrancheOptions({ supabase: this.supabase })
      if (branches.length > 0) {
        const suggestion = await this.mistral.classifyBranche({
          company_name: master.company_name ?? null,
          industry: master.industry ?? null,
          sbi_activities: (master.sbi_activities ?? []).map((s) => ({
            code: s.code,
            description: s.description,
          })),
          description: master.description_short ?? master.description_long ?? null,
          vacancy_titles: (master.vacancies ?? []).map((v) => v.title),
          availableBranches: branches.map((b) => ({ enum_id: b.pipedrive_enum_id, label: b.label })),
        })
        if (suggestion) master.branche_suggestion = suggestion
      }
    } catch (e) {
      console.warn('[orchestrator] branche-classificatie faalde:', e)
    }

    master.deal_note_text = await generateDealNote({
      master,
      selectedVacancies: master.vacancies,
      supabase: this.supabase,
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

    // Upsert company + career-page-suggesties zodra bruikbare data → user kan
    // op /sales/lead-verrijking/[id] career-pages goedkeuren. Faalt deze stap,
    // dan blokkeren we de status-update niet (suggesties zijn niet-kritiek).
    if (finalStatus === 'review' && master.company_name) {
      try {
        const company = await upsertCompanyFromRun(this.supabase, {
          id: runId,
          input_domain: run.input_domain,
          input_url: run.input_url,
          pipedrive_org_id: null,
          master_record: master,
        })
        for (const cand of master.career_page_candidates ?? []) {
          await upsertCareerPageSource(this.supabase, {
            company_id: company.id,
            company_name: master.company_name,
            run_id: runId,
            url: cand.url,
            discovery_method: cand.method,
            is_external_ats: false,
            ats_type: null,
          })
        }
      } catch (e) {
        console.error('[orchestrator] career-page suggesties opslaan faalde:', e)
      }
    }

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

export type KvkLookupOverride = {
  kvkNumber?: string
  name?: string
  via?: 'website' | 'manual' | 'maps' | 'apollo'
}

/**
 * Kies het sterkste KvK-input-signaal uit website-data:
 *   1. KvK-nummer dat Mistral letterlijk op de site las (8 cijfers) → directe lookup.
 *   2. Bedrijfsnaam die afwijkt van de domein-guess → Zoeken-API.
 * Returnt `null` als website niets bruikbaars opleverde — voorkomt zinloze
 * retries met dezelfde input die net 404 gaf.
 */
function pickKvkInputFromWebsite(
  enrichments: RunEnrichments,
  inputDomain: string,
): KvkLookupOverride | null {
  const website = enrichments.website?.parsed
  if (!website) return null

  const digits = (website.kvk_number ?? '').replace(/\D/g, '')
  if (/^\d{8}$/.test(digits)) return { kvkNumber: digits, via: 'website' }

  const websiteName = website.company_name?.trim()
  if (!websiteName) return null
  const guess = domainToCompanyGuess(inputDomain).toLowerCase()
  if (websiteName.toLowerCase() === guess) return null
  return { name: websiteName, via: 'website' }
}
