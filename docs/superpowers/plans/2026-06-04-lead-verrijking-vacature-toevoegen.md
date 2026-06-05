# Vacature toevoegen in Lead Verrijking - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In de Lead Verrijking-pagina een "Vacature toevoegen"-knop toevoegen die een echt `job_posting`-record aanmaakt (met auto-gematcht of nieuw bedrijf), de vacature direct aangevinkt in de lead toont en mee laat gaan in de Pipedrive-deal.

**Architecture:** Het create-formulier van `/vacatures/nieuw` wordt geextraheerd naar een herbruikbaar `VacatureForm`-component, hergebruikt in een nieuwe `LeadAddVacancyModal` op de lead-pagina. Een nieuw `GET /api/companies/match` endpoint herkent het bedrijf (KvK -> domein -> naam). Na aanmaken wordt de vacature als `manual`-vacature in de lead-pool gezet en gepersisteerd via de (uitgebreide) PATCH-route.

**Tech Stack:** Next.js App Router, React (client components), shadcn/ui, Supabase (service-role), Vitest (pure-functie tests + auth-coverage gate).

**Spec:** `docs/superpowers/specs/2026-06-04-lead-verrijking-vacature-toevoegen-design.md`

---

## File Structure

**Create:**
- `apps/admin/lib/services/sales-leads/manual-vacancy.ts` - pure helpers: form-payload -> `NormalizedVacancy`, en `normalizeManualVacancies` (verplaatst + uitgebreid met `detail`).
- `apps/admin/__tests__/sales-leads/manual-vacancy.test.ts` - tests voor die helpers.
- `apps/admin/app/api/companies/match/route.ts` - bedrijf-match endpoint (`// @auth SESSION`).
- `apps/admin/components/vacatures/vacature-form.tsx` - herbruikbaar create-formulier.
- `apps/admin/components/sales/lead-add-vacancy-modal.tsx` - modal die `VacatureForm` toont, bedrijf matcht en POST't.

**Modify:**
- `apps/admin/app/api/sales-leads/[id]/route.ts` - PATCH accepteert `manual_vacancies`.
- `apps/admin/app/vacatures/nieuw/page.tsx` - gebruikt `VacatureForm`.
- `apps/admin/components/sales/lead-vacancies-column.tsx` - "Vacature toevoegen"-knop + modal.
- `apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx` - `manualVacancies` lokale state, auto-save uitbreiden, `onVacancyCreated`.

**Conventions:** Geen em-dash (U+2014) in code/comments/JSX. Elke `route.ts` heeft `// @auth <KLASSE>` op regel 1 (Vitest auth-gate). Zie `docs/reference/conventions.md` indien nodig.

---

## Task 1: PATCH-route accepteert `manual_vacancies`

De lead-pagina moet handmatig toegevoegde vacatures kunnen persisteren. De PATCH-route slaat nu alleen `master_record` en `selected_contacts` op.

**Files:**
- Modify: `apps/admin/app/api/sales-leads/[id]/route.ts:24-62`

- [ ] **Step 1: Breid het body-type en de update-shape uit**

Vervang in `patchHandler` de body-cast en de `update`-declaratie:

```ts
  const body = (await req.json().catch(() => null)) as
    | { master_record?: unknown; selected_contacts?: unknown; manual_vacancies?: unknown }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const update: {
    updated_at: string
    master_record?: Json
    selected_contacts?: Json
    manual_vacancies?: Json
  } = { updated_at: new Date().toISOString() }
```

- [ ] **Step 2: Voeg de `manual_vacancies`-tak toe**

Direct na de `selected_contacts`-tak (voor de `if (!touched)`-check):

```ts
  if ('manual_vacancies' in body && body.manual_vacancies !== undefined) {
    if (!Array.isArray(body.manual_vacancies)) {
      return NextResponse.json({ error: 'manual_vacancies moet array zijn' }, { status: 400 })
    }
    update.manual_vacancies = body.manual_vacancies as Json
    touched = true
  }
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter admin type-check`
Expected: geen nieuwe fouten in `app/api/sales-leads/[id]/route.ts`.

- [ ] **Step 4: Auth-gate test (regressie: marker blijft intact)**

Run: `pnpm --filter admin test -- auth-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/api/sales-leads/[id]/route.ts
git commit -m "feat(sales-leads): PATCH-route accepteert manual_vacancies"
```

---

## Task 2: Pure helpers voor manual-vacatures (TDD)

Twee pure functies: `payloadToNormalizedVacancy` (form-payload -> `NormalizedVacancy` met `detail`), en `normalizeManualVacancies` (DB-jsonb -> `NormalizedVacancy[]`, nu mét `detail` behouden). De bestaande `normalizeManualVacancies` in de lead-pagina is de basis en wordt hierheen verplaatst.

