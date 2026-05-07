'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  MasterRecord,
  RunEnrichments,
  NormalizedFields,
  SourceKey,
} from '@/lib/services/sales-leads/types'
import { getSourceAlternatives, SOURCE_LABEL } from '@/lib/sales-leads/source-pill-options'
import { formatFieldValue, formatAddress } from '@/lib/sales-leads/format-fields'

type OwnerConfig = {
  id: string
  hoofddomein_strategy: 'fixed' | 'auto_match_by_address'
  hoofddomein_fixed_value: string | null
}

type Props = {
  runId: string
  master: MasterRecord
  enrichments: RunEnrichments
  ownerConfig: OwnerConfig | null
  onChange: (next: MasterRecord) => void
}

type FieldDef = {
  key: keyof NormalizedFields
  label: string
}

const FIELDS: FieldDef[] = [
  { key: 'company_name', label: 'Bedrijfsnaam' },
  { key: 'kvk_number', label: 'KvK-nummer' },
  { key: 'address', label: 'Adres' },
  { key: 'industry', label: 'Branche' },
  { key: 'employee_count', label: 'Bedrijfsgrootte' },
  { key: 'phone', label: 'Telefoon' },
  { key: 'email', label: 'E-mail' },
  { key: 'website', label: 'Website' },
]

function getMasterValueAsString(master: MasterRecord, key: keyof NormalizedFields): string {
  const value = (master as Record<string, unknown>)[key]
  if (value === undefined || value === null) return ''
  if (key === 'address') return formatAddress(value as NormalizedFields['address'])
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function LeadMasterRecord({ runId, master, enrichments, ownerConfig, onChange }: Props) {
  const { toast } = useToast()
  const [hoofddomein, setHoofddomein] = useState(master.hoofddomein ?? '')
  const [resolvingHoofddomein, setResolvingHoofddomein] = useState(false)

  useEffect(() => {
    setHoofddomein(master.hoofddomein ?? '')
  }, [master.hoofddomein])

  // Bij init: als owner_config = 'fixed' en master.hoofddomein leeg → vul fixed_value.
  // Bewust alleen [ownerConfig] in deps: master/onChange in deps zou een infinite loop
  // veroorzaken (effect muteert master via onChange → master verandert → effect runt opnieuw).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ownerConfig) return
    if (
      ownerConfig.hoofddomein_strategy === 'fixed' &&
      ownerConfig.hoofddomein_fixed_value &&
      !master.hoofddomein
    ) {
      const val = ownerConfig.hoofddomein_fixed_value
      setHoofddomein(val)
      onChange({ ...master, hoofddomein: val })
    }
  }, [ownerConfig])

  function setSource(field: keyof NormalizedFields, source: SourceKey) {
    const next: MasterRecord = {
      ...master,
      source_overrides: { ...(master.source_overrides ?? {}), [field]: source },
    }
    if (source !== 'custom') {
      const alt = getSourceAlternatives(field, enrichments, undefined).find(
        (a) => a.source === source,
      )
      if (alt) {
        ;(next as Record<string, unknown>)[field] = alt.value
      }
    }
    onChange(next)
  }

  function setValue(field: keyof NormalizedFields, raw: string) {
    const next: MasterRecord = {
      ...master,
      source_overrides: { ...(master.source_overrides ?? {}), [field]: 'custom' },
    }
    if (field === 'address') {
      next.address = { ...(master.address ?? {}), full: raw }
    } else if (field === 'employee_count') {
      const n = raw ? Number.parseInt(raw, 10) : NaN
      next.employee_count = Number.isFinite(n) ? n : undefined
    } else {
      ;(next as Record<string, unknown>)[field] = raw || undefined
    }
    onChange(next)
  }

  const isFixed = ownerConfig?.hoofddomein_strategy === 'fixed'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Master record</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {FIELDS.map((f) => {
          const currentSource = master.source_overrides?.[f.key]
          const alts = getSourceAlternatives(f.key, enrichments, currentSource)
          const stringValue = getMasterValueAsString(master, f.key)
          return (
            <div key={String(f.key)} className="grid grid-cols-12 gap-2 items-center">
              <label className="col-span-3 text-xs text-gray-600">{f.label}</label>
              <Input
                className="col-span-6"
                type={f.key === 'employee_count' ? 'number' : 'text'}
                min={f.key === 'employee_count' ? 0 : undefined}
                value={stringValue}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
              <div className="col-span-3">
                <Select
                  value={currentSource ?? 'custom'}
                  onValueChange={(v) => setSource(f.key, v as SourceKey)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alts.map((a) => (
                      <SelectItem key={a.source} value={a.source}>
                        <span className="font-medium mr-1">{SOURCE_LABEL[a.source]}</span>
                        <span className="text-gray-400 text-xs">
                          {formatFieldValue(f.key, a.value)}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom (handmatig)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}

        <div className="grid grid-cols-12 gap-2 items-center pt-3 border-t">
          <label className="col-span-3 text-xs text-gray-600 flex items-center gap-1">
            Hoofddomein
            {isFixed && <Lock className="w-3 h-3 text-gray-400" />}
          </label>
          <Input
            className="col-span-6"
            value={hoofddomein}
            disabled={isFixed}
            onChange={(e) => {
              setHoofddomein(e.target.value)
              onChange({ ...master, hoofddomein: e.target.value || null })
            }}
          />
          <div className="col-span-3 flex items-center gap-2">
            {ownerConfig?.hoofddomein_strategy === 'auto_match_by_address' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolvingHoofddomein}
                onClick={async () => {
                  setResolvingHoofddomein(true)
                  try {
                    const res = await fetch(
                      `/api/sales-leads/${runId}/resolve-hoofddomein`,
                      { method: 'POST' },
                    )
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const body = (await res.json()) as { matched: boolean; hoofddomein: string | null }
                    if (body.matched && body.hoofddomein) {
                      setHoofddomein(body.hoofddomein)
                      onChange({ ...master, hoofddomein: body.hoofddomein })
                      toast({ title: 'Hoofddomein gematcht', description: body.hoofddomein })
                    } else {
                      toast({
                        title: 'Geen match',
                        description: 'Vul handmatig een hoofddomein in.',
                        variant: 'default',
                      })
                    }
                  } catch (e) {
                    toast({
                      title: 'Auto-match mislukt',
                      description: (e as Error).message,
                      variant: 'destructive',
                    })
                  } finally {
                    setResolvingHoofddomein(false)
                  }
                }}
              >
                {resolvingHoofddomein ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Matchen…
                  </>
                ) : (
                  'Auto-match'
                )}
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                vast
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
