'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SOURCE_LABEL } from '@/lib/sales-leads/source-pill-options'
import type { SourceKey } from '@/lib/services/sales-leads/types'

type ConfigurableField = 'address' | 'industry' | 'employee_count' | 'phone' | 'email'
type PreferenceValue = SourceKey | null

type SourcePreferencesResponse = {
  fields?: string[]
  sources?: SourceKey[]
  allowed_fields?: string[]
  allowed_sources?: SourceKey[]
  preferences?: Partial<Record<ConfigurableField, SourceKey>>
  overrides?: Partial<Record<ConfigurableField, PreferenceValue>>
  defaults?: Partial<Record<ConfigurableField, SourceKey>>
}

const CONFIGURABLE_FIELDS: ConfigurableField[] = [
  'address',
  'industry',
  'employee_count',
  'phone',
  'email',
]

const FIELD_LABELS: Record<ConfigurableField, string> = {
  address: 'Adres',
  industry: 'Branche',
  employee_count: 'Aantal medewerkers',
  phone: 'Telefoon',
  email: 'E-mail',
}

const FIELD_DESCRIPTIONS: Record<ConfigurableField, string> = {
  address: 'Welke bron standaard het adres vult.',
  industry: 'Welke bron standaard de branche vult.',
  employee_count: 'Welke bron standaard het aantal medewerkers vult.',
  phone: 'Welke bron standaard het telefoonnummer vult.',
  email: 'Welke bron standaard het e-mailadres vult.',
}

const FALLBACK_SOURCES: SourceKey[] = ['kvk', 'google_maps', 'apollo', 'website']
const DEFAULT_VALUE = '__default__'

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error
  }
  return fallback
}

function cleanFields(fields: string[] | undefined): ConfigurableField[] {
  const allowed = new Set(CONFIGURABLE_FIELDS)
  const fromApi = fields?.filter((field): field is ConfigurableField => allowed.has(field as ConfigurableField)) ?? []
  return fromApi.length > 0 ? fromApi : CONFIGURABLE_FIELDS
}

function cleanSources(sources: SourceKey[] | undefined): SourceKey[] {
  const allowed = new Set(FALLBACK_SOURCES)
  const fromApi = sources?.filter((source) => allowed.has(source)) ?? []
  return fromApi.length > 0 ? fromApi : FALLBACK_SOURCES
}

export function SourcePreferencesSettings() {
  const [fields, setFields] = useState<ConfigurableField[]>(CONFIGURABLE_FIELDS)
  const [sources, setSources] = useState<SourceKey[]>(FALLBACK_SOURCES)
  const [preferences, setPreferences] = useState<Partial<Record<ConfigurableField, PreferenceValue>>>({})
  const [defaults, setDefaults] = useState<Partial<Record<ConfigurableField, SourceKey>>>({})
  const [savedPreferences, setSavedPreferences] = useState<Partial<Record<ConfigurableField, PreferenceValue>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPreferences() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/sales-leads/source-preferences')
        const body = (await res.json().catch(() => ({}))) as SourcePreferencesResponse

        if (!res.ok) {
          throw new Error(getErrorMessage(body, 'Bronvoorkeuren laden mislukt'))
        }

        if (cancelled) return

        setFields(cleanFields(body.fields ?? body.allowed_fields))
        setSources(cleanSources(body.sources ?? body.allowed_sources))
        setPreferences(body.overrides ?? {})
        setSavedPreferences(body.overrides ?? {})
        setDefaults(body.defaults ?? {})
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Bronvoorkeuren laden mislukt')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPreferences()

    return () => {
      cancelled = true
    }
  }, [])

  const hasChanges = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences],
  )

  function setPreference(field: ConfigurableField, value: string) {
    setPreferences((current) => ({
      ...current,
      [field]: value === DEFAULT_VALUE ? null : (value as SourceKey),
    }))
  }

  function resetChanges() {
    setPreferences(savedPreferences)
  }

  async function savePreferences() {
    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, PreferenceValue> = {}
      for (const field of fields) {
        payload[field] = preferences[field] ?? null
      }

      const res = await fetch('/api/sales-leads/source-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: payload }),
      })
      const body = (await res.json().catch(() => ({}))) as SourcePreferencesResponse

      if (!res.ok) {
        throw new Error(getErrorMessage(body, 'Opslaan mislukt'))
      }

      const nextPreferences = body.overrides ?? payload
      setPreferences(nextPreferences)
      setSavedPreferences(nextPreferences)
      if (body.defaults) setDefaults(body.defaults)
      toast.success('Bronvoorkeuren opgeslagen')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Opslaan mislukt'
      setError(message)
      toast.error('Bronvoorkeuren opslaan mislukt', { description: message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          {CONFIGURABLE_FIELDS.map((field) => (
            <Skeleton key={field} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">OTIS bronvoorkeuren</CardTitle>
            <CardDescription className="mt-1">
              Kies per veld welke bron standaard leidend is in het globale master record.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={resetChanges} disabled={!hasChanges || saving}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button size="sm" onClick={savePreferences} disabled={!hasChanges || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Opslaan
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="divide-y rounded-md border">
          {fields.map((field) => {
            const current = preferences[field] ?? null
            const fallback = defaults[field]

            return (
              <div
                key={field}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">{FIELD_LABELS[field]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{FIELD_DESCRIPTIONS[field]}</div>
                </div>
                <Select value={current ?? DEFAULT_VALUE} onValueChange={(value) => setPreference(field, value)}>
                  <SelectTrigger aria-label={`${FIELD_LABELS[field]} bron`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_VALUE}>
                      Standaard{fallback ? ` (${SOURCE_LABEL[fallback]})` : ''}
                    </SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {SOURCE_LABEL[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
