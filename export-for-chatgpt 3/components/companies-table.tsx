"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Eye, Edit, ExternalLink, Star, Building2, Globe, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle, XCircle } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { useCompaniesCache } from "@/hooks/use-companies-cache"

interface Company {
  id: string
  name: string
  website?: string | null
  indeed_url?: string | null
  logo_url?: string | null
  location?: string | null
  description?: string | null
  rating_indeed?: number | null
  review_count_indeed?: number | null
  size_min?: number | null
  size_max?: number | null
  is_customer?: boolean | null
  source_name?: string | null
  created_at: string | null
  job_counts: number
  region_id?: string | null; // Added for client-side filtering
  status?: string | null; // Added for bulk status
}

interface CompaniesTableProps {
  onCompanyClick: (company: any) => void
  onStatusChange?: () => void
}

export function CompaniesTable({ onCompanyClick, onStatusChange }: CompaniesTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const tableRef = useRef<HTMLDivElement | null>(null)
  const [orderBy, setOrderBy] = useState<string>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const sizeRanges = [
    { label: "1-10", min: 1, max: 10 },
    { label: "11-50", min: 11, max: 50 },
    { label: "51-200", min: 51, max: 200 },
    { label: "201-500", min: 201, max: 500 },
    { label: "501+", min: 501, max: null },
    { label: "Onbekend", min: 1, max: null }, // min is dummy, wordt niet gebruikt
  ];
  const [sizeRangeFilter, setSizeRangeFilter] = useState("all");
  const [allSources, setAllSources] = useState<{id: string, name: string}[]>([]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [regions, setRegions] = useState<{ id: string, plaats: string, regio_platform: string }[]>([]);
  const [uniqueRegionNames, setUniqueRegionNames] = useState<string[]>([]);
  const [regionCompanyIds, setRegionCompanyIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const { toast } = useToast();

  // Bepaal backend filterwaarden
  const backendFilters: any = {
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm,
    orderBy,
    orderDirection,
    status: statusFilter !== "all" ? statusFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    is_customer: customerFilter === "all" ? undefined : customerFilter === "customers",
    websiteFilter: websiteFilter,
  };
  // Regio
  if (regionFilter !== "all" && regionFilter !== "none") {
    const matchingRegions = regions.filter(r => r.plaats === regionFilter);
    if (matchingRegions.length > 0) {
      backendFilters.regionIds = matchingRegions.map(r => r.id);
    }
  }
  // Grootte
  if (sizeRangeFilter !== "all") {
    const selected = sizeRanges.find(r => r.label === sizeRangeFilter);
    if (selected) {
      if (selected.label === "Onbekend") {
        backendFilters.unknownSize = true;
      } else {
        backendFilters.sizeRange = { min: selected.min, max: selected.max };
      }
    }
  }
  // Vervang fetchCompanies en gerelateerde state
  const {
    data: companiesResult,
    loading,
    error,
    refetch,
  } = useCompaniesCache(backendFilters)
  const companies = companiesResult?.data || []
  const totalCount = companiesResult?.count || 0
  const totalPages = companiesResult?.totalPages || 1

  useEffect(() => {
    const timeoutId = setTimeout(refetch, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchTerm, customerFilter, sourceFilter, currentPage, sizeRangeFilter, regionFilter, statusFilter, websiteFilter])

  useEffect(() => {
    refetch()
  }, [orderBy, orderDirection])

  useEffect(() => {
    // Haal alle mogelijke sources op bij laden
    supabaseService.getCompanySources().then(setAllSources)
  }, [])

  useEffect(() => {
    supabaseService.getRegions().then((allRegions) => {
      setRegions(allRegions)
    })
  }, [])

  // Regiofilter via vacatures (job_postings)
  useEffect(() => {
    if (regionFilter === "all" || regionFilter === "none") {
      setRegionCompanyIds(null);
      return;
    }
    // Zoek alle regio's met deze plaats
    const matchingRegions = regions.filter(r => r.plaats === regionFilter);
    if (matchingRegions.length === 0) {
      setRegionCompanyIds([]);
      return;
    }
    // Haal alle vacatures op met deze regio_id's
    (async () => {
      const regionIds = matchingRegions.map(r => r.id);
      // Haal alle job_postings met deze regio_id's via supabaseService
      let postings: any[] = [];
      try {
        for (const regionId of regionIds) {
          // Gebruik een fetcher via supabaseService
          const result = await supabaseService.getJobPostings({ region_id: regionId, limit: 1000 });
          if (result && result.data) postings.push(...result.data);
        }
      } catch (e) {
        postings = [];
      }
      // Verzamel unieke company_id's
      const companyIds = Array.from(new Set(postings.map(p => p.company_id).filter(Boolean)));
      setRegionCompanyIds(companyIds);
    })();
  }, [regionFilter, regions]);

  const handleCompanyClick = async (company: Company) => {
    try {
      const companyData = await supabaseService.getCompanyDetails(company.id)
      onCompanyClick(companyData)
    } catch (error) {
      console.error("Error fetching company details:", error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Onbekend"
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getCompanySize = (company: Company) => {
    if (company.size_min && company.size_max) {
      return `${company.size_min}-${company.size_max}`
    } else if (company.size_min) {
      return `${company.size_min}+`
    }
    return null
  }

  // Alleen paginering client-side
  const pagedCompanies = companies;
  // Scroll to top on page change
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [currentPage, itemsPerPage])

  console.log('CompaniesTable render', companies);

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  const selectAll = () => {
    if (selected.length === pagedCompanies.length) setSelected([])
    else setSelected(pagedCompanies.map((c: Company) => c.id))
  }

  // In handleBulkStatus, gebruik refetch na update
  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.length === 0) return;
    try {
      const res = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selected, status: bulkStatus }),
      });
      if (res.ok) {
        toast({
          title: "Status bijgewerkt",
          description: (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {`Status gewijzigd voor ${selected.length} bedrijven naar ${bulkStatus}.`}
            </span>
          ),
        });
        setSelected([]);
        setBulkStatus("");
        refetch();
        if (onStatusChange) onStatusChange();
      } else {
        const data = await res.json();
        toast({ title: "Fout bij bijwerken", description: data.error || "Onbekende fout", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Netwerkfout", description: e?.toString() || "Onbekende fout", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters en bulk-actie gegroepeerd */}
      <Card className="mb-6 p-4 border rounded-lg bg-gray-50">
        <div className="flex flex-col md:flex-row md:items-end md:gap-6 gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Zoek op bedrijf of locatie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Bron filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle bronnen</SelectItem>
                {allSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeRangeFilter} onValueChange={setSizeRangeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Grootte filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle groottes</SelectItem>
                {sizeRanges.map((r) => (
                  <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="Prospect">Prospect</SelectItem>
                <SelectItem value="Qualified">Qualified</SelectItem>
                <SelectItem value="Disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Regio filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle regio's</SelectItem>
                <SelectItem value="none">Geen regio</SelectItem>
                {Array.from(new Set(regions.map(r => r.plaats)))
                  .sort((a, b) => a.localeCompare(b, 'nl'))
                  .map((plaats) => (
                    <SelectItem key={plaats} value={plaats}>{plaats}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Website filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle bedrijven</SelectItem>
                <SelectItem value="with">Met website</SelectItem>
                <SelectItem value="without">Zonder website</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600 flex items-center">
              {totalCount > 0 ? `${totalCount} bedrijven gevonden` : "Geen bedrijven gevonden"}
            </div>
          </div>
          {/* Bulk-actie: status-selectie + knop */}
          <div className="flex flex-col gap-2 min-w-[270px]">
            <label className="text-sm font-medium text-gray-700 mb-1">Bedrijven status wijzigen</label>
            <div className="flex gap-2">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="border rounded px-2 py-1 w-44">
                <option value="">Wijzig status naar...</option>
                <option value="Prospect">Prospect</option>
                <option value="Qualified">Qualified</option>
                <option value="Disqualified">Disqualified</option>
              </select>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4"
                disabled={!bulkStatus || selected.length === 0}
                onClick={handleBulkStatus}
                title={selected.length === 0 ? 'Selecteer eerst bedrijven' : !bulkStatus ? 'Selecteer een status' : 'Wijzig status'}
              >
                Wijzig status
              </Button>
            </div>
            <span className="text-xs text-gray-500">
              Selecteer eerst bedrijven en een status.
            </span>
          </div>
        </div>
      </Card>
      {/* Table */}
      <div className="border rounded-lg" ref={tableRef}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input type="checkbox" checked={selected.length === pagedCompanies.length && pagedCompanies.length > 0} onChange={selectAll} aria-label="Selecteer alles" />
              </TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => {
                  if (orderBy === 'job_counts') {
                    setOrderDirection(orderDirection === 'desc' ? 'asc' : 'desc')
                  } else {
                    setOrderBy('job_counts')
                    setOrderDirection('desc')
                  }
                  setCurrentPage(1)
                }}
              >
                Vacatures
                {orderBy !== 'job_counts' && <ArrowUpDown className="inline w-4 h-4 ml-1 text-gray-400" />}
                {orderBy === 'job_counts' && orderDirection === 'asc' && <ChevronUp className="inline w-4 h-4 ml-1 text-gray-600" />}
                {orderBy === 'job_counts' && orderDirection === 'desc' && <ChevronDown className="inline w-4 h-4 ml-1 text-gray-600" />}
              </TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Grootte</TableHead>
              <TableHead>Toegevoegd</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 9 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pagedCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Geen bedrijven gevonden
                </TableCell>
              </TableRow>
            ) : (
              pagedCompanies.map((company: Company) => (
                <TableRow key={company.id} className="hover:bg-orange-50">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      aria-label={`Selecteer bedrijf ${company.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url || "/placeholder.svg"}
                            alt={company.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => handleCompanyClick(company)}
                          className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                        >
                          {company.name}
                        </button>
                        <div className="flex items-center space-x-2 mt-1">
                          {company.is_customer && <Badge className="bg-green-100 text-green-800 text-xs">Klant</Badge>}
                          {company.source_name && (
                            <Badge variant="outline" className="text-xs">
                              {company.source_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        company.status === "Qualified"
                          ? "text-green-800 bg-green-100 border-green-200"
                          : company.status === "Disqualified"
                          ? "text-red-800 bg-red-100 border-red-200"
                          : "text-gray-800 bg-gray-100 border-gray-200"
                      }
                    >
                      {company.status || "Prospect"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {company.website && company.website.trim() !== "" ? (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                        {company.website}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{company.location || "Onbekend"}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{company.job_counts}</span>
                      <span className="text-xs text-gray-500">vacatures</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.rating_indeed ? (
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{company.rating_indeed}</span>
                        {company.review_count_indeed && (
                          <span className="text-xs text-gray-500">({company.review_count_indeed})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Geen rating</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getCompanySize(company) ? (
                      <div className="text-sm">
                        {getCompanySize(company)} <span className="text-gray-500">medewerkers</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Onbekend</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDate(company.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleCompanyClick(company)}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      {company.website && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={company.website} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 text-gray-500" />
                          </a>
                        </Button>
                      )}
                      {company.indeed_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={company.indeed_url} target="_blank" rel="noopener noreferrer">
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

      {/* Pagination Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Pagina {currentPage} van {totalPages} ({totalCount} totaal)
          </span>
          {/* Items per page selector */}
          <label className="ml-4 text-sm text-gray-600">Per pagina:</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            {[10, 15, 30, 50, 100].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        {/* Page number buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }).map((_, idx) => {
            // Show first, last, current, and neighbors; ellipsis for skipped
            const page = idx + 1
            const isCurrent = page === currentPage
            const isEdge = page === 1 || page === totalPages
            const isNear = Math.abs(page - currentPage) <= 1
            if (isEdge || isNear) {
              return (
                <Button
                  key={page}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={isCurrent ? "font-bold" : ""}
                  disabled={isCurrent}
                >
                  {page}
                </Button>
              )
            }
            // Show ellipsis only once before/after current
            if (
              (page === currentPage - 2 && page > 1) ||
              (page === currentPage + 2 && page < totalPages)
            ) {
              return <span key={page} className="px-2 text-gray-400">...</span>
            }
            return null
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
