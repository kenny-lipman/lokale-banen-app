# Task 3 Plan — Admin UI Wizards, Image Upload & Junction Reads

**Auteur**: Claude (CTO-modus)
**Datum**: 2026-04-15
**Status**: Ter goedkeuring door Kenny
**Scope**: 3 samenhangende features die de admin zelfstandig maken en het platform schaalbaar maken naar "1 vacature in meerdere regio's"

---

## 1. Executive Summary

Drie features, in volgorde van impact:

| # | Feature | Waarom nu? | Effort |
|---|---------|-----------|--------|
| A | **Platform Go-Live Wizard + Branding Editor** | 25 platforms zijn live via DB-seeds, maar Luc/Kay moeten zelfstandig branding kunnen aanpassen zonder SQL. Nu is elke tekstwijziging een dev-taak. | 1.5 dag |
| B | **Image Upload (Supabase Storage)** | Luc/Kay moeten logo's, favicons en OG images kunnen uploaden. Nu is het enige alternatief: URL plakken in admin — onpraktisch en foutgevoelig. | 1 dag |
| C | **Junction Reads (`job_posting_platforms`)** | Eén vacature in Doetinchem hoort ook op Zutphense en Winterswijkse jobboards — de Achterhoek. Nu kan 1 vacature maar 1 regio bedienen. | 0.5 dag |

**Totaal**: ~3 werkdagen.

**Volgorde afhankelijkheid**: A en B zijn onafhankelijk. C is onafhankelijk van admin UI maar vereist een DB-check voor performance. A→B→C kan parallel of sequentieel.

---

## 2. Feature A — Platform Go-Live Wizard + Branding Editor

### Business context

**Wie gebruikt dit?** Luc (product owner) en Kay (domains/branding).

**Wat willen ze kunnen doen?**
- Nieuw platform van `is_public=false` naar live brengen in 1 flow (nu 8+ losse DB updates nodig)
- Hero title, subtitle, SEO description aanpassen zonder dev
- Kleur-scheme per regio kiezen uit presets of hex picker
- Sociale links + contact info invoeren
- Privacy / terms tekst (rich text) per platform beheren
- Voorproefje van de site zien voor publicatie

**Huidige pijnpunt**: 25 platforms zijn via DB-seed live met default "Vacatures in X en omgeving" copy. Luc heeft geen admin-schil om dit te personaliseren. Elke copy-wijziging = Claude/Kenny taak. Schaalt niet.

**Business waarde**:
- Autonome content-iteratie zonder dev-afhankelijkheid
- Tijdige go-live van nieuwe regio's (NovemberseBanen, RotterdamseBanen etc. komen later)
- Centraal overzicht van platform-gezondheid (welke zijn compleet, welke missen assets)

### Frontend schema

```
┌─────────────────────────────────────────────────────────────────┐
│  /dashboard/platforms (bestaat al — uitbreiden)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [+ Nieuwe regio toevoegen]                     [zoek: ____]     │
│                                                                   │
│  Status  Naam                Domain            Vacatures  Acties │
│  🟢 Live  UtrechtseBanen     utrechtsebanen.nl    27.676  [Edit] │
│  🟡 Conf  RotterdamseBanen   rotterdamsebanen.nl      0   [Edit] │
│  ⚪ Draft MiddelburgseBanen  —                        0   [Edit] │
│                                                                   │
│  Legenda: 🟢 is_public + domain gezet + vacatures>0              │
│           🟡 is_public maar geen vacatures of geen domain        │
│           ⚪ is_public=false (draft)                             │
└─────────────────────────────────────────────────────────────────┘
                              │ click Edit
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  /dashboard/platforms/[id] (bestaat al — uitbreiden)             │
├─────────────────────────────────────────────────────────────────┤
│  UtrechtseBanen  [🟢 Live]                        [Bekijk site▸] │
│                                                                   │
│  ┌────────────────┬────────────────┬────────────────┐            │
│  │ Tab: Basis     │ Tab: Branding  │ Tab: Content   │            │
│  │                │                │                │            │
│  │ Tab: SEO       │ Tab: Contact   │ Tab: Go-Live   │            │
│  └────────────────┴────────────────┴────────────────┘            │
│                                                                   │
│  [... tab-specifiek formulier ...]                               │
│                                                                   │
│  [Auto-save na 2s — of explicit Save knop bovenin]               │
└─────────────────────────────────────────────────────────────────┘
```

