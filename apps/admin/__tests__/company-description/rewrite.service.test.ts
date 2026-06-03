import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rewriteCompanyDescription } from '@/lib/services/company-description/rewrite.service'

const realFetch = globalThis.fetch

function mockFetch(impl: (...args: any[]) => any) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

describe('rewriteCompanyDescription', () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = 'test-key'
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('parseert de Mistral-respons naar { description }', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                description: 'Humankind biedt kinderopvang en ontwikkeling in de regio Midden-Brabant.',
              }),
            },
          },
        ],
      }),
    }))

    const result = await rewriteCompanyDescription({
      name: 'Humankind',
      city: 'Leusden',
      sourceText: 'Humankind is een organisatie voor kinderopvang en ontwikkeling in Nederland. '.repeat(2),
    })

    expect(result.description).toContain('kinderopvang')
  })

  it('gooit een fout als de brontekst te kort is', async () => {
    await expect(
      rewriteCompanyDescription({ name: 'X', city: null, sourceText: 'te kort' }),
    ).rejects.toThrow(/te kort/i)
  })
})
