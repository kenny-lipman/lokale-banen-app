'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PerSourceEnrichment, NormalizedFields } from '@/lib/services/sales-leads/types'
import { formatFieldValue } from '@/lib/sales-leads/format-fields'

type Props = {
  source: 'kvk' | 'google_maps' | 'apollo' | 'website'
  entry: PerSourceEnrichment
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

export function LeadSourceDetailPanel({ source, entry }: Props) {
  const parsed = entry.parsed ?? {}
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