### Tab layout

**Tab "Basis"**:
```
Platform naam    : UtrechtseBanen
Centrale plaats  : Utrecht
Tier             : [dropdown: free / premium / enterprise]
Is public        : [toggle on/off]
Production .nl   : utrechtsebanen.nl
Preview (Vercel) : utrechtsebanen.vercel.app (read-only)
```

**Tab "Branding"**:
```
Logo             : [upload component — bestaat uit taak B]
Favicon          : [upload component]
OG image         : [upload component — voor Twitter/LinkedIn preview]

Primary color    : [color picker] + [5 hex presets per regio]
                   Preview: "Knop", badges, links in gekozen kleur
```

**Tab "Content"** (copy/marketing):
```
Hero title       : [text, max 80 chars] — "Vacatures in Utrecht en omgeving"
Hero subtitle    : [textarea, max 200] — "Ontdek de beste lokale banen..."
About text       : [rich text editor — markdown] — /over-ons pagina
Privacy text     : [rich text — markdown]
Terms text       : [rich text — markdown]
```

**Tab "SEO"**:
```
SEO description  : [textarea, max 160] — voor <meta description>
Indexnow key     : [read-only UUID, copy-to-clipboard]
Robots mode      : [dropdown: allow all / noindex drafts / disabled]
```

**Tab "Contact"**:
```
Contact email    : info@utrechtsebanen.nl
Contact phone    : +31 ...
LinkedIn         : https://linkedin.com/company/...
Instagram        : ...
Facebook         : ...
TikTok           : ...
Twitter/X        : ...
```

**Tab "Go-Live"** (de wizard):
```
Checklist:
  [✓] Domain gezet
  [✓] Primary color gekozen
  [✗] Logo geupload (optioneel maar aanbevolen)
  [✓] Hero title ingevuld
  [✓] SEO description ingevuld
  [✗] Minstens 10 approved vacatures
  [✗] About text gevuld

[Preview site ▸]   [🚀 Live zetten]  (alleen actief bij alle required checks)
```

### Backend schema

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN UI (client component)                   │
│              /dashboard/platforms/[id]                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ PATCH /api/platforms/[id]
                               │ body: { [field]: value, ... }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXISTING: /api/review/platforms/[id] (PATCH)                    │
│  UITBREIDEN:                                                      │
│   - Accept alle 25 kolommen (niet alleen is_public/domain)       │
│   - Valideer: domain uniek, primary_color hex, emails valid      │
│   - updated_at trigger (nu via platforms.updated_at kolom)       │
│   - Call revalidatePublicSite({ platformIds: [id] })             │
│                                                                   │
│  NEW: GET /api/platforms/[id]/go-live-check                      │
│   - Return checklist state (vacancy count, assets present, etc.) │
│                                                                   │
│  NEW: POST /api/platforms/[id]/go-live                           │
│   - Validate all required fields filled                          │
│   - Set is_public=true + published_at=now() atomically           │
│   - Trigger revalidate                                           │
│   - Return go-live confirmation                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase `platforms` table                                      │
│  (schema reeds compleet — alle kolommen bestaan)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Nieuwe/gewijzigde bestanden

**Wijzigen**:
- `apps/admin/app/(dashboard)/platforms/[id]/page.tsx` — uitbreiden met tabs
- `apps/admin/app/api/review/platforms/[id]/route.ts` — alle velden ondersteunen + revalidate

