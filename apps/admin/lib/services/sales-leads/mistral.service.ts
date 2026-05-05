const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const DEFAULT_MODEL = 'mistral-small-latest'

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
}