**Files:**
- Create: `apps/admin/lib/services/sales-leads/manual-vacancy.ts`
- Test: `apps/admin/__tests__/sales-leads/manual-vacancy.test.ts`
- Referentie (niet wijzigen in deze taak): `apps/admin/lib/services/sales-leads/types.ts:162-172` (`NormalizedVacancy`, `VacancyDetailFields`)

- [ ] **Step 1: Schrijf de failing test**

```ts
// apps/admin/__tests__/sales-leads/manual-vacancy.test.ts
import { describe, it, expect } from 'vitest'
import {
  payloadToNormalizedVacancy,
  normalizeManualVacancies,
  type VacaturePayload,
} from '@/lib/services/sales-leads/manual-vacancy'

describe('payloadToNormalizedVacancy', () => {
  it('mapt titel/url/locatie en zet source op manual', () => {
    const payload: VacaturePayload = {
      title: '  Senior Monteur ',
      url: 'https://werkgever.nl/vac',
      city: 'Amsterdam',
      review_status: 'pending',
    }
    const v = payloadToNormalizedVacancy(payload)
    expect(v.title).toBe('Senior Monteur')
    expect(v.url).toBe('https://werkgever.nl/vac')
    expect(v.location).toBe('Amsterdam')
    expect(v.source).toBe('manual')
  })

  it('vult detail-velden en parset uren naar number', () => {
    const payload: VacaturePayload = {
      title: 'Werkvoorbereider',
      salary: '2800 - 3500',
      employment: 'Vast',
      working_hours_min: '32',
      working_hours_max: '40',
      education_level: 'MBO',
      categories: 'Techniek',
      end_date: '2026-12-31',
      description: 'Mooie baan',
      review_status: 'pending',
    }
    const v = payloadToNormalizedVacancy(payload)
    expect(v.detail).toBeDefined()
    expect(v.detail?.salary).toBe('2800 - 3500')
    expect(v.detail?.employment).toBe('Vast')
    expect(v.detail?.working_hours_min).toBe(32)
    expect(v.detail?.working_hours_max).toBe(40)
    expect(v.detail?.education_level).toBe('MBO')
    expect(v.detail?.categories).toBe('Techniek')
    expect(v.detail?.end_date).toBe('2026-12-31')
    expect(v.detail?.description).toBe('Mooie baan')
  })

  it('laat detail weg als er geen detail-velden zijn', () => {
    const v = payloadToNormalizedVacancy({ title: 'Alleen titel', review_status: 'pending' })
    expect(v.detail).toBeUndefined()
  })
})

describe('normalizeManualVacancies', () => {
  it('negeert non-arrays en items zonder titel', () => {
    expect(normalizeManualVacancies(null)).toEqual([])
    expect(normalizeManualVacancies([{ url: 'x' }, { title: '   ' }])).toEqual([])
  })

  it('behoudt title/url/location en zet source op manual', () => {
    const out = normalizeManualVacancies([
      { title: 'Monteur', url: 'https://a.nl', location: 'Utrecht' },
    ])
    expect(out).toEqual([
      { title: 'Monteur', url: 'https://a.nl', location: 'Utrecht', source: 'manual' },
    ])
  })

  it('behoudt detail als die aanwezig is', () => {
    const out = normalizeManualVacancies([
      { title: 'Monteur', detail: { salary: '3000', working_hours_min: 32 } },
    ])
    expect(out[0].detail?.salary).toBe('3000')
    expect(out[0].detail?.working_hours_min).toBe(32)
  })
})
```

- [ ] **Step 2: Run de test, verifieer dat hij faalt**

Run: `pnpm --filter admin test -- manual-vacancy`
Expected: FAIL ("Failed to resolve import '@/lib/services/sales-leads/manual-vacancy'").

- [ ] **Step 3: Schrijf de implementatie**

