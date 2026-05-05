'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { detectDiscrepancies } from '@/lib/services/sales-leads/master-record'
import type { RunEnrichments, MasterRecord } from '@/lib/services/sales-leads/types'

type Props = {
  enrichments: RunEnrichments
  master: MasterRecord
}

export function LeadDiscrepancyWarnings({ enrichments, master }: Props) {
  const discrepancies = useMemo(() => detectDiscrepancies(enrichments), [enrichments])
  if (discrepancies.length === 0) return null
  return (
    <Card className="border-yellow-300 bg-yellow-50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-900">
          <AlertTriangle className="w-4 h-4" />
          {discrepancies.length} bron-discrepantie{discrepancies.length > 1 ? 's' : ''} gedetecteerd
        </div>
        {discrepancies.map((d) => (
          <div key={String(d.field)} className="text-xs text-yellow-900">
            <span className="font-medium">{String(d.field)}:</span>{' '}
            {d.values.map((v) => `${v.source}=${JSON.stringify(v.value).slice(0, 40)}`).join(' · ')}
            {master.source_overrides[d.field] && (
              <span className="ml-2 text-yellow-700">→ gekozen: {master.source_overrides[d.field]}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
