"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { authFetch } from "@/lib/authenticated-fetch"

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
    instantly: {
      synced: number
      pending: number
    }
    pipedrive: {
      synced: number
      pending: number
    }
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

export function useBlocklist(options: UseBlocklistOptions = {}) {
  const {
    initialPage = 1,
    initialLimit = 20,
    initialFilters = {},
  } = options

  const [entries, setEntries] = useState<BlocklistEntry[]>([])
  const [stats, setStats] = useState<BlocklistStats | null>(null)
  const [pagination, setPagination] = useState<BlocklistPagination>({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState<BlocklistFilters>(initialFilters)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== "")
        ),
      })

      const response = await authFetch(`/api/blocklist?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch blocklist entries")
      }

      const data = await response.json()
      setEntries(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch entries"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await authFetch("/api/blocklist/stats")
      if (!response.ok) {
        throw new Error("Failed to fetch blocklist stats")
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    }
  }

  // Create entry
  const createEntry = async (entryData: Omit<BlocklistEntry, "id" | "created_at" | "updated_at">) => {
    try {
      const response = await authFetch("/api/blocklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create entry")
      }

      const newEntry = await response.json()
      toast.success("Blocklist entry toegevoegd")

      // Refresh data
      fetchEntries()
      fetchStats()

      return newEntry
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create entry"
      toast.error(errorMessage)
      throw err
    }
  }

  // Update entry
  const updateEntry = async (id: string, entryData: Partial<BlocklistEntry>) => {
    try {
      const response = await authFetch(`/api/blocklist/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update entry")
      }

      const updatedEntry = await response.json()
      toast.success("Blocklist entry bijgewerkt")

      // Refresh data
      fetchEntries()
      fetchStats()

      return updatedEntry
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update entry"
      toast.error(errorMessage)
      throw err
    }
  }

  // Delete entry
  const deleteEntry = async (id: string) => {
    try {
      const response = await authFetch(`/api/blocklist/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete entry")
      }

      toast.success("Blocklist entry verwijderd")

      // Refresh data
      fetchEntries()
      fetchStats()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete entry"
      toast.error(errorMessage)
      throw err
    }
  }

  // Bulk operations
  const bulkActivate = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map(id => updateEntry(id, { is_active: true }))
      )
      toast.success(`${ids.length} entries geactiveerd`)
    } catch (err) {
      toast.error("Failed to activate entries")
      throw err
    }
  }

  const bulkDeactivate = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map(id => updateEntry(id, { is_active: false }))
      )
      toast.success(`${ids.length} entries gedeactiveerd`)
    } catch (err) {
      toast.error("Failed to deactivate entries")
      throw err
    }
  }

  const bulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map(id => deleteEntry(id))
      )
      toast.success(`${ids.length} entries verwijderd`)
    } catch (err) {
      toast.error("Failed to delete entries")
      throw err
    }
  }

  // Check blocklist
  const checkBlocklist = async (values: string[]) => {
    try {
      const response = await authFetch("/api/blocklist/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  // Import entries
  const importEntries = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await authFetch("/api/blocklist/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import entries")
      }

      const result = await response.json()
      toast.success(`Import geslaagd: ${result.summary.successfully_imported} entries toegevoegd`)

      // Refresh data
      fetchEntries()
      fetchStats()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import entries"
      toast.error(errorMessage)
      throw err
    }
  }

  // Export entries
  const exportEntries = async (format: "json" | "csv" = "csv") => {
    try {
      const response = await authFetch(`/api/blocklist/export?format=${format}`)

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

  // Sync to Instantly.ai
  const syncToInstantly = async () => {
    try {
      setLoading(true)
      const response = await authFetch("/api/blocklist/sync", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to sync to Instantly.ai")
      }

      const result = await response.json()

      toast.success(
        `Sync voltooid: ${result.data.success} geslaagd, ${result.data.failed} gefaald, ${result.data.skipped} overgeslagen`
      )

      // Refresh data to get updated sync status
      fetchEntries()
      fetchStats()

      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync to Instantly.ai"
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Navigation
  const changePage = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const changeLimit = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const updateFilters = (newFilters: Partial<BlocklistFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when filtering
  }

  // Effects
  useEffect(() => {
    fetchEntries()
  }, [pagination.page, pagination.limit, filters])

  useEffect(() => {
    fetchStats()
  }, [])

  return {
    // Data
    entries,
    stats,
    pagination,
    filters,
    loading,
    error,

    // Actions
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

    // Navigation
    changePage,
    changeLimit,
    updateFilters,

    // Refresh
    refetch: fetchEntries,
    refetchStats: fetchStats,
  }
}