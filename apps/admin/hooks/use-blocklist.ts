"use client"

import { useState } from "react"
import { toast } from "sonner"
import useSWR, { mutate as globalMutate } from "swr"
import { swrKeys } from "@/lib/swr-keys"

export interface BlocklistEntry {
  id: string
  type: "email" | "domain"
  value: string
  reason: string
  is_active: boolean
  created_at: string
  updated_at: string
  instantly_synced?: boolean
  instantly_synced_at?: string | null
  instantly_id?: string | null
  instantly_error?: string | null
  pipedrive_synced?: boolean
  pipedrive_synced_at?: string | null
  pipedrive_error?: string | null
  created_by_user?: {
    email: string
  }
}

export interface BlocklistStats {
  overview: {
    total: number
    active: number
    inactive: number
  }
  byType: {
    email: number
    domain: number
  }
  syncStatus: {
    instantly: { synced: number; pending: number }
    pipedrive: { synced: number; pending: number }
  }
  recentActivity: {
    last24Hours: number
    last7Days: number
    recentEntries: BlocklistEntry[]
  }
}

export interface BlocklistFilters {
  search?: string
  type?: "email" | "domain"
  is_active?: boolean
  sort_by?: string
  sort_order?: "asc" | "desc"
}

export interface BlocklistPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UseBlocklistOptions {
  initialPage?: number
  initialLimit?: number
  initialFilters?: BlocklistFilters
}

interface BlocklistListResponse {
  data: BlocklistEntry[]
  pagination: { total: number; totalPages: number }
}

async function fetchBlocklistList(
  page: number,
  limit: number,
  filters: BlocklistFilters,
): Promise<BlocklistListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined && value !== ""),
    ) as Record<string, string>,
  })

  const response = await fetch(`/api/blocklist?${params}`)
  if (!response.ok) {
    throw new Error("Failed to fetch blocklist entries")
  }
  return response.json()
}

async function fetchBlocklistStats(): Promise<BlocklistStats> {
  const response = await fetch("/api/blocklist/stats")
  if (!response.ok) {
    throw new Error("Failed to fetch blocklist stats")
  }
  return response.json()
}

function revalidateAll() {
  globalMutate(
    (key) => Array.isArray(key) && key[0] === "blocklist",
    undefined,
    { revalidate: true },
  )
}

export function useBlocklist(options: UseBlocklistOptions = {}) {
  const { initialPage = 1, initialLimit = 20, initialFilters = {} } = options

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [filters, setFilters] = useState<BlocklistFilters>(initialFilters)
  const [syncing, setSyncing] = useState(false)

  const listKey = swrKeys.blocklistList({ page, limit, filters: filters as Record<string, unknown> })
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateList,
  } = useSWR<BlocklistListResponse>(listKey, () => fetchBlocklistList(page, limit, filters))

  const {
    data: stats,
    mutate: mutateStats,
  } = useSWR<BlocklistStats>(swrKeys.blocklistStats, fetchBlocklistStats)

  const entries = listData?.data ?? []
  const pagination: BlocklistPagination = {
    page,
    limit,
    total: listData?.pagination?.total ?? 0,
    totalPages: listData?.pagination?.totalPages ?? 0,
  }

  const createEntry = async (
    entryData: Omit<BlocklistEntry, "id" | "created_at" | "updated_at">,
  ) => {
    try {
      const response = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create entry")
      }
      const newEntry = await response.json()
      toast.success("Blocklist entry toegevoegd")
      revalidateAll()
      return newEntry
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create entry"
      toast.error(errorMessage)
      throw err
    }
  }

  const updateEntry = async (id: string, entryData: Partial<BlocklistEntry>) => {
    try {
      const response = await fetch(`/api/blocklist/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update entry")
      }
      const updatedEntry = await response.json()
      toast.success("Blocklist entry bijgewerkt")
      revalidateAll()
      return updatedEntry
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update entry"
      toast.error(errorMessage)
      throw err
    }
  }

  const deleteEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/blocklist/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete entry")
      }
      toast.success("Blocklist entry verwijderd")
      revalidateAll()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete entry"
      toast.error(errorMessage)
      throw err
    }
  }

  const bulkActivate = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => updateEntry(id, { is_active: true })))
      toast.success(`${ids.length} entries geactiveerd`)
    } catch (err) {
      toast.error("Failed to activate entries")
      throw err
    }
  }

  const bulkDeactivate = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => updateEntry(id, { is_active: false })))
      toast.success(`${ids.length} entries gedeactiveerd`)
    } catch (err) {
      toast.error("Failed to deactivate entries")
      throw err
    }
  }

  const bulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deleteEntry(id)))
      toast.success(`${ids.length} entries verwijderd`)
    } catch (err) {
      toast.error("Failed to delete entries")
      throw err
    }
  }

  const checkBlocklist = async (values: string[]) => {
    try {
      const response = await fetch("/api/blocklist/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: values }),
      })
      if (!response.ok) {
        throw new Error("Failed to check blocklist")
      }
      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check blocklist"
      toast.error(errorMessage)
      throw err
    }
  }

  const importEntries = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/blocklist/upload", { method: "POST", body: formData })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import entries")
      }
      const result = await response.json()
      if (result.data?.import?.successful) {
        toast.success(`Import geslaagd: ${result.data.import.successful} entries toegevoegd`)
      } else if (result.data?.validation?.validEntries) {
        toast.success(`Bestand verwerkt: ${result.data.validation.validEntries} entries gevalideerd`)
      } else {
        toast.success("Import succesvol verwerkt")
      }
      if (result.data?.import?.error) {
        toast.error(`Import waarschuwing: ${result.data.import.error}`)
      }
      revalidateAll()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import entries"
      toast.error(errorMessage)
      throw err
    }
  }

  const exportEntries = async (format: "json" | "csv" = "csv") => {
    try {
      const response = await fetch(`/api/blocklist/export?format=${format}`)
      if (!response.ok) {
        throw new Error("Failed to export entries")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `blocklist_export_${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Export gestart")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to export entries"
      toast.error(errorMessage)
      throw err
    }
  }

  const syncToInstantly = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/blocklist/sync", { method: "POST" })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to sync to Instantly.ai")
      }
      const result = await response.json()
      toast.success(
        `Sync voltooid: ${result.data.success} geslaagd, ${result.data.failed} gefaald, ${result.data.skipped} overgeslagen`,
      )
      revalidateAll()
      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync to Instantly.ai"
      toast.error(errorMessage)
      throw err
    } finally {
      setSyncing(false)
    }
  }

  const changePage = (newPage: number) => setPage(newPage)
  const changeLimit = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }
  const updateFilters = (newFilters: Partial<BlocklistFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPage(1)
  }

  return {
    entries,
    stats: stats ?? null,
    pagination,
    filters,
    loading: listLoading || syncing,
    error: listError ? (listError instanceof Error ? listError.message : "Failed to fetch entries") : null,

    createEntry,
    updateEntry,
    deleteEntry,
    bulkActivate,
    bulkDeactivate,
    bulkDelete,
    checkBlocklist,
    importEntries,
    exportEntries,
    syncToInstantly,

    changePage,
    changeLimit,
    updateFilters,

    refetch: () => mutateList(),
    refetchStats: () => mutateStats(),
  }
}
