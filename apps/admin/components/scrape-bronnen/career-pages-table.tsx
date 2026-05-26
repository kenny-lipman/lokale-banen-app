'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Combobox } from '@/components/ui/combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { CheckCircle2, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react'

type Row = {
  id: string
  url: string | null
  scrape_frequency: string | null
  ats_type: string | null
  active: boolean | null
  review_status: string
  discovery_method: string | null
  last_scraped_at: string | null
  last_scrape_status: string | null
  approved_at: string | null
  rejected_at: string | null
  created_at: string
  company: { id: string; name: string; website: string | null } | null
}

type ListResponse = { rows: Row[]; total: number; page: number; pageSize: number }

const FREQUENCIES = [
  { value: 'daily', label: 'Dagelijks' },
  { value: 'weekly', label: 'Wekelijks' },
  { value: 'monthly', label: 'Maandelijks' },
]

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved')
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">✓ Actief</Badge>
    )
  if (status === 'pending')
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">⏳ Pending</Badge>
    )
  return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">✗ Afgewezen</Badge>
}

export function CareerPagesTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reviewStatus, setReviewStatus] = useState<string>('all')
  const [frequency, setFrequency] = useState<string>('all')
  const [onlyActive, setOnlyActive] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState<Row | null>(null)
  const [deleteRow, setDeleteRow] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      kind: 'company_career_page',
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search.trim()) params.set('search', search.trim())
    if (reviewStatus !== 'all') params.set('review_status', reviewStatus)
    if (frequency !== 'all') params.set('scrape_frequency', frequency)
    if (onlyActive) params.set('active', 'true')

    try {
      const res = await fetch(`/api/job-sources/career-pages?${params}`)
      const data = (await res.json()) as ListResponse | { error: string }
      if (!res.ok) throw new Error('error' in data ? data.error : 'Onbekende fout')
      const list = data as ListResponse
      setRows(list.rows)
      setTotal(list.total)
    } catch (e) {
      toast.error('Laden mislukt', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [page, search, reviewStatus, frequency, onlyActive])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const onApprove = async (id: string) => {
    const res = await fetch(`/api/job-sources/career-pages/${id}/approve`, { method: 'POST' })
    if (!res.ok) {
      toast.error('Goedkeuren mislukt')
      return
    }
    toast.success('Goedgekeurd')
    load()
  }

  const onToggleActive = async (row: Row, value: boolean) => {
    const res = await fetch(`/api/job-sources/career-pages/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: value }),
    })
    if (!res.ok) {
      toast.error('Wijzigen mislukt')
      return
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: value } : r)))
  }

  const onDelete = async () => {
    if (!deleteRow) return
    const id = deleteRow.id
    setDeleteRow(null)
    const res = await fetch(`/api/job-sources/career-pages/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Verwijderen mislukt')
      return
    }
    toast.success('Verwijderd')
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{total} bron{total === 1 ? '' : 'nen'}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Werken-bij URL toevoegen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-slate-50">
        <Input
          placeholder="Zoek op company-naam of URL…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
        <Select value={reviewStatus} onValueChange={(v) => { setReviewStatus(v); setPage(1) }}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="approved">✓ Goedgekeurd</SelectItem>
            <SelectItem value="pending">⏳ Pending</SelectItem>
            <SelectItem value="rejected">✗ Afgewezen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={frequency} onValueChange={(v) => { setFrequency(v); setPage(1) }}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Frequentie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle frequenties</SelectItem>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Switch checked={onlyActive} onCheckedChange={(v) => { setOnlyActive(v); setPage(1) }} />
          Alleen actief
        </label>
      </div>

      {/* Tabel */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Bron</TableHead>
              <TableHead>Frequentie</TableHead>
              <TableHead>Laatst gescrapet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                  Nog geen werken-bij bronnen.<br />
                  <span className="text-xs">Worden automatisch aangemaakt na succesvolle Sales Lead enrichment, of voeg er handmatig één toe.</span>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className={row.review_status === 'pending' ? 'bg-amber-50/40' : row.review_status === 'rejected' ? 'opacity-60' : ''}>
                  <TableCell>
                    {row.company ? (
                      <a href={`/companies?id=${row.company.id}`} className="text-blue-600 hover:underline">
                        {row.company.name}
                      </a>
                    ) : <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[260px]">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="text-slate-700 hover:underline truncate flex items-center gap-1">
                        <span className="truncate">{row.url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{row.discovery_method ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {FREQUENCIES.find((f) => f.value === row.scrape_frequency)?.label ?? row.scrape_frequency ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {row.last_scraped_at ? new Date(row.last_scraped_at).toLocaleDateString('nl-NL') : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={row.review_status} /></TableCell>
                  <TableCell>
                    <Switch
                      checked={!!row.active}
                      onCheckedChange={(v) => onToggleActive(row, v)}
                      disabled={row.review_status === 'rejected'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {row.review_status === 'pending' && (
                        <Button size="sm" variant="ghost" className="text-green-700 hover:text-green-800 h-8" onClick={() => onApprove(row.id)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Goedkeuren
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditRow(row)} title="Bewerken">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteRow(row)} title="Verwijderen">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Pagina {page} van {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Vorige</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Volgende ›</Button>
          </div>
        </div>
      )}

      {/* Add dialog */}
      <AddCareerPageDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />

      {/* Edit dialog */}
      <EditCareerPageDialog
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={load}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bron verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow?.url} wordt permanent verwijderd. Bij her-suggestie via enrichment komt hij weer terug als pending.
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

// ─── Add dialog ───────────────────────────────────────────────────

export function AddCareerPageDialog({
  open,
  onOpenChange,
  onSaved,
  presetCompany,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  /** Voor inbedded gebruik (CompanyDrawer): company is al gekozen */
  presetCompany?: { id: string; name: string }
}) {
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [companyId, setCompanyId] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [url, setUrl] = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'pending'>('approved')
  const [submitting, setSubmitting] = useState(false)

  const searchCompanies = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ search: q, limit: '50' })
      const res = await fetch(`/api/companies/search?${params}`)
      const result = await res.json()
      if (result.success && result.companies) {
        setCompanies(result.companies.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })))
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => searchCompanies(companySearch), companySearch ? 300 : 0)
    return () => clearTimeout(t)
  }, [open, companySearch, searchCompanies])

  // Reset bij open
  useEffect(() => {
    if (open) {
      setCompanyId(presetCompany?.id ?? '')
      setUrl(''); setFrequency('weekly'); setReviewStatus('approved'); setCompanySearch('')
    }
  }, [open, presetCompany])

  const submit = async () => {
    if (!companyId || !url) {
      toast.error('Company en URL zijn verplicht')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/job-sources/career-pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          url,
          scrape_frequency: frequency,
          review_status: reviewStatus,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Onbekende fout')
      }
      toast.success('Toegevoegd')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error('Toevoegen mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Werken-bij URL toevoegen</DialogTitle>
          <DialogDescription>URL wordt gecanonicaliseerd. Duplicaten worden geweigerd.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {presetCompany ? (
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <div className="px-3 py-2 bg-slate-50 border rounded text-sm">{presetCompany.name}</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <Combobox
                options={companies}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Zoek company…"
                searchPlaceholder="Typ om te zoeken…"
                emptyText="Geen companies gevonden"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <Input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Frequentie</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as 'approved' | 'pending')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✓ Direct goedkeuren</SelectItem>
                  <SelectItem value="pending">⏳ Pending review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Bezig…' : 'Toevoegen'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────

function EditCareerPageDialog({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const [frequency, setFrequency] = useState('weekly')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (row) {
      setFrequency(row.scrape_frequency ?? 'weekly')
      setActive(!!row.active)
    }
  }, [row])

  if (!row) return null

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/job-sources/career-pages/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scrape_frequency: frequency, active }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Onbekende fout')
      }
      toast.success('Opgeslagen')
      onClose()
      onSaved()
    } catch (e) {
      toast.error('Opslaan mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Werken-bij bron bewerken</DialogTitle>
          <DialogDescription className="font-mono text-xs truncate">{row.url}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Frequentie</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">Actief — pickt op door scheduled scraper (V1B)</span>
          </div>
          <div className="text-xs text-slate-500 border-t pt-3 space-y-1">
            <div className="flex justify-between"><span>Toegevoegd:</span><span>{new Date(row.created_at).toLocaleString('nl-NL')}</span></div>
            {row.approved_at && <div className="flex justify-between"><span>Goedgekeurd:</span><span>{new Date(row.approved_at).toLocaleString('nl-NL')}</span></div>}
            {row.rejected_at && <div className="flex justify-between"><span>Afgewezen:</span><span>{new Date(row.rejected_at).toLocaleString('nl-NL')}</span></div>}
            <div className="flex justify-between"><span>Laatst gescrapet:</span><span>{row.last_scraped_at ? new Date(row.last_scraped_at).toLocaleString('nl-NL') : '—'}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuleren</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Bezig…' : 'Opslaan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