**Nieuw**:
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/basics-tab.tsx`
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/branding-tab.tsx`
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/content-tab.tsx`
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/seo-tab.tsx`
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/contact-tab.tsx`
- `apps/admin/app/(dashboard)/platforms/[id]/tabs/go-live-tab.tsx`
- `apps/admin/app/api/platforms/[id]/go-live-check/route.ts`
- `apps/admin/app/api/platforms/[id]/go-live/route.ts`
- `apps/admin/components/platform/markdown-editor.tsx` (lightweight, geen zware dependencies)

### DB wijzigingen (klein)

```sql
ALTER TABLE platforms
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER platforms_set_updated_at
  BEFORE UPDATE ON platforms
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

---

## 3. Feature B — Image Upload (Supabase Storage)

### Business context

**Wie gebruikt dit?** Luc, Kay en toekomstige tenant admins.

**Wat moeten ze kunnen uploaden?**
- **Logo** (platform/regio) — toont in header, ~200×60px, PNG/SVG, max 500KB
- **Favicon** — 32×32 of 180×180px, PNG/ICO, max 100KB
- **OG image** — 1200×630px, JPG/PNG/WebP, max 1MB (voor social sharing)
- **Company logos** — bestaat al deels; uitbreiden zodat admin kan overrulen
- **Vacature header afbeeldingen** (toekomst) — per vacature

**Huidige pijnpunt**: De DB heeft `logo_url TEXT` — URL-gebaseerd. Je moet ergens anders hosten en de URL in admin plakken. Niet werkbaar.

**Waarom Supabase Storage en niet Vercel Blob?**
- Al gekoppeld aan hetzelfde project
- RLS policies consistent met rest van data
- Transformations via Supabase Transform API (resize, format)
- CDN via Supabase global edge network (Fastly)
- Simpel auth via bestaande Clerk JWT

### Frontend schema

```
┌─────────────────────────────────────────────────────────────────┐
│  <ImageUpload> component (herbruikbaar)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌───────────────────────────────┐                              │
│   │                               │  ↑ Drag & drop              │
│   │        [current image         │  ↑ Click to browse          │
│   │         preview or            │  ↑ Max 1MB                  │
│   │         placeholder]          │  ↑ PNG, JPG, WebP, SVG      │
│   │                               │                              │
│   │        [× Remove]             │                              │
│   └───────────────────────────────┘                              │
│                                                                   │
│   Upload URL: platforms/[id]/logo.png                            │
│   CDN URL: https://wnfhwhvrknvmidmzeclh.supabase.co/storage/... │
│                                                                   │
│   [Uploading... 60%] (progress bar bij upload)                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

Props:
```typescript
interface ImageUploadProps {
  bucket: 'platform-assets' | 'company-logos' | 'job-images'
  path: string  // e.g. "platforms/{id}/logo.png"
  aspectRatio?: '1:1' | '16:9' | 'auto'
  maxSizeMB?: number
  acceptedFormats?: string[]
  currentUrl?: string | null
  onUpload: (publicUrl: string) => void
  onRemove: () => void
}
```

### Backend schema

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin UI — ImageUpload component                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (1) Request signed upload URL
                               │ POST /api/storage/signed-upload
                               │ body: { bucket, path, contentType, sizeBytes }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  NEW: /api/storage/signed-upload/route.ts                        │
│  - Auth check (admin role via Clerk)                             │
│  - Validate: bucket whitelist, size < limit, mime whitelist      │
│  - Call supabase.storage.createSignedUploadUrl(bucket, path)     │
│  - Return { token, path, publicUrl }                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (2) Direct upload van client
                               │ met signed URL naar Supabase
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Storage bucket "platform-assets"                       │
│  - Policy: insert/update alleen met signed URL                   │
│  - Policy: select public (iedereen kan lezen)                    │
│  - CDN via Supabase edge (auto)                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (3) Client krijgt upload-success
                               │ POST /api/platforms/[id] met logo_url
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bestaand PATCH endpoint update platforms.logo_url               │
│  + revalidatePublicSite (platform:{id} tag)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Storage buckets

```
platform-assets/        # logos, favicons, og images
  {platform_id}/
    logo.png
    favicon.png
    og-image.png

