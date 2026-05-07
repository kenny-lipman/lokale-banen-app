# Vervang Google Maps API door Apify Google Maps Scraper

**Datum**: 2026-05-06
**Trigger**: Kosten ($34/1000 → $2.10/1000) maar vooral: top-3 candidates voor user-selectie i.p.v. auto-pick top-1.

## Scope
- Volledige replacement: Google Places API code weg, Apify-actor `compass/crawler-google-places` (ID `nwua9Gu5YrADL7ZDj`) ervoor in de plaats
- `MapsService` levert top-3 candidates terug
- UI in detail-panel laat user candidate switchen
- Switchen recomputeert master_record server-side
- Caching blijft (30d), nieuwe cache-key-prefix zodat oude Google-cache-rijen niet conflicteren

## Out of scope
- Apify residential proxy voor website-scraping (besluit uitgesteld na 2 weken meten)
- Multi-location actor input (we gebruiken alleen `searchStringsArray` + fixed `locationQuery: "Netherlands"`)

## Acceptance criteria
- Maps-source returnt top-3 candidates in `enrichments.google_maps.candidates[]`, eerste is default `parsed`
- Detail-panel toont 3 candidate-cards met "Selecteer als beste" knop
- Promoten van candidate triggert master-record recompute (server-side)
- Latency p95 < 30s voor Maps-bron (Apify sync run)
- Geen Google Places API calls meer in de codebase
- Bestaande cache blijft intact maar wordt niet gebruikt — nieuwe runs vullen Apify-cache

## Open keuzes (defaults aangenomen, override per item)

1. **`maxCrawledPlacesPerSearch: 3`** — top-3 candidates terug. ✅ Per user akkoord.
2. **`locationQuery: "Netherlands"`** — fixed, geen per-run dynamische stad. ✅ Per user akkoord.
3. **Promote-actie overschrijft user-edits in master_record**: V1 → ja, met confirm-dialog. V2 → veld-niveau merge.
4. **Cache-key**: `apify_maps:{query}` met 30d TTL. Oude `google_maps_*` cache-rijen worden niet meer geraakt — laten staan tot natuurlijke expiry.
5. **`language: "nl"`** in actor input zodat opening_hours en categorieën NL-locale leveren.

---

## Fase M-1 — Apify HTTP client helper (~1.5u)

Nieuwe file: `apps/admin/lib/services/apify/run-actor-sync.ts`

```ts
const APIFY_BASE = 'https://api.apify.com/v2'

export class ApifyApiError extends Error {
  constructor(
    public reason: 'no_token' | 'auth' | 'timeout' | 'actor_failed' | 'no_results' | 'unknown',
    message: string,
    public httpStatus?: number,
  ) {
    super(message)
    this.name = 'ApifyApiError'
  }
}

/**
 * Run Apify actor synchronously and return dataset items.
 * Endpoint: POST /v2/acts/{actorId}/run-sync-get-dataset-items
 *
 * Returns parsed JSON array van dataset items. Apify timeout = 5 min hard cap.
 * Caller mag dit lager zetten via `runTimeoutSecs` in input.
 */
export async function runActorSync<TItem>(opts: {
  actorId: string             // bv. 'compass~crawler-google-places' of '17-char-id'
  input: Record<string, unknown>
  timeoutMs?: number          // local fetch timeout; max 295s ivm Apify cap
}): Promise<TItem[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new ApifyApiError('no_token', 'APIFY_TOKEN ontbreekt')

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000)
  try {
    const url = `${APIFY_BASE}/acts/${opts.actorId}/run-sync-get-dataset-items`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(opts.input),
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) {
      throw new ApifyApiError('auth', `Apify ${res.status}`, res.status)
    }
    if (res.status === 408 || res.status === 504) {
      throw new ApifyApiError('timeout', `Apify timeout ${res.status}`, res.status)
    }
    if (res.status >= 500 || !res.ok) {
      const body = await res.text().catch(() => '')
      throw new ApifyApiError('actor_failed', `Apify ${res.status}: ${body.slice(0, 200)}`, res.status)
    }
    return (await res.json()) as TItem[]
  } finally {
    clearTimeout(timeout)
  }
}
```

