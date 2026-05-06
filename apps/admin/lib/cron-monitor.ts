// apps/admin/lib/cron-monitor.ts

import { withAutomationMonitoring } from '@/lib/automation-monitor'

// Backward-compat re-exports — bestaande handlers gebruiken deze namen.
export { CRON_JOBS_CONFIG, EXPECTED_INTERVAL_MS, OVERDUE_MULTIPLIER, ALERT_COOLDOWN_HOURS } from '@/lib/cron-config'

/**
 * @deprecated Gebruik `withAutomationMonitoring(automationId)` direct.
 * Tweede argument `path` wordt genegeerd — handlerPath staat in de registry.
 */
export function withCronMonitoring(jobName: string, _path: string) {
  return withAutomationMonitoring(jobName)
}
