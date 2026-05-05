'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { RunDetailResponse, SalesLeadRunStatus } from '@/lib/services/sales-leads/types'

const STATUS_LABEL: Record<SalesLeadRunStatus, { label: string; className: string; Icon: typeof Loader2 }> = {
  enriching: { label: 'Verrijken…', className: 'bg-orange-100 text-orange-700', Icon: Loader2 },
  review: { label: 'Klaar voor review', className: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  syncing: { label: 'Pipedrive sync…', className: 'bg-blue-100 text-blue-700', Icon: Loader2 },
  completed: { label: 'Voltooid', className: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  failed: { label: 'Gefaald', className: 'bg-red-100 text-red-700', Icon: XCircle },
  duplicate: { label: 'Duplicaat', className: 'bg-yellow-100 text-yellow-700', Icon: AlertTriangle },
}

type Props = {
  run: RunDetailResponse['run']
  onCancel?: () => void
}

export function LeadStatusBanner({ run, onCancel }: Props) {
  const meta = STATUS_LABEL[run.status]
  const { Icon } = meta
  const spinning = run.status === 'enriching' || run.status === 'syncing'
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sales/lead-verrijking">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Overzicht
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{run.input_domain}</h1>
          <p className="text-xs text-gray-500">{run.input_url}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={`${meta.className} hover:${meta.className}`}>
          <Icon className={`w-3 h-3 mr-1 ${spinning ? 'animate-spin' : ''}`} />
          {meta.label}
        </Badge>
        {run.status === 'enriching' && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </div>
  )
}
