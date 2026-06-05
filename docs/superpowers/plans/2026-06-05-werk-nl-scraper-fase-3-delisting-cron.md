# werk.nl scraper - Fase 3: delisting + cron + monitoring - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans of subagent-driven-development. Stappen met checkbox (`- [ ]`).

**Goal:** De werk.nl scraper zelfstandig laten draaien: dagelijkse incrementele lijst-scan, periodieke volledige pass die verdwenen vacatures archiveert (ADR 0002), detail-worker op cron, en watchdog/reaper. Daarna draait werk.nl end-to-end zonder handmatige triggers.

**Architecture:** Drie cron-routes. (1) Incrementele lijst-scan (GET, dagelijks): ontdekt nieuw/gewijzigd met early-stop, enqueuet, archiveert nooit. (2) Volledige pass (GET, frequent, cursor-gestuurd over meerdere runs): ververst `last_seen_in_sitemap` van alle vacatures; bij een **voltooide** pass archiveert een sweep alles dat sinds pass-start niet gezien is (ADR 0002). (3) Detail-worker (GET, frequent): drain-modus (orchestratie-agnostisch claimen) + reaper voor vastgelopen `processing`-rijen. Pass-state in eigen singleton-tabel `werk_nl_scan_state` (geen vervuiling van `job_sources`).

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase. Bouwt voort op Fase 1/2 in `apps/admin/lib/scrapers/werk_nl/`.

**Scope:** Delisting (pass-based), incrementele early-stop, cron-registratie, reaper/watchdog. Buiten scope: changed-detection voor re-enrichment (vereist opslaan van bron-`modified`; bewust later), UI.

**Hard rules:** geen em-dash; `// @auth SECRET` op regel 1 van elke `route.ts`; na DB-changes `apply_migration` -> `get_advisors` -> types; `docs/reference/{scrapers,database,cron-jobs}.md` bijwerken in dezelfde commit.

---

## File Structure

| Bestand | Verantwoordelijkheid |
|---------|----------------------|
| `supabase/migrations/<ts>_werknl_fase3.sql` | `werk_nl_scan_state` singleton; `werknl_claim_batch` -> null-orchestratie = "any" |
| `lib/scrapers/werk_nl/delisted.ts` | `archiveNotSeenSince()` - delisting-sweep |
| `lib/scrapers/werk_nl/scan-state.ts` | lees/schrijf pass-cursor/state; "moet nieuwe pass starten?" |
| `lib/scrapers/werk_nl/queue.ts` | + `reapStaleProcessing()`, `claimBatch` orchestratie-optioneel |
| `lib/scrapers/werk_nl/search-client.ts` of route | incrementele early-stop helper |
| `app/api/scrapers/werk-nl/route.ts` | + GET (cron, incrementeel met early-stop) |
| `app/api/scrapers/werk-nl/full-pass/route.ts` | volledige pass orchestrator (cursor + sweep) |
| `app/api/scrapers/werk-nl/worker/route.ts` | + drain-modus (geen orchestrationId) + reaper |
| `apps/admin/vercel.json` | 3 cron-registraties + `maxDuration` |
| tests | delisted, scan-state, reaper, early-stop |

---

## Task 1: Schema (scan-state + claim "any")

- [ ] **Migratie** `werk_nl_scan_state` (singleton): `id smallint primary key default 1 check (id=1)`, `pass_cursor int not null default 0`, `pass_started_at timestamptz`, `pass_completed_at timestamptz`. RLS aan, geen policies. Seed 1 rij.
- [ ] **`werknl_claim_batch` herdefinieren**: `where (p_orchestration_id is null or q.orchestration_id = p_orchestration_id)` zodat de cron-worker orchestratie-agnostisch kan drainen. Backward-compatible.
- [ ] `apply_migration` -> `get_advisors` -> types regenereren -> `database.md` bij.
- [ ] Commit `feat(werk-nl): Fase 3 schema (scan-state + claim any)`

---

## Task 2: Delisting-sweep (TDD)

`lib/scrapers/werk_nl/delisted.ts`: `archiveNotSeenSince(supabase, sourceId, passStartedAtIso)` -> update `job_postings` set `archived_at=now, archived_reason='not_in_werknl', status='archived'` where `source_id=sourceId and last_seen_in_sitemap < passStartedAt and archived_at is null`. Returns aantal gearchiveerd.

