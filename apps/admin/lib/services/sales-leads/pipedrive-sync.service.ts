import {
  getPipedriveClient,
  type PipedrivePerson,
} from '@/lib/pipedrive-client'
import { createServiceRoleClient } from '@/lib/supabase-server'
import {
  buildOrgPayload,
  buildPersonPayload,
  buildDealPayload,
  nextWorkday,
  type OwnerConfigForSync,
} from './pipedrive-payloads'
import {
  upsertCompanyFromRun,
  upsertJobPostingsFromRun,
  resolveCareerPageSourceId,
} from './internal-linking'
import { findEnumIdForSbi } from './branche-options.service'
import { extractApex } from '@/lib/utils/url'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MasterRecord, NormalizedContact, NormalizedVacancy } from './types'

type SB = SupabaseClient

/**
 * Minimale Pipedrive-client-interface die deze service gebruikt. Gekoppeld aan
 * de echte client via Pick zodat signatures niet kunnen wegdrijven, maar
 * injecteerbaar voor unit-tests (in-memory fake, geen PIPEDRIVE_API_KEY nodig).
 */
type PipedriveClientLike = Pick<
  ReturnType<typeof getPipedriveClient>,
  | 'searchOrganization'
  | 'searchOrganizationByDomain'
  | 'getOrganizationDealCount6m'
  | 'createOrganizationV2'
  | 'getOrganizationV2'
  | 'updateOrganizationV2'
  | 'searchPersonByEmail'
  | 'getPerson'
  | 'updatePerson'
  | 'createPerson'
  | 'createDealV2'
  | 'addNoteToDeal'
  | 'addDealParticipant'
>

export type SyncResult =
  | {
      status: 'duplicate'
      existing_org_id: number
      existing_org_name: string | null
      deal_count_6m: number
    }
  | {
      status: 'completed'
      pipedrive_org_id: number
      pipedrive_deal_id: number
      pipedrive_person_ids: number[]
    }
  | {
      status: 'failed'
      error: string
      partial: {
        pipedrive_org_id: number | null
        pipedrive_deal_id: number | null
        pipedrive_person_ids: number[]
      }
    }

/**
 * Bepaal of contact-dedup tegen een bestaande org moet draaien. True bij een
 * expliciete 'existing'-keuze, of (afgeleid) bij een 'auto'-retry waar de org al
 * gekoppeld is aan de eerder gedetecteerde duplicate-org.
 */
export function computeExistingOrgFlow(
  orgMode: 'auto' | 'new' | 'existing',
  pipedriveOrgId: number | null,
  existingPipedriveOrgId: number | null,
): boolean {
  if (orgMode === 'existing') return true
  return (
    orgMode === 'auto' &&
    pipedriveOrgId != null &&
    pipedriveOrgId === existingPipedriveOrgId
  )
}

/**
 * Orchestrator: dedupe → org → persons → deal → notitie → participants → interne linking.
 *
 * Idempotent via DB-state: skipt stappen waar `pipedrive_org_id` /
 * `pipedrive_person_ids[]` / `pipedrive_deal_id` al gevuld zijn. Bij faal blijft
 * de partial state in de DB staan zodat een retry naadloos verder kan.
 *
 * Schema-mapping notes:
 *   - `sales_lead_runs.master_record` is `Json | null` → cast naar `MasterRecord`.
 *   - `sales_lead_runs.selected_contacts` is `Json` (defaults to `[]`).
 *   - `sales_lead_runs.pipedrive_person_ids` is non-nullable `number[]` met default `{}`.
 *   - `sales_lead_owner_config.hoofddomein_strategy` is `string` in DB; we casten
 *     naar de union die `OwnerConfigForSync` verwacht.
 */
export class PipedriveSyncService {
  private pd: PipedriveClientLike
  private supabase: SB
  constructor(supabase?: SB, pd?: PipedriveClientLike) {
    this.supabase = supabase ?? (createServiceRoleClient() as unknown as SB)
    this.pd = pd ?? getPipedriveClient()
  }

