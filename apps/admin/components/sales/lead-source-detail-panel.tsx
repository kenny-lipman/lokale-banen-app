'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import type {
  PerSourceEnrichment,
  NormalizedFields,
  RunEnrichments,
} from '@/lib/services/sales-leads/types'
import { formatFieldValue } from '@/lib/sales-leads/format-fields'

type Props = {
  source: 'kvk' | 'google_maps' | 'apollo' | 'website'
  entry: PerSourceEnrichment
  enrichments?: RunEnrichments
  runId?: string
  inputDomain?: string
  onCandidatePromoted?: () => void | Promise<void>
}

const GROUPS: Array<{ title: string; fields: Array<keyof NormalizedFields> }> = [
  {
    title: 'Identiteit',
    fields: ['company_name', 'trade_names', 'legal_form', 'kvk_number', 'rsin', 'vestigingsnummer'],
  },
  {
    title: 'Locatie',
    fields: ['address', 'coordinates', 'bag_id'],
  },
  {
    title: 'Web & Social',
    fields: [
      'website',
      'email',
      'emails_all',
      'phone',
      'phones_all',
      'linkedin_url',
      'twitter_url',
      'facebook_url',
      'instagram_url',
      'tiktok_url',
      'crunchbase_url',
    ],
  },
  {
    title: 'Bedrijfsprofiel',
    fields: [
      'industry',
      'industry_codes',
      'sbi_activities',
      'employee_count',
      'employee_bucket',
      'founded_year',
      'founded_date',
      'description_short',
    ],
  },
  {
    title: 'Apollo-extra',
    fields: ['apollo_org_id', 'technologies', 'keywords', 'departmental_head_count', 'annual_revenue', 'funding_total'],
  },
  {
    title: 'Maps-extra',
    fields: ['rating', 'ratings_total', 'business_status', 'opening_hours', 'business_types', 'photos_count'],
  },
  {
    title: 'Career-page',
    fields: ['career_page_url', 'career_page_method', 'career_page_external', 'career_page_ats_type'],
  },
]