- [ ] Failing test (mock client telt geraakte rijen; filter-args gecontroleerd).
- [ ] Implementatie.
- [ ] Commit `feat(werk-nl): delisting-sweep op niet-gezien-sinds-pass`

---

## Task 3: Scan-state + volledige-pass orchestrator (TDD waar puur)

`scan-state.ts`: `getScanState()`, `startPassIfDue(staleDays)` (start nieuwe pass als idle en `pass_completed_at` > N dagen geleden of null), `advanceCursor(n)`, `completePass()`.

`app/api/scrapers/werk-nl/full-pass/route.ts` (`// @auth SECRET`, GET+POST): 
- initialiseer pass (cursor + `pass_started_at`).
- scan een begrensd aantal pagina's vanaf cursor (tijdbudget), upsert (ververst `last_seen`), advance cursor.
- einde bereikt (lege/korte pagina) -> `completePass()` + `archiveNotSeenSince(sourceId, pass_started_at)` + cursor reset.

- [ ] Failing tests voor de pure state-overgangen (start/advance/complete, due-logica).
- [ ] Implementatie route + lib.
- [ ] auth-gate + type-check.
- [ ] Commit `feat(werk-nl): volledige-pass orchestrator met delisting-sweep`

---

## Task 4: Incrementele early-stop (TDD)

Lijst-scan krijgt een incrementele modus: stop zodra `N` opeenvolgende pagina's uitsluitend reeds-bekende (`outcome==="seen"`) vacatures bevatten (sort=nieuwste, dus daarna enkel ouder/bekend). GET-handler op `/api/scrapers/werk-nl` voor de dagelijkse cron (default incrementeel). POST blijft handmatig (full of incrementeel via body).

- [ ] Failing test voor de stop-conditie (pure helper `shouldStop(consecutiveKnownPages, threshold)`).
- [ ] Implementatie + GET-handler.
- [ ] Commit `feat(werk-nl): incrementele early-stop lijst-scan + cron-GET`

---

## Task 5: Worker drain-modus + reaper (TDD)

- [ ] `queue.ts`: `reapStaleProcessing(supabase, staleAfterMs)` (reset `processing` ouder dan cutoff -> `pending`, `picked_at=null`), template wik. `claimBatch` accepteert `orchestrationId: string | null`.
- [ ] Worker-route: zonder `orchestrationId` (cron) -> drain alle pending; reap aan het begin van de run.
- [ ] Failing tests reaper + claim-any.
- [ ] Commit `feat(werk-nl): worker drain-modus + reaper voor vastgelopen rijen`

---

## Task 6: Cron-registratie + monitoring

- [ ] `apps/admin/vercel.json`: 3 crons + `maxDuration`. **Cadans (tunable, bevestig vóór merge):**
  - `/api/scrapers/werk-nl` (incrementeel) - `0 6 * * *` (dagelijks 06:00)
  - `/api/scrapers/werk-nl/full-pass` - `*/30 * * * *` (elke 30 min, self-gating; nieuwe pass als > 7 dagen sinds vorige voltooiing)
  - `/api/scrapers/werk-nl/worker` - `*/10 * * * *` (elke 10 min, drain + reap)
- [ ] Watchdog: bevestig dat de bestaande `watchdog`/`job_sources.consecutive_failures` werk.nl meeneemt; reaper dekt vastgelopen queue-rijen.
- [ ] `docs/reference/cron-jobs.md` bij (3 nieuwe rijen).
- [ ] Commit `feat(werk-nl): cron-registratie (incrementeel + volledige pass + worker)`

---

## Task 7: Live verificatie + docs

- [ ] Echte mini-run: incrementele scan; een begrensde full-pass-chunk; demonstreer dat een kunstmatig "oude" `last_seen` door de sweep gearchiveerd wordt (op een testrij, daarna opruimen).
- [ ] `docs/reference/scrapers.md` Fase-3-sectie (delisting, scan-modi, cron).
- [ ] Commit `docs(werk-nl): documenteer Fase 3 delisting + cron`

## Self-Review notities

- ADR 0002 nageleefd: archiveren alleen op voltooide pass, sweep op `last_seen < pass_started_at`. Incrementeel archiveert nooit.
- Pass-state in eigen `werk_nl_scan_state` (bounded context), niet in gedeelde `job_sources`.
- Cron-cadans is tunable en activeert pas bij merge; bevestig de getallen in review.
- Changed-detection voor re-enrichment bewust uitgesteld (vereist bron-`modified` opslaan).
