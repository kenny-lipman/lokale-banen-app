'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Pencil, X } from 'lucide-react'

type BrancheOption = {
  id: string
  pipedrive_enum_id: number
  label: string
  sort_order: number
  sbi_prefixes: string[]
  active: boolean
  synced_from_pipedrive_at: string | null
  updated_at: string | null
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function BrancheMappingClient() {
  const [options, setOptions] = useState<BrancheOption[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editTarget, setEditTarget] = useState<BrancheOption | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pipedrive-branche-options', { cache: 'no-store' })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`)
      const json = (await res.json()) as { options: BrancheOption[] }
      setOptions(json.options)
    } catch (e) {
      toast.error('Laden mislukt', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/pipedrive-branche-options/sync', { method: 'POST' })
      const json = await res.json() as {
        success?: boolean
        error?: string
        inserted?: number
        updated?: number
        deactivated?: number
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`)
      toast.success('Sync voltooid', {
        description: `${json.inserted} nieuw · ${json.updated} bijgewerkt · ${json.deactivated} inactief`,
      })
      await load()
    } catch (e) {
      toast.error('Sync mislukt', { description: (e as Error).message })
    } finally {
      setSyncing(false)
    }
  }

  const updateRow = async (id: string, patch: Partial<Pick<BrancheOption, 'sbi_prefixes' | 'active'>>) => {
    const res = await fetch(`/api/admin/pipedrive-branche-options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json() as { option?: BrancheOption; error?: string }
    if (!res.ok || !json.option) throw new Error(json.error ?? `HTTP ${res.status}`)
    setOptions((prev) => prev.map((o) => (o.id === id ? json.option! : o)))
  }

  const toggleActive = async (row: BrancheOption) => {
    try {
      await updateRow(row.id, { active: !row.active })
    } catch (e) {
      toast.error('Wijzigen mislukt', { description: (e as Error).message })
    }
  }

  const lastSync = options.reduce<string | null>((latest, o) => {
    if (!o.synced_from_pipedrive_at) return latest
    if (!latest || o.synced_from_pipedrive_at > latest) return o.synced_from_pipedrive_at
    return latest
  }, null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branche-mapping</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Pipedrive branche-opties met SBI-prefix mapping. Wordt gebruikt door sales lead enrichment.
          </p>
        </div>
        <Button onClick={sync} disabled={syncing} variant="outline">
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync vanuit Pipedrive
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opties</CardTitle>
          <CardDescription>
            Laatste sync: {fmtDate(lastSync)}. Label en ID komen uit Pipedrive en zijn read-only. SBI-prefixes
            zijn 2-cijferige codes die deze branche herkennen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">Laden…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>SBI-prefixes</TableHead>
                  <TableHead className="w-24">Actief</TableHead>
                  <TableHead className="w-24">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((row) => (
                  <TableRow key={row.id} className={!row.active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-xs">{row.pipedrive_enum_id}</TableCell>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>
                      {row.sbi_prefixes.length === 0 ? (
                        <span className="text-xs text-gray-400">geen</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.sbi_prefixes.map((p) => (
                            <Badge key={p} variant="secondary" className="font-mono">{p}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={row.active} onCheckedChange={() => void toggleActive(row)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditSbiModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={async (prefixes) => {
          if (!editTarget) return
          try {
            await updateRow(editTarget.id, { sbi_prefixes: prefixes })
            toast.success('Opgeslagen', { description: `SBI-prefixes voor ${editTarget.label} bijgewerkt.` })
            setEditTarget(null)
          } catch (e) {
            toast.error('Opslaan mislukt', { description: (e as Error).message })
          }
        }}
      />
    </>
  )
}

function EditSbiModal({
  target,
  onClose,
  onSave,
}: {
  target: BrancheOption | null
  onClose: () => void
  onSave: (prefixes: string[]) => void | Promise<void>
}) {
  const [prefixes, setPrefixes] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setPrefixes([...target.sbi_prefixes])
      setInput('')
    }
  }, [target])

  const add = () => {
    const cleaned = input.trim()
    if (!/^\d{2}$/.test(cleaned)) return
    if (prefixes.includes(cleaned)) {
      setInput('')
      return
    }
    setPrefixes([...prefixes, cleaned].sort())
    setInput('')
  }

  const remove = (p: string) => {
    setPrefixes(prefixes.filter((x) => x !== p))
  }

  if (!target) return null

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SBI-prefixes voor {target.label}</DialogTitle>
          <DialogDescription>
            Voeg 2-cijferige SBI-codes toe die deze branche herkennen. Bv. 41, 42, 43 voor de bouw.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="bv. 41"
              maxLength={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={add} disabled={!/^\d{2}$/.test(input.trim())}>
              Toevoegen
            </Button>
          </div>

          {prefixes.length === 0 ? (
            <div className="text-xs text-gray-400">Nog geen SBI-prefixes</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {prefixes.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono gap-1">
                  {p}
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="ml-1 rounded hover:bg-gray-200"
                    aria-label={`Verwijder ${p}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annuleren</Button>
          <Button
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(prefixes)
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
