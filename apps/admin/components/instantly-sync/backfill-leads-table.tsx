"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TablePagination } from "@/components/ui/table-filters"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Loader2,
  Search,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type { BackfillLead, BackfillLeadStatus, BackfillBatchStatus } from "@/lib/services/instantly-backfill.service"

interface BackfillLeadsTableProps {
  batchId: string | null
  batchStatus?: BackfillBatchStatus | null
}

const STATUS_CONFIG: Record<BackfillLeadStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Wachtend", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Bezig", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  synced: { label: "Gesynchroniseerd", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  skipped: { label: "Overgeslagen", variant: "outline", icon: <SkipForward className="h-3 w-3" /> },
  failed: { label: "Mislukt", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
}

const AUTO_REFRESH_INTERVAL = 5000 // 5 seconds

export function BackfillLeadsTable({ batchId, batchStatus }: BackfillLeadsTableProps) {
  const [leads, setLeads] = useState<BackfillLead[]>([])
  const [loading, setLoading] = useState(false)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState({
    status: "" as BackfillLeadStatus | "",
    search: "",
  })
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch leads
  const fetchLeads = useCallback(async (silent = false) => {
    if (!batchId) return

    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (filters.status) params.append("status", filters.status)
      if (filters.search) params.append("search", filters.search)

      const response = await fetch(`/api/instantly/backfill-queue/leads/${batchId}?${params}`)
      const data = await response.json()

      if (data.success) {
        setLeads(data.leads)
        setPagination(prev => ({
          ...prev,
          total: data.total,
          totalPages: data.totalPages,
        }))
      }
    } catch (error) {
      console.error("Failed to fetch leads:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [batchId, pagination.page, pagination.limit, filters.status, filters.search])

  // Fetch leads when filters or pagination changes
  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Auto-refresh during processing or collecting
  useEffect(() => {
    const isProcessing = batchStatus === 'processing' || batchStatus === 'collecting'

    if (isProcessing && batchId) {
      setIsAutoRefreshing(true)
      refreshIntervalRef.current = setInterval(() => {
        fetchLeads(true) // Silent refresh
      }, AUTO_REFRESH_INTERVAL)
    } else {
      setIsAutoRefreshing(false)
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [batchStatus, batchId, fetchLeads])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  if (!batchId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Start een backfill om leads te zien.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op email of campaign..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-8"
          />
        </div>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => {
            setFilters(prev => ({ ...prev, status: value === "all" ? "" : value as BackfillLeadStatus }))
            setPagination(prev => ({ ...prev, page: 1 }))
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle statussen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="pending">Wachtend</SelectItem>
            <SelectItem value="processing">Bezig</SelectItem>
            <SelectItem value="synced">Gesynchroniseerd</SelectItem>
            <SelectItem value="skipped">Overgeslagen</SelectItem>
            <SelectItem value="failed">Mislukt</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh button with auto-refresh indicator */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchLeads()}
          disabled={loading}
          title={isAutoRefreshing ? "Auto-refresh actief (elke 5s)" : "Ververs leads"}
        >
          <RefreshCw className={`h-4 w-4 ${loading || isAutoRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {isAutoRefreshing && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Live
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pipedrive</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Tijd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Geen leads gevonden
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const statusConfig = STATUS_CONFIG[lead.status]
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-mono text-sm">
                      {lead.lead_email}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {lead.campaign_name || lead.campaign_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {lead.determined_event_type || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.pipedrive_org_id ? (
                        <a
                          href={`https://lokalebanen.pipedrive.com/organization/${lead.pipedrive_org_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Org #{lead.pipedrive_org_id}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {lead.error_message ? (
                        <span className="text-red-600 text-sm truncate block" title={lead.error_message}>
                          {lead.error_message}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.completed_at
                        ? formatDistanceToNow(new Date(lead.completed_at), { addSuffix: true, locale: nl })
                        : lead.collected_at
                          ? formatDistanceToNow(new Date(lead.collected_at), { addSuffix: true, locale: nl })
                          : '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          onItemsPerPageChange={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
        />
      )}
    </div>
  )
}
