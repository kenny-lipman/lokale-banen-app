# FIX6 — Cities-table Primary + Random-Street Fallback

**Datum:** 2026-05-06
**Doel:** Maximaliseer platform-matching success door (a) onze eigen `cities`-tabel als directe platform-bron te gebruiken en (b) random-street geocoding als laatste fallback voor postcode-detectie.

**Background:** Post-FIX5 hebben we 100% enriched in 2 runs, maar dat is een klein sample. Voor edge-cases (onbekende locations of LocationIQ errors) willen we extra robuustheid via deterministische `cities`-lookups.

---

## Algoritme

Per job_posting:

```
1. deriveCity(row) → city (al bestaand)
2. citiesByName = findCityByName(city)            ← NIEUW (geen API call)
   Returns: { platform_id, postcode_4digit } | null

3. search = searchCity(city)                      ← bestaand
   - fail → mark geocoding_failed (no_match), continue
4. lat = search.lat, lon = search.lon, addr = search.address
   - Number.isFinite check → mark invalid_coords if fail (bestaand)

5. postcode = addr.postcode | null
   IF postcode is null:
     reverse = reverseGeocode(lat, lon)           ← bestaand
     IF reverse heeft postcode → addr/postcode update

6. IF postcode is null:                           ← NIEUW
     reverseOffset = reverseGeocode(lat+0.005, lon+0.005)
     IF reverseOffset heeft postcode → addr/postcode update
     stats.postcode_via_random_street++ (bij success)

7. IF postcode is null AND citiesByName != null:  ← NIEUW
     postcode = citiesByName.postcode_4digit
     stats.postcode_via_cities_fallback++

8. IF postcode is null → mark geocoding_failed (missing_postcode), continue

9. platformId = findPlatformIdByPostcode(extractPostcodePrefix(postcode))
   IF platformId is null AND citiesByName != null:    ← NIEUW
     platformId = citiesByName.platform_id
     stats.platform_matched_via_cities++

10. UPDATE job_posting met lat, lon, postcode, platform_id, addr.{road, city, state, country}
```

**Worst-case API calls per item:** 3 (search + reverse + offset-reverse).
**Best-case:** 1 (search returneert postcode direct).
**Realistic mix:** ~2 per item.

---

## Files

| File | Actie | Reason |
|---|---|---|
| `apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts` | modify | Add `findCityByName(supabase, cityName)` |
| `apps/admin/lib/automations/fix-job-postings-geocoding/types.ts` | modify | Add 3 new counters to `BusinessStats` |
| `apps/admin/lib/automations/fix-job-postings-geocoding/index.ts` | modify | Wire new fallbacks into orchestrator + adjust per-run limit |
| `apps/admin/__tests__/platform-lookup.test.ts` | modify | Add 3 tests voor `findCityByName` |
| `apps/admin/lib/automations-registry.ts` | modify | Add new displayStats entries voor zichtbaarheid in UI |

**Geen DB migrations** — alleen code changes.

---

## Task 1 — Add `findCityByName` (TDD)

### Step 1.1: Failing test toevoegen aan `__tests__/platform-lookup.test.ts`

Append na het bestaande `describe('extractPostcodePrefix', ...)` block:

```ts
import { findCityByName } from '@/lib/automations/fix-job-postings-geocoding/platform-lookup'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeMockSupabase(rows: Array<{ platform_id: string | null; postcode: string | null }> | null, error: { message: string } | null = null) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows?.[0] ?? null, error }),
  }
  return mock as unknown as SupabaseClient
}

describe('findCityByName', () => {
  it('returns platform_id and postcode when city found', async () => {
    const supabase = makeMockSupabase([{ platform_id: 'plat-1', postcode: '1011' }])
    const r = await findCityByName(supabase, 'Amsterdam')
    expect(r).toEqual({ platform_id: 'plat-1', postcode_4digit: '1011' })
  })

  it('returns null when city not found', async () => {
    const supabase = makeMockSupabase([])
    const r = await findCityByName(supabase, 'Onbekend Dorp')
    expect(r).toBeNull()
  })

  it('returns null on DB error', async () => {
    const supabase = makeMockSupabase(null, { message: 'connection lost' })
    const r = await findCityByName(supabase, 'Amsterdam')
    expect(r).toBeNull()
  })
})
```

