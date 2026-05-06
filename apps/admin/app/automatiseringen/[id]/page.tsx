// apps/admin/app/automatiseringen/[id]/page.tsx

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { AutomationDefinition } from '@/lib/automations-registry'
import { RunNowButton } from './run-now-button'
import { TrendChart } from './trend-chart'
import { RunHistoryTable } from './run-history-table'

export const dynamic = 'force-dynamic'

interface AutomationRun {
  id: string
  automation_id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
  triggered_by_user_id: string | null
}

interface DetailResponse {
  success: boolean
  automation: AutomationDefinition
  stats: { totalRuns: number; successCount: number; errorCount: number; avgDurationMs: number; successRate: number } | null
  runs: AutomationRun[]
  error?: string
}

async function fetchDetail(id: string): Promise<DetailResponse | null> {
  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  const host = h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const res = await fetch(`${protocol}://${host}/api/automations/${id}?days=30`, {
    headers: { cookie },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fetch detail failed: ${res.status}`)
  return res.json()
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'zojuist'
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffHours < 24) return `${diffHours}u geleden`
  return `${diffDays}d geleden`
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await fetchDetail(id)
  if (!detail) notFound()

  const { automation, stats, runs } = detail
  const latest = runs[0] ?? null

  return (
    <div className="p-6 space-y-6">
      <div className="text-xs text-gray-500">
        <Link href="/automatiseringen" className="text-blue-600 hover:underline">Automatiseringen</Link>
        {' / '}
        {automation.id}
      </div>

      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{automation.displayName}</h1>
            {latest && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                latest.status === 'success' ? 'bg-green-100 text-green-800'
                : latest.status === 'error' ? 'bg-red-100 text-red-800'
                : latest.status === 'timeout' ? 'bg-orange-100 text-orange-800'
                : 'bg-blue-100 text-blue-800'
              }`}>{latest.status}</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">{automation.category}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{automation.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            <code className="bg-gray-100 px-1 rounded">{automation.schedule}</code>
            {' · handler '}
            <code className="bg-gray-100 px-1 rounded">{automation.handlerPath}</code>
          </p>
        </div>
        <RunNowButton automationId={automation.id} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Vorige run</div>
          <div className="text-lg font-semibold">{latest ? formatRelativeTime(latest.started_at) : '—'}</div>
          <div className="text-xs text-gray-500">{latest ? formatDuration(latest.duration_ms) : ''}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Schedule</div>
          <div className="text-lg font-semibold"><code className="text-base">{automation.schedule}</code></div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Success rate (30d)</div>
          <div className="text-lg font-semibold text-green-700">{stats?.successRate ?? 0}%</div>
          <div className="text-xs text-gray-500">{stats ? `${stats.successCount}/${stats.totalRuns} runs` : '—'}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Avg duur</div>
          <div className="text-lg font-semibold">{stats ? formatDuration(stats.avgDurationMs) : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2">Trend laatste 30 dagen</h3>
          <TrendChart runs={runs} primaryStatKey={automation.primaryStatKey ?? automation.displayStats[0]?.key ?? null} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2">Business stats (laatste run)</h3>
          {latest?.business_stats ? (
            <table className="w-full text-sm">
              <tbody>
                {automation.displayStats.map((s) => (
                  <tr key={s.key}>
                    <td className="text-gray-500 py-1">{s.label}</td>
                    <td className="text-right font-medium">
                      {String(latest.business_stats?.[s.key] ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-gray-400">Geen data</p>}
        </div>
      </div>

      <RunHistoryTable runs={runs} displayStats={automation.displayStats} />
    </div>
  )
}