company-logos/          # bestaat misschien al; consolideren
  {company_id}/
    logo.png

job-images/             # toekomst (vacature headers)
  {job_posting_id}/
    header.jpg
```

### RLS policies (Supabase)

```sql
-- Anyone can READ platform assets (publieke site toont ze)
CREATE POLICY "Public read platform assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-assets');

-- Only authenticated admin users can INSERT
CREATE POLICY "Admins can upload platform assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'platform-assets'
    AND auth.jwt() ->> 'role' = 'admin'
  );

-- Same for UPDATE/DELETE
```

### Nieuwe bestanden

**Nieuw**:
- `apps/admin/components/ui/image-upload.tsx` — herbruikbaar
- `apps/admin/app/api/storage/signed-upload/route.ts`
- `apps/admin/lib/services/storage.service.ts` — helper voor CDN URLs + path generation

**DB migraties**:
- `CREATE BUCKET` voor `platform-assets`
- RLS policies

### Image optimization (bonus)

Supabase Storage heeft automatic image transformation via URL params:
```
https://.../platform-assets/{id}/logo.png?width=200&height=60&resize=contain
```

Public-sites kan deze direct gebruiken — geen Next.js Image nodig voor simple resize.

---

## 4. Feature C — Junction Reads (`job_posting_platforms`)

### Business context

**Kernvraag**: Wat gebeurt er als een vacature in Doetinchem wordt geplaatst? Hij staat nu alleen op AchterhoekseBanen (Doetinchem = central_place). Maar:
- Doetinchem ligt ook in de regio "Achterhoek" — hoort misschien ook op `zutphensebanen.nl`, `winterwijksebanen.nl` etc.
- Utrechtse vacature kan relevant zijn voor AmersfoortseBanen (15 km)
- Zeeland vacature in Vlissingen hoort op heel ZeeuwseBanen

**Huidige situatie**:
- `job_postings.platform_id` = 1 platform (de primaire)
- `job_posting_platforms` junction = **bestaat al in DB en wordt gevuld** bij bulk-approve (via `postcode_platform_lookup` — meerdere rows per postcode mogelijk)
- Public-sites leest **NIET** uit de junction. Alleen `job_postings.platform_id`.

**Business waarde**:
- Vacature wordt zichtbaarder → meer kandidaten → betere matches
- SEO: zelfde vacature op meerdere domeinen (met canonical tags om duplicate content te voorkomen)
- Meer content per platform — zonder extra scraping

**Risico**:
- Performance: LEFT JOIN op 1M+ rows kan traag zijn. Indexes vereist.
- Duplicate content: Google kan straffen als niet correct canonical getagged.

### Frontend schema (geen UI changes)

Deze feature is **invisible** aan de admin kant. Alleen public-sites queries worden aangepast.

Kanttekening: admin drawer kan wel tonen "Deze vacature staat op: [UtrechtseBanen, AmersfoortseBanen]" — nice-to-have.

### Backend schema — query wijziging

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT: apps/public-sites/src/lib/queries.ts                   │
│                                                                   │
│  getApprovedJobs(tenantId) {                                     │
│    .from('job_postings')                                         │
│    .eq('platform_id', tenantId)  ← alleen PRIMARY platform       │
│    .eq('review_status', 'approved')                              │
│    .not('published_at', 'is', null)                              │
│  }                                                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ wordt
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  NEW:                                                             │
│                                                                   │
│  getApprovedJobs(tenantId) {                                     │
│    .from('job_postings')                                         │
│    .select(`                                                     │
│      *,                                                          │
│      job_posting_platforms!inner(platform_id)                    │
│    `)                                                            │
│    .eq('job_posting_platforms.platform_id', tenantId) ← junction │
│    .eq('review_status', 'approved')                              │
│    .not('published_at', 'is', null)                              │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### SQL plan

```sql
-- Verifieer index op junction (CRITICAL voor 1M+ rows)
CREATE INDEX IF NOT EXISTS job_posting_platforms_platform_id_idx
  ON job_posting_platforms (platform_id, job_posting_id);

