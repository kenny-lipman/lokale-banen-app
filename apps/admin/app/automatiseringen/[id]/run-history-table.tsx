// apps/admin/app/automatiseringen/[id]/run-history-table.tsx
'use client'

import { useState } from 'react'
import type { DisplayStat } from '@/lib/automations-registry'

interface Run {
  id: string
  started_at: string
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
  triggered_by_user_id: string | null
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function summarize(stats: Run['business_stats'], displayStats: DisplayStat[]): string {
  if (!stats) return '—'
  return displayStats
    .slice(0, 3)
    .map((s) => stats[s.key] != null ? `${stats[s.key]} ${s.label}` : null)
    .filter(Boolean)
    .join(' · ') || '—'
}

export function RunHistoryTable({ runs, displayStats }: { runs: Run[]; displayStats: DisplayStat[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="rounded-lg border">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-sm">Run history</h3>
        <span className="text-xs text-gray-500">laatste {runs.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs">
            <th className="p-2 font-medium">Tijd</th>
            <th className="p-2 font-medium">Trigger</th>
            <th className="p-2 font-medium">Duur</th>
            <th className="p-2 font-medium">Stats</th>
            <th className="p-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <RowWithExpand key={r.id} run={r} displayStats={displayStats} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)} />
          ))}
          {runs.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-sm">Geen runs nog</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function RowWithExpand({ run, displayStats, expanded, onToggle }: {
  run: Run; displayStats: DisplayStat[]; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="p-2">{new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td className="p-2">{run.triggered_by}</td>
        <td className="p-2 font-mono">{formatDuration(run.duration_ms)}</td>
        <td className="p-2">{summarize(run.business_stats, displayStats)}</td>
        <td className="p-2">
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            run.status === 'success' ? 'bg-green-100 text-green-800'
            : run.status === 'error' ? 'bg-red-100 text-red-800'
            : run.status === 'timeout' ? 'bg-orange-100 text-orange-800'
            : 'bg-blue-100 text-blue-800'
          }`}>{run.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="p-3">
            {run.error_message && (
              <div className="mb-2">
                <div className="text-xs font-medium text-red-700">Error:</div>
                <pre className="text-xs bg-red-50 p-2 rounded mt-1 whitespace-pre-wrap">{run.error_message}</pre>
              </div>
            )}
            <div className="text-xs font-medium text-gray-700">business_stats:</div>
            <pre className="text-xs bg-white border p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(run.business_stats, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}
