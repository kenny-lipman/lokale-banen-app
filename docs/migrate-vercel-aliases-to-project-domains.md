# Vercel-aliassen → Project-domains migratie

## Probleem in één zin

64 `*.vercel.app` domains voor regio-jobboards zijn historisch via `POST /v2/deployments/{id}/aliases` toegevoegd, waardoor ze gepind zijn aan een specifieke deploy en **niet automatisch meegaan** met nieuwe production-deploys.

## Doel

Alle 64 deployment-aliassen converteren naar project-domains binnen hetzelfde Vercel-project (`lokale-banen-public`). Daarna volgen ze de huidige production-deploy automatisch — geen auto-repin meer nodig.

## Wat blijft hetzelfde

- 1 Vercel-project, 1 Next.js-app
- DB-tabel `platforms` blijft ongewijzigd (`preview_domain`-kolom)
- Tenant-resolution per Host-header in `apps/public-sites/src/lib/tenant.ts`
- Branding, favicons, content per tenant

## Wat verandert

- Deployment-alias (gepind aan `dpl_xxx`) → Project-domain (gekoppeld aan project)
- Auto-repin GitHub Action (`.github/workflows/repin-public-sites-aliases.yml`) wordt overbodig → kan weg na succesvolle migratie
- `apps/admin/lib/services/vercel-domain.service.ts` wordt overbodig → kan weg
- Aanroep van `ensureVercelAlias` in `platform-publication.service.ts` kan weg

## Per domain — wat gebeurt er?

```
1. DELETE  /v2/aliases/{aliasUid}                  (verwijder gepinde alias)
2. POST    /v10/projects/{projectId}/domains       (voeg toe als project-domain)
3. GET     /v9/projects/{projectId}/domains/{d}    (verifieer)
```

Stap 1 → 2 duurt ~1-3 seconden. Tijdens dat venster geeft het domein een 404 of een Vercel-default. Daarom: **één domein per keer**, sequentieel, niet parallel.

## Risico's en mitigaties

| Risico | Kans | Mitigatie |
|---|---|---|
| Korte 404 tussen DELETE en POST per domein | hoog (~1-3s per domain) | Gebruik niet-piek tijdstip. Sequentieel. Per domain ~2-5s totale window. |
| `addProjectDomain` faalt (rate limit / quota / naamconflict) | laag | Script logt + stopt bij eerste fout. Domein zit dan tussen "geen alias" en "geen project-domain" → 404. Recovery: handmatig in Vercel UI toevoegen, of script opnieuw draaien. |
| Vercel rate-limits tijdens 64 calls | laag-mid | Voeg `await sleep(500)` toe tussen iteraties indien nodig. |
| `*.vercel.app` als project-domain wordt geweigerd door Vercel | laag (zou kunnen — `vercel.app` is een gereserveerd suffix) | Eerst testen op 1 domein (`--only=`). Als geweigerd: alternatief zoeken (eigen `.com`-subdomain als project-domain, en `vercel.app` blijft een alias maar dan met auto-repin als permanente oplossing). |

**Belangrijkste onbekende**: of Vercel `*.vercel.app` namen accepteert als project-domain. Volgens Vercel-docs zijn deze normaal automatische deployment-URLs en dus niet bedoeld voor handmatige project-domain configuratie. Mogelijk werkt dit alleen voor *custom* domains (eigen `.nl` of `.com`).

**Implicatie**: als de migratie van `*.vercel.app` niet werkt, blijven we op auto-repin voor preview-aliassen, en migreren we **alleen de 27 `.nl` custom domains** als project-domains zodra de live productie verhuist van `ixlhosting.nl` naar Vercel.

## Aanbevolen volgorde

### Fase 1 — Test op 1 domein (10 min)

```bash
node scripts/migrate-aliases-to-project-domains.mjs --dry-run
node scripts/migrate-aliases-to-project-domains.mjs --only=westlandsebanen.vercel.app
```

Verifieer:
- `https://westlandsebanen.vercel.app/` toont nog steeds de WestlandseBanen-tenant
- Vercel UI → Project Domains lijst bevat nu `westlandsebanen.vercel.app`
- Push een nieuwe commit naar main, wacht op deploy → controleer of `westlandsebanen.vercel.app` automatisch de nieuwe versie laat zien (zonder repin)

**Beslispunt**: werkt het? Ga door. Werkt het niet (Vercel weigert `*.vercel.app` als project-domain)? Stop migratie, accepteer auto-repin als permanente oplossing voor `*.vercel.app`-aliassen, plan alleen voor custom `.nl`-domeinen.

### Fase 2 — Bulk-migratie (15-30 min)

```bash
node scripts/migrate-aliases-to-project-domains.mjs
```

Verwacht venster van ~5-10 min totaal (sequentieel, ~5-10s per domain). Plan in een rustig moment (avond/weekend).

### Fase 3 — Cleanup (30 min)

Na 24 uur succesvolle running zonder regressies:

1. `.github/workflows/repin-public-sites-aliases.yml` → verwijderen
2. `.github/scripts/wait-for-vercel-deploy.mjs` → verwijderen
3. `scripts/repin-public-sites-aliases.mjs` → verwijderen
4. `apps/admin/lib/services/vercel-domain.service.ts` → verwijderen
5. `apps/admin/lib/services/platform-publication.service.ts` — `import { ensureVercelAlias }` en aanroepen ervan verwijderen
6. Repo-secret `VERCEL_API_TOKEN` mag blijven (handig voor ad-hoc Vercel-acties)

## Rollback

**Tijdens fase 2** (script halverwege): script stopt zelf bij eerste fout. Domeinen die al gemigreerd zijn blijven project-domains (werken). Domeinen die nog niet zijn aangepakt blijven gepinde aliassen (werken). Domein dat halverwege faalde: handmatig in Vercel UI domein toevoegen.

**Na fase 3** (cleanup ongedaan maken): `git revert` van de cleanup-commit. Alle scripts/workflows zijn terug. Vercel domain-config zelf hoeft niet terug — project-domains blijven gewoon werken.

## Custom .nl-domeinen toevoegen

Apart van deze migratie: zodra je een `.nl`-domein van `ixlhosting.nl` wilt verhuizen naar Vercel:

1. Bij domain-registrar: DNS aanpassen
   - Apex: A-record `76.76.21.21`
   - WWW: CNAME `cname.vercel-dns.com`
2. In Vercel: Project `lokale-banen-public` → Settings → Domains → Add → typ `achterhoeksebanen.nl`
3. Vercel verifieert + provisions Let's Encrypt SSL → klaar

Of scriptable via `POST /v10/projects/{projectId}/domains`. Geen migratie nodig — direct als project-domain toegevoegd.
