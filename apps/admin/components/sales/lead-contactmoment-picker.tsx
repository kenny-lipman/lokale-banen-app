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

type ControlProps = {
  /** YYYY-MM-DD wanneer override gezet, null = gebruik auto-datum. */
  value: string | null
  offsetWorkdays: number
  disabled?: boolean
  saving?: boolean
  onChange: (next: string | null) => void
}

/**
 * Pure picker-UI - calendar + popover + auto/override-label. Geen fetch.
 * Caller bepaalt of het een review-page-flow (PATCH naar run) of een
 * stap-1-create-form-flow (form-state) is.
 */
export function ContactmomentPickerControl({
  value,
  offsetWorkdays,
  disabled,
  saving,
  onChange,
}: ControlProps) {
  const [open, setOpen] = useState(false)

  // Auto-datum = `offsetWorkdays` werkdagen na vandaag. addBusinessDays slaat
  // zat/zon over - matcht nextWorkday() in pipedrive-payloads.ts:163.
  const autoDate = useMemo(() => addBusinessDays(new Date(), offsetWorkdays), [offsetWorkdays])

  const overrideDate = value ? parseISO(value) : null
  const calendarSelected = overrideDate ?? autoDate

  const triggerLabel = overrideDate
    ? format(overrideDate, 'EEEE d MMMM yyyy', { locale: nl })
    : `Auto: ${format(autoDate, 'EEEE d MMMM', { locale: nl })} (volgende werkdag)`

  function handleSelect(d: Date | undefined) {
    if (!d) return
    const picked = format(d, 'yyyy-MM-dd')
    const auto = format(autoDate, 'yyyy-MM-dd')
    // Wanneer sales op de auto-datum klikt terwijl er nog geen override was,
    // resetten we naar null i.p.v. de auto-datum als override op te slaan.
    // Voorkomt dat we onbedoeld de owner-config-default vastpinnen.
    if (picked === auto && value === null) {
      setOpen(false)
      return
    }
    onChange(picked)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 justify-start font-normal"
            disabled={disabled || saving}
            type="button"
          >
            <CalendarIcon className="mr-2 size-4 text-gray-500" />
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
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          disabled={disabled || saving}
          title="Reset naar auto"
          type="button"
        >
          <RotateCcw className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

type Props = {
  runId: string
  contactmomentOverride: string | null
  /** Werkdag-offset uit owner-config (default 1). Bepaalt de auto-datum
   *  zolang er geen handmatige override is gezet. */
  offsetWorkdays: number
  onChange: (next: string | null) => void
}

/**
 * Datepicker voor sales_lead_runs.contactmoment_override - review-page wrapper
 * met PATCH naar de run. Voor stap-1 create-form gebruik ContactmomentPickerControl
 * direct met form-state.
 */
export function LeadContactmomentPicker({ runId, contactmomentOverride, offsetWorkdays, onChange }: Props) {
  const [saving, setSaving] = useState(false)

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
    } catch (e) {
      toast.error('Contactmoment opslaan mislukt', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-y-0">
        <CardTitle className="text-base">Contactmoment</CardTitle>
        {saving ? <Loader2 className="size-4 animate-spin text-gray-400" /> : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <ContactmomentPickerControl
          value={contactmomentOverride}
          offsetWorkdays={offsetWorkdays}
          saving={saving}
          onChange={(next) => void save(next)}
        />
        <p className="text-[11px] text-gray-400">
          {contactmomentOverride
            ? 'Specifieke datum gekozen. Klik op het reset-icoon om terug te gaan naar auto.'
            : `Auto-datum komt uit de owner-config (${offsetWorkdays} werkdag${offsetWorkdays === 1 ? '' : 'en'}). Kies een andere dag voor een override.`}
        </p>
      </CardContent>
    </Card>
  )
}
