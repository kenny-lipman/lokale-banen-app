// apps/admin/app/automatiseringen/[id]/trend-chart.tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Run {
  started_at: string
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
}

export function TrendChart({ runs, primaryStatKey }: { runs: Run[]; primaryStatKey: string | null }) {
  if (!primaryStatKey || runs.filter(r => r.status !== 'running').length === 0) {
    return <p className="text-sm text-gray-400">Geen data</p>
  }
  const data = [...runs]
    .filter((r) => r.status !== 'running')
    .reverse()
    .map((r) => ({
      time: new Date(r.started_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }),
      value: typeof r.business_stats?.[primaryStatKey] === 'number'
        ? (r.business_stats[primaryStatKey] as number)
        : 0,
      status: r.status,
    }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
          <YAxis stroke="#9ca3af" fontSize={11} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">{primaryStatKey} per run</p>
    </div>
  )
}
