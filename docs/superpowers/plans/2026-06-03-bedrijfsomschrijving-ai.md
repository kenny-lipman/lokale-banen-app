# Bedrijfsomschrijving AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een bedrijfsbeheerder kan op de bedrijf-bewerken-pagina met AI een korte, feitelijke bedrijfsomschrijving genereren (twee stappen: bron ophalen, dan herschrijven), en vanuit de job-postings-drawer in een nieuw tabblad naar die bewerken-pagina springen.

**Architecture:** Twee nieuwe services in `apps/admin/lib/services/company-description/` (bron ophalen via hergebruik van de bestaande `sales-leads/website/`-infra; herschrijven via Mistral). Twee POST API-routes (`ai-source`, `ai-rewrite`) met `// @auth SESSION`. UI-uitbreiding op de bestaande bewerken-pagina en een one-liner-koppeling in de job-postings-pagina. Niets wordt automatisch opgeslagen; opslaan loopt via de bestaande PATCH.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service-role client), Mistral API, Vitest, shadcn/ui, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-bedrijfsomschrijving-ai-design.md`

---

## File Structure

- Create: `apps/admin/lib/services/company-description/rewrite.service.ts` - Mistral-call die bron-tekst naar een korte bedrijfsomschrijving herschrijft.
- Create: `apps/admin/lib/services/company-description/source.service.ts` - haalt website-"over ons"-tekst (hergebruik website-infra) + vacaturetitels op; bevat de pure `pickSourceUrl`-helper.
- Create: `apps/admin/app/api/bedrijven/[id]/ai-source/route.ts` - POST, geeft bron-materiaal terug.
- Create: `apps/admin/app/api/bedrijven/[id]/ai-rewrite/route.ts` - POST, geeft gegenereerde omschrijving terug.
- Create: `apps/admin/__tests__/company-description/rewrite.service.test.ts` - unit-test parsing/guards rewrite-service.
- Create: `apps/admin/__tests__/company-description/source.service.test.ts` - unit-test `pickSourceUrl`.
- Modify: `apps/admin/app/bedrijven/[id]/bewerken/page.tsx` - nieuwe "AI-omschrijving"-sectie.
- Modify: `apps/admin/app/job-postings/page.tsx` - `onCompanyClick` doorgeven aan de drawer.

**Commando-conventies (vanuit worktree-root):**
- Vitest: `pnpm --filter @lokale-banen/admin exec vitest run <pad-relatief-aan-apps/admin>`
- Type-check: `pnpm --filter @lokale-banen/admin run type-check`

---

## Task 1: Rewrite-service (Mistral)

**Files:**
- Create: `apps/admin/lib/services/company-description/rewrite.service.ts`
- Test: `apps/admin/__tests__/company-description/rewrite.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin/__tests__/company-description/rewrite.service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/company-description/rewrite.service.test.ts`
Expected: FAIL met een module-resolutie-/import-fout (`rewrite.service` bestaat nog niet).

- [ ] **Step 3: Write minimal implementation**

Create `apps/admin/lib/services/company-description/rewrite.service.ts`:

```ts
/**
 * Company Description AI Rewrite Service
 *
 * Schrijft een korte, feitelijke "over ons"-omschrijving van een BEDRIJF op basis
 * van aangeleverde bron-tekst (website-content + vacaturetitels). Strikt anti-
 * hallucinatie: gebruikt alleen wat letterlijk in de bron staat.
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface CompanyRewriteResult {
  description: string
}

const SYSTEM_PROMPT = `Je bent een redacteur voor Nederlandse regionale jobboards (Lokale Banen netwerk).

Jouw taak: schrijf een korte, feitelijke "over ons"-omschrijving van het BEDRIJF op basis van de aangeleverde bron.

KRITIEKE REGEL - GEEN HALLUCINATIE
Gebruik UITSLUITEND informatie die letterlijk in de aangeleverde bron staat.
- VERBODEN: superlatieven zoals "toonaangevend", "marktleider", "innovatief", "hoogwaardig" tenzij ze letterlijk in de bron staan
- VERBODEN: aannames over bedrijfsgrootte, marktpositie of internationale aanwezigheid
- VERBODEN: invullen op basis van de bedrijfsnaam of de branche
Als de bron te weinig feitelijke bedrijfsinfo bevat, schrijf dan een korte eerlijke omschrijving in plaats van verzinsels.

ONDERWERP
Beschrijf het BEDRIJF (wat het doet, waar het zit, voor wie), NIET een specifieke vacature. Neem geen vacature-eisen, salarissen of sollicitatieprocedures over.

OUTPUT
- 2 tot 4 zinnen, maximaal ongeveer 600 tekens
- Platte tekst, geen koppen, geen bullet-lists
- Professioneel Nederlands, derde persoon (het bedrijf), niet "jij/je"

Antwoord ALLEEN met valid JSON:
{ "description": "..." }`

interface MistralResponse {
  choices: Array<{ message: { content: string } }>
}

export async function rewriteCompanyDescription(params: {
  name: string
  city: string | null
  sourceText: string
}): Promise<CompanyRewriteResult> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is niet geconfigureerd')
  }

  const source = (params.sourceText ?? '').trim()
  if (source.length < 30) {
    throw new Error('Brontekst is te kort om te herschrijven (minimaal 30 tekens)')
  }

  // Truncate om token-limieten te vermijden
  const maxChars = 8000
  const truncated = source.length > maxChars ? source.substring(0, maxChars) + '...' : source

  const userPrompt = `Bedrijf: ${params.name}${params.city ? `\nLocatie: ${params.city}` : ''}

Bron:
${truncated}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let response: Response
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Mistral API timeout (30s) - probeer het later opnieuw')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mistral API fout (${response.status}): ${errorText}`)
  }

  const data: MistralResponse = await response.json()
  const rawContent = data.choices?.[0]?.message?.content
  if (!rawContent) {
    throw new Error('Leeg antwoord van Mistral API')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error(`Mistral gaf geen valide JSON: ${rawContent.substring(0, 200)}`)
  }

  if (!parsed.description || typeof parsed.description !== 'string') {
    throw new Error('AI response bevat geen description veld')
  }

  return { description: (parsed.description as string).trim() }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/company-description/rewrite.service.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/services/company-description/rewrite.service.ts apps/admin/__tests__/company-description/rewrite.service.test.ts
git commit -m "feat(bedrijven): AI rewrite-service voor bedrijfsomschrijving"
```

---

## Task 2: Source-service (website + vacatures)

**Files:**
- Create: `apps/admin/lib/services/company-description/source.service.ts`
- Test: `apps/admin/__tests__/company-description/source.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin/__tests__/company-description/source.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickSourceUrl } from '@/lib/services/company-description/source.service'
import type { DiscoveredUrl } from '@/lib/services/sales-leads/website/sitemap-discovery'

describe('pickSourceUrl', () => {
  it('kiest about boven home', () => {
    const discovered: DiscoveredUrl[] = [
      { url: 'https://x.nl/', role: 'home', priority: 0 },
      { url: 'https://x.nl/over-ons', role: 'about', priority: 1 },
    ]
    expect(pickSourceUrl(discovered, 'https://x.nl')).toBe('https://x.nl/over-ons')
  })

  it('valt terug op home als er geen about is', () => {
    const discovered: DiscoveredUrl[] = [{ url: 'https://x.nl/', role: 'home', priority: 0 }]
    expect(pickSourceUrl(discovered, 'https://x.nl')).toBe('https://x.nl/')
  })

  it('valt terug op de opgegeven website als er niets gevonden is', () => {
    expect(pickSourceUrl([], 'https://x.nl')).toBe('https://x.nl')
  })

  it('geeft null als er niets is en geen fallback', () => {
    expect(pickSourceUrl([], '')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/company-description/source.service.test.ts`
Expected: FAIL met module-resolutie-fout (`source.service` bestaat nog niet).

- [ ] **Step 3: Write minimal implementation**

Create `apps/admin/lib/services/company-description/source.service.ts`:

```ts
/**
 * Company Description Source Service
 *
 * Verzamelt bron-materiaal voor de AI-bedrijfsomschrijving: de "over ons"-tekst
 * van de bedrijfswebsite (hergebruik van de sales-leads website-infra) plus de
 * vacaturetitels van het bedrijf. Faalt zacht: als de website niet bereikbaar is
 * blijft websiteText null en wordt alleen op vacatures teruggevallen.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { safeFetch } from '@/lib/services/sales-leads/website/ssrf-fetch'
import { htmlToMarkdown, truncateForLLM } from '@/lib/services/sales-leads/website/markdown'
import {
  discoverUrls,
  type DiscoveredUrl,
} from '@/lib/services/sales-leads/website/sitemap-discovery'

export interface CompanySource {
  websiteText: string | null
  websiteUrl: string | null
  vacancyTitles: string[]
}

const MAX_VACANCY_TITLES = 25
const SOURCE_MAX_TOKENS = 1500

/**
 * Kies de meest geschikte bron-URL: 'about' > 'home' > de opgegeven website.
 * Pure functie zodat de selectie-logica los te testen is.
 */
