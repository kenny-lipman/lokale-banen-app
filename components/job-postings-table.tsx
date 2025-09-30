"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Eye, Edit, ExternalLink, Star, CheckCircle, Clock, XCircle, AlertCircle, Archive, Crown, RefreshCw, Check, X, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useJobPostingsCache } from "@/hooks/use-job-postings-cache"
import { TableFilters, TablePagination } from "@/components/ui/table-filters"
import { useDebounce } from "@/hooks/use-debounce"
import { TableSkeleton, LoadingSpinner } from "@/components/ui/loading-states"

// Lazy load supabaseService to avoid circular dependencies
let supabaseService: any = null
const getSupabaseService = async () => {
  if (!supabaseService) {
    try {
      const { supabaseService: service } = await import("@/lib/supabase-service")
      supabaseService = service
    } catch (error) {
      console.error("Error loading supabaseService:", error)
      throw error
    }
  }
  return supabaseService
}

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
  regio_platform?: string;
  platform_id?: string;
}

interface JobPostingsTableProps {
  onCompanyClick?: (company: any) => void
  data?: any[] // Optional: override data for custom use (e.g. Otis scraped jobs)
}

export function JobPostingsTable({ onCompanyClick = () => {}, data }: JobPostingsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jobSourceList, setJobSourceList] = useState<{id: string, name: string}[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<{id: string, regio_platform: string}[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [jobSourceMap, setJobSourceMap] = useState<{ [id: string]: string }>({})
  const [error, setError] = useState<any>(null)
  const [initializationError, setInitializationError] = useState<any>(null)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

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
          source_id: sourceFilter !== "all" ? sourceFilter : undefined,
          platform_id: platformFilter !== "all" ? platformFilter : undefined,
        }
  )

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitializationError(null)
        const service = await getSupabaseService()
        const supabase = createClient()
        
        // Fetch job sources
        const { data: jobSourcesData, error: jobSourcesError } = await supabase.from("job_sources").select("id, name")
        if (jobSourcesData) {
          const map: { [id: string]: string } = {}
          jobSourcesData.forEach((src: any) => { map[src.id] = src.name })
          setJobSourceMap(map)
        }
        
        // Fetch company sources and platforms
        const [companySources, platformsData] = await Promise.all([
          service.getCompanySources(),
          fetch('/api/platforms', {
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          }).then(res => res.json())
        ])
        
        setJobSourceList(companySources)
        setAllPlatforms(platformsData.platforms || [])
      } catch (error) {
        console.error("Error fetching initial data:", error)
        setInitializationError(error)
        setError(error)
      }
    }
    
    fetchInitialData()
  }, [])

  useEffect(() => {
    setLoading(loadingFromHook)
    setError(errorFromHook)
    setJobPostings(jobPostingsResult?.data || [])
    setTotalCount(jobPostingsResult?.count || 0)
    setTotalPages(jobPostingsResult?.totalPages || 1)
  }, [jobPostingsResult, loadingFromHook, errorFromHook])

  // Create refresh handler
  const handleRefresh = async () => {
    if (refetch && !data) {
      setIsRefreshing(true)
      try {
        await refetch()
      } finally {
        setIsRefreshing(false)
      }
    }
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [debouncedSearchTerm, statusFilter, sourceFilter, platformFilter])

  // No client-side filtering needed - all filtering is handled server-side
  const filteredJobPostings = jobPostings;

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
      const service = await getSupabaseService()
      const companyData = await service.getCompanyDetails(job.company_id)
      onCompanyClick(companyData)
    } catch (error) {
      console.error("Error fetching company details:", error)
    }
  }

  const handleEditPlatform = (jobId: string, currentPlatformId: string | undefined) => {
    setEditingJobId(jobId)
    setSelectedPlatformId(currentPlatformId || null)
  }

  const handleCancelEdit = () => {
    setEditingJobId(null)
    setSelectedPlatformId(null)
  }

  const handleSavePlatform = async (jobId: string) => {
    setSavingJobId(jobId)
    
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/job-postings/${jobId}/platform`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ platform_id: selectedPlatformId })
      })

      if (!response.ok) {
        throw new Error('Failed to update platform')
      }

      const result = await response.json()
      
      // Update the local state with the new platform info
      setJobPostings(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, platform_id: selectedPlatformId, regio_platform: result.data.regio_platform }
          : job
      ))
      
      setEditingJobId(null)
      setSelectedPlatformId(null)
    } catch (error) {
      console.error("Error updating platform:", error)
      alert('Fout bij het bijwerken van het platform. Probeer het opnieuw.')
    } finally {
      setSavingJobId(null)
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

  // Show initialization error
  if (initializationError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Fout bij het laden</h3>
          <p className="text-gray-600 mb-4">
            Er is een probleem opgetreden bij het laden van de vacaturegegevens.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Pagina Vernieuwen
          </Button>
        </div>
      </div>
    )
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
          setSourceFilter("all")
          setPlatformFilter("all")
          setStatusFilter("all")
          setCurrentPage(1)
        }}
        filters={[
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
            id: "platform",
            label: "Platform",
            value: platformFilter,
            onValueChange: setPlatformFilter,
            options: [
              { value: "all", label: "Alle platforms" },
              { value: "null", label: "Geen platform" },
              ...allPlatforms.map(p => ({ value: p.id, label: p.regio_platform }))
            ],
            placeholder: "Filter op platform"
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
        actionButtons={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading || !!data}
            className="bg-white hover:bg-gray-50 border-gray-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
        }
      />

      {/* Error message */}
      {error && !initializationError && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Fout bij het laden van vacatures</span>
          </div>
          <p className="mt-1 text-sm text-red-600">
            {error?.message || 'Er is een fout opgetreden bij het ophalen van de vacaturegegevens.'}
          </p>
          <Button 
            onClick={() => handleRefresh()}
            size="sm"
            className="mt-3 bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Opnieuw proberen
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vacature</TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Locatie</TableHead>
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
                        <div className="text-xs text-gray-500 mt-1">
                          {job.company_rating && job.company_rating > 0 ? (
                            <div className="flex items-center">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                              {job.company_rating}
                            </div>
                          ) : (
                            <span>Geen rating bekend</span>
                          )}
                        </div>
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
                  <TableCell>
                    {job.salary && <span>{job.salary}</span>}
                  </TableCell>
                  <TableCell>
                    {job.job_type && (
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(job.job_type)
                          ? job.job_type.map((type, idx) => (
                              <Badge key={type + idx} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))
                          : job.job_type
                              .replace(/([a-z])([A-Z])/g, '$1,$2')
                              .split(/[\/,|]+/)
                              .filter((t) => t && t.trim() !== "")
                              .map((type, idx) => (
                                <Badge key={type + idx} variant="outline" className="text-xs">
                                  {type.trim()}
                                </Badge>
                              ))}
                      </div>
                    )}
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
