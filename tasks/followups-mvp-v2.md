# Follow-ups na MVP v1 — Plan

**Datum**: 2026-04-15
**Auteur**: Claude (CTO-modus)
**Status**: Ter goedkeuring door Kenny
**Scope**: 8 concrete verbeteringen bovenop de live MVP

---

## 1. Executive Summary

De MVP is live: 24 regio-jobboards, tabs/bulk in admin, image upload, ActionBar, LivePreview, ActivityLog. Alles draait. Maar:

- **Blocker**: `/job-postings` hangt met statement-timeout bij 1M+ rijen. Kenny kan de admin UI niet gebruiken zonder fix.
- **Missing feature**: public-sites toont `header_image_url` nog niet — admin-upload komt niet door naar de site.
- **Cleanup**: 6 worktrees + 4 demo pages + stale types + pre-existing type errors.
- **Quick SEO win**: IndexNow ping on approve (infrastructure staat klaar, alleen trigger ontbreekt).
- **UX improvement**: rich-text editor voor vacature description (markdown deps al geïnstalleerd).

Totaal geschatte effort: **~2 werkdagen**, in volgorde van prioriteit.

---

## 2. Blocker — /job-postings timeout

### 2.1 Root cause (EXPLAIN ANALYZE bewijs)

```sql
-- Review-counts endpoint doet 4x count:'exact' parallel
SELECT count(*) FROM job_postings WHERE review_status = 'pending';
-- Execution Time: 4131 ms  ← Parallel Seq Scan, 113 MB buffers

SELECT count(*) FROM job_postings;
-- Execution Time: 5178 ms  ← Index Only Scan, 766k heap fetches
```

Tabel specs:
- **1.010.201** rijen totaal
- Pending: **1.009.181** (99.9%)
- Approved: 20
- Still_pending: 1.000
- Rejected: 0
- Tabel 6.8 GB, indexes 1.7 GB, total 8.5 GB

De SELECT-kant van `/job-postings` is **snel** (9ms) dankzij `idx_job_postings_created_at`:
```
Limit  (actual time=2.961..9.241 rows=10 loops=1)
  → Index Scan Backward using idx_job_postings_created_at
      Filter: (review_status = 'pending')
```

Alleen de **counts** zijn traag. Timeout komt van PostgREST/Vercel wrapper, niet DB (`statement_timeout=20min`).

### 2.2 Oplossing — nieuwe RPC `get_job_posting_counts`

Vervang 4× `count:'exact'` door 1 RPC call die slimme schat/telmethoden combineert:

```sql
CREATE OR REPLACE FUNCTION public.get_job_posting_counts(
  platform_filter uuid DEFAULT NULL
) RETURNS TABLE(
  status text,
  count bigint,
  is_estimate boolean
) LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE
  total_estimate bigint;
BEGIN
  -- For 'all' count: use pg_class.reltuples when no filter (instant, ~99% accurate)
  IF platform_filter IS NULL THEN
    SELECT reltuples::bigint INTO total_estimate
    FROM pg_class WHERE relname = 'job_postings';
    RETURN QUERY SELECT 'all'::text, total_estimate, TRUE;
  ELSE
    -- With platform filter: exact count (partial index idx_jp_public_list/idx_jp_review_queue covers it)
    RETURN QUERY
    SELECT 'all'::text,
           (SELECT count(*) FROM job_postings WHERE platform_id = platform_filter),
           FALSE;
  END IF;

  -- For pending/approved/rejected: exact count with partial indexes
  -- (idx_jp_review_queue covers pending+still_pending with platform_id)
  RETURN QUERY
  SELECT 'pending'::text,
         (SELECT count(*) FROM job_postings
          WHERE review_status IN ('pending', 'still_pending')
            AND (platform_filter IS NULL OR platform_id = platform_filter)),
         FALSE;

  RETURN QUERY
  SELECT 'approved'::text,
         (SELECT count(*) FROM job_postings
          WHERE review_status = 'approved'
            AND (platform_filter IS NULL OR platform_id = platform_filter)),
         FALSE;

  RETURN QUERY
  SELECT 'rejected'::text,
         (SELECT count(*) FROM job_postings
          WHERE review_status = 'rejected'
            AND (platform_filter IS NULL OR platform_id = platform_filter)),
         FALSE;
END;
$$;
```

