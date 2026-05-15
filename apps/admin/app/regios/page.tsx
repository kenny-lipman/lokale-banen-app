"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/ui/table-filters"
import { AddRegionModal } from "@/components/AddRegionModal"
import { CityEditModal, type CityEditTarget } from "@/components/cities/CityEditModal"
import { CityBulkLinkModal, type BulkTargetRow } from "@/components/cities/CityBulkLinkModal"

interface CityRow {
  id: string
  plaats: string
  postcode: string | null
  platform_id: string | null
  source: string
  is_active: boolean | null
  current_regio_platform: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
  job_postings_count: number
}

interface CitiesStats {
  total: number
  mapped: number
  unmapped: number
  unmapped_with_suggestion: number
  unmapped_without_suggestion: number
  ambiguous_plaats_count: number
}

interface PlatformOption {
  id: string
  regio_platform: string
}

type StatusFilter = "all" | "mapped" | "unmapped" | "suggestion"
type SourceFilter = "all" | "manual" | "cbs_pc4"

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export default function RegionsPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [source, setSource] = useState<SourceFilter>("all")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<CityEditTarget | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [applyingSuggestions, setApplyingSuggestions] = useState(false)
  const [runningPrematch, setRunningPrematch] = useState(false)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (status !== "all") params.set("status", status)
    if (source !== "all") params.set("source", source)
    if (platformFilter !== "all") params.set("platform_id", platformFilter)
    params.set("limit", "500")
    params.set("offset", "0")
    return `/api/cities/list?${params.toString()}`
  }, [search, status, source, platformFilter])

  const {
    data: listData,
    error: listError,
    mutate: mutateList,
  } = useSWR<{ rows: CityRow[]; total: number }>(listUrl, fetcher)

  const { data: statsData, mutate: mutateStats } = useSWR<{ stats: CitiesStats }>(
    "/api/cities/stats",
    fetcher,
  )

  const { data: platformsData } = useSWR<{ success: boolean; data?: PlatformOption[] }>(
    "/api/platforms?format=full",
    async (url) => {
      const res = await fetch(url)
      const json = await res.json()
      return json
    },
  )

  const platforms: PlatformOption[] = useMemo(() => {
    const d = platformsData?.data
    if (!d) return []
    if (Array.isArray(d) && d.length > 0 && typeof d[0] === "string") {
      // legacy API returns string[]
      return (d as unknown as string[]).map((name) => ({ id: name, regio_platform: name }))
    }
    return d as PlatformOption[]
  }, [platformsData])

  const refresh = useCallback(() => {
    mutateList()
    mutateStats()
  }, [mutateList, mutateStats])

  const rows = listData?.rows ?? []
  const total = listData?.total ?? 0
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const stats = statsData?.stats

  useEffect(() => {
    // Reset page bij filter-wijzigingen
    setPage(1)
  }, [search, status, source, platformFilter])

  const toggleSelect = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const togglePageSelection = (on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of pagedRows) {
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }

  const selectedRows: BulkTargetRow[] = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  )

  const acceptSingleSuggestion = async (r: CityRow) => {
    if (!r.suggested_platform_id) return
    try {
      const res = await fetch(`/api/cities/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform_id: r.suggested_platform_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Koppelen mislukt")
      toast.success(`${r.plaats} → ${r.suggested_regio_platform}`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    }
  }

  const applyAllSuggestions = async () => {
    if (!confirm(`Accepteer alle ${stats?.unmapped_with_suggestion ?? "?"} PC4-suggesties?`)) return
    setApplyingSuggestions(true)
    try {
      const res = await fetch("/api/cities/apply-suggestions", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Mislukt")
      toast.success(`${data.updated} plaatsen automatisch gekoppeld`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setApplyingSuggestions(false)
    }
  }

  const runPrematchNow = async () => {
    setRunningPrematch(true)
    try {
      const res = await fetch("/api/cities/run-prematch?chunk=10000", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Prematch mislukt")
      const n = data.rows_updated ?? 0
      if (n === 0) toast.info("Niets te doen — geen nieuwe matches in de queue")
      else toast.success(`Prematch: ${n.toLocaleString("nl-NL")} vacatures gekoppeld`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setRunningPrematch(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regio&apos;s &amp; plaatsen</h1>
          <p className="text-gray-600 mt-1">
            Beheer alle plaatsen en hun platform-koppeling. Bron: handmatig of CBS PC4-import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runPrematchNow} disabled={runningPrematch}>
            {runningPrematch ? "Prematch draait…" : "Run prematch nu"}
          </Button>
          <AddRegionModal />
        </div>
      </div>

      {/* Stats-bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Totaal plaatsen"
          value={stats?.total ?? null}
          variant="neutral"
        />
        <StatCard
          label="Gekoppeld aan platform"
          value={stats?.mapped ?? null}
          variant="success"
        />
        <StatCard
          label="Met PC4-suggestie"
          value={stats?.unmapped_with_suggestion ?? null}
          variant="warning"
          action={
            stats?.unmapped_with_suggestion && stats.unmapped_with_suggestion > 0
              ? (
                <button
                  type="button"
                  onClick={applyAllSuggestions}
                  disabled={applyingSuggestions}
                  className="mt-1 text-xs underline hover:no-underline disabled:opacity-50"
                >
                  {applyingSuggestions ? "Bezig…" : "Accepteer alle"}
                </button>
              )
              : null
          }
        />
        <StatCard
          label="Niet gekoppeld (handmatig)"
          value={stats?.unmapped_without_suggestion ?? null}
          variant="danger"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Zoek plaats, postcode of platform…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="mapped">Gekoppeld</SelectItem>
            <SelectItem value="unmapped">Niet gekoppeld</SelectItem>
            <SelectItem value="suggestion">Met PC4-suggestie</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle bronnen</SelectItem>
            <SelectItem value="manual">Handmatig</SelectItem>
            <SelectItem value="cbs_pc4">CBS PC4</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectItem value="all">Alle platforms</SelectItem>
            {platforms
              .slice()
              .sort((a, b) => a.regio_platform.localeCompare(b.regio_platform, "nl"))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.regio_platform}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {(search || status !== "all" || source !== "all" || platformFilter !== "all") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("")
              setStatus("all")
              setSource("all")
              setPlatformFilter("all")
            }}
          >
            Reset
          </Button>
        )}
        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <Button
            onClick={() => setBulkOpen(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Bulk-koppel ({selectedIds.size})
          </Button>
        )}
      </div>

      {listError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Fout bij laden: {listError instanceof Error ? listError.message : String(listError)}
        </div>
      )}

      {/* Tabel */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    pagedRows.length > 0 &&
                    pagedRows.every((r) => selectedIds.has(r.id))
                  }
                  onCheckedChange={(v) => togglePageSelection(Boolean(v))}
                />
              </TableHead>
              <TableHead>Plaats</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Platform-koppeling</TableHead>
              <TableHead>Bron</TableHead>
              <TableHead className="text-right">Vacatures</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!listData && !listError && (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={idx}>
                  {Array.from({ length: 7 }).map((_, c) => (
                    <TableCell key={c}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {listData && pagedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Geen plaatsen gevonden voor deze filters.
                </TableCell>
              </TableRow>
            )}
            {pagedRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={(v) => toggleSelect(r.id, Boolean(v))}
                  />
                </TableCell>
                <TableCell className="font-medium">{r.plaats}</TableCell>
                <TableCell className="font-mono text-sm">{r.postcode ?? "—"}</TableCell>
                <TableCell>
                  {r.platform_id && r.current_regio_platform ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      ● {r.current_regio_platform}
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        ○ Niet gekoppeld
                      </Badge>
                      {r.suggested_platform_id && r.suggested_regio_platform && (
                        <button
                          type="button"
                          onClick={() => acceptSingleSuggestion(r)}
                          className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 hover:bg-orange-200"
                        >
                          ✦ Suggestie: {r.suggested_regio_platform}
                        </button>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      r.source === "cbs_pc4"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }
                  >
                    {r.source === "cbs_pc4" ? "CBS PC4" : "Handmatig"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {r.job_postings_count > 0 ? r.job_postings_count.toLocaleString("nl-NL") : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget(r)}>
                    Bewerk
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        itemName="plaatsen"
      />

      <CityEditModal
        city={editTarget}
        platforms={platforms}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={refresh}
      />

      <CityBulkLinkModal
        selected={selectedRows}
        platforms={platforms}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onApplied={() => {
          setSelectedIds(new Set())
          refresh()
        }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
  action,
}: {
  label: string
  value: number | null
  variant: "neutral" | "success" | "warning" | "danger"
  action?: React.ReactNode
}) {
  const bg = {
    neutral: "bg-gray-50",
    success: "bg-green-50",
    warning: "bg-amber-50",
    danger: "bg-red-50",
  }[variant]
  const fg = {
    neutral: "text-gray-900",
    success: "text-green-800",
    warning: "text-amber-800",
    danger: "text-red-800",
  }[variant]
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className={`text-2xl font-bold ${fg}`}>
        {value === null ? "—" : value.toLocaleString("nl-NL")}
      </div>
      <div className={`text-xs ${fg} opacity-80`}>{label}</div>
      {action}
    </div>
  )
}
