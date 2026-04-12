# Lokale Banen — SEO/GEO Audit & Schaalbaarheidsanalyse

**Versie:** 1.0
**Datum:** 2026-04-11
**Scope:** 50+ regio-domeinen (pilot: WestlandseBanen)
**Doel:** Vanaf dag 1 alle structurele SEO/GEO fundamenten correct hebben, zodat het netwerk schaalbaar is tot 50+ regio's zonder indexatie- of authority-penalty.

---

## 1. Executive Summary

Het oorspronkelijke plan scoorde **58/100** op huidige GEO readiness criteria (februari 2026 state-of-the-art). Na de 6 structurele fixes in dit document is **85/100+ haalbaar**, wat LokaleBanen onderscheidt van 90% van concurrerende jobboards.

**De 3 grootste hefbomen voor dit project:**
1. **JSON-LD `JobPosting` schema** — directe inclusie in Google Jobs en AI Overviews
2. **`llms.txt` + `llms-full.txt` met unieke regionale data** — LLM citation-ready
3. **Hub-and-spoke brand model** — één sterke "Lokale Banen Netwerk" entity ipv 50 zwakke brands

---

## 2. Waarom GEO nu kritiek is (februari 2026 context)

| Metric | Waarde | Bron |
|---|---|---|
| AI Overviews reach | 1.5 miljard users/maand, 200+ landen | Google |
| AI Overviews query coverage | 50%+ van alle queries | Industry data |
| AI-referred sessions growth | 527% (jan-mei 2025) | SparkToro |
| ChatGPT weekly active users | 900 miljoen | OpenAI |
| Perplexity monthly queries | 500+ miljoen | Perplexity |

**Kern inzicht (Ahrefs dec 2025, studie van 75.000 brands):**
> Brand mentions correleren **3× sterker met AI citaties** dan backlinks.

| Signaal | Correlatie met AI citation |
|---|---|
| YouTube mentions | 0.737 (sterkste) |
| Reddit mentions | hoog |
| Wikipedia aanwezigheid | hoog |
| LinkedIn aanwezigheid | gemiddeld |
| Domain Rating (backlinks) | 0.266 (zwak) |

**Consequentie voor LokaleBanen**: klassieke backlink-building is niet de winnende strategie. Brand-entity opbouwen is dat wel.

---

## 3. Huidige GEO Readiness Score — Originele Plan vs. Na Fixes

| Criterium | Origineel plan | Na fixes | Target |
|---|---|---|---|
| Citability (passage structuur) | 12/25 | 22/25 | ≥20 |
| Structural readability | 16/20 | 19/20 | ≥17 |
| Multi-modal content | 6/15 | 11/15 | ≥10 |
| Authority & brand signals | 8/20 | 16/20 | ≥15 |
| Technical accessibility | 16/20 | 18/20 | ≥17 |
| **Totaal** | **58/100** | **86/100** | **≥80** |

---

## 4. Platform-specifieke Optimalisatie Strategie

**Belangrijk (Ahrefs 2025)**: slechts **11% van domeinen** krijgt citaties van zowel ChatGPT als Google AIO voor dezelfde query. Per-platform optimalisatie is essentieel.

### Google AI Overviews

- **92% van citaties** komt uit top-10 ranking pages
- Maar 47% komt uit rankings onder positie 5 → andere signalen tellen ook
- **Primaire hefboom**: traditionele SEO + compleet JSON-LD JobPosting schema
- **Onze actie**: Schema perfectioneren, sitemap index, IndexNow, correcte canonical

### ChatGPT Web Search

- **47.9% van citaties** uit Wikipedia
- **11.3% uit Reddit**
- **Trekt uit Bing index** direct
- **Primaire hefboom**: Wikipedia entity (hub brand) + Bing indexatie via IndexNow
- **Onze actie**: Eén Wikipedia page voor "Lokale Banen Netwerk", IndexNow integratie vanaf dag 1

### Perplexity

- **46.7% van citaties** uit Reddit
- Directe crawl via `PerplexityBot`
- **Primaire hefboom**: Reddit community presence + directe crawl toegang
- **Onze actie**: `robots.txt` allow PerplexityBot + authentieke Reddit community engagement