```ts
// apps/admin/lib/services/sales-leads/manual-vacancy.ts
import type { NormalizedVacancy, VacancyDetailFields } from './types'

// Snake_case payload zoals POST /api/vacatures die verwacht. Lege velden zijn
// undefined (niet meegestuurd).
export type VacaturePayload = {
  title: string
  company_id?: string
  new_company_name?: string
  new_company_website?: string
  new_company_city?: string
  city?: string
  zipcode?: string
  street?: string
  state?: string
  description?: string
  salary?: string
  employment?: string
  working_hours_min?: string
  working_hours_max?: string
  education_level?: string
  categories?: string
  url?: string
  end_date?: string
  platform_id?: string
  review_status: string
}

function toIntOrNull(v: string | undefined): number | null {
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

// Bouwt de lead-pool-representatie (NormalizedVacancy) uit een create-payload.
// De detail-velden voeden de chips in LeadVacanciesColumn.
export function payloadToNormalizedVacancy(p: VacaturePayload): NormalizedVacancy {
  const detail: VacancyDetailFields = {
    salary: p.salary ?? null,
    employment: p.employment ?? null,
    job_type: null,
    description: p.description ?? null,
    published_at: null,
    end_date: p.end_date ?? null,
    education_level: p.education_level ?? null,
    career_level: null,
    working_hours_min: toIntOrNull(p.working_hours_min),
    working_hours_max: toIntOrNull(p.working_hours_max),
    categories: p.categories ?? null,
  }
  const hasDetail = Object.values(detail).some((v) => v !== null)
  return {
    title: p.title.trim(),
    url: p.url || undefined,
    location: p.city || undefined,
    source: 'manual',
    detail: hasDetail ? detail : undefined,
  }
}

// Leest sales_lead_runs.manual_vacancies (jsonb). Backend POST /create slaat
// soms zonder `source` op; hier wordt 'manual' gezet. Detail wordt behouden
// wanneer aanwezig zodat chips na refresh blijven tonen.
export function normalizeManualVacancies(raw: unknown): NormalizedVacancy[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v): NormalizedVacancy[] => {
    if (!v || typeof v !== 'object') return []
    const r = v as {
      title?: unknown
      url?: unknown
      location?: unknown
      detail?: unknown
    }
    if (typeof r.title !== 'string' || !r.title.trim()) return []
    return [
      {
        title: r.title,
        url: typeof r.url === 'string' ? r.url : undefined,
        location: typeof r.location === 'string' ? r.location : undefined,
        source: 'manual',
        detail:
          r.detail && typeof r.detail === 'object'
            ? (r.detail as VacancyDetailFields)
            : undefined,
      },
    ]
  })
}
```

- [ ] **Step 4: Run de test, verifieer dat hij slaagt**

Run: `pnpm --filter admin test -- manual-vacancy`
Expected: PASS (alle cases groen).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/services/sales-leads/manual-vacancy.ts apps/admin/__tests__/sales-leads/manual-vacancy.test.ts
git commit -m "feat(sales-leads): pure helpers voor manual-vacature mapping"
```

---

## Task 3: Bedrijf-match endpoint `GET /api/companies/match`

Herkent een bestaand bedrijf op basis van lead-data. Match-volgorde: KvK exact -> website apex-domein -> naam (ilike). Eerste hit wint.

**Files:**
- Create: `apps/admin/app/api/companies/match/route.ts`
- Referentie: `apps/admin/app/api/companies/search/route.ts` (auth + supabase-patroon), `apps/admin/lib/utils/url.ts:41` (`extractApex`)

- [ ] **Step 1: Schrijf de route**

```ts
// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { extractApex } from '@/lib/utils/url'

type CompanyMatch = { id: string; name: string; website: string | null }

async function matchCompanyHandler(req: NextRequest, authResult: AuthResult) {
  const url = new URL(req.url)
  const kvk = url.searchParams.get('kvk')?.trim() || ''
  const domain = url.searchParams.get('domain')?.trim() || ''
  const name = url.searchParams.get('name')?.trim() || ''
  const supabase = authResult.supabase

  // 1. KvK exact (meest betrouwbaar)
  if (kvk) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('kvk', kvk)
      .limit(1)
      .maybeSingle()
    if (data) return NextResponse.json({ match: data as CompanyMatch })
  }

  // 2. Website apex-domein
  if (domain) {
    const apex = extractApex(domain)
    if (apex) {
      const { data } = await supabase
        .from('companies')
        .select('id, name, website')
        .ilike('website', `%${apex}%`)
        .limit(1)
        .maybeSingle()
      if (data) return NextResponse.json({ match: data as CompanyMatch })
    }
  }

  // 3. Naam (ilike, hoge zekerheid)
  if (name) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, website')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    if (data) return NextResponse.json({ match: data as CompanyMatch })
  }

  return NextResponse.json({ match: null })
}

