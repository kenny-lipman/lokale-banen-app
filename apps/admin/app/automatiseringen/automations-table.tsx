// apps/admin/app/automatiseringen/automations-table.tsx
'use client'

import Link from 'next/link'
import type { AutomationView } from './page'

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

function StatusBadge({ status }: { status: 'success' | 'error' | 'timeout' | 'running' }) {
  const map = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    timeout: 'bg-orange-100 text-orange-800',
    running: 'bg-blue-100 text-blue-800',
  } as const
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[status]}`}>{status}</span>
}

function summarizeStats(business: Record<string, unknown> | null, displayStats: AutomationView['displayStats']): string {
  if (!business) return '—'
  return displayStats
    .slice(0, 3)
    .map((s) => business[s.key] != null ? `${business[s.key]} ${s.label}` : null)
    .filter(Boolean)
    .join(' · ') || '—'
}

export function AutomationsTable({ automations }: { automations: AutomationView[] }) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="p-3 font-medium">Naam</th>
            <th className="p-3 font-medium">Schedule</th>
            <th className="p-3 font-medium">Laatste run</th>
            <th className="p-3 font-medium">Resultaat</th>
            <th className="p-3 font-medium">Duur</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium text-right">7d</th>
          </tr>
        </thead>
        <tbody>
          {automations.map((a) => (
            <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50">
              <td className="p-3">
                <Link href={`/automatiseringen/${a.id}`} className="font-medium hover:underline">
                  {a.displayName}
                </Link>
                <div className="text-xs text-gray-500">{a.description}</div>
              </td>
              <td className="p-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{a.schedule}</code></td>
              <td className="p-3">{a.latestRun ? formatRelativeTime(a.latestRun.started_at) : <span className="text-gray-400">geen data</span>}</td>
              <td className="p-3">{summarizeStats(a.latestRun?.business_stats ?? null, a.displayStats)}</td>
              <td className="p-3 font-mono">{formatDuration(a.latestRun?.duration_ms ?? null)}</td>
              <td className="p-3">{a.latestRun ? <StatusBadge status={a.latestRun.status} /> : <span className="text-gray-400 text-xs">N/A</span>}</td>
              <td className="p-3 text-right text-xs">
                {a.stats ? (
                  <div>
                    <div>{a.stats.totalRuns} runs</div>
                    <div className="text-green-600">{a.stats.successRate}% OK</div>
                  </div>
                ) : <span className="text-gray-400">geen data</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