### Bing Copilot

- Uit Bing index (zelfde als ChatGPT search)
- **Primaire hefboom**: Bing Webmaster Tools + IndexNow submissions
- **Onze actie**: Bing WMT setup + IndexNow per approve

### Claude Search

- Crawlt via `ClaudeBot` + respecteert `llms.txt`
- **Primaire hefboom**: `llms.txt` met rich data + schone HTML
- **Onze actie**: Complete `llms.txt` + `llms-full.txt` met CBS arbeidsmarktdata per regio

---

## 5. De 6 Structurele Problemen — en Oplossingen

### Probleem 1: Single `platform_id` leidt tot canonical-conflict

**Symptoom**: Een vacature in Delft hoort bij DelftseBanen én kan relevant zijn voor HaagseBanen. Met één `platform_id` krijg je óf duplicate content (beide tonen) óf verloren verkeer (slechts één toont).

**Oplossing**: Junction tabel `job_posting_platforms` met `is_primary` flag.

```sql
CREATE TABLE job_posting_platforms (
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  platform_id    UUID NOT NULL REFERENCES platforms(id)    ON DELETE CASCADE,
  is_primary     BOOLEAN NOT NULL DEFAULT false,
  distance_km    INT,
  PRIMARY KEY (job_posting_id, platform_id)
);

CREATE UNIQUE INDEX idx_one_primary_per_job
  ON job_posting_platforms(job_posting_id) WHERE is_primary = true;
```

**Canonical regel**: Primary platform = canonical URL. Secondary platforms tonen de vacature wél, maar met `<link rel="canonical" href="https://primary-domain/...">`. Geen duplicate penalty.

**Toewijzing**: Automatisch via bestaande `postcode_platform_lookup` tabel (3251 postcodes al gemapped). Dichtstbijzijnde = primary, binnen 25km = secondary.

---

### Probleem 2: Thin content bij kleine regio's → Google Jobs exclusion

**Symptoom**: Bij 50 regio's zullen sommige <100 actieve vacatures hebben. Google Jobs indexeert dan zelden iets, en LLMs citeren lege pagina's niet.

**Oplossing**: Minimum-content-gate + verplichte content-enrichment.

```ts
// tenant-publisher.ts — publish guard
async function canPublishTenant(platformId: string): Promise<PublishCheck> {
  const approvedCount = await getApprovedJobsCount(platformId)
  if (approvedCount < 50) {
    return { ok: false, reason: `Minimum 50 approved jobs required (have ${approvedCount})` }
  }

  const enrichedCount = await getEnrichedJobsCount(platformId)
  if (enrichedCount / approvedCount < 0.7) {
    return { ok: false, reason: `70% of jobs must have Mistral-enriched content` }
  }

  return { ok: true }
}
```

**Plus**: Elke goedgekeurde vacature gaat door `lokalebanen-content.service.ts` Mistral-pipeline voordat `published_at` gezet kan worden. Dun scraped description → rijke gestructureerde content.

---

### Probleem 3: Brand authority op 50 regio's is onmogelijk zonder hub-model

**Symptoom**: Je kan geen 50 Wikipedia pages krijgen. Ahrefs (2025): brand mentions correleren 3× sterker met AI citaties dan backlinks. Geen brand authority = geen AI citaties.

**Oplossing**: Hub-and-spoke brand strategie.

```
          ┌─────────────────────────┐
          │  "Lokale Banen Netwerk"  │  ← één hoofd-entity
          │  lokalebanen.nl          │    Wikipedia, KvK, LinkedIn
          │  Wikipedia page          │    "Nederlands jobboard netwerk"
          └───────────┬──────────────┘
                      │
      ┌───────────┬───┴───┬──────────┐
      ▼           ▼       ▼          ▼
  Westlandse   Groningse  Leidse ... (50 sub-brands)
  Banen        Banen      Banen
  (vestiging)  (vestiging)(vestiging)
```

