'use client'

import { useCallback, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RotateCw } from 'lucide-react'
import type { RunDetailResponse } from '@/lib/services/sales-leads/types'

type Run = RunDetailResponse['run']
type Props = {
  run: Run
  ownerLabel?: string | null
  onSynced: () => Promise<void>
}

const PIPEDRIVE_BASE = 'https://lokalebanen.pipedrive.com'

type DupeInfo = { existing_org_id: number; existing_org_name: string | null; deal_count_6m: number }

export function LeadSyncStatus({ run, ownerLabel, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [confirmingForce, setConfirmingForce] = useState(false)
  const [dupeInfo, setDupeInfo] = useState<DupeInfo | null>(
    run.existing_pipedrive_org_id
      ? { existing_org_id: run.existing_pipedrive_org_id, existing_org_name: null, deal_count_6m: 0 }
      : null,
  )

  const triggerSync = useCallback(
    async (force: boolean) => {
      setSyncing(true)
      try {
        const res = await fetch(`/api/sales-leads/${run.id}/sync-pipedrive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force_duplicate: force }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const json = (await res.json()) as
          | { status: 'completed'; pipedrive_org_id: number; pipedrive_deal_id: number; pipedrive_person_ids: number[] }
          | { status: 'duplicate'; existing_org_id: number; existing_org_name: string | null; deal_count_6m: number }
          | { status: 'failed'; error: string }
        if (json.status === 'duplicate') {
          setDupeInfo({
            existing_org_id: json.existing_org_id,
            existing_org_name: json.existing_org_name,
            deal_count_6m: json.deal_count_6m,
          })
          toast.success('Duplicate gedetecteerd', { description: `Org ${json.existing_org_id} bestaat al.` })
        } else if (json.status === 'completed') {
          toast.success('Sync voltooid', { description: `Deal ${json.pipedrive_deal_id} aangemaakt` })
        } else {
          toast.error('Sync mislukt', { description: json.error })
        }
      } catch (e) {
        toast.error('Sync mislukt', { description: (e as Error).message })
      } finally {
        setSyncing(false)
        setConfirmingForce(false)
        await onSynced()
      }
    },
    [run.id, onSynced],
  )

  // ── State 1: nog niet gestart (status=review) → Start-sync knop ──
  if (run.status === 'review') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stap 3 — Sync naar Pipedrive</CardTitle>
          <CardDescription>Klik op "Sync naar Pipedrive" om de deal aan te maken.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => triggerSync(false)} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Sync naar Pipedrive
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── State 2: syncing → loading ──
  if (run.status === 'syncing') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <CardTitle>Sync loopt…</CardTitle>
          </div>
          <CardDescription>Dedupe → Org → Persons → Deal → Notitie</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-gray-600">
          {run.pipedrive_org_id && <p>✓ Organisatie aangemaakt (id: {run.pipedrive_org_id})</p>}
          {run.pipedrive_deal_id && <p>✓ Deal aangemaakt (id: {run.pipedrive_deal_id})</p>}
        </CardContent>
      </Card>
    )
  }

  // ── State 3: duplicate ──
  if (run.status === 'duplicate' && dupeInfo) {
    return (
      <Card className="border-yellow-300 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <CardTitle>Bedrijf bestaat al in Pipedrive</CardTitle>
          </div>
          <CardDescription>
            {dupeInfo.existing_org_name
              ? `"${dupeInfo.existing_org_name}" — `
              : ''}
            Org-id <span className="font-mono">{dupeInfo.existing_org_id}</span>
            {dupeInfo.deal_count_6m > 0 && ` · ${dupeInfo.deal_count_6m} deal(s) afgelopen 6 mnd`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href={`${PIPEDRIVE_BASE}/organization/${dupeInfo.existing_org_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Pipedrive <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </Button>
          {confirmingForce ? (
            <>
              <Button variant="destructive" disabled={syncing} onClick={() => triggerSync(true)}>
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Bevestig: nieuwe deal aanmaken
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingForce(false)}>
                Annuleer
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setConfirmingForce(true)}>
              Toch nieuwe deal aanmaken
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── State 4: completed ──
  if (run.status === 'completed') {
    const personCount = run.pipedrive_person_ids?.length ?? 0
    const dealTitle = run.master_record?.company_name
      ? `${run.master_record.company_name} — ${formatDealDate(run.updated_at)}`
      : null
    return (
      <Card className="border-green-300 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle>Sync voltooid</CardTitle>
          </div>
          <CardDescription>
            {dealTitle ? <>Deal "{dealTitle}" aangemaakt + interne data gekoppeld.</> : <>Pipedrive deal aangemaakt + interne data gekoppeld.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <dt className="text-gray-500">Gesyncet</dt>
              <dd className="font-medium text-gray-900">{formatTimestamp(run.updated_at)}</dd>
            </div>
            {ownerLabel && (
              <div>
                <dt className="text-gray-500">Owner</dt>
                <dd className="font-medium text-gray-900 truncate">{ownerLabel}</dd>
              </div>
            )}
            {run.pipedrive_org_id && (
              <div>
                <dt className="text-gray-500">Org-ID</dt>
                <dd className="font-mono text-gray-900">{run.pipedrive_org_id}</dd>
              </div>
            )}
            {run.pipedrive_deal_id && (
              <div>
                <dt className="text-gray-500">Deal-ID</dt>
                <dd className="font-mono text-gray-900">{run.pipedrive_deal_id}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap gap-2 items-center">
            {run.pipedrive_org_id && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`${PIPEDRIVE_BASE}/organization/${run.pipedrive_org_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Org <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
            {run.pipedrive_deal_id && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`${PIPEDRIVE_BASE}/deal/${run.pipedrive_deal_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deal <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
            {personCount > 0 &&
              (run.pipedrive_person_ids ?? []).map((pid, i) => (
                <Button asChild key={pid} variant="outline" size="sm">
                  <a
                    href={`${PIPEDRIVE_BASE}/person/${pid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Persoon {i + 1} <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              ))}
            <Badge variant="outline" className="ml-auto self-center">
              {personCount} persoon(en)
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── State 5: failed ──
  if (run.status === 'failed') {
    const hasPartialSync =
      !!run.pipedrive_org_id ||
      !!run.pipedrive_deal_id ||
      (run.pipedrive_person_ids?.length ?? 0) > 0
    const canRetrySync = !!run.master_record?.company_name || hasPartialSync

    return (
      <Card className="border-red-300 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <CardTitle>{canRetrySync ? 'Sync mislukt' : 'Verrijking mislukt'}</CardTitle>
          </div>
          <CardDescription className="text-red-800">{run.error ?? 'Onbekende fout'}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {hasPartialSync && (
            <div className="text-gray-600">
              <p className="font-medium">Reeds aangemaakt:</p>
              {run.pipedrive_org_id && <p>· org {run.pipedrive_org_id}</p>}
              {(run.pipedrive_person_ids ?? []).map((pid) => (
                <p key={pid}>· person {pid}</p>
              ))}
              {run.pipedrive_deal_id && <p>· deal {run.pipedrive_deal_id}</p>}
            </div>
          )}
          {canRetrySync ? (
            <Button onClick={() => triggerSync(false)} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}
              Hervatten
            </Button>
          ) : (
            <p className="text-gray-700">
              Geen master record opgebouwd — gebruik <span className="font-medium">"Opnieuw runnen"</span> bovenin om
              de bronnen opnieuw te proberen, of maak een nieuwe run aan voor deze URL.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Fallback (kan niet gebeuren binnen de spec'd states)
  return null
}

/**
 * "18 mei 2026, 17:05" — leesbare NL-tijd. Voor sync-card weergave.
 */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "2026-05-18" — ISO-date voor in de deal-titel (matcht buildDealPayload).
 */
function formatDealDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().split('T')[0]
}
