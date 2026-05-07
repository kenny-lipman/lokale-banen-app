'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { PerSourceEnrichment, NormalizedFields } from '@/lib/services/sales-leads/types'
import { formatFieldValue } from '@/lib/sales-leads/format-fields'

type Props = {
  source: 'kvk' | 'google_maps' | 'apollo' | 'website'
  entry: PerSourceEnrichment
  runId?: string
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

export function LeadSourceDetailPanel({ source, entry, runId, onCandidatePromoted }: Props) {
  const parsed = entry.parsed ?? {}
  const showPicker =
    source === 'google_maps' && (entry.candidates?.length ?? 0) > 1 && !!runId
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {source} — raw + parsed
          {entry.status === 'failed' && (
            <Badge variant="destructive" className="ml-2">
              {entry.error ?? 'failed'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
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

type CandidatePickerProps = {
  runId: string
  candidates: NormalizedFields[]
  selectedIndex: number
  onPromoted?: () => void | Promise<void>
}

function CandidatePicker({ runId, candidates, selectedIndex, onPromoted }: CandidatePickerProps) {
  const { toast } = useToast()
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
      toast({ title: `Candidate ${index + 1} geselecteerd` })
      await onPromoted?.()
    } catch (e) {
      toast({
        title: 'Promote mislukt',
        description: (e as Error).message,
        variant: 'destructive',
      })
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
