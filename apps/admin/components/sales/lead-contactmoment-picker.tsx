'use client'

import { useMemo, useState } from 'react'
import { addBusinessDays, format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  runId: string
  contactmomentOverride: string | null
  /** Werkdag-offset uit owner-config (default 1). Bepaalt de auto-datum
   *  zolang er geen handmatige override is gezet. */
  offsetWorkdays: number
  onChange: (next: string | null) => void
}

/**
 * Datepicker voor sales_lead_runs.contactmoment_override.
 * - Override gezet -> toont en selecteert die datum.
 * - Override null   -> toont label 'Auto ({datum})' en selecteert de auto-datum
 *   visueel in de calendar zonder dat het een echte override is. Pas wanneer
 *   sales een andere datum klikt wordt het een override.
 * Verleden datums zijn disabled.
 */
export function LeadContactmomentPicker({ runId, contactmomentOverride, offsetWorkdays, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-datum = `offsetWorkdays` werkdagen na vandaag. addBusinessDays slaat
  // zat/zon over - matcht nextWorkday() in pipedrive-payloads.ts:163.
  const autoDate = useMemo(() => addBusinessDays(new Date(), offsetWorkdays), [offsetWorkdays])

  const overrideDate = contactmomentOverride ? parseISO(contactmomentOverride) : null
  // Wanneer geen override: tonen we de auto-datum in de calendar als 'selected'
  // zodat sales meteen ziet wat de default is. Bij click op een andere dag
  // wordt dat een echte override.
  const calendarSelected = overrideDate ?? autoDate

  const triggerLabel = overrideDate
    ? format(overrideDate, 'EEEE d MMMM yyyy', { locale: nl })
    : `Auto: ${format(autoDate, 'EEEE d MMMM', { locale: nl })} (volgende werkdag)`

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
      toast.error('Contactmoment opslaan mislukt', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  function handleSelect(d: Date | undefined) {
    if (!d) return
    const picked = format(d, 'yyyy-MM-dd')
    const auto = format(autoDate, 'yyyy-MM-dd')
    // Wanneer sales op de auto-datum klikt terwijl er nog geen override was,
    // resetten we naar null i.p.v. de auto-datum als override op te slaan.
    // Voorkomt dat we onbedoeld de owner-config-default vastpinnen.
    if (picked === auto && contactmomentOverride === null) {
      setOpen(false)
      return
    }
    void save(picked)
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
                {triggerLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={calendarSelected}
                onSelect={handleSelect}
                disabled={(d) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return d < today
                }}
                locale={nl}
                weekStartsOn={1}
                autoFocus
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
          {overrideDate
            ? 'Specifieke datum gekozen. Klik op het reset-icoon om terug te gaan naar auto.'
            : `Auto-datum komt uit de owner-config (${offsetWorkdays} werkdag${offsetWorkdays === 1 ? '' : 'en'}). Kies een andere dag voor een override.`}
        </p>
      </CardContent>
    </Card>
  )
}