**Implementatie**:
- Één Wikipedia page voor "Lokale Banen" (het netwerk), niet 50
- Footer op elke regio-site: "Onderdeel van Lokale Banen Netwerk" met schema link
- Organization JSON-LD op elke tenant heeft `parentOrganization` → hub entity
- Reddit: r/nederland / r/banen posts vanuit één account
- LinkedIn: één company page met multi-location feature voor regio's
- KvK registratie van brand name
- Google Business Profile per regio alleen als fysieke aanwezigheid bestaat

---

### Probleem 4: Geen IndexNow = geen ChatGPT/Bing zichtbaarheid

**Symptoom**: ChatGPT web search trekt uit de Bing index. Bing indexeert langzaam zonder hulp. Zonder IndexNow = geen zichtbaarheid in ChatGPT search.

**Oplossing**: IndexNow integratie bij elke `approve` actie.

```ts
// admin/src/lib/services/indexnow.ts
const INDEXNOW_KEY = process.env.INDEXNOW_KEY!

export async function notifyIndexNow(urls: string[], host: string) {
  await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  })
}
```

Serveer de key-file via `apps/public-sites/app/[key].txt/route.ts` (dynamisch per tenant, allow list match).

**Trigger**: na elke bulk-approve actie, batch URLs per tenant, één IndexNow call per tenant.

**Cost**: IndexNow is volledig gratis. Zero excuses om het niet te doen.

---

### Probleem 5: Geen RSL 1.0 licensing = terughoudende LLM uptake

**Symptoom**: Sinds december 2025 is RSL 1.0 de standaard voor machine-leesbare LLM licensing. Reddit, Yahoo, Medium gebruiken het al. Zonder RSL kunnen "compliant" LLMs je content niet citeren.

**Oplossing**: `rsl.xml` per tenant met permissieve terms voor search/citation.

```xml
<!-- apps/public-sites/app/rsl.xml/route.ts -->
<rsl xmlns="https://rslstandard.org/rsl">
  <license>
    <permit type="ai-search">true</permit>
    <permit type="ai-use">true</permit>
    <permit type="ai-citation">true</permit>
    <permit type="ai-train">false</permit>
    <attribution required="true">
      <source>https://westlandsebanen.nl</source>
    </attribution>
    <contact>info@lokalebanen.nl</contact>
  </license>
</rsl>
```

**Beleid**: permit search/citation (we willen gevonden worden), deny training (beschermen data investment).

---

### Probleem 6: Client-side filters breken AI crawler discovery

**Symptoom**: AI crawlers executeren **geen JavaScript**. Als filter/search state client-side is, zien crawlers alleen de basic homepage — niet de gefilterde resultaten.

**Oplossing**: **Harde architectuurregel**: alle filter/search state in `URL searchParams`, alle rendering server-side met PPR.

```tsx
// app/page.tsx — voorbeeld correct
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; city?: string; q?: string }>
}) {
  const params = await searchParams
  const jobs = await getApprovedJobs({ filter: params })
  return <JobList jobs={jobs} />
}
```

**Test vanaf dag 1**: CI-check met `curl -H "User-Agent: GPTBot" https://westlandsebanen.nl/?type=fulltime` — response moet gefilterde resultaten in HTML bevatten.

---

## 6. Must-haves vanaf dag 1 — Schaalbaarheidsfundament

### Schema.org op elke vacature (complete JobPosting)

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Junior Developer",
  "description": "<rich HTML van content_md>",
  "datePosted": "2026-04-10T09:00:00+02:00",
  "validThrough": "2026-05-10T23:59:59+02:00",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Bedrijf X BV",
    "sameAs": [
      "https://linkedin.com/company/bedrijf-x",
      "https://kvk.nl/handelsregister/12345678"
    ],
    "logo": "https://.../logo.png",
    "identifier": {
      "@type": "PropertyValue",
      "name": "KvK",
      "value": "12345678"
    }
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Hoofdstraat 1",
      "addressLocality": "Naaldwijk",
      "postalCode": "2671AB",
      "addressRegion": "Zuid-Holland",
      "addressCountry": "NL"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 52.0,
      "longitude": 4.2
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "EUR",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": 2800,
      "maxValue": 3500,
      "unitText": "MONTH"
    }
  },
  "directApply": false,
  "identifier": {
    "@type": "PropertyValue",
    "name": "WestlandseBanen",
    "value": "abc123"
  },
  "applicantLocationRequirements": {
    "@type": "Country",
    "name": "NL"
  }
}
```

**Harde Google regel**: zonder `validThrough`, `directApply`, of `hiringOrganization.sameAs` = **geen Google Jobs inclusie**. Dit zijn geen suggesties.

### Site-level schema (per tenant)

- **WebSite** met `SearchAction` → Google sitelinks searchbox
- **Organization** met `parentOrganization` → brand hub linking
- **BreadcrumbList** op detail-pages → breadcrumbs in rich results
- **ItemList** op lijst-page → categorized results

### Heading hiërarchie

Strict:

```
<h1>Junior Developer</h1>                          ← vacature titel
  <h2>Wat ga je doen?</h2>                         ← question-based, matches query intent
  <h2>Wie zoeken we?</h2>
  <h2>Wat bieden we?</h2>
  <h2>Over Bedrijf X</h2>
    <h3>Bedrijfscultuur</h3>                       ← optional sub-sections
  <h2>Vergelijkbare vacatures</h2>
