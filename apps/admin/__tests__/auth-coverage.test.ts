import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { isApiAuthBypassed } from '@/lib/auth-bypass'

/**
 * Auth-seam coverage-gate.
 *
 * Elke API-route MOET een `// @auth <KLASSE>` marker hebben en de bijbehorende
 * wrapper gebruiken. Dit dwingt af dat geen enkele route zonder bewuste
 * auth-keuze in productie belandt (fail-closed by default).
 *
 * Zie DECISIONS.md (2026-05-29 - Auth-seam).
 */

const API_DIR = path.resolve(__dirname, '..', 'app', 'api')

const VALID_CLASSES = ['PUBLIC', 'SESSION', 'ADMIN', 'SECRET', 'SIGNATURE'] as const
type AuthClass = (typeof VALID_CLASSES)[number]

// Welke wrapper hoort bij welke klasse. PUBLIC vereist geen wrapper.
const WRAPPER_FOR: Record<Exclude<AuthClass, 'PUBLIC'>, RegExp> = {
  SESSION: /\bwithAuth\s*\(/,
  ADMIN: /\bwithAdminAuth\s*\(/,
  // withCronMonitoring en withAutomationMonitoring wrappen intern met withCronAuth.
  SECRET: /\b(withCronAuth|withCronMonitoring|withAutomationMonitoring)\s*\(/,
  SIGNATURE: /\bwithWebhookSecurity\s*\(/,
}

/**
 * Routes die nog operationele coordinatie vergen voordat ze de canonieke
 * wrapper kunnen krijgen. Bewust zichtbaar gehouden i.p.v. stil overslaan.
 * Zie PROGRESS.md (Security - API auth-seam, pending).
 *  - webhooks: HMAC-verificatie vereist secret-afstemming met de externe
 *    provider (MailerLite/Apollo/Instantly) voordat withWebhookSecurity aan kan.
 *  - process/mailerlite-backfill/-setup: hebben al secret-auth (CRON_SECRET /
 *    validateSecretAuth), maar tighten naar verplicht kan een externe trigger
 *    breken - eerst caller bevestigen.
 */
const KNOWN_PENDING = new Set<string>([
  'instantly/webhook/route.ts',
  'mailerlite/webhook/route.ts',
  'webhooks/apollo-result/route.ts',
  'instantly/backfill-queue/process/route.ts',
  'mailerlite/backfill/route.ts',
  'mailerlite/setup/route.ts',
])

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findRouteFiles(full))
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

const routeFiles = findRouteFiles(API_DIR)

describe('auth-coverage', () => {
  it('vindt route-bestanden', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  const missing: string[] = []
  const invalidClass: string[] = []
  const wrapperMismatch: string[] = []

  for (const file of routeFiles) {
    const rel = path.relative(API_DIR, file)
    if (KNOWN_PENDING.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    const match = src.match(/\/\/\s*@auth\s+(\w+)/)

    if (!match) {
      missing.push(rel)
      continue
    }
    const cls = match[1] as AuthClass
    if (!VALID_CLASSES.includes(cls)) {
      invalidClass.push(`${rel} (@auth ${cls})`)
      continue
    }
    if (cls !== 'PUBLIC' && !WRAPPER_FOR[cls].test(src)) {
      wrapperMismatch.push(`${rel} (@auth ${cls}, mist ${WRAPPER_FOR[cls]})`)
    }
  }

  it('elke route heeft een // @auth marker', () => {
    expect(missing, `Routes zonder @auth-marker:\n${missing.join('\n')}`).toEqual([])
  })

  it('elke @auth-marker is een geldige klasse', () => {
    expect(invalidClass, `Ongeldige @auth-klasse:\n${invalidClass.join('\n')}`).toEqual([])
  })

  it('elke route gebruikt de wrapper die bij zijn klasse hoort', () => {
    expect(wrapperMismatch, `Wrapper komt niet overeen met @auth-klasse:\n${wrapperMismatch.join('\n')}`).toEqual([])
  })
})

describe('middleware-bypass dekt exact de non-session routes', () => {
  const SESSION_CLASSES = new Set(['SESSION', 'ADMIN'])
  // route-pad -> URL; dynamische segmenten ([id]) -> 'x' zodat patronen matchen.
  const toUrl = (rel: string) =>
    '/api/' + rel.replace(/\/route\.ts$/, '').replace(/\[[^\]]+\]/g, 'x')

  const shouldBypass: string[] = []
  const shouldNotBypass: string[] = []

  for (const file of routeFiles) {
    const rel = path.relative(API_DIR, file)
    const src = readFileSync(file, 'utf8')
    const m = src.match(/\/\/\s*@auth\s+(\w+)/)
    const cls = m ? m[1] : KNOWN_PENDING.has(rel) ? 'PENDING' : null
    if (!cls) continue
    const url = toUrl(rel)
    if (SESSION_CLASSES.has(cls)) shouldNotBypass.push(url)
    else shouldBypass.push(url)
  }

  it('elke niet-SESSION/ADMIN route wordt door de middleware bypassed (anders 401 voor cron/webhook)', () => {
    const broken = shouldBypass.filter((u) => !isApiAuthBypassed(u))
    expect(broken, `Non-session routes die NIET bypassed worden:\n${broken.join('\n')}`).toEqual([])
  })

  it('geen enkele SESSION/ADMIN route wordt bypassed (anders open zonder sessie)', () => {
    const leaky = shouldNotBypass.filter((u) => isApiAuthBypassed(u))
    expect(leaky, `SESSION/ADMIN routes die ten onrechte bypassed worden:\n${leaky.join('\n')}`).toEqual([])
  })
})
