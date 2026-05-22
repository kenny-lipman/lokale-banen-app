# Architectuur-beslissingen

Append-only log van beslissingen tijdens de refactor.

## 2026-05-22 — OTIS rename volgorde
**Beslissing:** Rename eerst (Fase 1), daarna auth, dan TanStack Query, dan UI-audit.
**Waarom:** Snelste zichtbare resultaat + onafhankelijk van de andere fases. Geeft momentum.
**Alternatieven:** Auth eerst (grootste UX-impact maar grotere refactor + meer risico op regressies).

## 2026-05-22 — SWR volledig vervangen door TanStack Query
**Beslissing:** SWR uninstall na migratie, niet beide naast elkaar.
**Waarom:** User-keuze. Eén caching-lib voorkomt verwarring en doublure.
**Alternatieven:** SWR laten voor read-only paths (mijn initiële voorstel). Verworpen.
**Implicaties:** Migratie wordt groter dan eerst geschat — alle SWR-hooks (`hooks/use-dashboard-cache`, `lib/swr-prefetch`, `lib/swr-keys`, `lib/swr-config`, `components/QueryState`) moeten mee. Niet meer "per scherm beslissen", maar volledige migratie binnen Fase 3.

## 2026-05-22 — OTIS logo placeholder
**Beslissing:** Start met tekst-wordmark placeholder, echte logo komt later van user.
**Waarom:** Niet blocken op design-asset. SVG-format behouden voor scalability.

## 2026-05-22 — `/dashboard` redirect via server-component, niet next.config
**Beslissing:** `app/dashboard/page.tsx` blijft bestaan met server-side `redirect("/otis")`.
**Waarom:** Simpeler dan `next.config.js redirects()`, even snel, eenvoudiger te debuggen.
**Alternatieven:** Edge-level redirect via next.config (overkill voor één pad).
