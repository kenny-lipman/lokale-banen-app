'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { LeadRunsFilters, EMPTY_FILTERS, type FilterState } from '@/components/sales/lead-runs-filters'
import { LeadRunsTable } from '@/components/sales/lead-runs-table'
import { pollingOptions } from '@/lib/swr-polling'
import type { RunListResponse } from '@/lib/services/sales-leads/types'

const ACTIVE_POLL_MS = 5000

type Owner = { id: string; label: string }

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

function buildQueryString(f: FilterState, page: number, limit: number): string {
  const p = new URLSearchParams()
  if (f.search.trim()) p.set('search', f.search.trim())
  if (f.status !== 'all') p.set('status', f.status)
  if (f.owner !== 'all') p.set('owner', f.owner)
  if (f.date_from) p.set('date_from', f.date_from)
  if (f.date_to) p.set('date_to', f.date_to)
  p.set('page', String(page))
  p.set('limit', String(limit))
  return p.toString()
}

export default function LeadVerrijkingPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const limit = 25

  // Reset naar pagina 1 zodra filters wijzigen
  useEffect(() => {
    setPage(1)
  }, [filters])

  const queryString = useMemo(() => buildQueryString(filters, page, limit), [filters, page])

  const { data, error, isLoading, isValidating } = useSWR<RunListResponse>(
    `/api/sales-leads?${queryString}`,
    fetcher,
    pollingOptions<RunListResponse>((latest) => {
      // Polling alleen actief als er ≥1 run in een transitie-state staat.
      // Zodra alle runs in eindstate zijn (review/completed/failed/duplicate),
      // stopt de polling — geen onnodige requests.
      if (!latest) return ACTIVE_POLL_MS
      const hasActive = latest.runs.some((r) => r.status === 'enriching' || r.status === 'syncing')
      return hasActive ? ACTIVE_POLL_MS : 0
    }),
  )

  const [owners, setOwners] = useState<Owner[]>([])
  useEffect(() => {
    fetch('/api/sales-leads/owner-config')
      .then((r) => r.json() as Promise<{ configs?: Owner[] }>)
      .then((j) => setOwners(j.configs ?? []))
      .catch(() => setOwners([]))
  }, [])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const runs = data?.runs ?? []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Verrijking</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Verrijk een bedrijf op basis van URL → review → sync naar Pipedrive.
          </p>
        </div>
        <Button asChild>
          <Link href="/sales/lead-verrijking/nieuw">
            <Plus className="size-4 mr-1" />
            Nieuwe lead
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-orange-600" />
            <CardTitle>Run-historie ({total})</CardTitle>
            {runs.some((r) => r.status === 'enriching' || r.status === 'syncing') && (
              <div className="flex items-center gap-1 text-xs text-blue-600 ml-2">
                <RefreshCw className={`w-3 h-3 ${isValidating ? 'animate-spin' : ''}`} />
                Auto-refresh (5s)
              </div>
            )}
          </div>
          <CardDescription>
            Klik op het oog-icoon om een run te openen. Actieve runs worden automatisch ververst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadRunsFilters value={filters} onChange={setFilters} owners={owners} />

          {error && (
            <div className="text-sm text-red-600 py-2">
              Kon runs niet laden: {(error as Error).message}
            </div>
          )}

          <LeadRunsTable runs={runs} loading={isLoading && !data} />

          {total > limit && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="text-xs text-gray-500">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} van {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-gray-600">
                  Pagina {page} van {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