### Step 1.2: Run tests, expect FAIL

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin
npx vitest run __tests__/platform-lookup.test.ts
```

Expected: FAIL — `findCityByName` not exported.

### Step 1.3: Append to `apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts`

Add ná de bestaande `findPlatformIdByPostcode` function:

```ts
export interface CityFallback {
  platform_id: string | null
  postcode_4digit: string | null
}

/**
 * Direct cities-tabel lookup op city naam (case-insensitive).
 * Gebruikt als fallback wanneer LocationIQ geen postcode/platform geeft.
 * Returnt null bij geen match of DB-error.
 */
export async function findCityByName(
  supabase: SupabaseClient,
  cityName: string,
): Promise<CityFallback | null> {
  const trimmed = cityName.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('cities')
    .select('platform_id, postcode')
    .ilike('plaats', trimmed)
    .not('postcode', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(`[platform-lookup] findCityByName ${trimmed}:`, error.message)
    return null
  }
  if (!data) return null

  return {
    platform_id: data.platform_id ?? null,
    postcode_4digit: data.postcode ?? null,
  }
}
```

### Step 1.4: Run tests, expect 9/9 PASS (6 bestaande + 3 nieuwe)

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin
npx vitest run __tests__/platform-lookup.test.ts
```

### Step 1.5: Commit (nog niet pushen — meerdere tasks in één deploy)

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts \
        apps/admin/__tests__/platform-lookup.test.ts
git commit -m "feat(geocoding): add findCityByName for cities-table fallback"
```

---

## Task 2 — Update `types.ts` voor nieuwe counters

### Step 2.1: Modify `apps/admin/lib/automations/fix-job-postings-geocoding/types.ts`

Update interface:

```ts
export interface BusinessStats {
  processed: number
  enriched: number
  geocoding_failed_no_match: number
  geocoding_failed_no_postcode: number
  geocoding_failed_invalid_coords: number
  platform_matched: number
  platform_matched_via_cities: number              // NIEUW
  postcode_via_random_street: number               // NIEUW
  postcode_via_cities_fallback: number             // NIEUW
  queue_remaining: number
  api_calls_used: number
  stopped_early: boolean
  skipped_reason?: 'daily_budget_reached' | 'auth_failed'
}
```

### Step 2.2: Commit

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/types.ts
git commit -m "feat(geocoding): add cities-fallback + random-street stat counters"
```

---

## Task 3 — Update orchestrator `index.ts`

### Step 3.1: Modify imports

```ts
import { searchCity, reverseGeocode } from './locationiq-client'
import { extractPostcodePrefix, findPlatformIdByPostcode, findCityByName } from './platform-lookup'
```

### Step 3.2: Update initial stats + emptyStats helper

Vervang het stats-init blok in `run()`:

```ts
const stats: BusinessStats = {
  processed: 0, enriched: 0,
  geocoding_failed_no_match: 0, geocoding_failed_no_postcode: 0,
  geocoding_failed_invalid_coords: 0,
  platform_matched: 0,
  platform_matched_via_cities: 0,
  postcode_via_random_street: 0,
  postcode_via_cities_fallback: 0,
  queue_remaining: 0,
  api_calls_used: 0, stopped_early: false,
}
```

Update `emptyStats()` met dezelfde nieuwe defaults.

### Step 3.3: Add constants

```ts
const PER_RUN_LIMIT = 110              // was 130 — 3-call worst case (search+reverse+offset) past binnen 240s
const ITEM_DELAY_MS = 1000
const MAX_RUN_MS = 240_000
const RETRY_DELAY_MS = 2000
const RANDOM_STREET_OFFSET = 0.005     // ~500m verschuiving (lat+lon)
```