**Nog snelheid winnen**:
1. **Caching** via Next.js `revalidate: 300` (5 min) in de route handler. Counts hoeven niet live-exact.
2. **Partial indexes uitbreiden** — er is al `idx_jp_review_queue` voor pending+still_pending. Voeg er één toe voor approved/rejected:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_jp_approved ON job_postings (platform_id)
     WHERE review_status = 'approved';
   CREATE INDEX IF NOT EXISTS idx_jp_rejected ON job_postings (platform_id)
     WHERE review_status = 'rejected';
   ```
   Kleine indexes (approved=20 rows, rejected=0) — nauwelijks disk gebruik.

### 2.3 Fix ook de RPC `search_job_postings`

Het inner COUNT binnen `search_job_postings` is óók traag voor `pending`. Opties:

**A** — Skip count als geen filters + pending only: gebruik `reltuples` schatting direct.
**B** — Verhoog LIMIT-trick drempel naar 1000 (ipv 100001) → UI toont "10.000+" ipv exact getal.

Ik kies **B** — duidelijker UX ("1000+ vacatures"), veel sneller, want de index scan stopt na 1000 rijen.

### 2.4 Effort

- Migratie (RPC + indexes): 30 min
- Review-counts endpoint herschrijven: 30 min
- `search_job_postings` aanpassen (LIMIT 1000): 30 min
- Cache header toevoegen in endpoint: 15 min
- Test met echte 1M dataset: 30 min

**Totaal: 2-3 uur**. Hoogste prioriteit — blocker.

---

## 3. Public-sites header_image_url rendering

### 3.1 Gap

`apps/public-sites/src/app/vacature/[slug]/page.tsx` fetcht vacature via `getJobBySlug()` uit `lib/queries.ts`. Die functie selecteert NU niet `header_image_url`. En de JSX rendert geen image.

### 3.2 Fix

**Stap 1**: `lib/queries.ts` — `getJobBySlug`: add `header_image_url` naar select.

**Stap 2**: `vacature/[slug]/page.tsx` — render image hero bovenaan:
```tsx
{job.header_image_url && (
  <div className="relative w-full aspect-[16/9] mb-6 overflow-hidden rounded-lg">
    <Image src={job.header_image_url} alt={job.title} fill
           className="object-cover" priority />
  </div>
)}
```

**Stap 3**: JSON-LD schema.org JobPosting — voeg `image` veld toe (als het er is):
```ts
"image": job.header_image_url,
```

**Stap 4**: Open Graph metadata — `generateMetadata` moet `header_image_url` gebruiken in `openGraph.images` (overruled `tenant.og_image_url` als per-vacature image beschikbaar):
```ts
openGraph: {
  images: job.header_image_url
    ? [{ url: job.header_image_url, width: 1600, height: 900 }]
    : tenant.og_image_url ? [tenant.og_image_url] : undefined,
}
```

**Stap 5**: `lib/queries.ts` — `getSitemapJobs`: geen wijziging, sitemap verwijst alleen naar URLs.

### 3.3 Cache invalidatie

Geen nieuwe tags — de `job:{slug}` tag wordt al ge-invalideerd bij edit. Header image update = vacature edit, dus PATCH `/api/vacatures/{id}` met `header_image_url` triggert `revalidatePublicSite({ jobSlugs: [slug] })`. Werkt al.

### 3.4 Effort

- `getJobBySlug` aanpassen: 10 min
- Page rendering + metadata + schema: 30 min
- Build + deploy public-sites: 20 min
- End-to-end test: upload → approve → open publieke pagina met image: 15 min

**Totaal: 1-1.5 uur**.

---

## 4. IndexNow ping on approve

### 4.1 Wat is al voorbereid

- Elke platform heeft `indexnow_key` (UUID) gegenereerd in task 2 seeding
- `key` moet publiek beschikbaar zijn op `https://{domain}/{indexnow_key}.txt`
- De key-file heeft alleen de key als content