  async syncLeadToPipedrive(
    runId: string,
    orgMode: 'auto' | 'new' | 'existing' = 'auto',
  ): Promise<SyncResult> {
    const { data: run, error } = await this.supabase
      .from('sales_lead_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle()
    if (error || !run) throw new Error(`run niet gevonden: ${runId}`)

    if (
      run.status !== 'review' &&
      run.status !== 'syncing' &&
      run.status !== 'failed' &&
      run.status !== 'duplicate'
    ) {
      throw new Error(
        `run.status='${run.status}' — sync alleen toegestaan vanuit review/syncing/failed/duplicate`,
      )
    }

    const master = run.master_record as MasterRecord | null
    const personIdsExisting: number[] = (run.pipedrive_person_ids as number[]) ?? []
    if (!master?.company_name) {
      return this.markFailed(runId, 'master_record.company_name ontbreekt', {
        pipedrive_org_id: run.pipedrive_org_id,
        pipedrive_deal_id: run.pipedrive_deal_id,
        pipedrive_person_ids: personIdsExisting,
      })
    }

    const { data: cfg } = await this.supabase
      .from('sales_lead_owner_config')
      .select(
        'id, pipedrive_user_id, pipedrive_pipeline_id, pipedrive_default_stage_id, hoofddomein_strategy, hoofddomein_fixed_value, hoofddomein_fixed_option_id, wetarget_flag_value, contactmoment_field_key, contactmoment_offset_workdays',
      )
      .eq('id', run.owner_config_id)
      .maybeSingle()
    if (!cfg) {
      return this.markFailed(runId, 'owner_config niet gevonden', {
        pipedrive_org_id: run.pipedrive_org_id,
        pipedrive_deal_id: run.pipedrive_deal_id,
        pipedrive_person_ids: personIdsExisting,
      })
    }
    // hoofddomein_strategy is `string` in DB-types; cast naar enum-union die de
    // payload-builder verwacht (only 'fixed' | 'auto_match_by_address' allowed).
    const owner = cfg as unknown as OwnerConfigForSync

    // 1. Dedupe - alleen in 'auto'-modus (geen expliciete org-keuze). Bij
    // 'new'/'existing' heeft de user al beslist; skip de duplicate-check.
    if (orgMode === 'auto' && !run.pipedrive_org_id) {
      const existing = await this.findExistingOrg(run.input_domain, master.company_name)
      if (existing) {
        const dealCount = await this.pd.getOrganizationDealCount6m(existing.id)
        await this.supabase
          .from('sales_lead_runs')
          .update({
            status: 'duplicate',
            existing_pipedrive_org_id: existing.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', runId)
        return {
          status: 'duplicate',
          existing_org_id: existing.id,
          existing_org_name: existing.name ?? null,
          deal_count_6m: dealCount,
        }
      }
    }

    // 2. Mark syncing
    await this.supabase
      .from('sales_lead_runs')
      .update({ status: 'syncing', updated_at: new Date().toISOString() })
      .eq('id', runId)

    let orgId: number | null = run.pipedrive_org_id ?? null
    const personIds: number[] = [...personIdsExisting]
    let dealId: number | null = run.pipedrive_deal_id ?? null

    // Effectieve "bestaande-org"-flow: expliciet via orgMode, of afgeleid bij
    // een retry/hervatten (orgMode='auto') waar de org al gekoppeld is aan de
    // gedetecteerde duplicate-org. Zo blijft contact-dedup actief na een fout,
    // zonder de modus in de DB te persisteren.
    const isExistingOrgFlow = computeExistingOrgFlow(
      orgMode,
      run.pipedrive_org_id ?? null,
      run.existing_pipedrive_org_id ?? null,
    )

    try {
      // 3. Org. createOrganizationV2 want buildOrgPayload levert V2-format
      // (`custom_fields` wrapper) — V1 endpoint zou de keys negeren of 400 geven.
      if (!orgId) {
        const hoofddomeinOptionId = await this.resolveHoofddomeinOptionId(owner, master.hoofddomein ?? undefined)
        const brancheEnumId = await this.resolveBrancheEnumId(run, master)
        const orgPayload = buildOrgPayload(master, owner, { hoofddomeinOptionId, brancheEnumId })

        if (orgMode === 'existing') {
          // Hergebruik de bestaande Pipedrive-org (deal komt onder dezelfde org
          // zodat klantcontact zichtbaar blijft). Vul alleen lege velden aan;
          // bestaande waarden nooit overschrijven.
          const existingId = run.existing_pipedrive_org_id as number | null
          if (!existingId) {
            return this.markFailed(
              runId,
              "orgMode='existing' maar run heeft geen existing_pipedrive_org_id",
              {
                pipedrive_org_id: null,
                pipedrive_deal_id: dealId,
                pipedrive_person_ids: personIds,
              },
            )
          }
          orgId = existingId
          await this.fillEmptyOrgFields(orgId, orgPayload)
        } else {
          const created = await this.pd.createOrganizationV2(orgPayload)
          orgId = created.id
        }

        await this.supabase
          .from('sales_lead_runs')
          .update({ pipedrive_org_id: orgId, updated_at: new Date().toISOString() })
          .eq('id', runId)
      }

      // 4. Persons (idempotent: only create persons beyond what's already in personIds[])
      // Met info@-fallback en company-phone-fallback uit master.
      // companyDomain wordt gereduceerd naar apex (mail.example.com -> example.com)
      // zodat info@-mailbox bestaat op de root MX-records, niet op een subdomein
      // dat zelden een eigen mailserver heeft.
      const selected = (run.selected_contacts as unknown as NormalizedContact[]) ?? []
      const companyDomain = run.input_domain ? extractApex(run.input_domain) : null
      const companyPhone = master.phone ?? null
      for (let i = personIds.length; i < selected.length; i++) {
        // In de bestaande-org-flow: hergebruik een bestaand contact als de echte
        // e-mail exact matcht in Pipedrive. Alleen op `contact.email` (niet op de
        // info@{domain}-fallback, die zou een willekeurige persoon van een
        // ander bedrijf kunnen matchen).
        let personId: number | null = null
        if (isExistingOrgFlow) {
          const match = await this.findExistingPersonByEmail(selected[i].email)
          if (match) {
            personId = match.id
            // Koppel het contact aan de gekozen org alleen als het nog geen org
            // heeft; een bestaande (andere) org-koppeling laten we ongemoeid om
            // klantdata niet te verstoren. Het contact wordt sowieso aan de deal
            // gehangen via personIds[] (person_id / participant).
            if (match.shouldLinkOrg) {
              try {
                await this.pd.updatePerson(personId, { org_id: orgId } as unknown as Partial<PipedrivePerson>)
              } catch (e) {
                console.error(`[pipedrive-sync] updatePerson(${personId}, org_id=${orgId}):`, e)
              }
            }
          }
        }
        if (!personId) {
          const personPayload = buildPersonPayload(selected[i], orgId, owner, {
            companyDomain,
            companyPhone,
          })
          const newPerson = await this.pd.createPerson(
            personPayload as unknown as PipedrivePerson,
          )
          personId = (newPerson as { id: number }).id
        }
        personIds.push(personId)
        await this.supabase
          .from('sales_lead_runs')
          .update({ pipedrive_person_ids: personIds, updated_at: new Date().toISOString() })
          .eq('id', runId)
      }

      // 5. Deal
      if (!dealId) {
        const cmDate = this.resolveContactmoment(run, owner)
        const dealPayload = buildDealPayload(master, orgId, personIds[0], owner, cmDate)
        const deal = await this.pd.createDealV2(dealPayload)
        dealId = deal.id
        await this.supabase
          .from('sales_lead_runs')
          .update({ pipedrive_deal_id: dealId, updated_at: new Date().toISOString() })
          .eq('id', runId)
      }

      // 6. Notitie. Pragmatisch: altijd posten als deal_note_text aanwezig is.
      // Duplicate notes bij retry kosten 1 extra API-call maar zijn niet schadelijk.
      if (master.deal_note_text && master.deal_note_text.trim().length > 0) {
        await this.pd.addNoteToDeal(dealId, master.deal_note_text)
      }

      // 7. Participants (2e+ contacts; eerste is al person_id van deal)
      for (let i = 1; i < personIds.length; i++) {
        try {
          await this.pd.addDealParticipant(dealId, personIds[i])
        } catch (e) {
          console.error(`[pipedrive-sync] addDealParticipant ${personIds[i]}:`, e)
        }
      }

      // 8. Interne linking — company is meestal al aangemaakt in finalize(),
      // upsertCompanyFromRun is idempotent (matcht op website/kvk) en update
      // met pipedrive_org_id. Career-page-bron-suggesties worden eveneens
      // in finalize() aangemaakt.
      const company = await upsertCompanyFromRun(this.supabase, {
        id: runId,
        input_domain: run.input_domain,
        input_url: run.input_url,
        pipedrive_org_id: orgId,
        master_record: master,
      })

      const vacancies = (master.vacancies ?? []) as NormalizedVacancy[]
      if (vacancies.length > 0) {
        // Koppel de vacatures aan de career-page-bron van dit bedrijf (in
        // finalize() aangemaakt). Voorkeur voor een approved bron; valt terug
        // op de eerste beschikbare. Geen bron gevonden -> source_id blijft null
        // (de vacature wordt dan alleen op url gekoppeld, niet aan een bron).
        const careerSourceId = await resolveCareerPageSourceId(this.supabase, company.id)
        await upsertJobPostingsFromRun(this.supabase, {
          company_id: company.id,
          source_id: careerSourceId,
          vacancies,
        })
      }

      // 9. Mark completed
      await this.supabase
        .from('sales_lead_runs')
        .update({ status: 'completed', error: null, updated_at: new Date().toISOString() })
        .eq('id', runId)

      return {
        status: 'completed',
        pipedrive_org_id: orgId,
        pipedrive_deal_id: dealId,
        pipedrive_person_ids: personIds,
      }
    } catch (e) {
      const msg = (e as Error).message
      await this.supabase
        .from('sales_lead_runs')
        .update({ status: 'failed', error: msg, updated_at: new Date().toISOString() })
        .eq('id', runId)
      return {
        status: 'failed',
        error: msg,
        partial: {
          pipedrive_org_id: orgId,
          pipedrive_deal_id: dealId,
          pipedrive_person_ids: personIds,
        },
      }
    }
  }

  private async findExistingOrg(
    domain: string,
    name: string,
  ): Promise<{ id: number; name?: string } | null> {
    // 1. Probeer domain-search
    try {
      const byDomain = await this.pd.searchOrganizationByDomain(domain)
      if (byDomain && byDomain.length > 0) {
        const item = byDomain[0].item ?? byDomain[0]
        if (item?.id) return { id: item.id, name: item.name }
      }
    } catch {
      // val terug op naam-search
    }
    // 2. Fallback op naam
    const byName = await this.pd.searchOrganization(name)
    if (byName.length > 0) {
      const item = byName[0].item ?? byName[0]
      if (item?.id) return { id: item.id, name: item.name }
    }
    return null
  }

  /**
   * Zoek een bestaande Pipedrive-persoon op echte e-mail. Returnt het person-id
   * plus `shouldLinkOrg` (true alleen als zeker is dat de persoon nog geen org
   * heeft) bij een exacte e-mailmatch, anders null.
   *
   * Robuustheid:
   *   - Lege/ontbrekende e-mail -> null (geen dedup op de info@-fallback).
   *   - Term-search is fuzzy; we accepteren alleen een item waarvan een e-mail
   *     exact (case-insensitive, getrimd) gelijk is aan de gezochte e-mail.
   *   - `shouldLinkOrg` is alleen true als we via getPerson zeker weten dat de
   *     persoon geen org heeft; bij twijfel (fout/onbekend) false zodat we een
   *     bestaande org-koppeling nooit per ongeluk overschrijven.
   *   - Search-fout -> null (val terug op createPerson).
   */
  private async findExistingPersonByEmail(
    email: string | null | undefined,
  ): Promise<{ id: number; shouldLinkOrg: boolean } | null> {
    if (!email || email.trim().length === 0) return null
    const target = email.trim().toLowerCase()
    let items: Array<Record<string, unknown>>
    try {
      items = (await this.pd.searchPersonByEmail(email.trim())) as Array<Record<string, unknown>>
    } catch {
      return null
    }
    for (const raw of items ?? []) {
      const item = ((raw?.item ?? raw) ?? {}) as Record<string, unknown>
      const id = item.id
      if (typeof id !== 'number') continue
      if (!this.personEmailsMatch(item, target)) continue
      // De V2 search-item bevat doorgaans al `organization`; gebruik dat en val
      // alleen terug op getPerson als de org-info ontbreekt in het item.
      let orgState = this.orgStateFromSearchItem(item)
      if (orgState === 'unknown') orgState = await this.resolvePersonOrgId(id)
      return { id, shouldLinkOrg: orgState === 'none' }
    }
    return null
  }

  /**
   * Lees de org-koppeling uit een persons/search-item:
   *   - `'has'`     : `organization` is een object met numeriek id.
   *   - `'none'`    : `organization` is expliciet null.
   *   - `'unknown'` : veld ontbreekt -> caller valt terug op getPerson.
   */
  private orgStateFromSearchItem(item: Record<string, unknown>): 'has' | 'none' | 'unknown' {
    if (!('organization' in item)) return 'unknown'
    const org = item.organization as { id?: unknown } | null
    if (org && typeof org === 'object' && typeof org.id === 'number') return 'has'
    if (org === null) return 'none'
    return 'unknown'
  }

  /**
   * True als een van de e-mailadressen op het search-item exact (case-insensitive,
   * getrimd) gelijk is aan `target`. Defensief tegen de twee V2-vormen:
   * `emails: string[]` of `emails: Array<{ value }>`, plus `primary_email`.
   */
  private personEmailsMatch(item: Record<string, unknown>, target: string): boolean {
    const collected: string[] = []
    const emails = item.emails
    if (Array.isArray(emails)) {
      for (const e of emails) {
        if (typeof e === 'string') collected.push(e)
        else if (e && typeof e === 'object' && typeof (e as { value?: unknown }).value === 'string') {
          collected.push((e as { value: string }).value)
        }
      }
    }
    if (typeof item.primary_email === 'string') collected.push(item.primary_email)
    return collected.some((v) => v.trim().toLowerCase() === target)
  }

  /**
   * Bepaal via getPerson of een persoon een org-koppeling heeft.
   *   - `'has'`     : persoon hangt aan een org (org_id gevuld).
   *   - `'none'`    : persoon heeft zeker geen org (veld aanwezig maar leeg).
   *   - `'unknown'` : niet te bepalen (getPerson-fout of onverwachte vorm).
   * Alleen `'none'` is veilig om aan de gekozen org te koppelen.
   */
  private async resolvePersonOrgId(personId: number): Promise<'has' | 'none' | 'unknown'> {
    try {
      const p = (await this.pd.getPerson(personId)) as Record<string, unknown>
      const data = ((p?.data ?? p) ?? {}) as Record<string, unknown>
      const direct = data.org_id
      if (typeof direct === 'number') return 'has'
      const org = data.organization as { id?: unknown } | null | undefined
      if (org && typeof org.id === 'number') return 'has'
      // Veld expliciet aanwezig maar leeg/null -> persoon heeft geen org.
      if (direct === null || org === null || 'org_id' in data || 'organization' in data) {
        return 'none'
      }
      // Vorm niet herkend -> niet koppelen.
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Vul lege velden van een bestaande org aan met de gewenste payload, zonder
   * bestaande waarden te overschrijven. Vergelijkt via V2 (custom_fields-wrapper)
   * zodat de veld-representaties matchen. Doet alleen een PATCH als er iets aan
   * te vullen valt.
   */
  private async fillEmptyOrgFields(
    orgId: number,
    desired: ReturnType<typeof buildOrgPayload>,
  ): Promise<void> {
    let existing: { custom_fields?: Record<string, unknown>; [k: string]: unknown }
    try {
      existing = await this.pd.getOrganizationV2(orgId)
    } catch (e) {
      // Org niet leesbaar -> sla aanvullen over, deal-koppeling gaat door.
      console.warn(`[pipedrive-sync] getOrganizationV2(${orgId}) faalde, skip veld-aanvulling:`, e)
      return
    }

    const isEmpty = (v: unknown): boolean =>
      v === null || v === undefined || (typeof v === 'string' && v.trim().length === 0)

    const patch: {
      address?: { value: string }
      industry?: number
      employee_count?: number
      custom_fields?: Record<string, unknown>
    } = {}

    // Top-level standaardvelden - alleen aanvullen als leeg op de bestaande org.
    // V2 levert `address` als object ({ value, formatted_address, ... }); leegte
    // zit in `address.value`, niet in het object zelf. Defensief ook string toestaan.
    const existingAddr = existing.address as { value?: unknown } | string | null | undefined
    const existingAddrValue = typeof existingAddr === 'string' ? existingAddr : existingAddr?.value
    if (desired.address && isEmpty(existingAddrValue)) patch.address = desired.address
    if (desired.industry != null && isEmpty(existing.industry)) patch.industry = desired.industry
    if (
      desired.employee_count != null &&
      isEmpty(existing.employee_count)
    ) {
      patch.employee_count = desired.employee_count
    }

    // Custom fields - per key alleen aanvullen als leeg/afwezig op de bestaande org.
    const existingCustom = (existing.custom_fields ?? {}) as Record<string, unknown>
    const customPatch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(desired.custom_fields)) {
      if (isEmpty(value)) continue
      if (isEmpty(existingCustom[key])) customPatch[key] = value
    }
    if (Object.keys(customPatch).length > 0) patch.custom_fields = customPatch

    if (Object.keys(patch).length === 0) return
    await this.pd.updateOrganizationV2(orgId, patch)
  }

  private async markFailed(
    runId: string,
    error: string,
    partial: {
      pipedrive_org_id: number | null
      pipedrive_deal_id: number | null
      pipedrive_person_ids: number[]
    },
  ): Promise<SyncResult> {
    await this.supabase
      .from('sales_lead_runs')
      .update({ status: 'failed', error, updated_at: new Date().toISOString() })
      .eq('id', runId)
    return {
      status: 'failed',
      error,
      partial,
    }
  }

  /**
   * Resolve het Pipedrive Hoofddomein-option-ID:
   *   1. strategy='fixed' → owner.hoofddomein_fixed_option_id
   *   2. strategy='auto_match_by_address' → platforms.regio_platform = master.hoofddomein
   * Returnt null als geen mapping bestaat — caller skipt het custom-field.
   */
  private async resolveHoofddomeinOptionId(
    owner: OwnerConfigForSync,
    hoofddomeinLabel: string | undefined,
  ): Promise<number | null> {
    if (owner.hoofddomein_strategy === 'fixed') {
      return owner.hoofddomein_fixed_option_id ?? null
    }
    if (!hoofddomeinLabel) return null
    const { data, error } = await this.supabase
      .from('platforms')
      .select('pipedrive_hoofddomein_option_id')
      .eq('regio_platform', hoofddomeinLabel)
      .maybeSingle()
    if (error || !data) return null
    return data.pipedrive_hoofddomein_option_id ?? null
  }

  /**
   * Resolve contactmoment-datum voor Pipedrive Deal:
   *   1. run.contactmoment_override (handmatig in OTIS gezet) — als YYYY-MM-DD
   *   2. nextWorkday(today, owner.contactmoment_offset_workdays) — default
   * `contactmoment_override` is in DB als `date`; Postgres serialized als
   * 'YYYY-MM-DD' string. Geen extra parsing nodig.
   */
  private resolveContactmoment(
    run: Record<string, unknown>,
    owner: OwnerConfigForSync,
  ): string {
    const override = run.contactmoment_override
    if (typeof override === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
      return override
    }
    return nextWorkday(new Date(), owner.contactmoment_offset_workdays)
  }

  /**
   * Resolve het Pipedrive Branche-enum-ID volgens 3-tier prioriteit:
   *   1. run.branche_override (sales overrule in OTIS review-pagina)
   *   2. master_record.branche_suggestion.enum_id (Mistral-classificatie)
   *   3. SBI-prefix fallback via BrancheOptionsService.findEnumIdForSbi
   * Returnt null wanneer geen enkele bron iets oplevert; caller skipt het veld.
   */
  private async resolveBrancheEnumId(
    run: Record<string, unknown>,
    master: MasterRecord,
  ): Promise<number | null> {
    const override = (run.branche_override as number | null | undefined) ?? null
    if (override != null) return override

    const suggestion = master.branche_suggestion?.enum_id
    if (typeof suggestion === 'number') return suggestion

    const firstSbi = master.industry_codes?.[0] ?? master.sbi_activities?.[0]?.code
    return await findEnumIdForSbi(firstSbi, this.supabase)
  }
}