-- Ook gecombineerde index voor filter flow:
CREATE INDEX IF NOT EXISTS job_postings_approved_published_idx
  ON job_postings (review_status, published_at)
  WHERE review_status = 'approved' AND published_at IS NOT NULL;
```

### Canonical URL strategie

Om duplicate content te voorkomen:
- Elke vacature heeft 1 "primary" platform (bestaande `job_posting_platforms.is_primary=true`)
- **Canonical URL**: altijd `https://{primary_platform.domain}/vacature/{slug}`
- Op secundaire platforms toont de vacature ook maar met `<link rel="canonical" href="https://{primary}/vacature/{slug}">` 
- Google begrijpt dit en rankt alleen de primary

Implementatie in `apps/public-sites/src/app/vacature/[slug]/page.tsx`:
```typescript
export async function generateMetadata({ params }) {
  const job = await getJobBySlug(tenant.id, slug)
  const primaryPlatform = await getPrimaryPlatform(job.id)
  
  return {
    alternates: {
      canonical: `https://${primaryPlatform.domain}/vacature/${slug}`
    }
  }
}
```

### Radius-based assignment (toekomstige verbetering)

Nu vult bulk-approve alleen rijen in `job_posting_platforms` voor de PRIMARY platform. Om echte multi-regio te krijgen moeten we bij approve alle platforms binnen X km toevoegen.

Voorstel (niet nu, later):
```sql
INSERT INTO job_posting_platforms (job_posting_id, platform_id, distance_km, is_primary)
SELECT 
  $job_id, 
  ppl.platform_id, 
  ppl.distance, 
  ppl.distance = 0  -- primary als exacte match
FROM postcode_platform_lookup ppl
WHERE ppl.postcode = left($zipcode, 4)
  AND ppl.distance <= 25  -- alleen platforms binnen 25km
```

Dit voegt elke vacature toe aan alle platforms binnen 25km. Maar dat doen we **niet** in de eerste versie — scope. We passen alleen de READ aan; de WRITE blijft zoals nu (1 rij per job_posting per primary platform).

### Nieuwe/gewijzigde bestanden

**Wijzigen**:
- `apps/public-sites/src/lib/queries.ts` — 9 query functies updaten naar junction-based
- `apps/public-sites/src/app/vacature/[slug]/page.tsx` — canonical URL
- `apps/public-sites/src/app/sitemap.ts` — ook junction voor meer sitemap URLs

**DB migraties**:
- Indexes op junction tabel (zie boven)

---

## 5. Architectuur diagram — alle 3 features samen

```mermaid
graph TB
    subgraph "Admin (Luc/Kay)"
        UI[Platform Detail<br/>/dashboard/platforms/[id]]
        UI --> Tabs[6 Tabs: Basis, Branding,<br/>Content, SEO, Contact, Go-Live]
        Tabs --> ImgUp[ImageUpload component]
    end

    subgraph "Admin API"
        API_PATCH["PATCH /api/platforms/[id]"]
        API_GOLIVE["POST /api/platforms/[id]/go-live"]
        API_CHECK["GET /api/platforms/[id]/go-live-check"]
        API_UPLOAD["POST /api/storage/signed-upload"]
    end

    subgraph "Data Layer"
        DB[(platforms table)]
        Storage[Supabase Storage<br/>platform-assets/]
        Junction[(job_posting_platforms)]
    end

    subgraph "Public Sites"
        Query[queries.ts<br/>junction-aware]
        Canonical[generateMetadata<br/>canonical URL]
        Revalidate[/api/revalidate/]
    end

    UI --> API_PATCH
    UI --> API_GOLIVE
    UI --> API_CHECK
    ImgUp --> API_UPLOAD

    API_PATCH --> DB
    API_GOLIVE --> DB
    API_UPLOAD --> Storage

    API_PATCH -.trigger.-> Revalidate
    API_GOLIVE -.trigger.-> Revalidate

    Query --> Junction
    Query --> DB
    Canonical --> Junction

    Storage -.CDN.-> Query
