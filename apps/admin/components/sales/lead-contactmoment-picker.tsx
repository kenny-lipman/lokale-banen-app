'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Loader2, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Props = {
  runId: string
  contactmomentOverride: string | null
  onChange: (next: string | null) => void
}

/**
 * Datepicker voor sales_lead_runs.contactmoment_override.
 * NULL → "Auto (volgende werkdag)" badge.
 * Wel-gezet → toont datum + reset-knop.
 * Disabled past dates (alleen vandaag of later).
 */
export function LeadContactmomentPicker({ runId, contactmomentOverride, onChange }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedDate = contactmomentOverride ? parseISO(contactmomentOverride) : undefined
  const displayLabel = selectedDate
    ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })
    : 'Auto (volgende werkdag)'

  async function save(next: string | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/contactmoment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactmoment_override: next }),
      })
      const body = (await res.json()) as { contactmoment_override?: string | null; error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      onChange(body.contactmoment_override ?? null)
      setOpen(false)
    } catch (e) {
      toast({ title: 'Contactmoment opslaan mislukt', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contactmoment</CardTitle>
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start font-normal" disabled={saving}>
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                {displayLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (!d) return
                  void save(format(d, 'yyyy-MM-dd'))
                }}
                disabled={(d) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return d < today
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {contactmomentOverride ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void save(null)}
              disabled={saving}
              title="Reset naar auto"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-gray-400">
          Standaard gebruikt Pipedrive de volgende werkdag (op basis van de owner-config).
          Override hier voor een specifieke datum.
        </p>
      </CardContent>
    </Card>
  )
}
