'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

type BrancheOption = { enum_id: number; label: string; sort_order: number }
type BrancheSuggestion = {
  enum_id: number
  label: string
  confidence: number
  reasoning: string
} | null

type Props = {
  runId: string
  brancheOverride: number | null
  suggestion: BrancheSuggestion
  onChange: (next: { branche_override: number | null; deal_note_text: string | null }) => void
}

const NO_OVERRIDE_VALUE = '__none__'

export function LeadBrancheSelect({ runId, brancheOverride, suggestion, onChange }: Props) {
  const [options, setOptions] = useState<BrancheOption[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/sales-leads/branche-options', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ options: BrancheOption[] }>)
      .then((j) => { if (!cancelled) setOptions(j.options) })
      .catch((e) => {
        if (!cancelled) {
          toast.error('Branches laden mislukt', { description: (e as Error).message })
        }
      })
    return () => { cancelled = true }
  }, [toast])

  const effectiveEnumId = brancheOverride ?? suggestion?.enum_id ?? null
  const effectiveLabel = useMemo(() => {
    if (effectiveEnumId == null) return null
    const opt = options?.find((o) => o.enum_id === effectiveEnumId)
    return opt?.label ?? suggestion?.label ?? null
  }, [effectiveEnumId, options, suggestion])

  async function save(nextOverride: number | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/branche-override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branche_override: nextOverride }),
      })
      const body = (await res.json()) as {
        branche_override?: number | null
        deal_note_text?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      onChange({
        branche_override: body.branche_override ?? null,
        deal_note_text: body.deal_note_text ?? null,
      })
    } catch (e) {
      toast.error('Branche opslaan mislukt', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Branche</CardTitle>
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <Select
          value={brancheOverride != null ? String(brancheOverride) : NO_OVERRIDE_VALUE}
          onValueChange={(v) => {
            const next = v === NO_OVERRIDE_VALUE ? null : Number(v)
            void save(next)
          }}
          disabled={!options || saving}
        >
          <SelectTrigger>
            <SelectValue placeholder={options ? 'Kies branche…' : 'Laden…'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_OVERRIDE_VALUE}>
              {suggestion
                ? `Auto: ${suggestion.label}`
                : 'Auto (SBI-fallback)'}
            </SelectItem>
            {(options ?? []).map((o) => (
              <SelectItem key={o.enum_id} value={String(o.enum_id)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {effectiveLabel ? (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Wordt gesynced als:</span>
            <Badge variant="secondary">{effectiveLabel}</Badge>
            {brancheOverride == null && suggestion ? (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI {suggestion.confidence}%
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Geen branche geselecteerd. Pipedrive Branche-veld blijft leeg.
          </p>
        )}

        {suggestion?.reasoning ? (
          <p className="text-[11px] text-gray-500 italic">{suggestion.reasoning}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
