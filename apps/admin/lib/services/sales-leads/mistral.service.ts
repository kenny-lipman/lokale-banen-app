import type { ContactRankingResult } from './types'
import { Semaphore } from '@/lib/utils/semaphore'
import { CONTACT_RANKING_PROMPT_V1 } from './prompts/contact-ranking.v1'
import { BRANCHE_CLASSIFICATION_PROMPT_V1 } from './prompts/branche-classification.v1'

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const DEFAULT_MODEL = 'mistral-small-latest'

// Module-level cap: bij bulk-create doen N orchestrators elk 2 Mistral-calls
// (rankContacts + classifyBranche). 25 URLs x 2 = 50 calls in burst, Mistral
// paid-tier hanteert per-second-limits. Cap op 3 concurrent.
const MISTRAL_SEMAPHORE = new Semaphore(3)

type MistralResponse = {
  choices: Array<{ message: { content: string } }>
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export type MistralCallResult<T> = {
  parsed: T
  raw_content: string
  usage?: MistralResponse['usage']
}

class MistralNonRetryableError extends Error {
  constructor(message: string, public httpStatus?: number) {
    super(message)
    this.name = 'MistralNonRetryableError'
  }
}

export class MistralService {
  private readonly apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY
  }

  /**
   * JSON-mode completion. Throws bij API-fout, retry 2× met backoff bij 429/5xx.
   * `prompt` is de complete user-content; system-prompt apart.
   * Returnt geparseerde JSON volgens generic type T.
   */
  async completeJson<T = unknown>(opts: {
    systemPrompt: string
    userPrompt: string
    model?: string
    maxTokens?: number
  }): Promise<MistralCallResult<T>> {
    return MISTRAL_SEMAPHORE.run(() => this.completeJsonUnlimited<T>(opts))
  }

  private async completeJsonUnlimited<T = unknown>(opts: {
    systemPrompt: string
    userPrompt: string
    model?: string
    maxTokens?: number
  }): Promise<MistralCallResult<T>> {
    if (!this.apiKey) throw new Error('MISTRAL_API_KEY ontbreekt')

    const body = {
      model: opts.model ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      response_format: { type: 'json_object' },
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }

    let lastErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(MISTRAL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 1000))
            lastErr = new Error(`Mistral ${res.status} (retried)`)
            continue
          }
          const text = await res.text()
          throw new MistralNonRetryableError(`Mistral ${res.status}: ${text.slice(0, 200)}`, res.status)
        }
        const data = (await res.json()) as MistralResponse
        const content = data.choices?.[0]?.message?.content
        if (!content) throw new MistralNonRetryableError('Mistral lege response')
        let parsed: T
        try {
          parsed = JSON.parse(content) as T
        } catch {
          throw new MistralNonRetryableError(`Mistral non-JSON response: ${content.slice(0, 200)}`)
        }
        return { parsed, raw_content: content, usage: data.usage }
      } catch (e) {
        if (e instanceof MistralNonRetryableError) throw e
        lastErr = e
        if (attempt === 2) break
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Mistral failed after retries')
  }

  async health(): Promise<{ ok: boolean; latency_ms: number; message?: string }> {
    if (!this.apiKey) return { ok: false, latency_ms: 0, message: 'MISTRAL_API_KEY ontbreekt' }
    const t0 = Date.now()
    try {
      const res = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      })
      return {
        ok: res.ok,
        latency_ms: Date.now() - t0,
        message: res.ok ? undefined : `HTTP ${res.status}`,
      }
    } catch (e) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  /**
   * Classificeer een bedrijf in 1 van de beschikbare Pipedrive branche-opties.
   * Returnt null bij Mistral-fail (caller valt terug op SBI-mapping via service).
   * Valideert enum_id tegen `availableBranches` om hallucinatie te voorkomen.
   */
  async classifyBranche(opts: {
    company_name: string | null
    industry: string | null
    sbi_activities: Array<{ code: string; description: string }>
    description: string | null
    vacancy_titles: string[]
    availableBranches: Array<{ enum_id: number; label: string }>
  }): Promise<{ enum_id: number; label: string; confidence: number; reasoning: string } | null> {
    if (opts.availableBranches.length === 0) return null

    const branchesList = opts.availableBranches
      .map((b) => `  - enum_id=${b.enum_id}: "${b.label}"`)
      .join('\n')
    const sbiList = opts.sbi_activities.length > 0
      ? opts.sbi_activities.map((s) => `${s.code} ${s.description}`).join('; ')
      : 'onbekend'
    const vacanciesList = opts.vacancy_titles.length > 0
      ? opts.vacancy_titles.slice(0, 8).join(', ')
      : 'geen vacatures bekend'

    const userPrompt = BRANCHE_CLASSIFICATION_PROMPT_V1
      .replace('{company_name}', opts.company_name ?? 'onbekend')
      .replace('{industry}', opts.industry ?? 'onbekend')
      .replace('{sbi_activities}', sbiList)
      .replace('{description}', opts.description ?? 'geen beschrijving')
      .replace('{vacancies}', vacanciesList)
      .replace('{available_branches}', branchesList)

    try {
      const r = await this.completeJson<{ enum_id: number; confidence: number; reasoning: string }>({
        systemPrompt:
          'Je bent een B2B sales-analyst. Classificeer in EXACT een van de gegeven enum_ids. Geef alleen geldig JSON terug.',
        userPrompt,
        maxTokens: 200,
      })
      const enumId = Number(r.parsed.enum_id)
      const match = opts.availableBranches.find((b) => b.enum_id === enumId)
      if (!match) {
        console.warn(`[mistral] classifyBranche returned unknown enum_id=${enumId}; ignoring`)
        return null
      }
      const confidence = Math.max(0, Math.min(100, Math.round(Number(r.parsed.confidence) || 0)))
      return {
        enum_id: enumId,
        label: match.label,
        confidence,
        reasoning: String(r.parsed.reasoning ?? '').slice(0, 200),
      }
    } catch (e) {
      console.warn('[mistral] classifyBranche faalde:', e)
      return null
    }
  }

  /**
   * Rangschik kandidaten op WeTarget-prioriteit. Geeft top-2 + reden.
   * Bij Mistral-fail: alfabetische top-2 fallback (sectie 6.6 spec).
   */
  async rankContacts(opts: {
    contacts: Array<{
      name: string
      title?: string
      seniority?: string
      department?: string
      email?: string
      email_verified?: boolean
      linkedin_url?: string
      source_origin: string[]
    }>
    company_name?: string
    industry?: string
    employee_count?: number
    departmental_head_count?: Record<string, number>
  }): Promise<ContactRankingResult> {
    if (opts.contacts.length === 0) {
      return { person_1: null, person_2: null, fallback_used: false }
    }
    const userPrompt = CONTACT_RANKING_PROMPT_V1
      .replace('{json_array_of_contacts_with_metadata}', JSON.stringify(opts.contacts, null, 2))
      .replace('{company_name}', opts.company_name ?? 'onbekend')
      .replace('{industry}', opts.industry ?? 'onbekend')
      .replace('{employee_count}', String(opts.employee_count ?? '?'))
      .replace('{departmental_head_count_apollo}', JSON.stringify(opts.departmental_head_count ?? {}))
    try {
      const r = await this.completeJson<ContactRankingResult>({
        systemPrompt: 'Je bent een B2B sales-strategie expert. Geef alleen geldig JSON terug.',
        userPrompt,
      })
      return r.parsed
    } catch {
      // Fallback: alfabetische top-2 (sectie 6.6)
      const sorted = [...opts.contacts].sort((a, b) => a.name.localeCompare(b.name))
      return {
        person_1: sorted[0]
          ? { name: sorted[0].name, score: 50, reason: 'Mistral-fallback: alfabetisch' }
          : null,
        person_2: sorted[1]
          ? { name: sorted[1].name, score: 50, reason: 'Mistral-fallback: alfabetisch' }
          : null,
        fallback_used: true,
      }
    }
  }
}
