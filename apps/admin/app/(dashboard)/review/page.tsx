"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-filters"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import {
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react"
import Link from "next/link"

interface Company {
  id: string
  name: string
  logo_url: string | null
  city: string | null
}

interface JobPosting {
  id: string
  title: string
  city: string | null
  salary: string | null
  employment: string | null
  review_status: string
  scraped_at: string
  zipcode: string | null
  platform_id: string | null
  slug: string | null
  published_at: string | null
  companies: Company | null
}

interface Platform {
  id: string
  regio_platform: string
}

export default function ReviewPage() {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [status, setStatus] = useState("pending")
  const [platformId, setPlatformId] = useState("")
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch platforms for dropdown
  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const res = await authFetch("/api/companies?type=platforms")
        // Fallback: fetch from our custom endpoint or direct
        const platformRes = await authFetch("/api/review?page=1&limit=1&status=all")
        // Just get platforms list separately
        const { createClient } = await import("@/lib/supabase")
        const supabase = createClient()
        const { data } = await supabase
          .from("platforms")
          .select("id, regio_platform")
          .order("regio_platform")
        if (data) setPlatforms(data)
      } catch {
        // Silently fail, platforms dropdown will be empty
      }
    }
    fetchPlatforms()
  }, [])

  // Fetch job postings
  const fetchJobPostings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status,
      })
      if (platformId) params.set("platformId", platformId)
      if (searchDebounced) params.set("search", searchDebounced)

      const res = await authFetch(`/api/review?${params.toString()}`)
      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      setJobPostings(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 1)
    } catch (err) {
      toast.error("Fout bij ophalen vacatures")
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, platformId, searchDebounced])

  useEffect(() => {
    fetchJobPostings()
  }, [fetchJobPostings])

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === jobPostings.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(jobPostings.map((j) => j.id))
    }
  }

  // Bulk actions
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    setActionLoading(true)
    try {
      const res = await authFetch("/api/review/bulk-approve", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds, platformId: platformId || undefined }),
      })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        setSelectedIds([])
        fetchJobPostings()
      }
    } catch {
      toast.error("Fout bij goedkeuren")
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return
    setActionLoading(true)
    try {
      const res = await authFetch("/api/review/bulk-reject", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        setSelectedIds([])
        fetchJobPostings()
      }
    } catch {
      toast.error("Fout bij afkeuren")
    } finally {
      setActionLoading(false)
    }
  }

  const statusBadge = (reviewStatus: string) => {
    switch (reviewStatus) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Goedgekeurd</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Afgekeurd</Badge>
      case "pending":
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">In afwachting</Badge>
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            Vacature Review
          </h1>
          <p className="text-muted-foreground mt-1">
            Beoordeel en publiceer vacatures voor de publieke sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vacatures/nieuw">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe vacature
            </Button>
          </Link>
          <Button variant="outline" onClick={fetchJobPostings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Status tabs */}
            <Tabs
              value={status}
              onValueChange={(val) => {
                setStatus(val)
                setPage(1)
                setSelectedIds([])
              }}
            >
              <TabsList>
                <TabsTrigger value="pending">
                  In afwachting
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Goedgekeurd
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Afgekeurd
                </TabsTrigger>
                <TabsTrigger value="all">
                  Alle
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and platform filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Zoek op titel..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={platformId || "all"}
                onValueChange={(val) => {
                  setPlatformId(val === "all" ? "" : val)
                  setPage(1)
                  setSelectedIds([])
                }}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Alle platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle platforms</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.regio_platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="self-center whitespace-nowrap">
                {total.toLocaleString("nl-NL")} resultaten
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.length} vacature(s) geselecteerd
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Goedkeuren ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Afkeuren ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds([])}
              >
                Deselecteren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      jobPostings.length > 0 &&
                      selectedIds.length === jobPostings.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Bedrijf</TableHead>
                <TableHead>Stad</TableHead>
                <TableHead>Salaris</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <span className="text-muted-foreground">Laden...</span>
                  </TableCell>
                </TableRow>
              ) : jobPostings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Geen vacatures gevonden met de huidige filters
                  </TableCell>
                </TableRow>
              ) : (
                jobPostings.map((job) => (
                  <TableRow
                    key={job.id}
                    className={selectedIds.includes(job.id) ? "bg-blue-50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(job.id)}
                        onCheckedChange={() => toggleSelect(job.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {job.title || "Geen titel"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {job.companies?.name || "-"}
                    </TableCell>
                    <TableCell>{job.city || "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {job.salary || "-"}
                    </TableCell>
                    <TableCell>{statusBadge(job.review_status)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(job.scraped_at)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/vacatures/${job.id}/bewerken`}>
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 0 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={total}
          itemsPerPage={limit}
          onPageChange={(p) => {
            setPage(p)
            setSelectedIds([])
          }}
          onItemsPerPageChange={(l) => {
            setLimit(l)
            setPage(1)
            setSelectedIds([])
          }}
        />
      )}
    </div>
  )
}
