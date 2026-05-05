'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RunDetailResponse } from '@/lib/services/sales-leads/types'

type Props = { run: RunDetailResponse['run'] }

export function LeadStep3Placeholder({ run }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stap 3 — Pipedrive sync</CardTitle>
        <CardDescription>
          Status: <span className="font-mono">{run.status}</span>. Sync-flow + dedupe wordt opgeleverd in fase 5.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p>org_id: <span className="font-mono">{run.pipedrive_org_id ?? '—'}</span></p>
        <p>deal_id: <span className="font-mono">{run.pipedrive_deal_id ?? '—'}</span></p>
        {run.error && <p className="text-red-600">Error: {run.error}</p>}
      </CardContent>
    </Card>
  )
}
