// apps/admin/lib/automations/fix-job-postings-geocoding/budget-check.ts

import type { SupabaseClient } from '@supabase/supabase-js'

const DAILY_CAP = 4500  // 500-call buffer onder de 5000 free-tier cap

export async function getApiCallsToday(supabase: SupabaseClient, automationId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('automation_runs')
    .select('business_stats')
    .eq('automation_id', automationId)
    .gte('started_at', startOfDay.toISOString())
  if (error) {
    console.error('[budget-check] query failed:', error.message)
    return 0
  }
  return (data ?? []).reduce((sum, r) => {
    const calls = (r.business_stats as Record<string, unknown> | null)?.['api_calls_used']
    return sum + (typeof calls === 'number' ? calls : 0)
  }, 0)
}

export function isBudgetExhausted(callsToday: number, plannedCallsForRun: number): boolean {
  return callsToday + plannedCallsForRun > DAILY_CAP
}

export { DAILY_CAP }
