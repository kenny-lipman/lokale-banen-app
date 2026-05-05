'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Loader2, XCircle, MinusCircle, ChevronDown } from 'lucide-react'
import type { RunEnrichments, EnrichmentStatus, PerSourceEnrichment } from '@/lib/services/sales-leads/types'
import { LeadSourceDetailPanel } from './lead-source-detail-panel'

const SOURCE_LABEL = {
  kvk: 'KvK',
  google_maps: 'Google Maps',
  apollo: 'Apollo',
  website: 'Website',
} as const

type SourceKey = keyof typeof SOURCE_LABEL

const STATUS_ICONS: Record<EnrichmentStatus, { Icon: typeof Loader2; color: string }> = {
  pending: { Icon: Loader2, color: 'text-gray-400' },
  running: { Icon: Loader2, color: 'text-orange-500 animate-spin' },
  completed: { Icon: CheckCircle2, color: 'text-green-600' },
  failed: { Icon: XCircle, color: 'text-red-600' },
  not_found: { Icon: MinusCircle, color: 'text-gray-400' },
}

function summarize(src: SourceKey, e: PerSourceEnrichment | undefined): string {
  if (!e) return 'wachten…'
  if (e.status === 'failed') return e.error ?? 'gefaald'
  if (e.status === 'not_found') return 'niet gevonden'
  if (e.status !== 'completed') return 'bezig…'
  const p = e.parsed
  if (!p) return 'klaar'
  switch (src) {
    case 'kvk':
      return `${Object.keys(p).length} velden · ${p.sbi_activities?.length ?? 0} SBI`
    case 'google_maps':
      return `${p.coordinates ? 'GPS · ' : ''}${p.rating ? `${p.rating}★` : 'place_id'}`
    case 'apollo':
      return `${p.technologies?.length ?? 0} tech · ${p.keywords?.length ?? 0} keywords · ${p.contacts?.length ?? 0} contacten`
    case 'website':
      return `${p.pages_crawled?.length ?? 0} pagina's · ${p.contacts?.length ?? 0} contacten · ${p.vacancies?.length ?? 0} vacatures`
  }
}

type Props = {
  enrichments: RunEnrichments
}

export function LeadSourceStatusGrid({ enrichments }: Props) {
  const [open, setOpen] = useState<SourceKey | null>(null)
  const sources: SourceKey[] = ['kvk', 'google_maps', 'apollo', 'website']
  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sources.map((src) => {
          const e = enrichments[src]
          const status = e?.status ?? 'pending'
          const { Icon, color } = STATUS_ICONS[status]
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
                <p className="text-xs text-gray-500 mt-2">{summarize(src, e)}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {open && enrichments[open] && (
        <LeadSourceDetailPanel source={open} entry={enrichments[open]!} />
      )}
    </div>
  )
}
