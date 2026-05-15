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
} from './internal-linking'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MasterRecord, NormalizedContact, NormalizedVacancy } from './types'

type SB = SupabaseClient

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
  private pd = getPipedriveClient()
  private supabase: SB
  constructor(supabase?: SB) {
    this.supabase = supabase ?? (createServiceRoleClient() as unknown as SB)
  }

  async syncLeadToPipedrive(runId: string, forceDuplicate = false): Promise<SyncResult> {
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

    // 1. Dedupe (skipt als al pipedrive_org_id, of forceDuplicate=true)
    if (!forceDuplicate && !run.pipedrive_org_id) {
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

    try {
      // 3. Org. createOrganizationV2 want buildOrgPayload levert V2-format
      // (`custom_fields` wrapper) — V1 endpoint zou de keys negeren of 400 geven.
      if (!orgId) {
        const hoofddomeinOptionId = await this.resolveHoofddomeinOptionId(owner, master.hoofddomein ?? undefined)
        const orgPayload = buildOrgPayload(master, owner, { hoofddomeinOptionId })
        const created = await this.pd.createOrganizationV2(orgPayload)
        orgId = created.id
        await this.supabase
          .from('sales_lead_runs')
          .update({ pipedrive_org_id: orgId, updated_at: new Date().toISOString() })
          .eq('id', runId)
      }

      // 4. Persons (idempotent: only create persons beyond what's already in personIds[])
      const selected = (run.selected_contacts as unknown as NormalizedContact[]) ?? []
      for (let i = personIds.length; i < selected.length; i++) {
        const personPayload = buildPersonPayload(selected[i], orgId, owner)
        const newPerson = await this.pd.createPerson(
          personPayload as unknown as PipedrivePerson,
        )
        const newId = (newPerson as { id: number }).id
        personIds.push(newId)
        await this.supabase
          .from('sales_lead_runs')
          .update({ pipedrive_person_ids: personIds, updated_at: new Date().toISOString() })
          .eq('id', runId)
      }

      // 5. Deal
      if (!dealId) {
        const cmDate = nextWorkday(new Date(), owner.contactmoment_offset_workdays)
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
      // in finalize() aangemaakt; vacancies krijgen source_id=null tot V1B
      // de echte scrape-koppeling levert.
      const company = await upsertCompanyFromRun(this.supabase, {
        id: runId,
        input_domain: run.input_domain,
        input_url: run.input_url,
        pipedrive_org_id: orgId,
        master_record: master,
      })

      const vacancies = (master.vacancies ?? []) as NormalizedVacancy[]
      if (vacancies.length > 0) {
        await upsertJobPostingsFromRun(this.supabase, {
          company_id: company.id,
          source_id: null,
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
}