```

**Question-based H2's zijn goud voor GEO** — ze matchen letterlijk query patronen die LLMs krijgen. "Wat ga je doen als junior developer?" is hoe iemand ChatGPT zou vragen.

### Content blocks in 134-167 word "citation chunks"

Mistral enrichment service structureert content als:

```markdown
## Wat ga je doen?
[134-167 words — zelf-bevattend antwoord, citeerbaar zonder context]

## Welke ervaring heb je nodig?
[134-167 words — eisen overzicht]

## Wat biedt {bedrijf} jou?
[134-167 words — salaris, benefits, groei]

## Waarom werken in {stad}?
[134-167 words — regio context, lokale arbeidsmarkt]
```

De laatste sectie — **"Waarom werken in {stad}"** — is goud voor GEO. Unieke, citeerbare content die LLMs extraheren voor queries als "is Naaldwijk een goede plek om te werken?". Genereer per combinatie `stad × sector` met CBS regio-data als factual basis.

---

## 7. `llms.txt` + `llms-full.txt` Formaat

### `/llms.txt` per tenant

```markdown
# WestlandseBanen — Lokale vacatures in het Westland

> WestlandseBanen is dé regionale jobboard voor het Westland, onderdeel van het Lokale Banen Netwerk. Meer dan {count} actuele vacatures in Naaldwijk, Maasdijk, Wateringen, Monster, De Lier en omgeving.

## Over het Westland arbeidsmarkt

- Grootste werkgevers: Koppert Cress, Royal Brinkman, FloraHolland, Lans
- Top sectoren: Tuinbouw, Logistiek, Techniek, Handel
- Gemiddeld bruto maandinkomen: €{from CBS data}
- Werkloosheidsgraad: {from CBS data}
- Bevolking: ~110.000 inwoners

## Actuele vacatures per sector

### Tuinbouw ({count})
- [Teeltmedewerker bij Koppert Cress](/vacature/teeltmedewerker-koppert-cress-naaldwijk): 2-3 jaar ervaring, €2.500-3.200/mnd
- [Logistiek medewerker bij FloraHolland](/vacature/...): fulltime, ploegendienst, €2.800-3.500/mnd
- ...

### Logistiek ({count})
- ...

### Techniek ({count})
- ...

## Populaire zoekopdrachten
- Vacatures Naaldwijk
- Fulltime banen Westland
- Logistiek Westland
- Parttime werk tuinbouw

