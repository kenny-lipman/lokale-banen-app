import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runActorSync, ApifyApiError } from '@/lib/services/apify/run-actor-sync'

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_TOKEN = process.env.APIFY_TOKEN

function mockFetch(impl: () => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

beforeEach(() => {
  process.env.APIFY_TOKEN = 'test_token'
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_TOKEN) process.env.APIFY_TOKEN = ORIGINAL_TOKEN
  else delete process.env.APIFY_TOKEN
  vi.restoreAllMocks()
})

describe('runActorSync', () => {
  it('throws no_token wanneer APIFY_TOKEN ontbreekt', async () => {
    delete process.env.APIFY_TOKEN
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'no_token' })
  })

  it('returnt array bij 200 + JSON-array', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify([{ a: 1 }, { a: 2 }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const out = await runActorSync<{ a: number }>({ actorId: 'foo~bar', input: {} })
    expect(out).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('throws auth bij 401', async () => {
    mockFetch(async () => new Response('unauth', { status: 401 }))
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'auth', httpStatus: 401 })
  })

  it('throws auth bij 403', async () => {
    mockFetch(async () => new Response('forbidden', { status: 403 }))
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'auth', httpStatus: 403 })
  })

  it('throws timeout bij 504', async () => {
    mockFetch(async () => new Response('gateway timeout', { status: 504 }))
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'timeout', httpStatus: 504 })
  })

  it('throws actor_failed bij 500', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }))
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'actor_failed', httpStatus: 500 })
  })

  it('throws actor_failed wanneer body niet-JSON is', async () => {
    mockFetch(async () =>
      new Response('<html>nope</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'actor_failed' })
  })

  it('throws actor_failed wanneer response geen array is', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      runActorSync({ actorId: 'foo~bar', input: {} }),
    ).rejects.toMatchObject({ reason: 'actor_failed' })
  })

  it('stuurt Bearer-token in Authorization header (geen ?token=)', async () => {
    let captured: { url?: string; headers?: Headers } = {}
    mockFetch(async (...args: Parameters<typeof fetch>) => {
      captured = { url: args[0] as string, headers: new Headers((args[1] as RequestInit).headers) }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    })
    await runActorSync({ actorId: 'compass~crawler-google-places', input: { foo: 'bar' } })
    expect(captured.url).toContain('/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items')
    expect(captured.url).not.toContain('token=')
    expect(captured.headers?.get('authorization')).toBe('Bearer test_token')
    expect(captured.headers?.get('content-type')).toBe('application/json')
  })
})