→ **Verify**: unit-test met mock fetch (vitest):
- 401 → `ApifyApiError('auth')`
- 504 → `ApifyApiError('timeout')`
- 200 + array → returnt array
- 200 + niet-JSON → throw

## Fase M-2 — Vervang MapsService implementatie (~3u)

File: `apps/admin/lib/services/sales-leads/maps.service.ts`

Geheel herschrijven. Behoud externe interface (`enrichByQuery(query)` returns `NormalizedFields`) **plus** nieuwe methode `enrichByQueryMulti(query)` returns `NormalizedFields[]` voor top-3.

```ts
import { runActorSync, ApifyApiError } from '@/lib/services/apify/run-actor-sync'
import { cachedFetch } from './cache'
import type { NormalizedFields, SourceHealth } from './types'

// Compass/crawler-google-places output schema (subset).
type ApifyGoogleMapsItem = {
  title: string
  placeId: string
  address: string | null
  street: string | null
  city: string | null
  postalCode: string | null
  state: string | null
  countryCode: string | null
  neighborhood: string | null
  location: { lat: number; lng: number }
  categories: string[]
  categoryName: string | null
  phone: string | null
  phoneUnformatted: string | null
  website: string
  totalScore: number | null
  reviewsCount: number | null
  permanentlyClosed: boolean
  temporarilyClosed: boolean
  openingHours: Array<{ day: string; hours: string }>
  imagesCount: number
  url: string
  rank: number
}

const ACTOR_ID = 'compass~crawler-google-places'
const MAX_CANDIDATES = 3

export class MapsApiError extends Error {
  constructor(
    public reason: 'no_key' | 'not_found' | 'rate_limited' | 'denied' | 'timeout' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'MapsApiError'
  }
}

export class MapsService {
  /**
   * Top-N candidates voor één query. Eerste candidate = best match (Apify rank).
   */
  async enrichByQueryMulti(query: string): Promise<NormalizedFields[]> {
    const cacheKey = `apify_maps:${query.toLowerCase().trim()}`
    const { value: items } = await cachedFetch('apify_maps', cacheKey, '30d', async () => {
      try {
        return await runActorSync<ApifyGoogleMapsItem>({
          actorId: ACTOR_ID,
          input: {
            searchStringsArray: [query],
            locationQuery: 'Netherlands',
            maxCrawledPlacesPerSearch: MAX_CANDIDATES,
            language: 'nl',
            skipClosedPlaces: false,
          },
          timeoutMs: 90_000,
        })
      } catch (e) {
        if (e instanceof ApifyApiError) {
          if (e.reason === 'auth') throw new MapsApiError('denied', e.message)
          if (e.reason === 'timeout') throw new MapsApiError('timeout', e.message)
          if (e.reason === 'no_token') throw new MapsApiError('no_key', e.message)
          throw new MapsApiError('unknown', e.message)
        }
        throw e
      }
    })
    if (!items || items.length === 0) {
      throw new MapsApiError('not_found', `Apify Maps geen hits voor "${query}"`)
    }
    return items.slice(0, MAX_CANDIDATES).map((it) => this.mapApifyToNormalized(it))
  }

  /** Backwards-compat: top-1 candidate. */
  async enrichByQuery(query: string): Promise<NormalizedFields> {
    const all = await this.enrichByQueryMulti(query)
    return all[0]
  }

  private mapApifyToNormalized(d: ApifyGoogleMapsItem): NormalizedFields {
    const phone = d.phone ?? d.phoneUnformatted ?? undefined
    return {
      company_name: d.title,
      address: (d.address || d.street || d.city)
        ? {
            street: d.street ?? undefined,
            postcode: d.postalCode ?? undefined,
            city: d.city ?? undefined,
            country: d.countryCode === 'NL' ? 'Nederland' : (d.countryCode ?? undefined),
            full: d.address ?? undefined,
          }
        : undefined,
      coordinates: d.location ? { lat: d.location.lat, lng: d.location.lng } : undefined,
      website: d.website,
      phone,
      phones_all: phone ? [phone] : undefined,
      rating: d.totalScore ?? undefined,
      ratings_total: d.reviewsCount ?? undefined,
      business_status: d.permanentlyClosed
        ? 'CLOSED_PERMANENTLY'
        : d.temporarilyClosed
        ? 'CLOSED_TEMPORARILY'
        : 'OPERATIONAL',
      opening_hours: (d.openingHours ?? []).map((o) => `${o.day}: ${o.hours}`),
      business_types: [d.categoryName, ...(d.categories ?? [])].filter((x): x is string => !!x),
      photos_count: d.imagesCount,
      source: 'google_maps',
    }
  }

  async health(): Promise<SourceHealth> {
    if (!process.env.APIFY_TOKEN) {
      return { ok: false, latency_ms: 0, message: 'APIFY_TOKEN ontbreekt' }
    }
    const t0 = Date.now()
    try {
      const candidates = await this.enrichByQueryMulti('WeTarget')
      return {
        ok: candidates.length > 0,
        latency_ms: Date.now() - t0,
        message: candidates.length > 0 ? undefined : 'Geen test-resultaat',
      }
    } catch (e) {
      const msg = e instanceof MapsApiError ? `${e.reason}` : String(e)
      return { ok: false, latency_ms: Date.now() - t0, message: msg }
    }
  }
}
```