```

---

## 6. Rollout strategie

### Dag 1 (Feature A — Admin UI)
- Morgen: `platforms` update_at migratie, platform detail page tabs structure
- Middag: Basics + Branding + Content tabs + API wiring
- Eind dag: deploy naar admin preview, test met Luc

### Dag 2 (Feature B — Image Upload)
- Morgen: Storage bucket + RLS + ImageUpload component
- Middag: Signed upload API + integratie in Branding tab
- Eind dag: test upload flow van logo/favicon/og

### Dag 3 (Feature C — Junction Reads + Dag 1/2 fallout)
- Morgen: DB indexes + queries.ts junction update
- Middag: Canonical URLs + sitemap update + build test
- Eind dag: Go-Live wizard tab + end-to-end test

**Iteraties na dag 3**: wat Luc terugstuurt na gebruik wordt fase 2.

---

## 7. Risico's

| # | Risico | Kans | Mitigation |
|---|--------|------|------------|
| 1 | Junction query performance (1M+ rows) | Med | Indexes verplicht, explain analyze vóór deploy |
| 2 | Duplicate content penalty | Med | Canonical URLs in `<head>` van ALLE secundaire tenant pages |
| 3 | Supabase Storage RLS misconfigured → data leak | Low | `get_advisors` run na storage policies, unit test op upload auth |
| 4 | Admin form state complex (6 tabs, auto-save) | Med | Gebruik bestaand Zod + react-hook-form patroon uit admin |
| 5 | Grote image upload blokkeert UI | Low | Signed upload = direct-to-storage, niet via admin server |
| 6 | Storage kosten bij veel uploads | Low | Supabase free tier = 1GB; monitor bij 50+ platforms |
| 7 | Markdown editor bloat (MDX, rich text deps) | Med | Keep lean: `@uiw/react-md-editor` of pure textarea + preview |

---

## 8. Beslispunten voor jou

1. **[✓/✗] Volgorde A→B→C of A+B parallel?** Mijn voorstel: sequentieel — elke feature is ~1 dag, beter incremental dan 3 tegelijk.

2. **[✓/✗] Image upload via Supabase Storage** (niet Vercel Blob)? Voordeel: al verbonden; nadeel: iets trager CDN dan Vercel.

3. **[✓/✗] Junction reads zonder radius-expansion** (alleen READ aanpassen, schrijven blijft zoals nu)? Mijn voorstel: ja, eerst read. Radius-expansion is fase 2.

4. **[✓/✗] Markdown editor voor About/Privacy/Terms** of gewoon plain text area voor MVP?

5. **[✓/✗] Go-live wizard als aparte tab** of als modal op "Publish"-knop?

6. **[✓/✗] Auto-save naar API na 2s debounce** of expliciete "Opslaan" knop?

7. **[✓/✗] Spawn 3 separate agents** voor parallelle ontwikkeling (1 per feature) of 1 agent per feature sequentieel?

8. **Openstaande vraag**: moeten Luc/Kay ook vacatures kunnen **editen** of alleen platforms? Ik neem aan alleen platforms (vacatures = Kenny's domein). Bevestig.

---

## 9. Scope — wat NIET in deze sprint

- Radius-expansion bij approve (write-kant junction)
- Multi-language content (NL only)
- Versioning van content (staging vs live copy)
- Tenant-specific email templates
- Billing/tier enforcement (tier veld wordt alleen opgeslagen, niet afgedwongen)
- Custom CSS injection per tenant
- A/B testing per platform

---

## 10. Samenvatting

Je krijgt na deze sprint:
- Luc kan zelfstandig 25 platforms beheren zonder dev
- Kay kan logo/favicon/OG image uploaden via drag-drop
- Vacatures kunnen op meerdere regio's verschijnen (SEO-safe via canonical)

Nieuwe taken voor Kenny voor de volgende sprint:
- Radius-based auto-assignment bij approve
- Email templates per tenant
- Versioning / draft mode voor content