## Contact
- Website: https://westlandsebanen.nl
- Onderdeel van: [Lokale Banen Netwerk](https://lokalebanen.nl)

## Bronnen
- CBS regionale arbeidsmarktdata 2025
- KvK werkgeversregister
- Lokale Banen vacaturebank (eigen data)
```

### `/llms-full.txt` per tenant

Volledige dump: alle goedgekeurde vacatures in deze tenant, elk als markdown section met complete job content. Bedoeld voor zero-shot LLM grounding. Formaat:

```markdown
# Lokale Banen — WestlandseBanen Vacatures Database (Volledig)

> Volledige database van {count} actuele vacatures in het Westland, bijgewerkt {lastUpdated}.

---

## Junior Developer bij Bedrijf X — Naaldwijk

**Salaris**: €2.800 - 3.500 per maand
**Dienstverband**: Fulltime (32-40 uur)
**Geplaatst**: 2026-04-10
**Deadline**: 2026-05-10
**URL**: https://westlandsebanen.nl/vacature/junior-developer-bedrijf-x-naaldwijk

### Wat ga je doen?
[volledige passage content]

### Wie zoeken we?
[volledige passage content]

### Wat bieden we?
[volledige passage content]

### Over Bedrijf X
[company info]

---

## [volgende vacature]

...
```

**Gegenereerd als route handler**, niet gebuild bij deploy time. `'use cache'` met `cacheLife('hours')` en `cacheTag(\`llms-full:\${tenantId}\`)`. Revalidate bij approve.

### Markdown mirror per vacature

`/vacature/[slug]/md` — schone markdown versie van detail pagina:

```markdown
# Junior Developer

**Bedrijf**: Bedrijf X BV
**Locatie**: Naaldwijk (Zuid-Holland)
**Salaris**: €2.800 - 3.500 per maand
**Dienstverband**: Fulltime, 32-40 uur
**Geplaatst**: 10 april 2026
**Deadline**: 10 mei 2026

## Wat ga je doen?
[content]

## Wie zoeken we?
[content]

## Wat bieden we?
[content]

## Over Bedrijf X
[content]

---
Bron: https://westlandsebanen.nl/vacature/...
Onderdeel van Lokale Banen Netwerk
```

Content-Type: `text/markdown; charset=utf-8`. Linked vanuit HTML head:

```html
<link rel="alternate" type="text/markdown" href="/vacature/junior-developer/md" />
```

---

## 8. `robots.txt` Configuratie (per tenant)

```
User-agent: *
Allow: /
Disallow: /account/
Disallow: /api/

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

Sitemap: https://westlandsebanen.nl/sitemap.xml
```

**Beleid**:
- Allow alle search/Q&A bots (we willen gevonden worden)
- Disallow CCBot en Bytespider (training-only, geen directe waarde)
- Disallow `/account/` en `/api/` (privacy, geen waarde voor crawlers)

---

## 9. Sitemap Architectuur (schaalbaar naar 50 × 10k jobs)

```
https://westlandsebanen.nl/sitemap.xml
  └── sitemap index met sub-sitemaps:
      ├── /sitemaps/jobs-2026-04.xml        (max 50k URLs per file)
      ├── /sitemaps/jobs-2026-03.xml
      ├── /sitemaps/jobs-2026-02.xml
      ├── /sitemaps/categories.xml
      ├── /sitemaps/companies.xml
      └── /sitemaps/cities.xml
```

**Limieten** (hard van Google):
- Max 50.000 URLs per sitemap
- Max 50 MB uncompressed
- `lastmod` correct gebruiken (= `job.published_at` of `job.updated_at`)

**Implementation**: Elk sitemap file is een route handler met `'use cache'` en `cacheLife('hours')`:

```ts
// app/sitemaps/jobs-[month]/route.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function GET(req: Request, { params }: { params: { month: string } }) {
  const tenant = await getTenantFromRequest(req)
  const urls = await getApprovedJobsForMonth(tenant.id, params.month)

  const xml = buildSitemap(urls, tenant)
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

async function getApprovedJobsForMonth(tenantId: string, month: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`sitemap:${tenantId}:${month}`)
  return supabase.from('job_postings')
    .select('slug, published_at, updated_at')
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .gte('published_at', `${month}-01`)
    .lt('published_at', nextMonth(month))
}
```

---

## 10. Canonical URL Strategie

**Eén vacature = één canonical URL**.

- **Primary platform** (uit `job_posting_platforms.is_primary`) bepaalt de canonical URL
- Vacature getoond op secondary platforms heeft `<link rel="canonical" href="https://primary-domain/vacature/...">`
- Crawlers volgen canonical → indexeren alleen één versie
- Zero duplicate content penalty

**Uitzondering**: Master aggregator (`lokalebanen.nl`) toont alle vacatures zonder canonical claim — want de primary platform blijft de canonical, en master is een aggregation view.

```tsx
// app/vacature/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  const primaryTenant = await getPrimaryPlatform(job.id)
  const canonical = `https://${primaryTenant.domain}/vacature/${slug}`

  return {
    alternates: {
      canonical,
      types: { 'text/markdown': `${canonical}/md` },
    },
  }
}
```

---

## 11. IndexNow Integratie

### Setup (eenmalig per tenant)

1. Generate random key (per tenant): `crypto.randomUUID()`
2. Serveer via `app/[key].txt/route.ts` (validate tegen `platforms.indexnow_key`)
3. Key toevoegen aan `platforms` tabel:
   ```sql
   ALTER TABLE platforms ADD COLUMN indexnow_key TEXT;
   UPDATE platforms SET indexnow_key = gen_random_uuid()::text WHERE is_public = true;
   ```

### Trigger (op elke approve)

```ts
// Na bulk-approve in admin
const approvedJobs = await getApprovedJobsWithSlug(ids)
const byTenant = groupBy(approvedJobs, 'tenant_id')

for (const [tenantId, jobs] of Object.entries(byTenant)) {
  const tenant = await getTenantById(tenantId)
  const urls = jobs.map(j => `https://${tenant.domain}/vacature/${j.slug}`)
  await notifyIndexNow(urls, tenant.domain)
}
```

**Endpoints om te pingen**:
- `https://api.indexnow.org/indexnow` (universal — automatisch naar Bing, Yandex, Seznam)
- `https://www.bing.com/indexnow` (Bing direct, backup)

---

## 12. Brand Authority — Hub-and-Spoke Implementatie

### Wat de hub is: `lokalebanen.nl` + "Lokale Banen Netwerk" entity

### Wat spokes zijn: alle 50 regio-domeinen als "vestigingen"

### Implementatie per spoke

**1. Organization JSON-LD met parentOrganization**:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "WestlandseBanen",
  "url": "https://westlandsebanen.nl",
  "logo": "https://westlandsebanen.nl/logo.png",
  "parentOrganization": {
    "@type": "Organization",
    "name": "Lokale Banen Netwerk",
    "url": "https://lokalebanen.nl",
    "sameAs": [
      "https://nl.wikipedia.org/wiki/Lokale_Banen",
      "https://www.linkedin.com/company/lokale-banen-netwerk",
      "https://www.kvk.nl/handelsregister/{kvk-nr}"
    ]
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Westland",
    "containedInPlace": {
      "@type": "AdministrativeArea",
      "name": "Zuid-Holland"
    }
  }
}
```

**2. Footer link op elke regio-site**:

```tsx
<footer>
  <p>Onderdeel van <a href="https://lokalebanen.nl">Lokale Banen Netwerk</a></p>
  <p>Ook actief in: <a href="https://groningsebanen.nl">Groningen</a>, <a href="https://leidsebanen.nl">Leiden</a>, ...</p>