Verwijder volledig:
- `PLACES_BASE` constante
- `findPlace`, `getPlaceDetails` methodes
- `FindPlaceResponse`, `PlaceDetailsResponse` types
- `PLACE_DETAIL_FIELDS` constante

→ **Verify**: `pnpm typecheck` clean.

## Fase M-3 — Type-uitbreiding `PerSourceEnrichment.candidates` (~30min)

File: `apps/admin/lib/services/sales-leads/types.ts`

```ts
export type PerSourceEnrichment = {
  status: EnrichmentStatus
  started_at?: string
  completed_at?: string
  raw?: unknown
  parsed?: NormalizedFields
  /** Alternatieve candidates, alleen voor sources die multi-result ondersteunen (V1: alleen google_maps). */
  candidates?: NormalizedFields[]
  /** Index in candidates[] die nu actief is als parsed. Default 0. */
  selected_candidate_index?: number
  error?: string
}
```

Geen DB-migratie nodig — `enrichments` is `jsonb`, accepteert nieuwe velden zonder schema-wijziging.

→ **Verify**: `pnpm typecheck` clean. Geen runtime-impact op bestaande consumers (velden zijn optioneel).

## Fase M-4 — Orchestrator: store candidates (~30min)

File: `apps/admin/lib/services/sales-leads/enrichment-orchestrator.service.ts`

In `runMaps`:

```ts
private async runMaps(runId: string, domain: string): Promise<void> {
  const startedAt = new Date().toISOString()
  await this.markRunning(runId, 'google_maps', startedAt)
  const t0 = Date.now()
  try {
    const naamGuess = domainToCompanyGuess(domain)
    const candidates = await this.maps.enrichByQueryMulti(naamGuess)
    // parsed = eerste candidate (default-keuze); user kan later switchen via UI
    await this.setSource(runId, 'google_maps', {
      status: 'completed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      parsed: candidates[0],
      candidates,
      selected_candidate_index: 0,
    })
    await this.appendAudit(runId, this.audit('google_maps', `apify:${candidates.length}`, t0, 'ok'))
  } catch (e) {
    const reason = e instanceof MapsApiError ? e.reason : 'unknown'
    const status = reason === 'not_found' ? 'not_found' : 'failed'
    await this.failSource(runId, 'google_maps', startedAt, e, status)
    await this.appendAudit(runId, this.audit('google_maps', 'apify', t0, status, e))
  }
}
```

→ **Verify**: bestaande Maps-flow werkt nog (alleen completeSource → setSource met candidates).

## Fase M-5 — API endpoint voor candidate-promotion (~2u)

