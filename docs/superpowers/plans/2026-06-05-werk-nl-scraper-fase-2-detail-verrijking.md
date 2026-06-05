# werk.nl scraper - Fase 2: detail-verrijking + company-dedup - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) of superpowers:executing-plans om dit plan task-by-task uit te voeren. Stappen gebruiken checkbox (`- [ ]`) syntax.

**Goal:** De minimale werk.nl lijst-rijen uit Fase 1 verrijken met volledige detaildata via de publieke detail-API, met company-dedup en contact-aanmaak, gedreven door een eigen queue/worker. Verlopen/verdwenen vacatures archiveren op het detail-pad.

**Architecture:** Eigen `werk_nl_scrape_queue` (ADR 0001) + `werknl_claim_batch` RPC (atomic claim, `FOR UPDATE SKIP LOCKED`). De lijst-scan (Fase 1) enqueuet nieuwe/gewijzigde vacatures; een aparte worker-route claimt batches, haalt de detail-API op (2-5s delay), mapt de payload naar `job_postings`-detailvelden + `companies` + `contacts`, doet 3-laags company-dedup op `werknl_employer_id`, en zet `detail_scraped_at`. Bij 404 of verstreken `expirationDate`: archiveren i.p.v. verrijken. Geen Mistral (de API levert velden gestructureerd). Template: de werkenindekempen-scraper (queue.ts, dedup.ts, process-one.ts) en de migraties `20260515111204` + `20260515111400`.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Vitest, Supabase (service-role + RPC). Node `fetch` via de bestaande `werknlFetch`-sessielaag uit Fase 1.

**Scope:** Detail-verrijking, company-dedup, contact-aanmaak, queue/worker, en archiveren op 404/verlopen. **Buiten scope (Fase 3):** generatie-gebaseerde delisting via volledige pass (ADR 0002), cron-registratie in `vercel.json`, watchdog, incrementele early-stop lijst-scan.

**Naamgeving:** lib in `apps/admin/lib/scrapers/werk_nl/` (uitbreiding van Fase 1), worker-route in `apps/admin/app/api/scrapers/werk-nl/worker/`, tests in `apps/admin/__tests__/scrapers/werk_nl/`. Queue-tabel `werk_nl_scrape_queue`, RPC `werknl_claim_batch`. Log-prefix `[werknl]`.

**Hard rules (CLAUDE.md):** geen em-dash (U+2014); `// @auth <KLASSE>` op regel 1 van elke `route.ts`; na DB-changes `apply_migration` -> `get_advisors` -> types regenereren; `docs/reference/scrapers.md` + `docs/reference/database.md` bijwerken in dezelfde commit.

**Afhankelijkheid:** Task 1 (spike) levert de bewezen payload-vorm. Task 3/4 (Zod-schema + mapper) gebruiken die bevindingen; begin daar niet met verzonnen veldnamen.

---

## File Structure

| Bestand | Verantwoordelijkheid |
|---------|----------------------|
| `docs/superpowers/research/2026-06-05-werknl-detail-payload.md` | Spike-bevindingen: echte detail-API velden (Task 1) |
| `supabase/migrations/<ts>_werknl_fase2.sql` | `werk_nl_scrape_queue`, `werknl_claim_batch` RPC, `companies.werknl_employer_id`, bemiddelaar-veld, evt. `job_postings` vervaldatum |
| `lib/scrapers/werk_nl/detail-client.ts` | `fetchDetail(referenceNumber)` - detail-API ophalen |
| `lib/scrapers/werk_nl/detail-types.ts` | Zod-schema detail-respons (uit spike) |
| `lib/scrapers/werk_nl/detail-mapper.ts` | payload -> job_postings-detail + CompanyInput + ContactInput + bemiddelaar-vlag + vervaldatum |
| `lib/scrapers/werk_nl/dedup.ts` | 3-laags company-dedup op `werknl_employer_id` (adapt van wik) |
| `lib/scrapers/werk_nl/queue.ts` | enqueue (vanuit lijst-scan) / claimBatch (RPC) / finalize |
| `lib/scrapers/werk_nl/process-one.ts` | verrijk één vacature: detail -> map -> dedup -> upsert -> finalize; 404/verlopen -> archiveer |
| `app/api/scrapers/werk-nl/worker/route.ts` | POST/GET worker: claim batch + process, re-chain binnen tijdbudget |
| `__tests__/scrapers/werk_nl/detail-mapper.test.ts` | payload-mapping + bemiddelaar + vervaldatum |
| `__tests__/scrapers/werk_nl/dedup.test.ts` | 3-laags (laag 1/2/3 hit + create + backfill) |
| `__tests__/scrapers/werk_nl/queue.test.ts` | enqueue/claim/finalize-pad |
| `__tests__/scrapers/werk_nl/process-one.test.ts` | verrijk-pad + 404/verlopen-archiveer-pad |