### 4.2 Wat ontbreekt

1. **Key-file serving** op public-sites: `apps/public-sites/src/app/[key].txt/route.ts` (dynamic route die host → tenant → key matchen)
2. **Submit endpoint** in admin: `lib/services/indexnow.service.ts` — POST naar `https://api.indexnow.org/indexnow`
3. **Trigger in approve/publish/unpublish endpoints**: na `revalidatePublicSite()`, roep `indexnow.submit()` aan voor de affected URLs

### 4.3 Architectuur

```
Admin: POST /api/vacatures/[id]/publish
  → UPDATE job_postings
  → revalidatePublicSite({platformIds, jobSlugs})
  → NEW: indexNowSubmit({
       host: platform.preview_domain ?? platform.domain,
       key: platform.indexnow_key,
       urlList: [
         `https://${host}/vacature/${slug}`,
         `https://${host}/vacatures`,
         `https://${host}/sitemap.xml`
       ]
     })
       ↓ POST https://api.indexnow.org/indexnow
       { host, key, keyLocation: `https://${host}/${key}.txt`, urlList }
```

Google/Bing/Yandex/Seznam indexeren binnen minuten i.p.v. uren.

### 4.4 Files

**Nieuw**:
- `apps/public-sites/src/app/[key]/route.ts` — serveert `{key}.txt` als plain text. Dynamic catch-all om per-tenant match te doen.

Hmm nee, eigenlijk `[...key]/route.ts` is te breed. Specifieker: `apps/public-sites/src/app/indexnow/route.ts` is niet goed want IndexNow eist dat de key precies op de root gehost wordt als `{key}.txt`.

Beste aanpak: gebruik `middleware` (proxy.ts) of een catch-all `apps/public-sites/src/app/[[...slug]]/route.ts`. Maar dat conflicteert met bestaande routes.

Alternatief: op Vercel level — rewrite `/*.txt` naar een handler. Bekijken bij implementatie.

**Nieuw admin**:
- `apps/admin/lib/services/indexnow.service.ts`

**Wijzigen**:
- `apps/admin/app/api/vacatures/[id]/publish/route.ts` — call indexnow
- `apps/admin/app/api/vacatures/[id]/unpublish/route.ts` — call indexnow (verwijdert uit index)
- `apps/admin/app/api/review/bulk-approve/route.ts` — call indexnow voor batch

### 4.5 Effort

- Key file serving route: 1-1.5 uur (tricky met catch-all + tenant matching)
- IndexNow helper: 30 min
- Integratie in endpoints: 30 min
- Test via curl → check response 200 from api.indexnow.org: 15 min

**Totaal: 2.5-3 uur**.

---

## 5. Rich text editor voor vacature description

### 5.1 Nu

`vacatures/nieuw` en `vacatures/[id]/bewerken` gebruiken plain `<Textarea>` voor description. Gescrapede vacatures hebben vaak HTML in description — getoond als plain text.

### 5.2 Fix

Swap `<Textarea>` voor description naar `<MarkdownEditor>` (component van Feature A, wraps `@uiw/react-md-editor`, SSR-safe via dynamic import).

Voor migratie: bestaande descriptions zijn een mix van plain text en HTML entities. `@uiw/react-md-editor` accepteert markdown — HTML wordt niet gerendered. Opties:
- **A**: Keep as-is voor bestaande (plain text), markdown voor nieuwe
- **B**: On-open: parse HTML → markdown (via turndown lib) voor bestaande rijen
- **C**: Strip HTML tags, behoud plain tekst (simpel)

Ik kies **A** — minimal invasief. Luc kan bij edit kiezen om markdown op te maken; scraper vult plain/HTML zoals nu. Public-sites rendering moet al markdown gebruiken (check `vacature/[slug]/page.tsx` — rendering via `<MarkdownRenderer>` of dangerouslySetInnerHTML?).

### 5.3 Effort

- Swap Textarea → MarkdownEditor in 2 forms: 20 min
- Verify public-sites rendering: 15 min
- Docs update (readme voor admins): 10 min

**Totaal: 45 min**.

---

## 6. Cleanup

### 6.1 Demo pages verwijderen

```
apps/admin/app/(dashboard)/demo-action-bar/page.tsx
apps/admin/app/(dashboard)/demo-preview-log/page.tsx
apps/admin/app/(dashboard)/demo-header-image/page.tsx
apps/admin/app/(dashboard)/demo-platform-wizard/page.tsx  (als die bestaat)
apps/admin/app/(dashboard)/storage-demo/page.tsx  (van Feature B)
```

Effort: 5 min.

### 6.2 Worktrees opruimen

```bash
git worktree remove .claude/worktrees/agent-a2f87488
git worktree remove .claude/worktrees/agent-a63abb0b
git worktree remove .claude/worktrees/agent-a7b05647
git worktree remove .claude/worktrees/agent-a9ed5cbb
git worktree remove .claude/worktrees/agent-ab054a6a
git worktree remove .claude/worktrees/agent-afea29e6
git branch -D worktree-agent-a2f87488 worktree-agent-a63abb0b worktree-agent-a7b05647 worktree-agent-a9ed5cbb worktree-agent-ab054a6a worktree-agent-afea29e6
```

Effort: 2 min.

---

## 7. Tech debt (optioneel)

### 7.1 Supabase types regenereren

`apps/admin/lib/supabase.ts` heeft stale generated types. Agents moesten `(supabase as any)` casts gebruiken. Na regeneratie kunnen die weg.

**Plan**:
1. `mcp__supabase__generate_typescript_types` om fresh types te krijgen
2. Write naar `apps/admin/lib/supabase.ts` (replace full content)
3. Grep voor `(supabase as any)` casts en probeer te verwijderen (veel zullen nu werken)
4. Build test

**Risico**: sommige code rekent op oude type-inconsistenties. Moet per file testen.

**Effort**: 2-3 uur (zorgvuldig — raakt veel files). **Aparte sprint aanbevolen**.

### 7.2 Pre-existing type errors

- `middleware/rate-limiting.ts`: `req.ip` bestaat niet op Next 15 `NextRequest`. Fix: use `request.headers.get('x-forwarded-for')`.
- `lib/validators/__tests__/contact.test.ts`: `@types/jest` ontbreekt. Fix: `pnpm add -D @types/jest vitest` of tests verwijderen als ongebruikt.

**Effort**: 30 min. **Aparte sprint**.

### 7.3 Oude scrapers company_name check

`apps/admin/lib/scrapers/*` gebruikt `company_name`. Deze schrijven naar `companies` tabel bij scrape, dus `company_name` refereert naar `companies.name` (niet `job_postings.company_name`). Na mijn fix (task 3) is dit al correct gescheiden.

**Actie**: geen — al gecontroleerd. Staat in het initieel onderzoek van de admin map.

**Effort**: 0u (al verified).

---

## 8. Smoke test door Kenny

Checklist voor handmatige test na alle bovenstaande changes (na punt 2+3+4+5+6 klaar):

### Admin — /job-postings
- [ ] Page laadt binnen 3s (was: timeout)
- [ ] Tabs tonen counts (pending: ~1M+, approved: 20+, rejected: 0)
- [ ] Tabwissel → URL update + data refresh
- [ ] Platform filter → counts updaten
- [ ] Bulk select 2 rows → BulkActionBar verschijnt
- [ ] Bulk Approve → toast, rijen verdwijnen uit pending

### Admin — drawer (klik op een row)
- [ ] Header image preview (als gezet)
- [ ] Status pill met juiste kleur
- [ ] "Bekijk op site ↗" — opens publieke URL in nieuw tabblad
- [ ] "Publish" button → toast + status pill wijzigt
- [ ] "Unpublish" button → confirm dialog + toast
- [ ] "Live preview" button → iframe modal opent
- [ ] Desktop/Mobile toggle in preview werkt
- [ ] Activity log toont scraper + editor + reviewer namen
- [ ] "Bewerk" link → navigeert naar edit form
- [ ] "Archiveer" button → confirm dialog + toast

### Admin — edit form
- [ ] Header image upload → drag/drop werkt
- [ ] Upload preview toont na success
- [ ] Save → PATCH succeeds
- [ ] Open drawer na save → image toont

### Public-sites — vacature detail
- [ ] Navigeer naar `https://utrechtsebanen.vercel.app/vacature/{slug}` (slug van approved vacature)
- [ ] Header image toont bovenaan (16:9)
- [ ] Meta Open Graph tags bevatten header_image_url
- [ ] JSON-LD schema bevat `image` field
- [ ] Page is OK zonder header_image_url (fallback design)

### IndexNow
- [ ] `curl https://achterhoeksebanen.vercel.app/{indexnow_key}.txt` returns 200 + key
- [ ] Na approve: admin logs tonen "IndexNow submitted" + 200 response

---

## 9. Execution plan

Volgorde van belang (top = eerst):

| # | Item | Prio | Effort | Deploy |
|---|------|------|--------|--------|
| 1 | **Timeout fix** (RPC + indexes + endpoint rewrite) | P0 | 2-3u | Admin |
| 2 | Public-sites header image render | P1 | 1-1.5u | Public-sites |
| 3 | Cleanup (demo pages + worktrees) | P1 | 10min | Both |
| 4 | IndexNow ping on approve | P2 | 2.5-3u | Both |
| 5 | Rich text editor swap | P3 | 45min | Admin |
| 6 | Smoke test by Kenny | P3 | 30min | — |
| 7 | Tech debt (types, rate-limit) | P4 | 3-4u | Aparte sprint |

**Totaal P0-P3: ~7-9 uur effective werk**. Haalbaar in 1 dag.

---

## 10. Beslispunten voor Kenny

1. **[✓/✗] Timeout fix aanpak**: RPC + indexes + cache header (mijn voorstel) of liever een MV (materialized view die elke 5 min ververst)?
2. **[✓/✗] Counts "10.000+" bij grote tabellen i.p.v. exact** (voor performance). Akkoord?
3. **[✓/✗] IndexNow serving via Next.js catch-all** of liever via Vercel `rewrites` in `vercel.json`?
4. **[✓/✗] Rich text editor default aan** (ook voor gescrapete descriptions) of alleen voor nieuwe vacatures?
5. **[✓/✗] Tech debt nu** (P4 in deze sprint) of aparte sprint volgende week?
6. **Parallel agents** voor items 2, 4, 5 (onafhankelijk) of sequentieel (ik doe alles)?
7. **[✓/✗] Akkoord om te beginnen** na jouw antwoorden?

---

## 11. Wat NIET in deze sprint

- Platform-scoped permissies (volgende sprint — ieder admin ziet alles nu)
- Duplicate detectie bij scrape
- Email digest voor Luc/Kay
- Radius-based auto-assignment bij approve (junction writes)
- Materialized view voor job_postings (overkill voor nu)
- Search index optimalisatie (tsvector is al OK)
- `still_pending` vs `pending` semantic consolidation (1000 rows, niet urgent)
