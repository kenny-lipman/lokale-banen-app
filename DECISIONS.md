# Architectuur-beslissingen

Append-only log van beslissingen tijdens de refactor.

## 2026-05-22 - OTIS rename volgorde
**Beslissing:** Rename eerst (Fase 1), daarna auth, dan TanStack Query, dan UI-audit.
**Waarom:** Snelste zichtbare resultaat + onafhankelijk van de andere fases. Geeft momentum.
**Alternatieven:** Auth eerst (grootste UX-impact maar grotere refactor + meer risico op regressies).

## 2026-05-22 - SWR volledig vervangen door TanStack Query
**Beslissing:** SWR uninstall na migratie, niet beide naast elkaar.
**Waarom:** User-keuze. Eén caching-lib voorkomt verwarring en doublure.
**Alternatieven:** SWR laten voor read-only paths (mijn initiële voorstel). Verworpen.
**Implicaties:** Migratie wordt groter dan eerst geschat - alle SWR-hooks (`hooks/use-dashboard-cache`, `lib/swr-prefetch`, `lib/swr-keys`, `lib/swr-config`, `components/QueryState`) moeten mee. Niet meer "per scherm beslissen", maar volledige migratie binnen Fase 3.

## 2026-05-22 - OTIS logo placeholder
**Beslissing:** Start met tekst-wordmark placeholder, echte logo komt later van user.
**Waarom:** Niet blocken op design-asset. SVG-format behouden voor scalability.

## 2026-05-22 - `/dashboard` redirect via server-component, niet next.config
**Beslissing:** `app/dashboard/page.tsx` blijft bestaan met server-side `redirect("/otis")`.
**Waarom:** Simpeler dan `next.config.js redirects()`, even snel, eenvoudiger te debuggen.
**Alternatieven:** Edge-level redirect via next.config (overkill voor één pad).

## 2026-05-29 - Auth-seam (admin-API), best-practice fail-closed
**Context:** Auth was fail-open. Middleware liet alle `/api/*` door; elke route moest zelf een wrapper zetten. 62 niet-publieke routes (31 muterend) hadden geen enkele auth-check. Daarnaast 2x dezelfde hardcoded Instantly API-key in de broncode (`contacts/route.ts:525`, `instantly-campaigns/[campaignId]/details/route.ts:4`), en `validateDashboardRequest` bypassbaar via spoofbare `Sec-Fetch-Site`/`referer`-headers.

**Beslissing:** Auth wordt een seam volgens best practice (na CVE-2025-29927: middleware mag niet de enige laag zijn).
1. Autoritatieve check in de route, via bestaande wrappers (`withAuth`/`withAdminAuth`/`withCronAuth`/`withWebhookSecurity`) - die doen al server-side `getUser()`.
2. Elke route declareert `export const auth = '<KLASSE>'` naast de handler (Next.js-conventie).
3. CI-test dwingt af dat elke `app/api/**/route.ts` een geldige `auth`-export heeft. Vergeten = rode build.
4. Fail-closed middleware als vangnet, als LAATSTE omgezet: `/api/*` vereist sessie behalve een korte bypass-prefixlijst (PUBLIC/SECRET/SIGNATURE).

**Klassen:** PUBLIC, SESSION, ADMIN (`app_metadata.role=admin`), SECRET (`CRON_SECRET`), SIGNATURE (webhook).

**Waarom geen middleware-only:** CVE-2025-29927 (header-bypass) maakt middleware-only een single point of failure. Route blijft autoriteit.

**Aanroeper-inventarisatie:** `otis-app.vercel.app` is de EIGEN deploy-URL, GEEN aparte frontend. Vrijwel alles is same-origin SESSION. Echte externen: webhooks Instantly/MailerLite/Apollo-result (SIGNATURE). Risico op breken externe callers laag.

**Reeds gefixt:** beide hardcoded Instantly-keys vervangen door `process.env.INSTANTLY_API_KEY`. Key moet nog geroteerd worden in Instantly (gelekt via git).

**Open punt:** ~14 `otis/**`-routes worden alleen door de gequarantainede OTIS-feature (`@ts-nocheck`) aangeroepen. Te beslissen: individueel wrappen vs middleware-protect-only vs hele feature verwijderen.