---

## Task 1: Research-spike - echte detail-API payload vastleggen

Het bewijst de payload-vorm waar Task 3/4 op leunen, en beantwoordt de 3 open grill-vragen: (a) bestaat er een expliciet bemiddelaar/intermediair-signaal, (b) welk vervaldatum-veld, (c) employer/contactPerson-velden voor dedup.

**Files:**
- Create: `docs/superpowers/research/2026-06-05-werknl-detail-payload.md`

- [ ] **Step 1: Haal een handvol echte detailpayloads op**

Gebruik de bestaande Fase-1 sessielaag. Schrijf een skip-by-default test of een tijdelijk script dat `bootstrapSession()` doet en `GET .../api/vacature/{referenceNumber}` voor ~5 echte referenceNumbers (uit een verse lijst-scan). Print de volledige JSON.

- [ ] **Step 2: Documenteer de bevindingen**

Leg in het research-doc vast: alle top-level velden + types; specifiek `employer` (referenceNumber, name, website, en of er een **bemiddelaar/uitzend-indicatie** in zit); `contactPerson`; `expirationDate` (veldnaam + formaat); `description`/`proposition`/`applicationMethods`. Conclusie per open vraag (a/b/c) expliciet.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/research/2026-06-05-werknl-detail-payload.md
git commit -m "docs(werk-nl): Fase 2 spike - detail-API payload vastgelegd"
```

**STOP-check:** is er geen bemiddelaar-signaal in de payload? Meld dat aan de gebruiker voor we de bemiddelaar-detectie heuristisch maken (raakt CONTEXT.md / systeembreed veld).

---

## Task 2: DB-migratie (queue + RPC + dedup-kolom + bemiddelaar + vervaldatum)

**Files:**
- Create: `supabase/migrations/<ts>_werknl_fase2.sql`
- Modify: `docs/reference/database.md`

- [ ] **Step 1: Schrijf de migratie**

Naar voorbeeld van `20260515111204_werkenindekempen_scrape_queue.sql` + `20260515111400_wik_claim_batch_rpc.sql`. Sleutel de queue op `job_posting_id` (uuid) i.p.v. url:

```sql
-- werk_nl_scrape_queue: detail-verrijking queue (Fase 2). Service-role only, RLS aan, geen policies.
create table werk_nl_scrape_queue (
  job_posting_id    uuid primary key references job_postings(id) on delete cascade,
  orchestration_id  text not null,
  enqueued_at       timestamptz not null default now(),
  picked_at         timestamptz,
  completed_at      timestamptz,
  status            text not null default 'pending'
                    check (status in ('pending','processing','success','error','validation_failed')),
  attempts          smallint not null default 0,
  error_message     text,
  result_stats      jsonb
);
create index idx_werknl_queue_orch on werk_nl_scrape_queue (orchestration_id);
create index idx_werknl_queue_pending on werk_nl_scrape_queue (status, enqueued_at) where status='pending';
alter table werk_nl_scrape_queue enable row level security;

-- Atomic claim (kopie wik_claim_batch, op job_posting_id).
create or replace function werknl_claim_batch(p_orchestration_id text, p_batch_size int)
returns table (job_posting_id uuid, attempts smallint)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select q.job_posting_id from werk_nl_scrape_queue q
    where q.orchestration_id = p_orchestration_id and q.status = 'pending'
    order by q.enqueued_at asc limit p_batch_size for update skip locked
  )
  update werk_nl_scrape_queue q set status='processing', picked_at=now(), attempts=q.attempts+1
  from picked where q.job_posting_id = picked.job_posting_id
  returning q.job_posting_id, q.attempts;
