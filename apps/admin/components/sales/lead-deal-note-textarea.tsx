'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Props = {
  runId: string
  note: string
  onChange: (note: string) => void
}

export function LeadDealNoteTextarea({ runId, note, onChange }: Props) {
  const { toast } = useToast()
  const [regenerating, setRegenerating] = useState(false)

  async function regen() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/regenerate-note`, { method: 'POST' })
      const body = (await res.json()) as { deal_note_text?: string; error?: string }
      if (!res.ok || typeof body.deal_note_text !== 'string') {
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      onChange(body.deal_note_text)
      toast({ title: 'Notitie gegenereerd' })
    } catch (e) {
      toast({ title: 'Genereren mislukt', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deal-notitie</CardTitle>
        <Button size="sm" variant="outline" onClick={() => void regen()} disabled={regenerating}>
          {regenerating
            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            : <RefreshCw className="w-3 h-3 mr-1" />
          }
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
        <p className="text-[11px] text-gray-400 mt-1">
          HTML · wordt integraal als note bij de Pipedrive deal geplaatst.
        </p>
      </CardContent>
    </Card>
  )
}
