'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, ExternalLink, Archive } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { RunListItem } from '@/lib/services/sales-leads/types'
import type { RunStatus } from '@/lib/services/sales-leads/list-filters'

const PIPEDRIVE_BASE = 'https://lokalebanen.pipedrive.com'

const STATUS_BADGE: Record<RunStatus, { label: string; className: string }> = {
  enriching: { label: 'Verrijken', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  review: { label: 'Review', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  syncing: { label: 'Syncen', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  completed: { label: 'Voltooid', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  failed: { label: 'Mislukt', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  duplicate: { label: 'Duplicate', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return `${diffSec}s geleden`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m geleden`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}u geleden`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d geleden`
  return new Date(iso).toLocaleDateString('nl-NL')
}

/**
 * Archiveer-knop per run met bevestiging. Soft-archive (DELETE) verbergt de run
 * uit de lijst; de onderliggende data blijft bestaan en is omkeerbaar in de DB.
 */
function ArchiveRunButton({
  runId,
  companyName,
  onArchived,
}: {
  runId: string
  companyName: string
  onArchived?: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function archive() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast.success('Lead gearchiveerd')
      onArchived?.()
    } catch (e) {
      toast.error(`Archiveren mislukt: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-red-600"
          title="Lead archiveren"
        >
          <Archive className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lead archiveren?</AlertDialogTitle>
          <AlertDialogDescription>
            {companyName} wordt uit de lijst verwijderd. De gegevens blijven
            bewaard en kunnen later worden teruggezet. Bestaande Pipedrive-deals
            blijven ongemoeid.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void archive()
            }}
          >
            Archiveren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type Props = {
  runs: RunListItem[]
  loading: boolean
  onArchived?: () => void
}

export function LeadRunsTable({ runs, loading, onArchived }: Props) {
  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Laden…</div>
  }
  if (runs.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        Geen runs gevonden.
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase text-gray-500 border-b">
        <tr>
          <th className="text-left py-2">Status</th>
          <th className="text-left py-2">Bedrijf</th>
          <th className="text-left py-2">Eigenaar</th>
          <th className="text-left py-2">KvK</th>
          <th className="text-left py-2">Aangemaakt</th>
          <th className="text-left py-2">Pipedrive</th>
          <th className="text-left py-2"></th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => {
          const badge = STATUS_BADGE[r.status as RunStatus]
          const companyName = r.master_record?.company_name ?? r.input_domain
          const kvk = r.master_record?.kvk_number ?? '—'
          const dealLink = r.pipedrive_deal_id
            ? `${PIPEDRIVE_BASE}/deal/${r.pipedrive_deal_id}`
            : r.pipedrive_org_id
              ? `${PIPEDRIVE_BASE}/organization/${r.pipedrive_org_id}`
              : null
          return (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="py-3">
                {badge ? (
                  <Badge className={badge.className}>{badge.label}</Badge>
                ) : (
                  <Badge variant="secondary">{r.status}</Badge>
                )}
              </td>
              <td className="py-3">
                <div className="font-medium">{companyName}</div>
                <div className="text-xs text-gray-500 font-mono">{r.input_domain}</div>
              </td>
              <td className="py-3 text-gray-700">{r.owner_label ?? '—'}</td>
              <td className="py-3 font-mono text-xs text-gray-600">{kvk}</td>
              <td className="py-3 text-gray-600">{relativeTime(r.created_at)}</td>
              <td className="py-3">
                {dealLink ? (
                  <a
                    href={dealLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3 mr-1" />
                    {r.pipedrive_deal_id ? `Deal ${r.pipedrive_deal_id}` : `Org ${r.pipedrive_org_id}`}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/sales/lead-verrijking/${r.id}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                  <ArchiveRunButton
                    runId={r.id}
                    companyName={companyName}
                    onArchived={onArchived}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
