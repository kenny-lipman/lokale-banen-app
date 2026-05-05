'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw } from 'lucide-react'
import { generateDealNote } from '@/lib/services/sales-leads/auto-note'
import type {
  MasterRecord,
  RunEnrichments,
  NormalizedVacancy,
} from '@/lib/services/sales-leads/types'

type Props = {
  master: MasterRecord
  enrichments: RunEnrichments
  selectedVacancies: NormalizedVacancy[]
  onChange: (note: string) => void
}

export function LeadDealNoteTextarea({ master, enrichments, selectedVacancies, onChange }: Props) {
  const note = master.deal_note_text ?? ''
  function regen() {
    const next = generateDealNote({ master, enrichments, selectedVacancies })
    onChange(next)
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deal-notitie</CardTitle>
        <Button size="sm" variant="outline" onClick={regen}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Genereer opnieuw
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          rows={14}
          value={note}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-gray-400 mt-1">Markdown · wordt integraal als note bij de Pipedrive deal geplaatst.</p>
      </CardContent>
    </Card>
  )
}