Nieuwe route: `apps/admin/app/api/sales-leads/[id]/promote-candidate/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { computePrimaryMaster } from '@/lib/services/sales-leads/master-record'
import { generateDealNote } from '@/lib/services/sales-leads/auto-note'
import type { Json } from '@/lib/supabase'
import type { RunEnrichments } from '@/lib/services/sales-leads/types'

type RouteContext = { params: Promise<{ id: string }> }

async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as
    | { source?: 'google_maps'; index?: number }
    | null
  if (!body || body.source !== 'google_maps' || typeof body.index !== 'number') {
    return NextResponse.json({ error: 'source=google_maps + index required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: run, error } = await supabase
    .from('sales_lead_runs')
    .select('id,status,input_url,enrichments,master_record')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  const enrichments = (run.enrichments ?? {}) as RunEnrichments
  const mapsEntry = enrichments.google_maps
  const candidates = mapsEntry?.candidates
  if (!candidates || body.index < 0 || body.index >= candidates.length) {
    return NextResponse.json({ error: 'Index buiten range' }, { status: 400 })
  }

  // Update enrichments via atomic rpc
  const newEntry = {
    ...mapsEntry,
    parsed: candidates[body.index],
    selected_candidate_index: body.index,
  }
  const { error: setErr } = await supabase.rpc('sales_lead_runs_set_source', {
    p_run_id: id,
    p_source: 'google_maps',
    p_value: newEntry as unknown as Json,
  })
  if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 })

  // Recompute master_record en deal-note voor de Maps-velden.
  // We mergen MET de bestaande user-edits: alleen Maps-eigen velden worden vervangen.
  const updatedEnrichments = { ...enrichments, google_maps: newEntry }
  const fresh = computePrimaryMaster(updatedEnrichments, run.input_url)
  const existing = (run.master_record ?? {}) as typeof fresh

  // Maps-eigen velden (uit FIELD_PRIORITY): address, coordinates, rating, ratings_total,
  // business_status, opening_hours, business_types, photos_count
  // Andere velden behouden user-edits.
  const merged = {
    ...existing,
    address: fresh.address ?? existing.address,
    coordinates: fresh.coordinates ?? existing.coordinates,
    rating: fresh.rating ?? existing.rating,
    ratings_total: fresh.ratings_total ?? existing.ratings_total,
    business_status: fresh.business_status ?? existing.business_status,
    opening_hours: fresh.opening_hours ?? existing.opening_hours,
    business_types: fresh.business_types ?? existing.business_types,
    photos_count: fresh.photos_count ?? existing.photos_count,
  }
  merged.deal_note_text = generateDealNote({
    master: merged,
    enrichments: updatedEnrichments,
    selectedVacancies: merged.vacancies ?? [],
  })

  const { error: updErr } = await supabase
    .from('sales_lead_runs')
    .update({ master_record: merged as unknown as Json, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, selected_index: body.index, master_record: merged })
}

export const POST = withAuth(handler)
```

→ **Verify**:
- POST `/api/sales-leads/{id}/promote-candidate` met `{source:'google_maps', index:1}` → 200, master_record bevat candidates[1] address
- index buiten range → 400
- run zonder candidates → 400

## Fase M-6 — UI candidate-picker (~3u)

Files:
1. `apps/admin/components/sales/lead-source-detail-panel.tsx` — voor Maps-source een nieuw blok "Candidates (3)" met cards
2. `apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx` — fetch om master_record te re-syncen na promote

Component-toevoeging in detail-panel (alleen wanneer `source === 'google_maps'` en `entry.candidates`):

```tsx
{source === 'google_maps' && entry.candidates && entry.candidates.length > 1 && (
  <div className="mt-4 space-y-2">
    <h4 className="text-sm font-medium">Candidates ({entry.candidates.length})</h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {entry.candidates.map((c, i) => {
        const isActive = (entry.selected_candidate_index ?? 0) === i
        return (
          <Card key={i} className={isActive ? 'ring-2 ring-orange-500' : ''}>
            <CardContent className="p-3 text-xs">
              <div className="font-medium truncate">{c.company_name}</div>
              <div className="text-gray-500 truncate">{c.address?.full ?? '—'}</div>
              <div className="mt-1">
                {c.rating ? `${c.rating}★ (${c.ratings_total})` : 'Geen rating'}
              </div>
              <Button
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                disabled={isActive || promoting}
                onClick={() => onPromote(i)}
                className="mt-2 w-full"
              >
                {isActive ? 'Geselecteerd' : 'Selecteer'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  </div>
)}
```

