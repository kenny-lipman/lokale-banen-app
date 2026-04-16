# Canonical & JSON-LD Audit — Lokale Banen public-sites

## Context

Monorepo: 24 regionale Next.js jobboards + master aggregator `lokalebanen.nl`.
Multi-tenant: host-based routing via `x-tenant-host` header (proxy.ts → tenant.ts).
Elke vacature heeft een `is_primary = true` in `job_posting_platforms` die de canonieke eigenaar bepaalt.

Recent afgerond:
- Seed: 525 vacatures approved (21 platforms × 25)
- Master aggregator live op `lokalebanen-master.vercel.app`
- `getCanonicalInfo()` helper bestaat al in `apps/public-sites/src/lib/canonical.ts`
- `buildJobPostingSchema()` zit in `packages/shared/src/schema/job-posting.ts`

---

## Taak: audit + fix in `apps/public-sites/src/app/vacature/[slug]/page.tsx`

### Bug 1 — `tenant.domain` kan null zijn (preview_domain alleen platforms)

**Locaties:**
- Regel ~53: `const canonicalUrl = canonical?.canonicalUrl ?? \`https://${tenant.domain}/vacature/${slug}\``
- Regel ~54: `const ogUrl = \`https://${tenant.domain}/vacature/${slug}\``
- Regel ~134 (in JSX render): `const baseUrl = \`https://${tenant.domain}\``

**Fix:** Vervang `tenant.domain` door `tenant.domain ?? tenant.preview_domain ?? ''` op alle drie locaties.
Als host leeg is, laat canonical/ogUrl weg (return `undefined`) — geen `https://` zonder host.

### Bug 2 — BreadcrumbList gebruikt `baseUrl` vóór de check

Zorg dat breadcrumb items pas gebouwd worden als `baseUrl` een echte waarde heeft (niet leeg).

### JSON-LD audit

1. Lees `packages/shared/src/schema/job-posting.ts` — begrijp welke velden er worden uitgestuurd.
2. Valideer tegen Google's Job Search vereisten:
   - **Verplicht:** `title`, `description`, `datePosted`, `hiringOrganization.name`, `jobLocation.addressLocality` + `addressCountry`
   - **Sterk aanbevolen:** `validThrough`, `employmentType`, `baseSalary`, `identifier`
3. Check of `description` altijd gevuld is — de huidige code gebruikt `job.content_md || job.description`. Als beide null zijn, is `cleanDescription` een lege string. Google vereist minimaal 1 zin.
   - Fix: voeg fallback toe als `cleanDescription` leeg is: gebruik `job.title + ' bij ' + companyName`
4. Check of `jobLocation.addressLocality` altijd gevuld is — huidige code gebruikt `job.city || job.company?.city || 'Nederland'`. Dat is goed.
5. Check of `datePosted` altijd ISO-8601 is — `job.published_at || job.created_at` kan null zijn. Fix: voeg `?? new Date().toISOString()` toe als fallback.

### Canonical correctness op master site

Op `lokalebanen.nl` linken job cards al naar `https://{preview_domain}/vacature/{slug}` (extern). Er bestaat geen `/vacature/[slug]` route voor master (tenant.tier === 'master' catch is niet in die route). Voeg een vroege return toe in `JobPage`:

```tsx
// Master aggregator heeft geen eigen vacature detail pages — redirect naar primary platform
if (tenant.tier === 'master') {
  const canonical = await getCanonicalInfo(slug /* we need the id — see below */)
  // ... redirect naar canonical URL
  redirect(canonical.canonicalUrl)
}
```

Maar dit vereist het job-id. Alternatieven:
- `getMasterJobBySlug(slug)` bestaat al in queries.ts — gebruik die om de primary platform URL te resolven.
- Redirect naar `https://{primary_platform.preview_domain}/vacature/{slug}`.
- Als geen primary platform gevonden: 404.

### Na fixes

Voer TypeScript check uit: `cd apps/public-sites && npx tsc --noEmit`
Commit als `fix(public-sites): canonical + JSON-LD audit fixes`

---

## Relevante bestanden

| Bestand | Wat |
|---------|-----|
| `apps/public-sites/src/app/vacature/[slug]/page.tsx` | Vacature detail — canonical + JSON-LD |
| `apps/public-sites/src/lib/canonical.ts` | `getCanonicalInfo()` helper |
| `apps/public-sites/src/lib/queries.ts` | `getMasterJobBySlug()` (al aanwezig) |
| `packages/shared/src/schema/job-posting.ts` | `buildJobPostingSchema()` |
| `apps/public-sites/src/lib/tenant.ts` | `Tenant` interface (`tier: string | null`) |

## Supabase project
ID: `wnfhwhvrknvmidmzeclh`

## Commit stijl
Conventional commits. Geen push zonder toestemming.
