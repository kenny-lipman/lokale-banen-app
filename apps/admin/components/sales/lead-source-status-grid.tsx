'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Loader2, XCircle, MinusCircle, ChevronDown } from 'lucide-react'
import type {
  RunEnrichments,
  EnrichmentStatus,
  PerSourceEnrichment,
  SalesLeadRunStatus,
} from '@/lib/services/sales-leads/types'
import { LeadSourceDetailPanel } from './lead-source-detail-panel'

const SOURCE_LABEL = {
  kvk: 'KvK',
  google_maps: 'Google Maps',
  apollo: 'Apollo',
  website: 'Website',
} as const

type SourceKey = keyof typeof SOURCE_LABEL

const TERMINAL_ICONS: Record<Exclude<EnrichmentStatus, 'pending' | 'running'>, { Icon: typeof Loader2; color: string }> = {
  completed: { Icon: CheckCircle2, color: 'text-green-600' },
  failed: { Icon: XCircle, color: 'text-red-600' },
  not_found: { Icon: MinusCircle, color: 'text-gray-400' },
}

// `pending` en undefined renderen we contextueel: spinnen tijdens enriching, statisch erna.
function getIcon(
  status: EnrichmentStatus | undefined,
  runStatus: SalesLeadRunStatus,
): { Icon: typeof Loader2; color: string } {
  if (status === 'running') return { Icon: Loader2, color: 'text-orange-500 animate-spin' }
  if (status === 'completed' || status === 'failed' || status === 'not_found') {
    return TERMINAL_ICONS[status]
  }
  // pending of undefined
  if (runStatus === 'enriching') {
    return { Icon: Loader2, color: 'text-orange-300 animate-spin' }
  }
  return { Icon: MinusCircle, color: 'text-gray-300' }
}

function summarize(
  src: SourceKey,
  e: PerSourceEnrichment | undefined,
  runStatus: SalesLeadRunStatus,
): string {
  if (!e) return runStatus === 'enriching' ? 'wachten…' : 'overgeslagen'
  if (e.status === 'failed') return e.error ?? 'gefaald'
  if (e.status === 'not_found') return 'niet gevonden'
  if (e.status === 'pending') return runStatus === 'enriching' ? 'wachten…' : 'overgeslagen'
  if (e.status === 'running') return 'bezig…'
  const p = e.parsed
  if (!p) return 'klaar'
  switch (src) {
    case 'kvk':
      return `${Object.keys(p).length} velden · ${p.sbi_activities?.length ?? 0} SBI`
    case 'google_maps':
      return `${p.coordinates ? 'GPS · ' : ''}${p.rating ? `${p.rating}★` : 'place_id'}`
    case 'apollo': {
      const contacts = p.contacts?.length ?? 0
      const cold = p.cold_candidates?.length ?? 0
      const peopleLabel =
        contacts > 0 && cold > 0
          ? `${contacts} contacten · ${cold} suggesties`
          : cold > 0
          ? `${cold} suggesties`
          : `${contacts} contacten`
      return `${p.technologies?.length ?? 0} tech · ${p.keywords?.length ?? 0} keywords · ${peopleLabel}`
    }
    case 'website': {
      const crawled = p.pages_crawled?.length ?? 0
      const discovered = p.pages_discovered?.length ?? crawled
      const pagesLabel = discovered > crawled ? `${crawled}/${discovered} pagina's` : `${crawled} pagina's`
      return `${pagesLabel} · ${p.contacts?.length ?? 0} contacten · ${p.vacancies?.length ?? 0} vacatures`
    }
  }
}

type Props = {
  enrichments: RunEnrichments
  runStatus: SalesLeadRunStatus
  runId?: string
  inputDomain?: string
  onCandidatePromoted?: () => void | Promise<void>
}

export function LeadSourceStatusGrid({
  enrichments,
  runStatus,
  runId,
  inputDomain,
  onCandidatePromoted,
}: Props) {
  const [open, setOpen] = useState<SourceKey | null>(null)
  const sources: SourceKey[] = ['kvk', 'google_maps', 'apollo', 'website']
  const openEntry = open ? enrichments[open] : null
  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sources.map((src) => {
          const e = enrichments[src]
          const { Icon, color } = getIcon(e?.status, runStatus)
          const isOpen = open === src
          return (
            <Card
              key={src}
              className={`cursor-pointer transition ${isOpen ? 'ring-2 ring-orange-300' : 'hover:shadow'}`}
              onClick={() => setOpen(isOpen ? null : src)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm font-medium">{SOURCE_LABEL[src]}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-xs text-gray-500 mt-2">{summarize(src, e, runStatus)}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {open && openEntry && (
        <LeadSourceDetailPanel
          source={open}
          entry={openEntry}
          enrichments={enrichments}
          runId={runId}
          inputDomain={inputDomain}
          onCandidatePromoted={onCandidatePromoted}
        />
      )}
    </div>
  )
}