`onPromote(i)` callback:
```ts
async function onPromote(index: number) {
  setPromoting(true)
  try {
    const res = await fetch(`/api/sales-leads/${runId}/promote-candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'google_maps', index }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    // Trigger refetch op parent
    await refetch()
    toast({ title: 'Candidate geselecteerd' })
  } catch (e) {
    toast({ title: 'Promote mislukt', description: (e as Error).message, variant: 'destructive' })
  } finally {
    setPromoting(false)
  }
}
```

`refetch` + `runId` worden via props doorgegeven vanuit `[run_id]/page.tsx`.

**Confirm-dialog overslaan in V1**: master-record fields die door Maps gevuld zijn (address/coordinates/rating/etc) worden zonder waarschuwing overschreven. Wel duidelijke toast.

→ **Verify**:
- 3 candidate-cards zichtbaar bij Maps-source
- Click op niet-actieve → master.address verandert in UI binnen 2s
- Active card heeft oranje ring
- Bij faal: toast met error

## Fase M-7 — Verificatie (~1u)

### Smoke
1. Nieuwe enrichment voor `wetarget.nl`:
   - Maps krijgt 3 candidates terug
   - Master.address = candidates[0].address
   - User klikt candidate[1] → master.address verandert
   - Audit-log toont `apify:3` en `apify:0` voor faal-scenarios

2. Domein zonder match (bv. niet-bestaand bedrijf):
   - Apify returnt 0 places → MapsApiError('not_found') → google_maps source = `not_found` (terminale state)

3. Domein met 1 match:
   - candidates.length === 1 → UI verbergt picker (`length > 1` voorwaarde)

### Audit-log query
```sql
SELECT
  elem->>'endpoint' AS endpoint,
  elem->>'status' AS status,
  avg((elem->>'duration_ms')::int) AS avg_ms,
  count(*) FILTER (WHERE elem->>'status' = 'ok') AS ok_count,
  count(*) FILTER (WHERE elem->>'status' = 'failed') AS fail_count
FROM sales_lead_runs, jsonb_array_elements(audit_log) elem
WHERE created_at > now() - interval '24h'
  AND elem->>'source' = 'google_maps'
GROUP BY 1, 2;
```

→ **Verify**: na 24u: avg_ms < 30s p95, fail_count < 5%.

### Cost-monitor (Apify dashboard)
Apify Console → Compute units consumed voor `compass/crawler-google-places`. Eerste week: zou rond ~$3/mnd moeten zitten bij 50 enrichments/dag.

---

## Volgorde

1. **M-1** — Apify HTTP client (1.5u, geen dependencies)
2. **M-3** — Types (30min, blokkeert M-4)
3. **M-2** — MapsService herschrijven (3u, na M-1)
4. **M-4** — Orchestrator (30min, na M-2 + M-3)
5. **M-5** — Promote-endpoint (2u, na M-3)
6. **M-6** — UI candidate-picker (3u, na M-5)
7. **M-7** — Smoke + monitor (1u, laatste)

**Totaal**: ~11u werk.

## Pre-execute checklist

Voordat ik start moet je hebben:
- ✅ `APOLLO_API_KEY` op Vercel (al gedaan)
- ❓ `APIFY_TOKEN` op Vercel — bestaat die al ergens, of moet je hem aanmaken via Apify Console → Settings → Integrations → API Token?
- ❓ Apify-account met **Free of Starter+** plan (gratis $5 credit dekt eerste 2000 places)

## Risico's

- **Apify-actor down/changed**: actor dependency. Bij Google-DOM-update kunnen velden tijdelijk null zijn. Mitigatie: `mapApifyToNormalized` is defensief (alle fields nullable in mapping).
- **Sync-timeout**: Apify hard cap = 5min. Voor enkele queries onwaarschijnlijk dat dit raakt, maar `runActorSync({timeoutMs: 90_000})` als beschermingslaag.
- **Cache-pollution**: oude `google_maps_*` cache-keys blijven staan. Niet schadelijk (worden niet meer geraakt), wel ~30d disk-space gebruik. Optioneel cleanup-script.
- **Master-record overwrite**: V1 promote overschrijft Maps-eigen velden zonder confirm. Gebruiker die handmatig address bewerkte verliest die edit. Acceptabel voor V1; V2 → field-niveau merge.

## Rollback

- `git revert` van de feature-commits
- Apify-cache rijen mogen blijven staan (`apify_maps:*` keys hebben geen impact zonder caller)
- Geen DB-migratie om terug te draaien
