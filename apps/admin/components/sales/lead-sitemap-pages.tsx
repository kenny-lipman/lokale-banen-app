'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Check, Minus, ExternalLink } from 'lucide-react'
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

const ROLE_ORDER: string[] = ['home', 'contact', 'about', 'team', 'careers', 'company', 'other']
const COLLAPSED_LIMIT = 8

type SortMode = 'status' | 'role'

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
  const rows = useMemo(() => buildRows(master), [master])
  const [expanded, setExpanded] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('status')

  if (rows.length === 0) return null

  const fetchedCount = rows.filter((r) => r.fetched).length
  const origin = deriveOrigin(master)

  const grouped = sortMode === 'role'
    ? groupByRole(rows)
    : [{ key: 'all', label: null, items: rows.sort(statusFirst) }]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Geparsede sitemap
            <Badge variant="secondary" className="text-xs">
              {fetchedCount}/{rows.length} gecrawled
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <div className="text-xs text-slate-500 mr-1">Sorteer:</div>
            <Button
              size="sm"
              variant={sortMode === 'status' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setSortMode('status')}
            >
              Status
            </Button>
            <Button
              size="sm"
              variant={sortMode === 'role' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setSortMode('role')}
            >
              Rol
            </Button>
            {rows.length > COLLAPSED_LIMIT && (
              <Button size="sm" variant="ghost" className="h-7 text-xs ml-2" onClick={() => setExpanded((v) => !v)}>
                {expanded ? (
                  <><ChevronUp className="size-3 mr-1" />Inklappen</>
                ) : (
                  <><ChevronDown className="size-3 mr-1" />Toon alle {rows.length}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {grouped.map((g) => {
          const showAll = expanded || rows.length <= COLLAPSED_LIMIT
          // Bij role-mode: per groep COLLAPSED_LIMIT respecteren is verwarrend.
          // Doe over alle groepen samen één limit, gemeten via index.
          return (
            <div key={g.key}>
              {g.label && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-y">
                  <Badge className={`text-xs ${ROLE_COLORS[g.key] ?? ROLE_COLORS.other}`}>{g.label}</Badge>
                  <span className="text-xs text-slate-500">{g.items.length}</span>
                </div>
              )}
              <table className="w-full text-sm">
                {!g.label && (
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-y">
                    <tr>
                      <th className="text-center px-3 py-2 font-medium w-12">Gecrawled</th>
                      <th className="text-left px-3 py-2 font-medium">URL</th>
                      <th className="text-left py-2 font-medium">Rol</th>
                      <th className="text-right px-4 py-2 font-medium">Woorden</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                )}
                <tbody>
                  {(showAll ? g.items : g.items.slice(0, COLLAPSED_LIMIT)).map((r, i) => {
                    const fullUrl = origin ? origin + r.path : null
                    return (
                      <tr
                        key={`${r.path}-${i}`}
                        className={`border-b last:border-b-0 hover:bg-slate-50 ${
                          r.role === 'careers' ? 'bg-amber-50/40' : ''
                        } ${!r.fetched ? 'text-slate-400' : ''}`}
                      >
                        <td className="px-3 py-2 text-center">
                          {r.fetched ? (
                            <Check className="size-3.5 text-green-600 inline-block" />
                          ) : (
                            <Minus className="size-3.5 text-slate-300 inline-block" />
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
                        <td className="px-2 py-2 text-right">
                          {fullUrl && (
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open in nieuw tabblad"
                              className="inline-block text-slate-400 hover:text-orange-600"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!showAll && g.items.length > COLLAPSED_LIMIT && (
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-xs text-slate-400 italic">
                        + {g.items.length - COLLAPSED_LIMIT} verborgen URLs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/**
 * Merge `pages_discovered` (volledige sitemap met fetched-flag) + `pages_crawled`
 * (subset met word_count). Backwards-compat: oude runs zonder pages_discovered
 * tonen alleen pages_crawled (alles fetched=true).
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

  return discovered.map((d) => ({
    path: d.path,
    role: d.role,
    fetched: d.fetched,
    wordCount: wcByPath.get(d.path),
  }))
}

function statusFirst(a: Row, b: Row): number {
  if (a.fetched !== b.fetched) return a.fetched ? -1 : 1
  return 0
}

function groupByRole(rows: Row[]): Array<{ key: string; label: string; items: Row[] }> {
  const byRole = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r.role ?? 'other'
    const arr = byRole.get(key) ?? []
    arr.push(r)
    byRole.set(key, arr)
  }
  return ROLE_ORDER
    .filter((role) => byRole.has(role))
    .map((role) => ({
      key: role,
      label: role,
      items: (byRole.get(role) ?? []).sort(statusFirst),
    }))
}

/**
 * Bepaal origin uit master.website voor het open-in-nieuw-tabblad icoon.
 * Returnt null als geen geldige URL bekend is — icon wordt dan verborgen.
 */
function deriveOrigin(master: MasterRecord): string | null {
  if (!master.website) return null
  try {
    return new URL(master.website).origin
  } catch {
    return null
  }
}
