'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

const COLLAPSED_LIMIT = 5

type Props = {
  master: MasterRecord
}

export function LeadSitemapPages({ master }: Props) {
  const pages = master.pages_crawled ?? []
  const [expanded, setExpanded] = useState(pages.length <= COLLAPSED_LIMIT)

  if (pages.length === 0) return null

  const visible = expanded ? pages : pages.slice(0, COLLAPSED_LIMIT)
  const hidden = pages.length - visible.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            Geparsede sitemap
            <Badge variant="secondary" className="text-xs">{pages.length} URLs</Badge>
          </CardTitle>
          {pages.length > COLLAPSED_LIMIT && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <><ChevronUp className="w-3 h-3 mr-1" />Inklappen</> : <><ChevronDown className="w-3 h-3 mr-1" />Toon alle {pages.length}</>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-y">
            <tr>
              <th className="text-left px-4 py-2 font-medium">URL</th>
              <th className="text-left py-2 font-medium">Rol</th>
              <th className="text-right px-4 py-2 font-medium">Woorden</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr key={i} className={`border-b last:border-b-0 hover:bg-slate-50 ${p.role === 'careers' ? 'bg-amber-50/40' : ''}`}>
                <td className="px-4 py-2 font-mono text-xs text-slate-700 truncate max-w-md">{p.path}</td>
                <td className="py-2">
                  {p.role && <Badge className={`text-xs ${ROLE_COLORS[p.role] ?? ROLE_COLORS.other}`}>{p.role}</Badge>}
                </td>
                <td className="px-4 py-2 text-right text-xs text-slate-500">
                  {p.word_count > 0 ? p.word_count.toLocaleString('nl-NL') : '—'}
                </td>
              </tr>
            ))}
            {hidden > 0 && (
              <tr><td colSpan={3} className="px-4 py-2 text-xs text-slate-400 italic">+ {hidden} verborgen URLs</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