export const GET = withAuth(matchCompanyHandler)
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter admin type-check`
Expected: geen fouten in `app/api/companies/match/route.ts`. (Als `authResult.supabase` niet bestaat: gebruik `createServiceRoleClient()` zoals in `app/api/vacatures/route.ts:11` en importeer die.)

- [ ] **Step 3: Auth-gate test (nieuwe route heeft marker)**

Run: `pnpm --filter admin test -- auth-coverage`
Expected: PASS (de `// @auth SESSION`-marker op regel 1 voldoet aan de gate).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/api/companies/match/route.ts
git commit -m "feat(companies): GET /api/companies/match endpoint (kvk/domein/naam)"
```

---

## Task 4: Herbruikbaar `VacatureForm`-component + create-page refactor

Extraheer het create-formulier uit `app/vacatures/nieuw/page.tsx` naar een props-based component. De component houdt zijn eigen form-state, bouwt bij submit de API-payload en geeft die via `onSubmit` terug. De create-page doet daarna gewoon de POST + redirect (geen gedragsverandering).

**Files:**
- Create: `apps/admin/components/vacatures/vacature-form.tsx`
- Modify: `apps/admin/app/vacatures/nieuw/page.tsx`
- Referentie: `apps/admin/lib/services/sales-leads/manual-vacancy.ts` (`VacaturePayload`)

- [ ] **Step 1: Maak het `VacatureForm`-component**

Verplaats de constanten (`PROVINCES`, `EMPLOYMENT_TYPES`, `EDUCATION_LEVELS`, `REVIEW_STATUSES`), de company-search, platform-fetch, alle form-state en de Card-UI (Basisgegevens, Locatie, Beschrijving, Details, actieknoppen) uit `nieuw/page.tsx` naar dit component. Interface:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DescriptionEditor } from '@/components/vacature/description-editor'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Combobox } from '@/components/ui/combobox'
import { Loader2, Plus } from 'lucide-react'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'

const PROVINCES = [
  'Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant', 'Gelderland',
  'Overijssel', 'Limburg', 'Flevoland', 'Groningen', 'Friesland', 'Drenthe', 'Zeeland',
]
const EMPLOYMENT_TYPES = [
  { value: 'Vast', label: 'Vast' }, { value: 'Tijdelijk', label: 'Tijdelijk' },
  { value: 'Parttime', label: 'Parttime' }, { value: 'Stage', label: 'Stage' },
  { value: 'Bijbaan', label: 'Bijbaan' }, { value: 'Freelance', label: 'Freelance' },
  { value: 'Vrijwilliger', label: 'Vrijwilliger' },
]
const EDUCATION_LEVELS = [
  { value: 'VMBO/MAVO', label: 'VMBO/MAVO' }, { value: 'HAVO', label: 'HAVO' },
  { value: 'VWO', label: 'VWO' }, { value: 'MBO', label: 'MBO' },
  { value: 'HBO', label: 'HBO' }, { value: 'WO', label: 'WO' },
]
const REVIEW_STATUSES = [
  { value: 'pending', label: 'In afwachting' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'rejected', label: 'Afgekeurd' },
]

interface CompanyOption { value: string; label: string }
interface Platform { id: string; regio_platform: string }

export type VacatureFormInitial = {
  city?: string
  zipcode?: string
  newCompanyName?: string
  newCompanyWebsite?: string
  newCompanyCity?: string
  companyId?: string
}

type Props = {
  initialValues?: VacatureFormInitial
  // Injecteert een al-bekende company als optie in de combobox (auto-match).
  initialCompanyOption?: CompanyOption | null
  // Opent het 'nieuw bedrijf'-accordion standaard (bij geen match).
  defaultNewCompanyOpen?: boolean
  submitting?: boolean
  submitLabel?: string
  onSubmit: (payload: VacaturePayload) => void | Promise<void>
  onCancel?: () => void
}

export function VacatureForm({
  initialValues,
  initialCompanyOption,
  defaultNewCompanyOpen,
  submitting,
  submitLabel = 'Vacature aanmaken',
  onSubmit,
  onCancel,
}: Props) {
  const [companies, setCompanies] = useState<CompanyOption[]>(
    initialCompanyOption ? [initialCompanyOption] : [],
  )
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [companySearch, setCompanySearch] = useState('')

  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState(initialValues?.companyId ?? '')
  const [newCompanyName, setNewCompanyName] = useState(initialValues?.newCompanyName ?? '')
  const [newCompanyWebsite, setNewCompanyWebsite] = useState(initialValues?.newCompanyWebsite ?? '')
  const [newCompanyCity, setNewCompanyCity] = useState(initialValues?.newCompanyCity ?? '')
  const [city, setCity] = useState(initialValues?.city ?? '')
  const [zipcode, setZipcode] = useState(initialValues?.zipcode ?? '')
  const [street, setStreet] = useState('')
  const [state, setState] = useState('')
  const [description, setDescription] = useState('')
  const [salary, setSalary] = useState('')
  const [employment, setEmployment] = useState('')
  const [workingHoursMin, setWorkingHoursMin] = useState('')
  const [workingHoursMax, setWorkingHoursMax] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [categories, setCategories] = useState('')
  const [url, setUrl] = useState('')
  const [endDate, setEndDate] = useState('')
  const [platformId, setPlatformId] = useState('')
  const [reviewStatus, setReviewStatus] = useState('pending')

  const searchCompanies = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ search, limit: '50' })
      const res = await fetch(`/api/companies/search?${params}`)
      const result = await res.json()
      if (result.success && result.companies) {
        const opts: CompanyOption[] = result.companies.map(
          (c: { id: string; name: string }) => ({ value: c.id, label: c.name }),
        )
        // Behoud de auto-gematchte optie zodat het label niet verdwijnt als het
        // bedrijf buiten de eerste 50 zoekresultaten valt.
        if (initialCompanyOption && !opts.some((o) => o.value === initialCompanyOption.value)) {
          opts.unshift(initialCompanyOption)
        }
        setCompanies(opts)
      }
    } catch {
      // Silently fail
    }
  }, [initialCompanyOption])

  useEffect(() => {
    const timer = setTimeout(() => { searchCompanies(companySearch) }, 300)
    return () => clearTimeout(timer)
  }, [companySearch, searchCompanies])

  useEffect(() => { searchCompanies('') }, [searchCompanies])

  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const res = await fetch('/api/review/platforms')
        const { data } = await res.json()
        if (data) {
          setPlatforms(data.map((p: { id: string; regio_platform: string }) => ({
            id: p.id, regio_platform: p.regio_platform,
          })))
        }
      } catch {
        // Silently fail
      }
    }
    fetchPlatforms()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void onSubmit({
      title: title.trim(),
      company_id: companyId || undefined,
      new_company_name: !companyId ? newCompanyName.trim() || undefined : undefined,
      new_company_website: !companyId ? newCompanyWebsite.trim() || undefined : undefined,
      new_company_city: !companyId ? newCompanyCity.trim() || undefined : undefined,
      city: city.trim() || undefined,
      zipcode: zipcode.trim() || undefined,
      street: street.trim() || undefined,
      state: state || undefined,
      description: description.trim() || undefined,
      salary: salary.trim() || undefined,
      employment: employment || undefined,
      working_hours_min: workingHoursMin || undefined,
      working_hours_max: workingHoursMax || undefined,
      education_level: educationLevel || undefined,
      categories: categories.trim() || undefined,
      url: url.trim() || undefined,
      end_date: endDate || undefined,
      platform_id: platformId || undefined,
      review_status: reviewStatus,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plak hier de bestaande Card-blokken Basisgegevens, Locatie, Beschrijving en
          Details uit nieuw/page.tsx (regels 238-534), ongewijzigd op variabelenamen na.
          Combobox onValueChange + setCompanySearch via een searchPlaceholder/onSearch prop
          zoals de bestaande page die gebruikt. */}
      <div className="flex items-center justify-end gap-4">
        {onCancel && (
          <Button variant="outline" type="button" onClick={onCancel}>
            Annuleren
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
```