export function LeadSourceDetailPanel({
  source,
  entry,
  enrichments,
  runId,
  inputDomain,
  onCandidatePromoted,
}: Props) {
  const parsed = entry.parsed ?? {}
  const showPicker =
    source === 'google_maps' && (entry.candidates?.length ?? 0) > 1 && !!runId
  const showKvkRecovery =
    source === 'kvk' && entry.status === 'not_found' && !!runId
  // Bij not_found is "Opnieuw" misleidend (dezelfde domein-guess geeft weer 404).
  // De recovery-panel biedt rijkere acties — verberg de generic knop dan.
  const canReplaySource =
    !!runId && entry.status !== 'running' && entry.status !== 'pending' && !showKvkRecovery
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <span>{source} — raw + parsed</span>
          {entry.status === 'failed' && (
            <Badge variant="destructive">
              {entry.error ?? 'failed'}
            </Badge>
          )}
          {canReplaySource && (
            <SourceReplayButton
              runId={runId!}
              source={source}
              onReplayed={onCandidatePromoted}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {showKvkRecovery && (
          <KvkRecoveryPanel
            runId={runId!}
            enrichments={enrichments ?? {}}
            inputDomain={inputDomain}
            onReplayed={onCandidatePromoted}
          />
        )}
        {showPicker && (
          <CandidatePicker
            runId={runId!}
            candidates={entry.candidates!}
            selectedIndex={entry.selected_candidate_index ?? 0}
            onPromoted={onCandidatePromoted}
          />
        )}
        {GROUPS.map((g) => {
          const rows = g.fields
            .map((f) => ({ field: f, value: parsed[f] }))
            .filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
          if (rows.length === 0) return null
          return (
            <div key={g.title}>
              <h4 className="text-xs uppercase text-gray-500 mb-1">{g.title}</h4>
              <table className="w-full text-xs">
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.field)} className="border-b last:border-0">
                      <td className="py-1 pr-3 font-mono text-gray-500 align-top w-1/3">{String(r.field)}</td>
                      <td className="py-1 align-top">{formatFieldValue(r.field, r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

type SourceReplayButtonProps = {
  runId: string
  source: 'kvk' | 'google_maps' | 'apollo' | 'website'
  onReplayed?: () => void | Promise<void>
}

function SourceReplayButton({ runId, source, onReplayed }: SourceReplayButtonProps) {
  const [busy, setBusy] = useState(false)

  async function handleReplay(e: React.MouseEvent) {
    // Prevent collapse-toggle in parent grid-card.
    e.stopPropagation()
    setBusy(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/replay-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast.success(`${source} herstart`)
      // Run.status is nu 'enriching' — SWR-polling pakt het automatisch op.
      // We refetchen 1× direct zodat UI meteen de nieuwe status laat zien.
      await onReplayed?.()
    } catch (err) {
      toast.error('Replay-source mislukt', { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="ml-auto h-7"
      disabled={busy}
      onClick={handleReplay}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <RotateCcw className="w-3 h-3 mr-1" />
      )}
      Opnieuw
    </Button>
  )
}

type CandidatePickerProps = {
  runId: string
  candidates: NormalizedFields[]
  selectedIndex: number
  onPromoted?: () => void | Promise<void>
}

function CandidatePicker({ runId, candidates, selectedIndex, onPromoted }: CandidatePickerProps) {
  const [promoting, setPromoting] = useState<number | null>(null)

  async function promote(index: number) {
    setPromoting(index)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/promote-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'google_maps', index }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast.success(`Candidate ${index + 1} geselecteerd`)
      await onPromoted?.()
    } catch (e) {
      toast.error('Promote mislukt', { description: (e as Error).message })
    } finally {
      setPromoting(null)
    }
  }

  return (
    <div>
      <h4 className="text-xs uppercase text-gray-500 mb-2">Candidates ({candidates.length})</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {candidates.map((c, i) => {
          const isActive = selectedIndex === i
          const isLoading = promoting === i
          return (
            <Card key={i} className={isActive ? 'ring-2 ring-orange-500' : ''}>
              <CardContent className="p-3 text-xs space-y-1">
                <div className="font-medium truncate">{c.company_name ?? '—'}</div>
                <div className="text-gray-500 truncate">{c.address?.full ?? '—'}</div>
                <div className="text-gray-600">
                  {c.rating ? `${c.rating}★ (${c.ratings_total ?? 0})` : 'Geen rating'}
                  {c.business_status && c.business_status !== 'OPERATIONAL'
                    ? ` · ${c.business_status}`
                    : ''}
                </div>
                {c.website && (
                  <div className="text-gray-500 truncate">{c.website}</div>
                )}
                <Button
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  disabled={isActive || promoting !== null}
                  onClick={() => promote(i)}
                  className="w-full mt-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isActive ? (
                    'Geselecteerd'
                  ) : (
                    'Selecteer'
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── KvK-recovery (laag 1 + 2) ────────────────────────────────────────────

type KvkOverrideOrigin = 'website' | 'maps' | 'apollo' | 'manual'

type KvkSuggestion = {
  value: string
  source: Exclude<KvkOverrideOrigin, 'manual'>
}

type KvkSearchHit = {
  kvkNummer: string
  naam: string
  type: 'hoofdvestiging' | 'rechtspersoon' | 'nevenvestiging'
  plaats?: string
}

type KvkRecoveryPanelProps = {
  runId: string
  enrichments: RunEnrichments
  inputDomain?: string
  onReplayed?: () => void | Promise<void>
}

function KvkRecoveryPanel({ runId, enrichments, inputDomain, onReplayed }: KvkRecoveryPanelProps) {
  const [replayingKey, setReplayingKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<KvkSearchHit[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const suggestions = useMemo(
    () => collectSuggestions(enrichments, inputDomain),
    [enrichments, inputDomain],
  )

  // Debounced search. Min-input: 8 cijfers (KvK-nummer) OF ≥3 chars naam.
  useEffect(() => {
    const trimmed = query.trim()
    const digits = trimmed.replace(/\D/g, '')
    const isKvkNumber = digits.length === 8
    if (!trimmed || (trimmed.length < 3 && !isKvkNumber)) {
      setResults([])
      setSearchError(null)
      setSearched(false)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const url = `/api/sales-leads/${runId}/kvk-search?q=${encodeURIComponent(trimmed)}`
        const res = await fetch(url, { signal: ctrl.signal })
        const body = (await res.json().catch(() => ({}))) as {
          results?: KvkSearchHit[]
          error?: string
        }
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
        setResults(body.results ?? [])
        setSearched(true)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setSearchError((e as Error).message)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, runId])

  async function replay(key: string, override: { name?: string; kvkNumber?: string; via: KvkOverrideOrigin }) {
    setReplayingKey(key)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/replay-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'kvk', override }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast.success('KvK opnieuw gestart')
      await onReplayed?.()
    } catch (e) {
      toast.error('Replay mislukt', { description: (e as Error).message })
    } finally {
      setReplayingKey(null)
    }
  }

  const anyReplay = replayingKey !== null

  return (
    <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-orange-900">KvK gaf geen match</p>
        <p className="text-xs text-orange-800/80 mt-0.5">
          KvK doet exacte tekstmatch. Kies een suggestie of zoek op naam/KvK-nummer.
        </p>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs uppercase text-gray-500">Suggesties uit andere bronnen</h4>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const key = `sug:${s.source}:${s.value}`
              const isBusy = replayingKey === key
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  disabled={anyReplay}
                  onClick={() => replay(key, { name: s.value, via: s.source })}
                  className="h-8 bg-white"
                >
                  {isBusy ? (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : null}
                  <span>{s.value}</span>
                  <span className="text-gray-400 text-xs ml-2">· {s.source}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs uppercase text-gray-500">
          {suggestions.length > 0 ? 'Of zoek handmatig' : 'Zoek handmatig in KvK'}
        </h4>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bedrijfsnaam of KvK-nummer (8 cijfers)"
            className="pl-8 h-9 bg-white"
            disabled={anyReplay}
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          )}
        </div>

        {searchError && (
          <p className="text-xs text-red-700">Fout: {searchError}</p>
        )}

        {!searchError && searched && results.length === 0 && !searching && (
          <p className="text-xs text-gray-500">
            Geen resultaten. Probeer een kortere of andere zoekterm.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((r) => {
              const key = `hit:${r.kvkNummer}`
              const isBusy = replayingKey === key
              return (
                <button
                  key={key}
                  type="button"
                  disabled={anyReplay}
                  onClick={() => replay(key, { kvkNumber: r.kvkNummer, via: 'manual' })}
                  className="w-full text-left p-2 rounded border bg-white hover:bg-orange-50 hover:border-orange-300 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.naam}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.kvkNummer} · {r.type}
                      {r.plaats ? ` · ${r.plaats}` : ''}
                    </div>
                  </div>
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                  ) : (
                    <span className="text-xs text-orange-700 shrink-0">Selecteer</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Client-side variant van orchestrator's `domainToCompanyGuess` — bewust
 * gedupliceerd om geen server-only file naar de client te trekken.
 */
function domainToCompanyGuessClient(domain: string): string {
  const stem = domain.split('.')[0] ?? domain
  return stem.charAt(0).toUpperCase() + stem.slice(1)
}

function collectSuggestions(
  enrichments: RunEnrichments,
  inputDomain: string | undefined,
): KvkSuggestion[] {
  const guess = inputDomain ? domainToCompanyGuessClient(inputDomain).toLowerCase() : null
  const candidates: KvkSuggestion[] = [
    { value: enrichments.website?.parsed?.company_name ?? '', source: 'website' },
    { value: enrichments.google_maps?.parsed?.company_name ?? '', source: 'maps' },
    { value: enrichments.apollo?.parsed?.company_name ?? '', source: 'apollo' },
  ]
  const seen = new Set<string>()
  const out: KvkSuggestion[] = []
  for (const c of candidates) {
    const v = c.value.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (key === guess) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ value: v, source: c.source })
  }
  return out.slice(0, 3)
}