export function pickSourceUrl(
  discovered: DiscoveredUrl[],
  fallbackWebsite: string,
): string | null {
  const about = discovered.find((d) => d.role === 'about')
  if (about) return about.url
  const home = discovered.find((d) => d.role === 'home')
  if (home) return home.url
  return fallbackWebsite || null
}

async function fetchWebsiteText(
  website: string | null,
): Promise<{ text: string | null; url: string | null }> {
  if (!website) return { text: null, url: null }
  const normalized = website.startsWith('http') ? website : `https://${website}`
  try {
    const discovered = await discoverUrls(normalized)
    const target = pickSourceUrl(discovered, normalized)
    if (!target) return { text: null, url: null }
    const res = await safeFetch(target)
    if (res.status >= 400 || !res.contentType.includes('html')) {
      return { text: null, url: null }
    }
    const md = htmlToMarkdown(res.body)
    const text = truncateForLLM(md, SOURCE_MAX_TOKENS).trim()
    return { text: text.length > 0 ? text : null, url: target }
  } catch {
    // SSRF-block, timeout, size-limit, DNS-fail: zacht falen, val terug op vacatures
    return { text: null, url: null }
  }
}

async function fetchVacancyTitles(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('job_postings')
    .select('title')
    .eq('company_id', companyId)
    .not('title', 'is', null)
    .limit(MAX_VACANCY_TITLES)

  if (!data) return []

  const seen = new Set<string>()
  const titles: string[] = []
  for (const row of data as Array<{ title: string | null }>) {
    const t = (row.title ?? '').trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      titles.push(t)
    }
  }
  return titles
}

