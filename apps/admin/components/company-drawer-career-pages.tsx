'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { AddCareerPageDialog } from '@/components/scrape-bronnen/career-pages-table'

type Row = {
  id: string
  url: string | null
  scrape_frequency: string | null
  active: boolean | null
  review_status: string
  discovery_method: string | null
  last_scraped_at: string | null
  approved_at: string | null
  rejected_at: string | null
  created_at: string
}

type Props = {
  companyId: string
  companyName: string
}

export function CompanyDrawerCareerPages({ companyId, companyName }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        kind: 'company_career_page',
        company_id: companyId,
        pageSize: '100',
      })
      const res = await fetch(`/api/job-sources/career-pages?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onbekende fout')
      setRows(data.rows ?? [])
    } catch (e) {
      toast.error('Laden mislukt', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  const onToggle = async (row: Row, value: boolean) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: value } : r)))
    const res = await fetch(`/api/job-sources/career-pages/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: value }),
    })
    if (!res.ok) {
      // revert
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: !value } : r)))
      toast.error('Wijzigen mislukt')
    }
  }

  const onApprove = async (id: string) => {
    const res = await fetch(`/api/job-sources/career-pages/${id}/approve`, { method: 'POST' })
    if (!res.ok) return toast.error('Goedkeuren mislukt')
    toast.success('Goedgekeurd')
    load()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    const id = deleteRow.id
    setDeleteRow(null)
    const res = await fetch(`/api/job-sources/career-pages/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('Verwijderen mislukt')
    toast.success('Verwijderd')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <LinkIcon className="size-4 text-slate-500" />
          Werken-bij bronnen ({rows.length})
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-1" />
          URL toevoegen
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-slate-500">Laden…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center border border-dashed rounded">
            Nog geen werken-bij bronnen voor dit bedrijf.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className={`border rounded-lg p-3 ${row.review_status === 'pending' ? 'bg-amber-50/40 border-amber-200' : row.review_status === 'rejected' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <a
                      href={row.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-blue-600 hover:underline truncate flex items-center gap-1 max-w-full"
                    >
                      <span className="truncate">{row.url}</span>
                      <ExternalLink className="size-3 shrink-0 opacity-50" />
                    </a>
                    {row.review_status === 'pending' && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">⏳ Pending</Badge>
                    )}
                    {row.review_status === 'rejected' && (
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs">✗ Afgewezen</Badge>
                    )}
                    {row.review_status === 'approved' && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">✓ Actief</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {row.discovery_method ?? 'manual'} · {row.scrape_frequency ?? 'weekly'}
                    {row.last_scraped_at && ` · laatst gescrapet ${new Date(row.last_scraped_at).toLocaleDateString('nl-NL')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.review_status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-7 text-green-700" onClick={() => onApprove(row.id)}>Goedkeuren</Button>
                  )}
                  {row.review_status === 'approved' && (
                    <Switch checked={!!row.active} onCheckedChange={(v) => onToggle(row, v)} />
                  )}
                  <Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => setDeleteRow(row)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AddCareerPageDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={load}
        presetCompany={{ id: companyId, name: companyName }}
      />

      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bron verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow?.url} wordt permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
