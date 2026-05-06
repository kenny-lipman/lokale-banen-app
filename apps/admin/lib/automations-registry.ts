// apps/admin/lib/automations-registry.ts

export type AutomationCategory = 'scraper' | 'sync' | 'enrichment' | 'maintenance'

export interface DisplayStat {
  key: string
  label: string
  format?: 'number' | 'percent' | 'duration'
}

export interface AutomationDefinition {
  id: string
  displayName: string
  description: string
  category: AutomationCategory
  schedule: string                // cron expr in UTC
  expectedIntervalMs: number
  handlerPath: string
  displayStats: DisplayStat[]
  primaryStatKey?: string         // welke key in business_stats voor trend-grafiek (default: eerste in displayStats)
  docsLink?: string
}

const HOUR = 3_600_000
const MINUTE = 60_000

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    id: 'fix-job-postings-geocoding',
    displayName: 'Geocoding job_postings',
    description: 'Verrijkt job_postings met postcode, lat/lng en platform_id via LocationIQ',
    category: 'enrichment',
    schedule: '0 */2 * * *',
    expectedIntervalMs: 2 * HOUR,
    handlerPath: '/api/cron/fix-job-postings-geocoding',
    displayStats: [
      { key: 'enriched', label: 'verrijkt' },
      { key: 'geocoding_failed_no_match', label: 'geen match' },
      { key: 'geocoding_failed_no_postcode', label: 'geen postcode' },
      { key: 'platform_matched', label: 'platform' },
      { key: 'queue_remaining', label: 'queue' },
    ],
    primaryStatKey: 'enriched',
  },
  {
    id: 'postcode-backfill',
    displayName: 'Postcode backfill (companies)',
    description: 'Geocoding voor company-postcodes',
    category: 'enrichment',
    schedule: '*/2 * * * *',
    expectedIntervalMs: 2 * MINUTE,
    handlerPath: '/api/cron/postcode-backfill',
    displayStats: [
      { key: 'processed', label: 'verwerkt' },
      { key: 'enriched', label: 'verrijkt' },
      { key: 'failed', label: 'gefaald' },
    ],
    primaryStatKey: 'enriched',
  },
  {
    id: 'baanindebuurt-scraper',
    displayName: 'Baanindebuurt scraper',
    description: 'Vacatures scrapen van baanindebuurt.nl',
    category: 'scraper',
    schedule: '0 5 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/scrapers/baanindebuurt',
    displayStats: [
      { key: 'new', label: 'nieuw' },
      { key: 'updated', label: 'update' },
      { key: 'skipped', label: 'overgeslagen' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'new',
  },
  {
    id: 'debanensite-scraper',
    displayName: 'Debanensite scraper',
    description: 'Vacatures scrapen van debanensite.nl',
    category: 'scraper',
    schedule: '0 6 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/scrapers/debanensite',
    displayStats: [
      { key: 'pages_scraped', label: "pagina's" },
      { key: 'new', label: 'nieuw' },
      { key: 'updated', label: 'update' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'new',
  },
  {
    id: 'campaign-assignment-parallel',
    displayName: 'Campaign assignment',
    description: 'Verdeelt contacts over Instantly campagnes',
    category: 'sync',
    schedule: '0 7,13 * * *',
    expectedIntervalMs: 6 * HOUR,
    handlerPath: '/api/cron/campaign-assignment-parallel',
    displayStats: [
      { key: 'platforms_processed', label: 'platforms' },
      { key: 'contacts_assigned', label: 'contacts' },
      { key: 'campaigns_used', label: 'campagnes' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'contacts_assigned',
  },
  {
    id: 'cleanup-instantly-leads',
    displayName: 'Instantly cleanup',
    description: 'Verwijdert completed leads uit Instantly na 10 dagen',
    category: 'maintenance',
    schedule: '0 3 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/cleanup-instantly-leads',
    displayStats: [
      { key: 'deleted', label: 'verwijderd' },
      { key: 'kept', label: 'behouden' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'deleted',
  },
  {
    id: 'daily-campaign-report',
    displayName: 'Daily campaign report',
    description: 'Verstuurt dagelijks Instantly performance-rapport',
    category: 'maintenance',
    schedule: '0 8 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/daily-campaign-report',
    displayStats: [
      { key: 'reports_sent', label: 'rapporten' },
      { key: 'recipients', label: 'recipients' },
    ],
    primaryStatKey: 'reports_sent',
  },
  {
    id: 'refresh-campaign-eligible',
    displayName: 'Refresh campaign eligible',
    description: 'Vernieuwt campaign-eligible materialized view',
    category: 'maintenance',
    schedule: '30 6 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/refresh-campaign-eligible',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'refresh-contact-stats',
    displayName: 'Refresh contact stats',
    description: 'Vernieuwt contact_stats materialized view',
    category: 'maintenance',
    schedule: '*/5 * * * *',
    expectedIntervalMs: 5 * MINUTE,
    handlerPath: '/api/cron/refresh-contact-stats',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'refresh-company-platforms',
    displayName: 'Refresh company platforms',
    description: 'Vernieuwt company_platforms materialized view',
    category: 'maintenance',
    schedule: '0 10 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/refresh-company-platforms',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'auto-archive-old',
    displayName: 'Auto-archive old',
    description: 'Archiveert oude vacatures',
    category: 'maintenance',
    schedule: '30 3 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/auto-archive-old',
    displayStats: [
      { key: 'archived', label: 'gearchiveerd' },
      { key: 'kept', label: 'behouden' },
    ],
    primaryStatKey: 'archived',
  },
  {
    id: 'watchdog',
    displayName: 'Watchdog',
    description: 'Monitort alle automatiseringen en stuurt Slack-alerts',
    category: 'maintenance',
    schedule: '*/15 * * * *',
    expectedIntervalMs: 15 * MINUTE,
    handlerPath: '/api/cron/watchdog',
    displayStats: [
      { key: 'jobs_checked', label: 'jobs gecheckt' },
      { key: 'overdue', label: 'overdue' },
      { key: 'alerts_sent', label: 'alerts' },
    ],
    primaryStatKey: 'jobs_checked',
  },
]

export function getAutomation(id: string): AutomationDefinition | undefined {
  return AUTOMATIONS.find(a => a.id === id)
}

/** Een job is overdue als hij langer dan 3× expectedIntervalMs niet gedraaid heeft */
export const OVERDUE_MULTIPLIER = 3

export function isOverdue(automation: AutomationDefinition, lastRunStartedAt: string | null): boolean {
  if (!lastRunStartedAt) return false
  const elapsed = Date.now() - new Date(lastRunStartedAt).getTime()
  return elapsed > automation.expectedIntervalMs * OVERDUE_MULTIPLIER
}