export async function fetchCompanySource(
  supabase: SupabaseClient,
  params: { companyId: string; website: string | null },
): Promise<CompanySource> {
  const [{ text, url }, vacancyTitles] = await Promise.all([
    fetchWebsiteText(params.website),
    fetchVacancyTitles(supabase, params.companyId),
  ])
  return { websiteText: text, websiteUrl: url, vacancyTitles }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/company-description/source.service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/services/company-description/source.service.ts apps/admin/__tests__/company-description/source.service.test.ts
git commit -m "feat(bedrijven): bron-service voor AI-bedrijfsomschrijving (website + vacatures)"
```

---

## Task 3: API-route `ai-source`

**Files:**
- Create: `apps/admin/app/api/bedrijven/[id]/ai-source/route.ts`

- [ ] **Step 1: Write the implementation**

Create `apps/admin/app/api/bedrijven/[id]/ai-source/route.ts`:

```ts
// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { fetchCompanySource } from '@/lib/services/company-description/source.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function aiSourceHandler(
  _req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({ success: false, error: 'Bedrijf niet gevonden' }, { status: 404 })
    }

    const source = await fetchCompanySource(supabase, {
      companyId: company.id,
      website: company.website,
    })

    if (!source.websiteText && source.vacancyTitles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Geen bron beschikbaar voor dit bedrijf' },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, data: source })
  } catch (error) {
    console.error('Error in company ai-source:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Bron ophalen mislukt' },
      { status: 500 },
    )
  }
}

