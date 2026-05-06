// apps/admin/app/automatiseringen/page.tsx

import { headers } from 'next/headers'
import { AutomationsTable } from './automations-table'
import type { AutomationDefinition } from '@/lib/automations-registry'

export const dynamic = 'force-dynamic'

interface AutomationRun {
  id: string
  automation_id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, unknown> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
}

interface AutomationStats {
  totalRuns: number; successCount: number; errorCount: number;
  timeoutCount: number; avgDurationMs: number; maxDurationMs: number; successRate: number
}

export interface AutomationView extends AutomationDefinition {
  latestRun: AutomationRun | null
  stats: AutomationStats | null
}

async function fetchAutomations(): Promise<AutomationView[]> {
  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  const host = h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const res = await fetch(`${protocol}://${host}/api/automations?days=7`, {
    headers: { cookie },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`fetch /api/automations failed: ${res.status}`)
  const json = await res.json()
  return json.automations as AutomationView[]
}

export default async function AutomatiseringenPage() {
  const automations = await fetchAutomations()

  const ok = automations.filter(a => a.latestRun?.status === 'success').length
  const err = automations.filter(a => a.latestRun && (a.latestRun.status === 'error' || a.latestRun.status === 'timeout')).length
  const warn = 0  // toekomstige slot voor 'nadering timeout'
  const total = automations.length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automatiseringen</h1>
          <p className="text-sm text-gray-500">{total} actief · laatste 7 dagen</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Totaal</div>
          <div className="text-2xl font-bold mt-1">{total}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-sm text-green-700">OK</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{ok}</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="text-sm text-orange-700">Warnings</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{warn}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-700">Errors</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{err}</div>
        </div>
      </div>

      <AutomationsTable automations={automations} />

      <p className="text-xs text-gray-400 text-right">
        Geocoding via{' '}
        <a href="https://locationiq.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
          LocationIQ
        </a>
      </p>
    </div>
  )
}
