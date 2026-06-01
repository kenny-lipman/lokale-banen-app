# Campaign Assignment & WeTarget

> Bij wijziging aan de orchestrator/worker-flow, WeTarget-campagnes of Instantly-integratie: werk deze doc bij in dezelfde commit.

## Campaign Assignment Architecture

Campaign assignment gebruikt een **parallel orchestrator + worker** pattern:

- **Orchestrator** (`/api/cron/campaign-assignment-parallel`): haalt alle candidates op, groepeert per platform, triggert een aparte worker per platform via HTTP
- **Worker** (`/api/cron/campaign-assignment`): verwerkt tot 30 contacts voor een enkel platform (hard cap voor 300s timeout safety)
- Elke worker: Pipedrive search -> blocklist check -> Mistral AI personalization -> Instantly lead creation
- ~500 contacts over ~10-17 platforms in ~5 min wall time (parallel) vs ~160 min (oude sequential)
- Batches gegroepeerd per `orchestration_id` in de `campaign_assignment_batches` tabel
- Worker endpoint accepteert nog steeds manual triggers zonder `platformId` (sequential fallback mode)

## WeTarget Campaigns (Sector-based)

WeTarget is een jobmarketing-bureau (vacature-ads, employer branding). Anders dan de reguliere platform-based campagnes zijn WeTarget-campagnes **sector-based**.

### Campaigns
| Sector | Campaign ID | Senders |
|--------|------------|---------|
| Logistiek | `f5422a62-0dff-493d-b6d2-fac4eef133a1` | bart@, lois@we-targetonline.com |
| Transport | `df8d72a9-2472-400c-ba4b-332c59bf67ec` | bart@, lois@we-targetonline.com |
| Techniek | `a3664d52-7f83-4927-a088-493dddaf36d3` | bart@, lois@we-targetonline.com |

### Lead Selection Criteria
- Match `job_postings.title` op sector-specifieke functienamen (ILIKE patterns)
- **Exclude Zuid-Holland**: state + postcode ranges 2160-3399 en 4100-4299
- 1 contact per company, alleen personal emails (geen info@, hr@, etc.)
- Exclude "Afdeling Personeelszaken" placeholder contacts
- Prioriteer recente job postings

### Scripts (in `scripts/`)
- `generate-wetarget-excel.mjs` - Export staging leads naar Excel (3 worksheets per sector)
- `push-wetarget-instantly.mjs` - Push staging leads naar Instantly campaigns (1 voor 1 via POST /api/v2/leads)
- `enrich-wetarget-leads.mjs` - AI personalization via Mistral + update Instantly leads
- `fix-wetarget-titles.mjs` - Batch normalize job titles via Mistral + update Instantly (batches van 15 unieke titles)

## Instantly API Notes
- Create lead: `POST /api/v2/leads` (single lead)
- List leads: `POST /api/v2/leads/list` (niet GET /leads)
- Update lead: `PATCH /api/v2/leads/{id}`
- Auth: `Bearer ${INSTANTLY_API_KEY}`
- `jobTitle` is een core variable (set bij creation), custom variables zitten in `payload`