Belangrijk: kopieer de vier Card-blokken letterlijk uit `nieuw/page.tsx:238-534` in de `<form>`. De combobox in de huidige page zet `companySearch` niet (mist een `onSearch`); behoud het huidige gedrag exact (combobox met `options={companies}`). Geen functionele wijziging aan het formulier zelf.

Twee aanpassingen op de gekopieerde JSX:
1. Het 'nieuw bedrijf'-`Accordion` krijgt een default-open op basis van de prop:
   `<Accordion type="single" collapsible defaultValue={defaultNewCompanyOpen ? 'new-company' : undefined}>`
2. Verwijder de import van `Briefcase`/`ArrowLeft`/`Link`/`useRouter`/`toast` die alleen de page-header en submit-redirect betroffen; die blijven in `nieuw/page.tsx`. Het component importeert alleen wat het zelf gebruikt (zie de import-lijst hierboven).

- [ ] **Step 2: Herschrijf `nieuw/page.tsx` om `VacatureForm` te gebruiken**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { VacatureForm } from '@/components/vacatures/vacature-form'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'

export default function NieuweVacaturePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(payload: VacaturePayload) {
    if (!payload.title) {
      toast.error('Titel is verplicht')
      return
    }
    if (!payload.company_id && !payload.new_company_name) {
      toast.error('Selecteer een bedrijf of maak een nieuw bedrijf aan')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/vacatures', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Fout bij aanmaken vacature')
        return
      }
      toast.success('Vacature aangemaakt')
      router.push('/job-postings')
    } catch {
      toast.error('Fout bij aanmaken vacature')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/job-postings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Terug
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="size-8" />
            Nieuwe vacature
          </h1>
          <p className="text-muted-foreground mt-1">Maak een nieuwe vacature aan</p>
        </div>
      </div>
      <VacatureForm
        submitting={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/job-postings')}
      />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter admin type-check`
Expected: geen fouten in `vacature-form.tsx` of `nieuw/page.tsx`.

- [ ] **Step 4: Handmatige regressie van /vacatures/nieuw**

Run: `pnpm dev:admin` (of bestaande dev-server). Ga naar `/vacatures/nieuw`, maak een test-vacature aan met bestaand bedrijf. Verwacht: toast "Vacature aangemaakt" + redirect naar `/job-postings`, vacature zichtbaar.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/vacatures/vacature-form.tsx apps/admin/app/vacatures/nieuw/page.tsx
git commit -m "refactor(vacatures): extraheer create-formulier naar herbruikbaar VacatureForm"
```

---

## Task 5: `LeadAddVacancyModal`

Modal die `VacatureForm` toont in een dialog, het bedrijf van de lead vooraf matcht en bij submit een echte `job_posting` aanmaakt. Geeft bij succes de payload terug aan de parent.

**Files:**
- Create: `apps/admin/components/sales/lead-add-vacancy-modal.tsx`
- Referentie: `apps/admin/components/sales/lead-add-contact-modal.tsx` (dialog-patroon), `apps/admin/lib/utils/url.ts:41` (`extractApex`)

- [ ] **Step 1: Schrijf de modal**

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { VacatureForm, type VacatureFormInitial } from '@/components/vacatures/vacature-form'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'

type LeadCompanyContext = {
  companyName?: string | null
  domain?: string | null
  kvk?: string | null
  city?: string | null
}

type CompanyOption = { value: string; label: string }

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  lead: LeadCompanyContext
  // Geeft de aangemaakte vacature-payload terug zodat de pagina hem aan de
  // lead-pool toevoegt en selecteert.
  onCreated: (payload: VacaturePayload) => void
}

export function LeadAddVacancyModal({ open, onOpenChange, lead, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [matchedCompany, setMatchedCompany] = useState<CompanyOption | null>(null)
  const [initial, setInitial] = useState<VacatureFormInitial>({})
  const [ready, setReady] = useState(false)

  // Bij openen: probeer het bedrijf te matchen. Match -> combobox voorgevuld.
  // Geen match -> nieuw-bedrijf voorgevuld met lead-data.
  useEffect(() => {
    if (!open) return
    setReady(false)
    setMatchedCompany(null)
    const params = new URLSearchParams()
    if (lead.kvk) params.set('kvk', lead.kvk)
    if (lead.domain) params.set('domain', lead.domain)
    if (lead.companyName) params.set('name', lead.companyName)

    fetch(`/api/companies/match?${params}`)
      .then((r) => r.json())
      .then((j: { match: { id: string; name: string } | null }) => {
        if (j.match) {
          setMatchedCompany({ value: j.match.id, label: j.match.name })
          setInitial({ companyId: j.match.id, city: lead.city ?? undefined })
        } else {
          setInitial({
            newCompanyName: lead.companyName ?? undefined,
            newCompanyWebsite: lead.domain ?? undefined,
            newCompanyCity: lead.city ?? undefined,
            city: lead.city ?? undefined,
          })
        }
      })
      .catch(() => {
        setInitial({
          newCompanyName: lead.companyName ?? undefined,
          newCompanyWebsite: lead.domain ?? undefined,
          newCompanyCity: lead.city ?? undefined,
          city: lead.city ?? undefined,
        })
      })
      .finally(() => setReady(true))
  }, [open, lead.kvk, lead.domain, lead.companyName, lead.city])

  async function handleSubmit(payload: VacaturePayload) {
    if (!payload.title) {
      toast.error('Titel is verplicht')
      return
    }
    if (!payload.company_id && !payload.new_company_name) {
      toast.error('Selecteer een bedrijf of maak een nieuw bedrijf aan')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/vacatures', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Fout bij aanmaken vacature')
        return
      }
      toast.success('Vacature aangemaakt')
      onCreated(payload)
      onOpenChange(false)
    } catch {
      toast.error('Fout bij aanmaken vacature')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vacature toevoegen</DialogTitle>
          <DialogDescription>
            Maakt een echte vacature aan (review-status: in afwachting) en koppelt hem aan deze lead.
          </DialogDescription>
        </DialogHeader>
        {ready && (
          <VacatureForm
            key={open ? 'open' : 'closed'}
            initialValues={initial}
            initialCompanyOption={matchedCompany}
            defaultNewCompanyOpen={!matchedCompany}
            submitting={saving}
            submitLabel="Vacature toevoegen"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter admin type-check`
Expected: geen fouten in `lead-add-vacancy-modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/sales/lead-add-vacancy-modal.tsx
git commit -m "feat(sales-leads): LeadAddVacancyModal met bedrijf-match"
```

---

## Task 6: "Vacature toevoegen"-knop in `LeadVacanciesColumn`

Voeg een knop toe in de CardHeader (gespiegeld op de "Handmatig"-knop in `LeadContactsColumn`), open de modal en geef de aangemaakte vacature door aan de parent.

**Files:**
- Modify: `apps/admin/components/sales/lead-vacancies-column.tsx`
- Referentie: `apps/admin/components/sales/lead-contacts-column.tsx:131-139` (knop-patroon)

- [ ] **Step 1: Breid props + imports uit**

Vervang de imports en het `Props`-type bovenaan `lead-vacancies-column.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { NormalizedVacancy, RunEnrichments } from '@/lib/services/sales-leads/types'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'
import { LeadAddVacancyModal } from './lead-add-vacancy-modal'

type Props = {
  manualVacancies: NormalizedVacancy[]
  enrichments: RunEnrichments
  selectedTitles: string[]
  onChange: (selectedTitles: string[]) => void
  // Lead-context voor de 'vacature toevoegen'-modal.
  lead: {
    companyName?: string | null
    domain?: string | null
    kvk?: string | null
    city?: string | null
  }
  onVacancyCreated: (payload: VacaturePayload) => void
}
```

- [ ] **Step 2: Voeg modal-state, knop en modal toe**

Wijzig de functie-signature naar `({ manualVacancies, enrichments, selectedTitles, onChange, lead, onVacancyCreated }: Props)`. Voeg bovenaan de body toe:

```tsx
  const [modalOpen, setModalOpen] = useState(false)
```

Vervang de `CardHeader` door een versie met knop:

```tsx
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Vacatures</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
          <Plus className="size-4 mr-1" />
          Toevoegen
        </Button>
      </CardHeader>
```

Voeg vlak voor de afsluitende `</CardContent>` de modal toe:

```tsx
        <LeadAddVacancyModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          lead={lead}
          onCreated={onVacancyCreated}
        />
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter admin type-check`
Expected: één verwachte fout in `lead-verrijking/[run_id]/page.tsx` (ontbrekende props `lead` en `onVacancyCreated`) - die lost Task 7 op. Geen fouten in `lead-vacancies-column.tsx` zelf.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/sales/lead-vacancies-column.tsx
git commit -m "feat(sales-leads): vacature-toevoegen knop + modal in vacatures-kolom"
```

---

## Task 7: Lead-pagina integratie (state, auto-save, auto-selecteren)

Maak `manualVacancies` lokale state, breid de auto-save uit met `manual_vacancies`, en handel `onVacancyCreated` af (toevoegen aan pool + selecteren).

**Files:**
- Modify: `apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx`
- Hergebruik: `apps/admin/lib/services/sales-leads/manual-vacancy.ts` (`normalizeManualVacancies`, `payloadToNormalizedVacancy`)

- [ ] **Step 1: Vervang de inline helpers door imports**

Verwijder de lokale functies `normalizeManualVacancies` (regels 35-53) en gebruik de gedeelde helper. Voeg bij de imports toe (en behoud de lokale `dedupeVacancies`):

```tsx
import {
  normalizeManualVacancies,
  payloadToNormalizedVacancy,
  type VacaturePayload,
} from '@/lib/services/sales-leads/manual-vacancy'
```

Verwijder de inline `function normalizeManualVacancies(...)`-definitie (de import vervangt hem). Laat `dedupeVacancies` staan.

- [ ] **Step 2: Maak `manualVacancies` lokale state met hydratie**

Voeg bij de overige `useState`-hooks toe:

```tsx
  const [manualVacancies, setManualVacancies] = useState<NormalizedVacancy[]>([])
```

In het bestaande hydratie-`useEffect` (waar `setMaster`/`setSelected` staan), voeg toe direct na `setSelected(...)`:

```tsx
    setManualVacancies(normalizeManualVacancies(run.manual_vacancies))
```

In `onReplay` (waar `setMaster(null)` / `setSelected([])` staat) voeg toe:

```tsx
    setManualVacancies([])
```

- [ ] **Step 3: Breid de auto-save uit met `manual_vacancies`**

In het auto-save-`useEffect`: voeg `manualVacancies` toe aan het debounce-mechanisme en de payload. Wijzig de payload-opbouw:

```tsx
    const payload = JSON.stringify({
      master_record: debouncedMaster,
      selected_contacts: debouncedSelected,
      manual_vacancies: debouncedManualVacancies,
    })
```

Voeg de debounce-hook toe bij de andere:

```tsx
  const debouncedManualVacancies = useDebounce(manualVacancies, 500)
```

En voeg `debouncedManualVacancies` toe aan de dependency-array van het auto-save-effect.

- [ ] **Step 4: Handel `onVacancyCreated` af (toevoegen + auto-selecteren)**

Voeg een callback toe (binnen de component, naast de andere `useCallback`s). Hij voegt de vacature toe aan de pool (dedup op titel) en selecteert hem in `master.vacancies`:

```tsx
  const onVacancyCreated = useCallback(
    (payload: VacaturePayload) => {
      const vac = payloadToNormalizedVacancy(payload)
      const key = vac.title.trim().toLowerCase()
      setManualVacancies((prev) =>
        prev.some((v) => v.title.trim().toLowerCase() === key) ? prev : [vac, ...prev],
      )
      setMaster((prev) => {
        if (!prev) return prev
        const current = prev.vacancies ?? []
        if (current.some((v) => v.title.trim().toLowerCase() === key)) return prev
        return { ...prev, vacancies: [...current, vac] }
      })
    },
    [],
  )
```

- [ ] **Step 5: Gebruik de lokale state in `renderReviewGrid` en geef props door**

In `renderReviewGrid`: vervang `const manualVacancies = normalizeManualVacancies(run!.manual_vacancies)` (regel 247) door gebruik van de state-variabele. Omdat `manualVacancies` nu een state-variabele in de outer scope is, verwijder de lokale herdeclaratie en laat `allVacancies` de state gebruiken:

```tsx
    const websiteVacancies = run!.enrichments?.website?.parsed?.vacancies ?? []
    const allVacancies = dedupeVacancies([...manualVacancies, ...websiteVacancies])
```

Geef de nieuwe props door aan `LeadVacanciesColumn`:

```tsx
          <LeadVacanciesColumn
            manualVacancies={manualVacancies}
            enrichments={run!.enrichments ?? {}}
            selectedTitles={selectedVacancyTitles}
            onChange={setSelectedVacancyTitles}
            lead={{
              companyName: currentMaster.company_name ?? null,
              domain: run!.input_domain ? extractApex(run!.input_domain) : null,
              kvk: currentMaster.kvk_number ?? null,
              city: currentMaster.address?.city ?? null,
            }}
            onVacancyCreated={onVacancyCreated}
          />
```

Noot: verifieer de exacte velden op `MasterRecord` voor `company_name`, `kvk_number` en `address.city` in `lib/services/sales-leads/types.ts:174-205`. Pas de paden aan als ze afwijken (bv. `currentMaster.address?.city`).

- [ ] **Step 6: Type-check**

Run: `pnpm --filter admin type-check`
Expected: geen fouten. (Als `address.city` niet bestaat, gebruik het juiste adresveld uit `NormalizedAddress`.)

- [ ] **Step 7: Commit**

```bash
git add apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx
git commit -m "feat(sales-leads): handmatige vacature toevoegen + persisteren in lead-verrijking"
```

---

## Task 8: Volledige verificatie

**Files:** geen wijziging; dit is de verify-fase.

- [ ] **Step 1: Type-check (hele admin-app)**

Run: `pnpm --filter admin type-check`
Expected: clean.

- [ ] **Step 2: Vitest (auth-gate + nieuwe helper-test)**

Run: `pnpm --filter admin test -- auth-coverage manual-vacancy`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm --filter admin lint`
Expected: geen nieuwe errors in gewijzigde bestanden. Controleer specifiek: geen em-dash (U+2014).

- [ ] **Step 4: Handmatige end-to-end op een lead**

Start `pnpm dev:admin`. Open een lead op `/sales/lead-verrijking/[run_id]` in status `review`. Klik "Toevoegen" in de Vacatures-kolom.
- Verwacht: modal opent, bedrijf is voorgevuld (gematcht of nieuw-bedrijf met lead-data).
- Vul titel + enkele details in, klik "Vacature toevoegen".
- Verwacht: toast "Vacature aangemaakt", modal sluit, vacature staat **aangevinkt** in de lijst.

- [ ] **Step 5: Verifieer de echte job_posting + persistentie**

- Controleer via Supabase (`select id, title, company_id, review_status from job_postings order by created_at desc limit 1`): record bestaat, juiste `company_id`, `review_status = 'pending'`.
- Refresh de lead-pagina. Verwacht: de vacature blijft zichtbaar en aangevinkt (gepersisteerd in `manual_vacancies` + `master_record.vacancies`).
- Controleer dat de vacature **niet** publiek is (review pending -> geen `published_at`).

- [ ] **Step 6: Regressie /vacatures/nieuw**

Maak nog een vacature aan via `/vacatures/nieuw`. Verwacht: ongewijzigd gedrag (aanmaken + redirect).

- [ ] **Step 7: Finishing**

Gebruik `superpowers:finishing-a-development-branch` om de branch af te ronden (PR naar `main` met groene checks).
```