### Step 3.4: Replace de postcode-handling block

Vervang het huidige (post-FIX5) block dat begint met `let addr = outcome.result.address` en eindigt vóór de `extractPostcodePrefix(postcode)` regel:

```ts
    // ── Step 0: cities-tabel lookup voor fallback (geen API call) ──
    const citiesByName = await findCityByName(supabase, city)

    let addr = outcome.result.address
    let postcode = addr.postcode ?? null

    // ── Step 1: reverse-fallback (was FIX5) ──
    if (!postcode) {
      await sleep(ITEM_DELAY_MS)
      let reverseOutcome = await reverseGeocode(outcome.result.lat, outcome.result.lon, { apiKey })
      stats.api_calls_used++

      if (!reverseOutcome.ok && reverseOutcome.reason === 'rate_limit') {
        await sleep(RETRY_DELAY_MS)
        reverseOutcome = await reverseGeocode(outcome.result.lat, outcome.result.lon, { apiKey })
        stats.api_calls_used++
      }

      if (reverseOutcome.ok && reverseOutcome.result.address.postcode) {
        addr = reverseOutcome.result.address
        postcode = addr.postcode ?? null
      }
    }

    // ── Step 2: NIEUW — random-street offset reverse ──
    if (!postcode) {
      const lat0 = Number(outcome.result.lat)
      const lon0 = Number(outcome.result.lon)
      if (Number.isFinite(lat0) && Number.isFinite(lon0)) {
        await sleep(ITEM_DELAY_MS)
        const offsetOutcome = await reverseGeocode(
          lat0 + RANDOM_STREET_OFFSET,
          lon0 + RANDOM_STREET_OFFSET,
          { apiKey }
        )
        stats.api_calls_used++

        if (offsetOutcome.ok && offsetOutcome.result.address.postcode) {
          addr = offsetOutcome.result.address
          postcode = addr.postcode ?? null
          stats.postcode_via_random_street++
        }
      }
    }

    // ── Step 3: NIEUW — cities-table 4-digit postcode fallback ──
    if (!postcode && citiesByName?.postcode_4digit) {
      postcode = citiesByName.postcode_4digit
      stats.postcode_via_cities_fallback++
      // Note: addr blijft van search (city/road kunnen leeg zijn — niet erg, postcode is voldoende voor platform match)
    }

    if (!postcode) {
      await markFailed(supabase, row.id, 'missing_postcode')
      stats.geocoding_failed_no_postcode++
      await sleep(ITEM_DELAY_MS)
      continue
    }
```

### Step 3.5: Update platform lookup met cities-fallback

Vervang het bestaande platform-lookup block:

```ts
    const prefix = extractPostcodePrefix(postcode)
    let platformId: string | null = null
    let platformViaCities = false

    if (prefix) {
      platformId = await findPlatformIdByPostcode(supabase, prefix)
    }

    // ── NIEUW — cities-by-name fallback voor platform_id ──
    if (!platformId && citiesByName?.platform_id) {
      platformId = citiesByName.platform_id
      platformViaCities = true
    }

    if (platformId) {
      if (platformViaCities) {
        stats.platform_matched_via_cities++
      } else {
        stats.platform_matched++
      }
    }
```

### Step 3.6: Type-check NIET vereist (per usual constraint), wel vitest

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin
npx vitest run __tests__/locationiq-client.test.ts __tests__/platform-lookup.test.ts
```

Expected: 12/12 passing (5 search + 4 reverse + 6+3 platform = 18). Wait — let me recount: searchCity 5 + reverseGeocode 4 + extractPostcodePrefix 6 + findCityByName 3 = **18 tests**.

### Step 3.7: Commit

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/index.ts
git commit -m "feat(geocoding): wire random-street + cities-by-name fallbacks into orchestrator"
```

---

## Task 4 — Update registry displayStats

### Step 4.1: Modify `apps/admin/lib/automations-registry.ts`

