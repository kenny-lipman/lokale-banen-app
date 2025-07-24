"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Eye, Edit, ExternalLink, Star, CheckCircle, Clock, XCircle, AlertCircle, Archive, Crown } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"
import { createClient } from "@/lib/supabase"
import { useJobPostingsCache } from "@/hooks/use-job-postings-cache"
import { TableFilters, TablePagination } from "@/components/ui/table-filters"
import { useDebounce } from "@/hooks/use-debounce"
import { TableSkeleton, LoadingSpinner } from "@/components/ui/loading-states"

interface JobPosting {
  id: string
  title: string
  company_name: string
  company_logo?: string
  company_rating?: number
  is_customer?: boolean
  location: string
  platform: string
  status: string
  review_status: string
  scraped_at: string
  company_id: string
  job_type?: string
  salary?: string
  url?: string
  country?: string
  company_website?: string
  source_id: string
  region?: string;
  source_name?: string;
}

interface JobPostingsTableProps {
  onCompanyClick?: (company: any) => void
  data?: any[] // Optional: override data for custom use (e.g. Otis scraped jobs)
}

export function JobPostingsTable({ onCompanyClick = () => {}, data }: JobPostingsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [regionFilter, setRegionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [regions, setRegions] = useState<{ id: string, plaats: string, regio_platform: string }[]>([]);
  const [jobSourceList, setJobSourceList] = useState<{id: string, name: string}[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [jobSourceMap, setJobSourceMap] = useState<{ [id: string]: string }>({})
  const [error, setError] = useState<any>(null)

  // Gebruik cache hook alleen als er geen data prop is (Otis)
  const {
    data: jobPostingsResult,
    loading: loadingFromHook,
    error: errorFromHook,
    refetch,
  } = useJobPostingsCache(
    data
      ? {} // Als data prop, niet fetchen
      : {
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearchTerm,
          status: statusFilter === "all" ? undefined : statusFilter,
          region_id: regionFilter !== "all" && regionFilter !== "none" ? regions.find(r => r.plaats === regionFilter)?.id : regionFilter === "none" ? null : undefined,
          source_id: sourceFilter !== "all" ? sourceFilter : undefined,
        }
  )

  useEffect(() => {
    const fetchJobSources = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("job_sources").select("id, name")
      if (data) {
        const map: { [id: string]: string } = {}
        data.forEach((src: any) => { map[src.id] = src.name })
        setJobSourceMap(map)
      }
    }
    fetchJobSources()
    supabaseService.getCompanySources().then(setJobSourceList)
    // Haal alle regio's op
    supabaseService.getRegions().then(setRegions)
  }, [])

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  
  useEffect(() => {
    setLoading(loadingFromHook)
    setError(errorFromHook)
    setJobPostings(jobPostingsResult?.data || [])
    setTotalCount(jobPostingsResult?.count || 0)
    setTotalPages(jobPostingsResult?.totalPages || 1)
  }, [jobPostingsResult, loadingFromHook, errorFromHook])

  // Client-side filter op bron/platform als fallback
  const filteredJobPostings = jobPostings.filter((job) => {
    if (sourceFilter !== "all") {
      // Filter op platform/source_name (case-insensitive)
      return (job.platform || job.source_name || "").toLowerCase() === jobSourceList.find(s => s.id === sourceFilter)?.name?.toLowerCase();
    }
    return true;
  });

  // Helper: haal de juiste bron/platform naam op client-side
  function getJobSourceName(job: JobPosting): string | undefined {
    if (job.platform && job.platform.trim() !== "") return job.platform;
    if (job.source_name && job.source_name.trim() !== "") return job.source_name;
    if (job.source_id && jobSourceList.length > 0) {
      const found = jobSourceList.find(s => s.id === job.source_id);
      if (found && found.name && found.name.trim() !== "") return found.name;
    }
    return undefined;
  }

  const handleCompanyClick = async (job: JobPosting) => {
    try {
      const companyData = await supabaseService.getCompanyDetails(job.company_id)
      onCompanyClick(companyData)
    } catch (error) {
      console.error("Error fetching company details:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Nieuw
          </Badge>
        )
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actief
          </Badge>
        )
      case "inactive":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="w-3 h-3 mr-1" />
            Inactief
          </Badge>
        )
      case "archived":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Archive className="w-3 h-3 mr-1" />
            Gearchiveerd
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <XCircle className="w-3 h-3 mr-1" />
            {status || "Onbekend"}
          </Badge>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <TableFilters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Zoek op vacaturetitel, locatie of bedrijf..."
        totalCount={totalCount}
        resultText="vacatures"
        onResetFilters={() => {
          setSearchTerm("")
          setRegionFilter("all")
          setSourceFilter("all")
          setStatusFilter("all")
          setCurrentPage(1)
        }}
        filters={[
          {
            id: "region",
            label: "Regio",
            value: regionFilter,
            onValueChange: setRegionFilter,
            options: [
              { value: "all", label: "Alle regio's" },
              { value: "none", label: "Geen regio" },
              ...Array.from(new Set(regions.map(r => r.plaats)))
                .sort((a, b) => a.localeCompare(b, 'nl'))
                .map(plaats => ({ value: plaats, label: plaats }))
            ],
            placeholder: "Filter op regio"
          },
          {
            id: "source",
            label: "Bron",
            value: sourceFilter,
            onValueChange: setSourceFilter,
            options: [
              { value: "all", label: "Alle bronnen" },
              ...jobSourceList.map(s => ({ value: s.id, label: s.name }))
            ],
            placeholder: "Filter op bron"
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onValueChange: setStatusFilter,
            options: [
              { value: "all", label: "Alle statussen" },
              { value: "new", label: "Nieuw" },
              { value: "active", label: "Actief" },
              { value: "inactive", label: "Inactief" },
              { value: "archived", label: "Gearchiveerd" }
            ],
            placeholder: "Filter op status"
          }
        ]}
      />

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vacature</TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead>Regio</TableHead>
              <TableHead>Salaris</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} columns={10} />
            ) : filteredJobPostings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  Geen vacatures gevonden
                </TableCell>
              </TableRow>
            ) : (
              filteredJobPostings.map((job) => (
                <TableRow key={String(job.id ?? job.title ?? job.company_name ?? Math.random())} className="hover:bg-orange-50">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {job.title}
                      </div>
                      {/* Badge met bron/platform onder de functietitel, zelfde stijl als /companies */}
                      {(() => {
                        const sourceName: string | undefined = getJobSourceName(job);
                        return sourceName ? (
                          <Badge variant="outline" className="text-xs mt-1">
                            {sourceName}
                          </Badge>
                        ) : undefined;
                      })()}
                      {job.salary && <div className="text-xs text-gray-500 md:hidden">{job.salary}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {job.company_logo && (
                        <img
                          src={job.company_logo || "/placeholder.svg"}
                          alt={job.company_name}
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <div>
                        {job.company_website ? (
                          <a
                            href={job.company_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                          >
                            {job.company_name}
                          </a>
                        ) : (
                          <span className="font-medium">{job.company_name}</span>
                        )}
                        {job.is_customer && (
                          <Badge className="bg-green-100 text-green-800 border-green-200 ml-1 text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Klant
                          </Badge>
                        )}
                        {job.company_rating && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                            {job.company_rating}
                          </div>
                        )}
                        {/* Verwijder de bron-badge hier */}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {job.location}
                      {job.country && job.country !== "Netherlands" && (
                        <div className="text-xs text-gray-500">{job.country}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{job.region || "Onbekend"}</TableCell>
                  <TableCell>
                    {job.salary && <span>{job.salary}</span>}
                  </TableCell>
                  <TableCell>
                    {job.job_type && Array.isArray(job.job_type)
                      ? job.job_type.map((type, idx) => (
                          <Badge key={type + idx} variant="outline" className="text-xs mr-1">
                            {type}
                          </Badge>
                        ))
                      : job.job_type &&
                        job.job_type
                          .split(/[\/,|]+|\s+/)
                          .filter((t) => t && t.trim() !== "")
                          .map((type, idx) => (
                            <Badge key={type + idx} variant="outline" className="text-xs mr-1">
                              {type}
                            </Badge>
                          ))}
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDate(job.scraped_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {job.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && filteredJobPostings.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage)
            setCurrentPage(1)
          }}
        />
      )}
    </div>
  )
}