end; $$;
revoke all on function werknl_claim_batch(text,int) from public, anon, authenticated;
grant execute on function werknl_claim_batch(text,int) to service_role;

-- Dedup-laag 1: stabiele werk.nl bedrijfs-id.
alter table companies add column werknl_employer_id text;
create unique index uq_companies_werknl_employer_id on companies (werknl_employer_id) where werknl_employer_id is not null;

-- Bemiddelaar-onderscheid (systeembreed, CONTEXT.md). Definitief veldtype na Task 1.
alter table companies add column is_bemiddelaar boolean not null default false;

-- Vervaldatum uit detail-API (alleen toevoegen als Task 1 geen herbruikbare kolom vond).
alter table job_postings add column expires_at timestamptz;
```

- [ ] **Step 2: Toepassen + advisors + types**

`apply_migration` -> `get_advisors` (los nieuwe warnings op) -> `mcp__supabase__generate_typescript_types` en update het types-bestand.

- [ ] **Step 3: database.md bijwerken + commit**

Documenteer `werk_nl_scrape_queue`, `werknl_employer_id`, `is_bemiddelaar`, `expires_at`.

```bash
git add supabase/migrations docs/reference/database.md apps/admin/<types-file>
git commit -m "feat(werk-nl): Fase 2 schema (queue, RPC, dedup-kolom, bemiddelaar, vervaldatum)"
```

---

## Task 3: Detail-client + Zod-schema (TDD)

**Files:**
- Create: `lib/scrapers/werk_nl/detail-types.ts`, `lib/scrapers/werk_nl/detail-client.ts`
- Test: `__tests__/scrapers/werk_nl/detail-client.test.ts`

- [ ] **Step 1: Failing test** - `fetchDetail(session, ref)` parset een gemockte payload (velden uit Task 1), gooit bij HTTP-fout, en mapt 404 naar een herkenbaar resultaat (zodat process-one kan archiveren).
- [ ] **Step 2: Implementatie** - `werknlFetch` GET op `${DETAIL_URL_BASE}/${ref}`; Zod-schema uit de spike; 404 -> `{ notFound: true }`.
- [ ] **Step 3: Test groen + commit** `feat(werk-nl): detail-client + Zod detail-schema`

---

## Task 4: Detail-mapper (TDD)

**Files:**
- Create: `lib/scrapers/werk_nl/detail-mapper.ts`
- Test: `__tests__/scrapers/werk_nl/detail-mapper.test.ts`

- [ ] **Step 1: Failing test** - payload -> `{ jobPatch, company: CompanyInput, contact: ContactInput|null, isBemiddelaar, expiresAt }`. Test: kernvelden gevuld; bemiddelaar-vlag afgeleid uit het signaal van Task 1 (of heuristiek); `expiresAt` geparset; ontbrekende contactPerson -> null.
- [ ] **Step 2: Implementatie** conform spike-bevindingen.
- [ ] **Step 3: Test groen + commit** `feat(werk-nl): detail-mapper payload naar job/company/contact`

---

## Task 5: 3-laags company-dedup (TDD)

**Files:**
- Create: `lib/scrapers/werk_nl/dedup.ts`
- Test: `__tests__/scrapers/werk_nl/dedup.test.ts`

Adapt `werkenindekempen/dedup.ts` (`findOrCreateCompanyThreeLayer`): laag 1 `werknl_employer_id`, laag 2 `normalized_name`, laag 3 `hoofddomein`, anders create. Bij match op laag 2/3: backfill `werknl_employer_id` (met conflict-afhandeling zoals wik). Zet `is_bemiddelaar` mee bij create/update.

- [ ] **Step 1: Failing test** - laag 1/2/3 hit + create + backfill + backfill-conflict.
- [ ] **Step 2: Implementatie** (copy-adapt).
- [ ] **Step 3: Test groen + commit** `feat(werk-nl): 3-laags company-dedup op werknl_employer_id`

---

## Task 6: Queue-lib + lijst-scan koppelen (TDD)

**Files:**
- Create: `lib/scrapers/werk_nl/queue.ts`
- Modify: `lib/scrapers/werk_nl/upsert.ts` + `app/api/scrapers/werk-nl/route.ts` (enqueue nieuw/gewijzigd)
- Test: `__tests__/scrapers/werk_nl/queue.test.ts`

`enqueue(jobPostingIds, orchestrationId)`, `claimBatch(orchestrationId, size)` (via `werknl_claim_batch` RPC), `finalize(jobPostingId, outcome)`. De lijst-scan enqueuet de `job_posting_id` van elke **nieuwe** rij en van elke **gewijzigde** (detecteer via `modified` uit de SearchItem t.o.v. opgeslagen waarde).

- [ ] **Step 1: Failing test** enqueue/claim/finalize met gemockte client + RPC.
- [ ] **Step 2: Implementatie** + wire upsert/route (upsert geeft nu `job_posting_id` + outcome terug).
- [ ] **Step 3: Test groen + commit** `feat(werk-nl): queue-lib + lijst-scan enqueuet nieuw/gewijzigd`

---

## Task 7: process-one + worker-route (TDD)

**Files:**
- Create: `lib/scrapers/werk_nl/process-one.ts`, `app/api/scrapers/werk-nl/worker/route.ts`
- Test: `__tests__/scrapers/werk_nl/process-one.test.ts`

`processOne(supabase, session, jobPostingId)`: fetchDetail -> (404 of verstreken `expiresAt`) archiveer (`archived_reason='not_in_werknl'` resp. `'expired'`, geen verrijking) -> finalize; anders map -> dedup -> update `job_postings` (detailvelden, `company_id`, `detail_scraped_at`) -> contact -> finalize success. Worker-route: `// @auth SECRET`, claim batch via queue, loop binnen `maxDuration`, 2-5s delay tussen detailcalls, re-chain zolang werk + tijd. `updateJobSourceStatus` aan het eind.

