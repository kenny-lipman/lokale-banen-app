'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Cloud, CloudOff, RotateCcw } from 'lucide-react'
import type { RunDetailResponse, SalesLeadRunStatus } from '@/lib/services/sales-leads/types'

type StatusMeta = { label: string; className: string; Icon: typeof Loader2 }

const STATUS_LABEL: Record<SalesLeadRunStatus, StatusMeta> = {
  enriching: { label: 'Verrijken…', className: 'bg-orange-100 text-orange-700', Icon: Loader2 },
  review: { label: 'Klaar voor review', className: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  syncing: { label: 'Pipedrive sync…', className: 'bg-blue-100 text-blue-700', Icon: Loader2 },
  completed: { label: 'Voltooid', className: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  failed: { label: 'Gefaald', className: 'bg-red-100 text-red-700', Icon: XCircle },
  duplicate: { label: 'Duplicaat', className: 'bg-yellow-100 text-yellow-700', Icon: AlertTriangle },
}

// Defensieve fallback voor als de DB ooit een status buiten de enum bevat
// (legacy rows, handmatige edit, toekomstige status). Voorkomt crash.
const UNKNOWN_STATUS_META: StatusMeta = {
  label: 'Onbekende status',
  className: 'bg-gray-100 text-gray-700',
  Icon: HelpCircle,
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  run: RunDetailResponse['run']
  onCancel?: () => void
  onReplay?: () => void
  replaying?: boolean
  saveState?: SaveState
}

const REPLAYABLE_STATUSES: SalesLeadRunStatus[] = ['failed', 'duplicate']

export function LeadStatusBanner({
  run,
  onCancel,
  onReplay,
  replaying = false,
  saveState = 'idle',
}: Props) {
  const meta: StatusMeta = STATUS_LABEL[run.status] ?? UNKNOWN_STATUS_META
  const { Icon } = meta
  const spinning = run.status === 'enriching' || run.status === 'syncing'
  const canReplay = onReplay && REPLAYABLE_STATUSES.includes(run.status)
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
        {run.status === 'review' && <SaveIndicator state={saveState} />}
        <Badge className={`${meta.className} hover:${meta.className}`}>
          <Icon className={`w-3 h-3 mr-1 ${spinning ? 'animate-spin' : ''}`} />
          {meta.label}
        </Badge>
        {run.status === 'enriching' && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Annuleren
          </Button>
        )}
        {canReplay && (
          <Button variant="outline" size="sm" onClick={onReplay} disabled={replaying}>
            {replaying ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3 mr-1" />
            )}
            Opnieuw runnen
          </Button>
        )}
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') {
    return (
      <span className="flex items-center text-xs text-gray-500">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Opslaan…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center text-xs text-green-600">
        <Cloud className="w-3 h-3 mr-1" />
        Opgeslagen
      </span>
    )
  }
  return (
    <span className="flex items-center text-xs text-red-600">
      <CloudOff className="w-3 h-3 mr-1" />
      Opslaan mislukt
    </span>
  )
}
