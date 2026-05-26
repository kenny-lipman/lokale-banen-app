'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, ShieldCheck, X, ExternalLink } from 'lucide-react'

type Suggestion = {
  id: string
  url: string | null
  discovery_method: string | null
  ats_type: string | null
  review_status: string
  is_external_ats: boolean | null
  created_at: string
}

type Props = {
  runId: string
  /**
   * Wordt aangeroepen na elke approve/reject zodat parent kan refresh'en
   * (optioneel — component houdt eigen lokale state).
   */
  onChange?: () => void
}

export function LeadCareerPageSuggestions({ runId, onChange }: Props) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [autoApproved, setAutoApproved] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        kind: 'company_career_page',
        source_run_id: runId,
        pageSize: '50',
      })
      const res = await fetch(`/api/job-sources/career-pages?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onbekende fout')
      const all = (data.rows ?? []) as Suggestion[]
      setItems(all.filter((r) => r.review_status === 'pending'))
      setAutoApproved(all.filter((r) => r.review_status === 'approved'))
    } catch (e) {
      toast.error('Suggesties laden mislukt', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    load()
  }, [load])

  const action = async (id: string, kind: 'approve' | 'reject') => {
    setActing((s) => new Set(s).add(id))
    try {
      const res = await fetch(`/api/job-sources/career-pages/${id}/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: kind === 'reject' ? JSON.stringify({}) : undefined,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Onbekende fout')
      }
      // Optimistic remove (item is geen pending meer)
      setItems((rows) => rows.filter((r) => r.id !== id))
      toast.success(kind === 'approve' ? 'Goedgekeurd' : 'Afgewezen', {
        description: kind === 'approve' ? 'Bron is actief en wordt later gescrapet.' : 'URL wordt niet meer gesuggereerd.'
      })
      onChange?.()
    } catch (e) {
      toast.error('Actie mislukt', { description: (e as Error).message })
    } finally {
      setActing((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const approveAll = async () => {
    if (items.length === 0) return
    if (!confirm(`Alle ${items.length} suggesties goedkeuren?`)) return
    for (const it of items) {
      // Sequentieel zodat toasts niet stapelen + RLS-/rate-limit-veilig
      // (bedoeld voor 1-5 items per run, niet honderden)
      // eslint-disable-next-line no-await-in-loop
      await action(it.id, 'approve')
    }
  }

  // Empty state = niets renderen tenzij er auto-approved zijn (info-hint)
  if (!loading && items.length === 0 && autoApproved.length === 0) return null

  // Alleen auto-approved (geen pending) → kleine info-hint
  if (!loading && items.length === 0 && autoApproved.length > 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-green-900">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>
              <strong>{autoApproved.length}</strong> werken-bij {autoApproved.length === 1 ? 'bron' : 'bronnen'} automatisch toegevoegd
              {autoApproved.some((a) => a.is_external_ats) && ' (incl. herkende ATS-platforms)'}
            </span>
            <span className="text-xs text-green-700 ml-auto">Beheer via scrape-bronnen</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Potentiële werken-bij websites
            <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200">
              {loading ? '…' : items.length} suggestie{items.length === 1 ? '' : 's'} · review nodig
            </Badge>
          </CardTitle>
          {items.length > 1 && (
            <Button size="sm" variant="ghost" className="text-green-700 h-7" onClick={approveAll}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Alles goedkeuren
            </Button>
          )}
        </div>
        {autoApproved.length > 0 && (
          <p className="text-xs text-amber-700 pt-1">
            + {autoApproved.length} {autoApproved.length === 1 ? 'bron' : 'bronnen'} al automatisch toegevoegd (high-confidence)
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-amber-700">Laden…</p>
        ) : (
          items.map((it) => {
            const isActing = acting.has(it.id)
            return (
              <div key={it.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <a
                      href={it.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-blue-600 hover:underline truncate flex items-center gap-1"
                    >
                      <span className="truncate">{it.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                    </a>
                    <Badge variant="secondary" className="text-xs">via {it.discovery_method ?? 'onbekend'}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Wordt scrape-bron na goedkeuring
                    {it.ats_type ? ` · ATS: ${it.ats_type}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => action(it.id, 'approve')} disabled={isActing}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Goedkeuren
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => action(it.id, 'reject')} disabled={isActing}>
                    <X className="w-4 h-4 mr-1" />
                    Afwijzen
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