- [ ] **Step 1: Failing tests** verrijk-pad + 404-archiveer + verlopen-archiveer.
- [ ] **Step 2: Implementatie** (process-one template: `werkenindekempen/process-one.ts`).
- [ ] **Step 3: auth-gate + type-check** `pnpm vitest run __tests__/auth && pnpm exec tsc --noEmit`
- [ ] **Step 4: Commit** `feat(werk-nl): detail-worker (claim, verrijk, archiveer verlopen)`

---

## Task 8: Live verificatie + docs

**Files:**
- Modify: `docs/reference/scrapers.md`, `CONTEXT.md` (open bemiddelaar-vraag sluiten)

- [ ] **Step 1: Echte mini-run** - lijst-scan (klein) -> worker draaien tegen echte detail-API. Toon: aantal verrijkte rijen, een paar `job_postings` met `detail_scraped_at` + `company_id`, en de dedup-verdeling (laag 1/2/3/new). Bevestig bemiddelaar-tagging op een echt voorbeeld.
- [ ] **Step 2: Docs** - `scrapers.md` Fase-2-sectie (detail-API, dedup, queue/worker, archiveer-op-verlopen); `CONTEXT.md` de open bemiddelaar-vraag als resolved markeren met de gekozen detectie.
- [ ] **Step 3: Commit** `docs(werk-nl): documenteer Fase 2 detail-verrijking + dedup`

---

## Vervolg (Fase 3, apart plan)

Generatie-gebaseerde delisting via volledige pass (ADR 0002): scan-generatie op `job_sources`, stempel geziene rijen, bulk-archive `< generatie` na een voltooide pass; incrementele early-stop lijst-scan; cron-registratie in `vercel.json` (orchestrator + worker + volledige pass); watchdog via `consecutive_failures`.

## Self-Review notities

- Spike-first: Task 3/4 leunen bewust op Task 1; geen verzonnen payload-velden.
- ADR 0001 gerespecteerd: eigen `werk_nl_scrape_queue`, niet de gedeelde `needs_detail_scrape`-vlag.
- ADR 0002 bewust buiten scope: archiveren hier alleen op 404/verlopen (detail-pad), niet de generatie-delisting.
- Bemiddelaar-onderscheid (CONTEXT.md) systeembreed via `companies.is_bemiddelaar`; detectie definitief na Task 1.
- Dedup/queue/process-one zijn copy-adapt van werkenindekempen (bewezen patroon).
