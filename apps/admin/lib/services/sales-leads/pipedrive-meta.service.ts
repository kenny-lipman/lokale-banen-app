import { createServiceRoleClient } from '@/lib/supabase-server'
import { cachedFetch, invalidateCacheSource, type CacheSource } from './cache'
import type {
  PipedriveUser,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveDealField,
  OwnerConfigTestResult,
} from './types'

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY
const PIPEDRIVE_V1_BASE = (process.env.PIPEDRIVE_API_URL ?? 'https://lokalebanen.pipedrive.com/api/v2')
  .replace(/\/v2\/?$/, '/v1')

export class PipedriveMetaService {
  private supabase = createServiceRoleClient()

  private async cached<T>(source: CacheSource, cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const { value } = await cachedFetch(source, cacheKey, '1h', fetcher)
    return value
  }

  private async pdFetch(path: string): Promise<unknown> {
    if (!PIPEDRIVE_API_KEY) throw new Error('PIPEDRIVE_API_KEY ontbreekt')
    const sep = path.includes('?') ? '&' : '?'
    const url = `${PIPEDRIVE_V1_BASE}${path}${sep}api_token=${PIPEDRIVE_API_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Pipedrive ${path} failed: ${res.status}`)
    const json = await res.json()
    if (json.success === false) throw new Error(`Pipedrive error: ${json.error ?? 'unknown'}`)
    return json.data
  }

  async getUsers(): Promise<PipedriveUser[]> {
    return this.cached('pipedrive_users', 'all', async () => {
      const data = (await this.pdFetch('/users')) as Array<{
        id: number; name: string; email: string; active_flag: boolean
      }>
      return data
        .filter((u) => u.active_flag)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, active_flag: u.active_flag }))
    })
  }

  async getPipelines(): Promise<PipedrivePipeline[]> {
    return this.cached('pipedrive_pipelines', 'all', async () => {
      const data = (await this.pdFetch('/pipelines')) as Array<{
        id: number; name: string; active: boolean; order_nr: number
      }>
      return data.filter((p) => p.active)
    })
  }

  async getStages(pipelineId: number): Promise<PipedriveStage[]> {
    return this.cached('pipedrive_stages', String(pipelineId), async () => {
      const data = (await this.pdFetch(`/stages?pipeline_id=${pipelineId}`)) as Array<{
        id: number; name: string; pipeline_id: number; order_nr: number
      }>
      return data.sort((a, b) => a.order_nr - b.order_nr)
    })
  }

  async getHoofddomeinOptions(): Promise<Array<{ id: number; label: string }>> {
    return this.cached('pipedrive_org_fields', 'hoofddomein', async () => {
      const data = (await this.pdFetch('/organizationFields?limit=500')) as Array<{
        key: string
        name: string
        field_type: string
        options?: Array<{ id: number; label: string }>
      }>
      // 7180a712… = Hoofddomein enum (zie pipedrive-fields.ts ORG_FIELD_KEYS).
      const field = data.find((f) => f.key === '7180a7123d1de658e8d1d642b8496802002ddc66')
      if (!field?.options) return []
      return field.options.map((o) => ({ id: o.id, label: o.label }))
    })
  }

  async getDateDealFields(): Promise<PipedriveDealField[]> {
    return this.cached('pipedrive_deal_fields_date', 'all', async () => {
      const data = (await this.pdFetch('/dealFields')) as Array<PipedriveDealField>
      return data.filter((f) => f.field_type === 'date' && f.edit_flag && !f.mandatory_flag)
    })
  }

  async testConfig(opts: {
    pipedrive_user_id: number
    pipedrive_pipeline_id: number
    pipedrive_default_stage_id: number
    contactmoment_field_key: string | null
  }): Promise<OwnerConfigTestResult> {
    const result: OwnerConfigTestResult = {
      ok: false,
      checks: {
        user: { ok: false },
        pipeline: { ok: false },
        stage: { ok: false },
        deal_field: { ok: false },
      },
    }

    const users = await this.getUsers()
    const user = users.find((u) => u.id === opts.pipedrive_user_id)
    result.checks.user = user
      ? { ok: true, message: `${user.name} (${user.email})` }
      : { ok: false, message: `User ${opts.pipedrive_user_id} niet gevonden of inactief` }

    const pipelines = await this.getPipelines()
    const pipeline = pipelines.find((p) => p.id === opts.pipedrive_pipeline_id)
    result.checks.pipeline = pipeline
      ? { ok: true, message: pipeline.name }
      : { ok: false, message: `Pipeline ${opts.pipedrive_pipeline_id} niet gevonden of inactief` }

    if (pipeline) {
      const stages = await this.getStages(pipeline.id)
      const stage = stages.find((s) => s.id === opts.pipedrive_default_stage_id)
      result.checks.stage = stage
        ? { ok: true, message: `${stage.name} (order ${stage.order_nr})` }
        : { ok: false, message: `Stage ${opts.pipedrive_default_stage_id} hoort niet bij pipeline ${pipeline.name}` }
    } else {
      result.checks.stage = { ok: false, message: 'Pipeline ontbreekt — kan stage niet valideren' }
    }

    if (opts.contactmoment_field_key === null) {
      result.checks.deal_field = { ok: true, message: 'Geen contactmoment ingesteld (toegestaan)' }
    } else {
      const fields = await this.getDateDealFields()
      const field = fields.find((f) => f.key === opts.contactmoment_field_key)
      result.checks.deal_field = field
        ? { ok: true, message: field.name }
        : { ok: false, message: `Date-veld met key ${opts.contactmoment_field_key} niet gevonden` }
    }

    result.ok = Object.values(result.checks).every((c) => c.ok)
    return result
  }

  async invalidateCache(source?: CacheSource): Promise<void> {
    if (source) {
      await invalidateCacheSource(source)
    } else {
      const sources: CacheSource[] = [
        'pipedrive_users',
        'pipedrive_pipelines',
        'pipedrive_stages',
        'pipedrive_deal_fields_date',
      ]
      for (const s of sources) await invalidateCacheSource(s)
    }
  }
}