In de `fix-job-postings-geocoding` entry, breid `displayStats` uit:

```ts
displayStats: [
  { key: 'enriched', label: 'verrijkt' },
  { key: 'platform_matched', label: 'platform (postcode)' },
  { key: 'platform_matched_via_cities', label: 'platform (cities)' },
  { key: 'postcode_via_random_street', label: 'random-street fallback' },
  { key: 'postcode_via_cities_fallback', label: 'cities postcode fallback' },
  { key: 'geocoding_failed_no_match', label: 'geen match' },
  { key: 'geocoding_failed_no_postcode', label: 'geen postcode' },
  { key: 'geocoding_failed_invalid_coords', label: 'invalid coords' },
  { key: 'queue_remaining', label: 'queue' },
],
```

`primaryStatKey` blijft `'enriched'`.

### Step 4.2: Commit

```bash
git add apps/admin/lib/automations-registry.ts
git commit -m "feat(geocoding): expose new fallback counters in dashboard"
```

---

## Task 5 — Push + verify

### Step 5.1: Push

```bash
git push origin main
```

### Step 5.2: Wachten op Vercel deploy (~60-90s)

Poll endpoint until 401 (means new code deployed):

```bash
curl -sI https://lokale-banen-app.vercel.app/api/cron/fix-job-postings-geocoding | head -1
```

### Step 5.3: Trigger manual run

```bash
source apps/admin/.env.vercel.local
curl -s -X POST "https://lokale-banen-app.vercel.app/api/cron/fix-job-postings-geocoding" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "X-Automation-Trigger: manual" \
  --max-time 320
```

### Step 5.4: Verify resultaten

Via Supabase MCP:

```sql
SELECT triggered_by, status, duration_ms, business_stats
FROM automation_runs
WHERE automation_id = 'fix-job-postings-geocoding'
ORDER BY started_at DESC LIMIT 1;
```

**Acceptance criteria:**
- `status = 'success'`
- `duration_ms < 250000` (binnen 240s + netwerk-buffer)
- `processed = enriched` (geen failures)
- `platform_matched + platform_matched_via_cities ≥ 70%` van enriched
- Som van `postcode_via_random_street + postcode_via_cities_fallback` toont aandeel fallback-paden

---

## Risk register

| Risico | Mitigatie |
|---|---|
| 3 API calls per item × 110 items = 330 calls/run × 12 runs/dag = 3960 calls/dag → dichtbij 5000 cap | Real distribution: meeste cities krijgen postcode in step 1 (forward search met buurt-precisie) — gemiddeld ~1.5 calls/item. Monitor `api_calls_used` per run; lower PER_RUN_LIMIT to 90 als nodig. |
| `findCityByName` ILIKE op `plaats` traag bij grote tabel | `cities` is klein (~hooguit duizenden rijen), index op `plaats` zou helpen. Niet kritiek nu; toevoegen in follow-up als query >10ms blijkt. |
| Random-street offset (~500m) valt soms buiten bebouwd gebied | LocationIQ retourneert dan `no_match` of een ver gelegen weg. Cities-fallback (Step 3) vangt dit op. |
| `cities.postcode` is 4-digit zonder letters; vervangt 6-digit zipcode in DB | `job_postings.zipcode` accepteert text van elke vorm; downstream consumers (platform-lookup) gebruiken alleen prefix. Geen breaking change. |
| Cities-fallback platform_id kan stale zijn | `cities` is editorial DB; niet ons probleem voor deze fix. |

---

## Resterende open punten (niet voor FIX6, follow-up)

- **Reset 367 ten onrechte gefaalde items** is al gedaan in FIX5 — niets te resetten in FIX6.
- **Index op `cities.plaats`** voor query performance.
- **Configurable offset** (`process.env.GEOCODE_RANDOM_OFFSET`) voor tuning zonder deploy.

---

## Execution

Subagent-driven, één implementer per task (5 tasks total), spec+quality review per task. Na alle 5: één gezamenlijke push naar main + verificatie via productie trigger.
