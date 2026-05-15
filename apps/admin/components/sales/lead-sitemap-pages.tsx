'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Check, Minus } from 'lucide-react'
import type { MasterRecord } from '@/lib/services/sales-leads/types'

const ROLE_COLORS: Record<string, string> = {
  home: 'bg-blue-100 text-blue-700',
  careers: 'bg-amber-100 text-amber-700',
  contact: 'bg-slate-100 text-slate-700',
  about: 'bg-slate-100 text-slate-700',
  team: 'bg-slate-100 text-slate-700',
  company: 'bg-slate-100 text-slate-700',
  other: 'bg-slate-100 text-slate-500',
}

const COLLAPSED_LIMIT = 8

type Props = {
  master: MasterRecord
}

type Row = {
  path: string
  role?: string
  fetched: boolean
  wordCount?: number
}

export function LeadSitemapPages({ master }: Props) {
  const rows = buildRows(master)
  const [expanded, setExpanded] = useState(rows.length <= COLLAPSED_LIMIT)

  if (rows.length === 0) return null

  const fetchedCount = rows.filter((r) => r.fetched).length
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_LIMIT)
  const hidden = rows.length - visible.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            Geparsede sitemap
            <Badge variant="secondary" className="text-xs">
              {fetchedCount}/{rows.length} gecrawled
            </Badge>
          </CardTitle>
          {rows.length > COLLAPSED_LIMIT && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded((v) => !v)}>
              {expanded ? (
                <><ChevronUp className="w-3 h-3 mr-1" />Inklappen</>
              ) : (
                <><ChevronDown className="w-3 h-3 mr-1" />Toon alle {rows.length}</>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-y">
            <tr>
              <th className="text-center px-3 py-2 font-medium w-12">Gecrawled</th>
              <th className="text-left px-3 py-2 font-medium">URL</th>
              <th className="text-left py-2 font-medium">Rol</th>
              <th className="text-right px-4 py-2 font-medium">Woorden</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr
                key={`${r.path}-${i}`}
                className={`border-b last:border-b-0 hover:bg-slate-50 ${
                  r.role === 'careers' ? 'bg-amber-50/40' : ''
                } ${!r.fetched ? 'text-slate-400' : ''}`}
              >
                <td className="px-3 py-2 text-center">
                  {r.fetched ? (
                    <Check className="w-3.5 h-3.5 text-green-600 inline-block" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-300 inline-block" />
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs truncate max-w-md">{r.path}</td>
                <td className="py-2">
                  {r.role && (
                    <Badge className={`text-xs ${ROLE_COLORS[r.role] ?? ROLE_COLORS.other}`}>
                      {r.role}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  {r.wordCount && r.wordCount > 0 ? r.wordCount.toLocaleString('nl-NL') : '—'}
                </td>
              </tr>
            ))}
            {hidden > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-xs text-slate-400 italic">
                  + {hidden} verborgen URLs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

/**
 * Merge `pages_discovered` (volledige sitemap met fetched-flag) + `pages_crawled`
 * (subset met word_count). Backwards-compat: oude runs zonder pages_discovered
 * tonen alleen pages_crawled. Crawled rows komen eerst, dan niet-gecrawled,
 * binnen elke groep gesorteerd op priority.
 */
function buildRows(master: MasterRecord): Row[] {
  const crawled = master.pages_crawled ?? []
  const discovered = master.pages_discovered ?? []
  const wcByPath = new Map<string, number>(crawled.map((p) => [p.path, p.word_count]))

  if (discovered.length === 0) {
    return crawled.map((p) => ({
      path: p.path,
      role: p.role,
      fetched: true,
      wordCount: p.word_count,
    }))
  }

  const rows: Row[] = discovered.map((d) => ({
    path: d.path,
    role: d.role,
    fetched: d.fetched,
    wordCount: wcByPath.get(d.path),
  }))

  // Crawled bovenaan, daarna priority-volgorde.
  rows.sort((a, b) => {
    if (a.fetched !== b.fetched) return a.fetched ? -1 : 1
    return 0
  })
  return rows
}