export const POST = withAuth(aiSourceHandler)
```

- [ ] **Step 2: Run the auth-coverage gate to verify the new route has a valid auth-seam**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/auth-coverage.test.ts`
Expected: PASS (de nieuwe route heeft `// @auth SESSION` + `withAuth(`).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/api/bedrijven/[id]/ai-source/route.ts
git commit -m "feat(bedrijven): POST ai-source route voor bron-materiaal"
```

---

## Task 4: API-route `ai-rewrite`

**Files:**
- Create: `apps/admin/app/api/bedrijven/[id]/ai-rewrite/route.ts`

- [ ] **Step 1: Write the implementation**

Create `apps/admin/app/api/bedrijven/[id]/ai-rewrite/route.ts`:

```ts
// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { rewriteCompanyDescription } from '@/lib/services/company-description/rewrite.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function aiRewriteHandler(
  req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : ''

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }
    if (!sourceText) {
      return NextResponse.json({ success: false, error: 'Brontekst is verplicht' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, city')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({ success: false, error: 'Bedrijf niet gevonden' }, { status: 404 })
    }

    const result = await rewriteCompanyDescription({
      name: company.name,
      city: company.city,
      sourceText,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error in company ai-rewrite:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI herschrijving mislukt' },
      { status: 500 },
    )
  }
}

export const POST = withAuth(aiRewriteHandler)
```

- [ ] **Step 2: Run the auth-coverage gate**

Run: `pnpm --filter @lokale-banen/admin exec vitest run __tests__/auth-coverage.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/api/bedrijven/[id]/ai-rewrite/route.ts
git commit -m "feat(bedrijven): POST ai-rewrite route voor AI-omschrijving"
```

---

## Task 5: UI - "AI-omschrijving"-sectie op de bewerken-pagina

**Files:**
- Modify: `apps/admin/app/bedrijven/[id]/bewerken/page.tsx`

- [ ] **Step 1: Breid de lucide-import uit**

Vervang regel 29:

```tsx
import { ArrowLeft, Loader2, Trash2, Building2 } from "lucide-react"
```

door:

```tsx
import { ArrowLeft, Loader2, Trash2, Building2, Globe, Sparkles } from "lucide-react"
```

- [ ] **Step 2: Voeg state toe voor de AI-sectie**

Direct na de bestaande regel `const [sizeMax, setSizeMax] = useState("")` (regel 71), voeg toe:

```tsx
  // AI-omschrijving state
  const [sourceLoading, setSourceLoading] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [sourceText, setSourceText] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [sourceNote, setSourceNote] = useState("")
```

- [ ] **Step 3: Voeg de handlers toe**

Direct vóór de bestaande `const handleSubmit = async (e: React.FormEvent) => {` (regel 113), voeg toe:

```tsx
  const composeSource = (data: {
    websiteText: string | null
    vacancyTitles?: string[]
  }): string => {
    const parts: string[] = []
    if (data.websiteText) parts.push(data.websiteText)
    if (data.vacancyTitles && data.vacancyTitles.length > 0) {
      parts.push("Vacatures bij dit bedrijf:\n" + data.vacancyTitles.map((t) => `- ${t}`).join("\n"))
    }
    return parts.join("\n\n")
  }

  const handleFetchSource = async () => {
    setSourceLoading(true)
    try {
      const res = await fetch(`/api/bedrijven/${id}/ai-source`, { method: "POST" })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || "Bron ophalen mislukt")
        return
      }
      const data = result.data
      setSourceText(composeSource(data))
      setSourceUrl(data.websiteUrl || "")
      setSourceNote(data.websiteText ? "" : "Website niet bereikbaar, alleen vacatures gebruikt")
    } catch {
      toast.error("Bron ophalen mislukt")
    } finally {
      setSourceLoading(false)
    }
  }

  const handleRewrite = async () => {
    if (!sourceText.trim()) {
      toast.error("Haal eerst de bron op")
      return
    }
    setRewriting(true)
    try {
      const res = await fetch(`/api/bedrijven/${id}/ai-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || "AI herschrijving mislukt")
        return
      }
      setDescription(result.data.description)
      toast.success("Omschrijving gegenereerd, controleer en sla op")
    } catch {
      toast.error("AI herschrijving mislukt")
    } finally {
      setRewriting(false)
    }
  }
```

- [ ] **Step 4: Voeg de AI-sectie als Card toe**

Direct na de sluit-tag van de "Basisgegevens"-Card (de `</Card>` op regel 302, vóór `{/* Address */}`), voeg toe:

```tsx
        {/* AI-omschrijving */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-omschrijving
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Haal de bron op (bedrijfswebsite en vacatures) en laat AI er een korte,
              feitelijke bedrijfsomschrijving van maken. Het resultaat komt in het
              Beschrijving-veld hierboven, je kunt het daarna nog aanpassen voor je opslaat.
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchSource}
                disabled={sourceLoading || rewriting}
              >
                {sourceLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Bron ophalen
              </Button>
              <Button
                type="button"
                onClick={handleRewrite}
                disabled={!sourceText.trim() || rewriting || sourceLoading}
              >
                {rewriting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Herschrijf met AI
              </Button>
            </div>
            {(sourceText || sourceUrl || sourceNote) && (
              <div className="space-y-2">
                <Label htmlFor="ai-source">Bron (bewerkbaar)</Label>
                <Textarea
                  id="ai-source"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Bron-tekst voor de AI..."
                  rows={8}
                />
                {sourceUrl && (
                  <p className="text-xs text-muted-foreground">Bron: {sourceUrl}</p>
                )}
                {sourceNote && <p className="text-xs text-amber-600">{sourceNote}</p>}
              </div>
            )}
          </CardContent>
        </Card>
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @lokale-banen/admin run type-check`
Expected: PASS (geen TypeScript-fouten).

- [ ] **Step 6: Manual verification**

Start de admin dev-server (`pnpm dev:admin`), open `/bedrijven/<een-bedrijf-met-website>/bewerken`:
- Klik "Bron ophalen" -> binnen ~enkele seconden verschijnt een bewerkbare bron-textarea met de bron-URL eronder (of de notitie "Website niet bereikbaar, alleen vacatures gebruikt").
- Klik "Herschrijf met AI" -> het Beschrijving-veld vult zich met een korte omschrijving.
- Klik "Opslaan" -> toast "Bedrijf bijgewerkt".
Expected: alle drie de stappen werken; geen console-errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/app/bedrijven/[id]/bewerken/page.tsx
git commit -m "feat(bedrijven): AI-omschrijving sectie op bewerken-pagina"
```

---

## Task 6: Deel B - snelle company-edit vanuit job-postings-drawer

**Files:**
- Modify: `apps/admin/app/job-postings/page.tsx`

- [ ] **Step 1: Geef `onCompanyClick` door aan de drawer**

In `apps/admin/app/job-postings/page.tsx`, in de `<JobPostingDrawer ... />` render (rond regel 217-235), voeg een `onCompanyClick`-prop toe. De drawer toont dan de bestaande "Bekijk bedrijf"-knop. Resultaat:

```tsx
      <JobPostingDrawer
        job={selectedJobForDrawer as any}
        open={!!selectedJobForDrawer}
        onClose={handleCloseJobDrawer}
        onCompanyClick={(companyId) =>
          window.open(`/bedrijven/${companyId}/bewerken`, "_blank", "noopener")
        }
        onJobChange={async () => {
          // Refetch full job data + update counts
          const jobId = selectedJobForDrawer?.id
          if (jobId) {
            const res = await fetch(`/api/job-postings/${jobId}`)
            const result = await res.json()
            if (result.success && result.data) {
              setSelectedJobForDrawer(result.data)
            }
          }
          setRefreshTick((t) => t + 1)
        }}
      />
```

(Alleen de `onCompanyClick`-regel is nieuw; de rest blijft ongewijzigd.)

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @lokale-banen/admin run type-check`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Open `/job-postings?status=pending`, klik een vacature aan zodat de drawer opent. Onderaan de drawer staat nu een knop "Bekijk bedrijf". Klik die:
Expected: er opent een nieuw tabblad op `/bedrijven/<company_id>/bewerken`; de job-postings-lijst en de geopende drawer blijven in het oorspronkelijke tabblad staan.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/job-postings/page.tsx
git commit -m "feat(job-postings): snelle company-edit-link vanuit drawer"
```

---

## Final verification

- [ ] **Run de volledige admin test-suite**

Run: `pnpm --filter @lokale-banen/admin exec vitest run`
Expected: alle tests groen, inclusief auth-coverage en de twee nieuwe service-tests.

- [ ] **Type-check de hele app**

Run: `pnpm --filter @lokale-banen/admin run type-check`
Expected: PASS.

- [ ] **End-to-end op een echt bedrijf**

Open `/bedrijven/<id>/bewerken` voor Humankind (slug `humankind-kinderopvang-en-ontwikkeling-f96f4ace`): bron ophalen -> herschrijven -> opslaan. Verifieer daarna op de public site (`achterhoeksebanen.vercel.app/bedrijf/humankind-kinderopvang-en-ontwikkeling-f96f4ace`, na deploy/refresh) dat de nieuwe korte omschrijving getoond wordt in plaats van de vacaturelap.
