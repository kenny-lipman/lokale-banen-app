# Custom domains (TransIP + Vercel)

Hoe een public-sites platform van een `*.vercel.app`-preview naar een echt
`.nl`-domein gaat. Geautomatiseerd via `scripts/setup-custom-domains.mjs`.

## Model

- `platforms.domain` = het echte productie-domein (apex, bv. `achterhoeksebanen.nl`).
- `platforms.preview_domain` = het `*.vercel.app`-adres.
- `apps/public-sites/src/lib/tenant.ts` matcht een binnenkomende host **eerst** op
  `domain`, dan op `preview_domain`. Zodra DNS + Vercel kloppen serveert de site
  dus automatisch op het `.nl`-domein, zonder app-wijziging.
- **Canonical = apex.** `www` is een 308-redirect naar de apex. Reden: `canonical.ts`
  en de sitemap bouwen URLs uit `platform.domain` (zonder `www`); www-canonical zou
  een mismatch geven.

## DNS-keuze

DNS blijft bij **TransIP** (geen nameserver-verhuizing). Het script raakt alleen de
`@`- en `www`-records aan; MX/mail en overige records blijven intact.

Per domein:

| Naam | Type  | Inhoud                  |
|------|-------|-------------------------|
| `@`  | A     | `76.76.21.21` (Vercel)  |
| `www`| CNAME | `cname.vercel-dns.com`  |

Vercel geeft soms een extra `_vercel` TXT-record voor verificatie (alleen als het
domein elders al geclaimd is); het script zet die automatisch.

## Eenmalig: TransIP API-key

1. TransIP-controlepaneel → **Mijn account → API**.
2. API inschakelen, **sleutelpaar genereren** → kopieer de **private key** (PEM).
3. Token-instelling: zonder IP-whitelist werkt het script overal
   (de auth gebruikt `global_key: true`). Met whitelist: whitelist het IP dat
   het script draait.

## Env

```
TRANSIP_LOGIN=<transip-gebruikersnaam>
TRANSIP_PRIVATE_KEY_FILE=/pad/naar/transip-private-key.pem   # of TRANSIP_PRIVATE_KEY="-----BEGIN..."
VERCEL_API_TOKEN=<token>           # anders valt het script terug op de Vercel-CLI login
# Vercel team/project hebben defaults voor public-sites; override via
# VERCEL_TEAM_ID / VERCEL_PUBLIC_SITES_PROJECT_ID indien nodig.
```

## Draaien

```bash
node scripts/setup-custom-domains.mjs --dry-run            # niets wijzigen, alleen tonen
node scripts/setup-custom-domains.mjs --only=achterhoeksebanen.nl
node scripts/setup-custom-domains.mjs --limit=5            # eerste 5
node scripts/setup-custom-domains.mjs                      # alle platforms met domain
```

Idempotent: bestaande project-domains en correcte DNS-records worden overgeslagen.
`verified=false` direct na het zetten is normaal - DNS-propagatie + SSL duren tot
~30 min. Draai het script daarna opnieuw om de status te bevestigen.

## Aandachtspunten

- Het script verwerkt alleen platforms waar `platforms.domain` gevuld is.
- Domeinen die niet in het TransIP-account zitten of waar `canEditDns=false` is,
  worden overgeslagen en in de samenvatting gemeld.
- Let op preview/domein-typo's (bv. `nijmegensebanen.vercel.app` ↔
  `nijmeegsebanen.nl`): het echte `.nl` telt en moet zo in TransIP staan.
- `is_public` wordt **niet** automatisch gewijzigd; go-live blijft een aparte stap.
