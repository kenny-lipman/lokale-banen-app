// apps/admin/lib/cron-config.ts
//
// Compat-laag — bestaande consumers (CronJobMonitor, watchdog tot migratie)
// blijven werken. Bron van waarheid: lib/automations-registry.ts

import { AUTOMATIONS, type AutomationDefinition } from '@/lib/automations-registry'

export const CRON_JOBS_CONFIG: Record<string, { path: string; schedule: string; description: string }> =
  Object.fromEntries(
    AUTOMATIONS.map((a: AutomationDefinition) => [
      a.id,
      { path: a.handlerPath, schedule: a.schedule, description: a.description },
    ])
  )

export const EXPECTED_INTERVAL_MS: Record<string, number> =
  Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.expectedIntervalMs]))

export const OVERDUE_MULTIPLIER = 3
export const ALERT_COOLDOWN_HOURS = 4
