/**
 * Cron Job Configuration
 *
 * Shared constants for cron job monitoring. This file has NO server-only
 * imports so it can be used in both server and client components.
 */

/** Config for all known cron jobs */
export const CRON_JOBS_CONFIG: Record<string, { path: string; schedule: string; description: string }> = {
  'campaign-assignment': {
    path: '/api/cron/campaign-assignment',
    schedule: '0 7,13,19 * * *',
    description: 'Assigns companies to Instantly campaigns (3x/day)',
  },
  'cleanup-instantly-leads': {
    path: '/api/cron/cleanup-instantly-leads',
    schedule: '0 3 * * *',
    description: 'Removes completed leads from Instantly after 10 days',
  },
  'postcode-backfill': {
    path: '/api/cron/postcode-backfill',
    schedule: '*/2 * * * *',
    description: 'Geocoding enrichment for company postal codes',
  },
  'refresh-campaign-eligible': {
    path: '/api/cron/refresh-campaign-eligible',
    schedule: '30 6 * * *',
    description: 'Refreshes campaign eligible companies materialized view',
  },
  'refresh-contact-stats': {
    path: '/api/cron/refresh-contact-stats',
    schedule: '*/5 * * * *',
    description: 'Refreshes contact stats materialized view',
  },
  'baanindebuurt-scraper': {
    path: '/api/scrapers/baanindebuurt',
    schedule: '0 5 * * *',
    description: 'Scrapes job postings from baanindebuurt.nl',
  },
  'debanensite-scraper': {
    path: '/api/scrapers/debanensite',
    schedule: '0 6 * * *',
    description: 'Scrapes job postings from debanensite.nl',
  },
  'watchdog': {
    path: '/api/cron/watchdog',
    schedule: '*/15 * * * *',
    description: 'Monitors all cron jobs and sends Slack alerts for overdue jobs',
  },
}

/** Expected run interval per job in ms — used by watchdog and dashboard for overdue detection */
export const EXPECTED_INTERVAL_MS: Record<string, number> = {
  'campaign-assignment': 6 * 3_600_000,
  'cleanup-instantly-leads': 24 * 3_600_000,
  'postcode-backfill': 2 * 60_000,
  'refresh-campaign-eligible': 24 * 3_600_000,
  'refresh-contact-stats': 5 * 60_000,
  'baanindebuurt-scraper': 24 * 3_600_000,
  'debanensite-scraper': 24 * 3_600_000,
  'watchdog': 15 * 60_000,
}

/** Multiplier for overdue detection — job is overdue if elapsed > expectedInterval * this */
export const OVERDUE_MULTIPLIER = 3

/** Cooldown period for alert deduplication (hours) */
export const ALERT_COOLDOWN_HOURS = 4