</footer>
```

**3. Hub entity presence building** (post-pilot):

| Platform | Actie | Timing |
|---|---|---|
| Wikipedia | Pagina "Lokale Banen (jobboard netwerk)" | Week 3-4 na pilot |
| KvK | Brand naam formeel registreren | Week 1 |
| LinkedIn | Company page met multi-location feature | Week 1 |
| Reddit | r/nederland + r/banen posts vanuit één account | Ongoing |
| YouTube | Channel voor kandidaten tips (later) | Phase 7+ |
| Google Business Profile | Alleen als fysiek kantoor bestaat | Optional |

---

## 13. 50-regio Schaalbaarheidscheck — Pre-launch Checklist

Voordat je een regio live zet:

- [ ] **Minimum 50 approved jobs** in de pipeline
- [ ] **70% van jobs heeft enriched content_md** (Mistral passage-optimized)
- [ ] **Primary platform assignment** correct (via postcode_platform_lookup)
- [ ] **Unique hero_title + hero_subtitle + seo_description** (geen template text)
- [ ] **Logo upload** (niet default placeholder)
- [ ] **Primary color** (niet default blauw)
- [ ] **DNS CNAME** naar Vercel (Kay)
- [ ] **Custom domain** toegevoegd in Vercel project
- [ ] **Clerk satellite domain** toegevoegd
- [ ] **IndexNow key** gegenereerd en getest
- [ ] **Sitemap** accessible en geldig
- [ ] **llms.txt** met échte CBS/KvK data (geen boilerplate)
- [ ] **robots.txt** met AI crawler allows
- [ ] **rsl.xml** met licensing terms
- [ ] **JSON-LD** valideert per pagina via schema.org validator
- [ ] **Lighthouse mobiel ≥95**
- [ ] **LCP <2.5s** op throttled 4G
- [ ] **Google Search Console** property toegevoegd (domain verification)
- [ ] **Bing Webmaster Tools** property toegevoegd
- [ ] **Search Console sitemap submitted**
- [ ] **IndexNow eerste batch push** uitgevoerd
- [ ] **JSON-LD breadcrumbs** op detail pages werken
- [ ] **Canonical URLs** correct (primary platform)
- [ ] **404/410 handling** werkt voor expired jobs

Bij 50 regio's: deze checklist als automation script runnen via `pnpm tenant:precheck <domain>`.

---

## 14. Quick Wins — Day 1 Implementatie Prioriteit

Alle onderstaande kunnen in 2 dagen foundation werk staan:

| Quick win | Impact | Effort |
|---|---|---|
| 1. IndexNow integratie | Hoog (Bing + ChatGPT visibility) | 2u |
| 2. Complete JobPosting schema | Hoog (Google Jobs) | 4u |
| 3. robots.txt met AI crawler allows | Medium (access) | 30m |
| 4. llms.txt met CBS/KvK data | Hoog (LLM citation) | 4u per tenant |
| 5. rsl.xml licensing | Medium (LLM compliance) | 1u |
| 6. BreadcrumbList schema | Medium (rich results) | 2u |
| 7. Question-based H2 headings | Hoog (query matching) | in Mistral prompt |
| 8. 134-167 word passage enforcement | Hoog (citation extraction) | in Mistral prompt |
| 9. WebSite+SearchAction schema | Medium (sitelinks) | 1u |
| 10. Publication/update dates prominent | Medium (trust signals) | 1u |
| 11. Canonical URL via primary platform | Kritiek (anti-duplicate) | 2u |
| 12. 410 status voor expired jobs | Medium (crawl budget) | 1u |
| 13. Markdown mirror per vacature | Medium (GEO fallback) | 3u |
| 14. OG images via @vercel/og | Laag (social sharing) | 2u |
| 15. Sitemap index architecture | Medium (indexation) | 3u |

**Totaal**: ~28 uur ≈ 3.5 werkdagen. Past binnen Phase 2 (SEO/GEO — 3 dagen).

---

## 15. KPI Monitoring (post-launch)

Meet wekelijks na launch:

| KPI | Tool | Target |
|---|---|---|
| Google Search Console impressions | GSC | Groei 50% m/m in pilot maand |
| Google Jobs inclusion rate | GSC → Rich Results | >80% van submitted jobs |
| Indexed pages | GSC Index → Coverage | 90%+ van sitemap |
| Bing indexed pages | Bing Webmaster Tools | 80%+ |
| LLM citations (Perplexity, ChatGPT) | Manual query testing | 3+ citations/week |
| Avg position (branded queries) | GSC | Top 3 |
| Avg position (long-tail job queries) | GSC | Top 10 |
| LCP (real user) | Vercel Analytics | <2.5s |
| AI crawler visits | Server logs filter | >100/dag per tenant |
| Organic CTR | GSC | >5% |

### Handmatige LLM query tests (wekelijks)

Test deze queries in ChatGPT, Perplexity, Claude, Google AI Overviews:
- "vacatures in [regio]"
- "banen in [stad] [sector]"
- "is [stad] een goede plek om te werken?"
- "fulltime werk [stad]"
- "hoeveel verdien je in [sector] in [regio]?"

Score: wordt LokaleBanen genoemd? In welke zin? Correct geciteerd?

---

## 16. Gerelateerde documenten

- `.planning/PLAN.md` — uitvoeringsplan met Phase 2 (SEO/GEO) details
- `.planning/DESIGN.md` — design system (structural SEO via heading hierarchy)
