"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Eye, Edit, ExternalLink, Star, Building2, Globe, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle, XCircle, User, Crown, Zap, Sparkles } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { useCompaniesCache } from "@/hooks/use-companies-cache"
import { TablePagination } from "@/components/ui/table-filters"
import { useCompanySelection } from "@/hooks/use-company-selection"
import { BulkActionBar } from "@/components/bulk-action-bar"
import { useApolloEnrichment } from "@/hooks/use-apollo-enrichment"
import { EnrichmentProgressModal } from "@/components/enrichment-progress-modal"
import { CompanySidebar } from "@/components/company-sidebar"
import { useDebounce } from "@/hooks/use-debounce"
import { TableSkeleton, LoadingSpinner } from "@/components/ui/loading-states"

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
  contact_count: number // Contact count from contacts table
  postal_code?: string | null // Postal code field
  category_size?: string | null // Company size category
  region_id?: string | null; // Added for client-side filtering
  status?: string | null; // Added for bulk status
  apollo_enriched_at?: string | null; // Apollo enrichment timestamp
  apollo_contacts_count?: number | null; // Number of contacts found
  apollo_enrichment_data?: any; // Apollo enrichment data
  last_enrichment_batch_id?: string | null; // Last enrichment batch
}

interface CompaniesTableProps {
  onCompanyClick: (company: any) => void
  onStatusChange?: () => void
}

export function CompaniesTable({ onCompanyClick, onStatusChange }: CompaniesTableProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const tableRef = useRef<HTMLDivElement | null>(null)
  const [orderBy, setOrderBy] = useState<string>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const [allSources, setAllSources] = useState<{id: string, name: string}[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const [categorySizeFilter, setCategorySizeFilter] = useState<string>("all");
  const [apolloEnrichedFilter, setApolloEnrichedFilter] = useState<string>("all");
  const [hasContactsFilter, setHasContactsFilter] = useState<string>("all");
  
  // Company sidebar state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
    categorySize: categorySizeFilter !== "all" ? categorySizeFilter : undefined,
    apolloEnriched: apolloEnrichedFilter !== "all" ? apolloEnrichedFilter : undefined,
    hasContacts: hasContactsFilter !== "all" ? hasContactsFilter : undefined,
  };
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

  // Enhanced company selection with Apollo enrichment support
  const {
    selectedIds,
    selectedCount,
    enrichableCount,
    toggleSelection,
    selectAll,
    clearSelection,
    isAllSelected,
    canEnrich,
    exceedsBatchLimit,
    getValidationMessage,
    getApolloPayload
  } = useCompanySelection({
    companies,
    maxBatchSize: 100,
    onSelectionChange: (selectedIds) => {
      // Optional: Handle selection changes
      console.log(`Selected ${selectedIds.length} companies`)
    }
  })

  // Apollo enrichment management
  const {
    isEnriching,
    enrichmentJobs,
    showProgressModal,
    startEnrichment,
    closeProgressModal
  } = useApolloEnrichment({
    onRefreshData: refetch
  })

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  
  useEffect(() => {
    refetch()
  }, [debouncedSearchTerm, customerFilter, sourceFilter, currentPage, statusFilter, websiteFilter, categorySizeFilter, apolloEnrichedFilter, hasContactsFilter])

  useEffect(() => {
    refetch()
  }, [orderBy, orderDirection])

  useEffect(() => {
    // Haal alle mogelijke sources op bij laden
    supabaseService.getCompanySources().then(setAllSources)
  }, [])





  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Onbekend"
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getCompanySizeBadge = (company: Company) => {
    // Use category_size field from Supabase
    const categorySize = (company as any).category_size?.trim() || 'Onbekend'
    
    // Define badge variants and colors for each size category
    const getBadgeProps = (size: string) => {
      switch (size) {
        case 'Klein':
          return {
            variant: 'secondary' as const,
            className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
          }
        case 'Middel':
          return {
            variant: 'secondary' as const,
            className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
          }
        case 'Groot':
          return {
            variant: 'secondary' as const,
            className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200'
          }
        case 'Onbekend':
        default:
          return {
            variant: 'outline' as const,
            className: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }
      }
    }

    const badgeProps = getBadgeProps(categorySize)
    
    return (
      <Badge 
        variant={badgeProps.variant}
        className={`text-xs font-medium ${badgeProps.className}`}
      >
        {categorySize}
      </Badge>
    )
  }

  // Navigate to contacts page filtered by company
  const handleContactsClick = (companyId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row selection
    router.push(`/contacten?company=${companyId}`)
  }

  // Open company sidebar
  const handleCompanySidebarClick = (company: Company, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row selection
    setSelectedCompany(company)
    setIsSidebarOpen(true)
  }

  // Close company sidebar
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    setSelectedCompany(null)
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

  // Selection functions now provided by useCompanySelection hook

  // In handleBulkStatus, gebruik refetch na update
  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedCount === 0) return;
    try {
      const res = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selectedIds, status: bulkStatus }),
      });
      if (res.ok) {
        toast({
          title: "Status bijgewerkt",
          description: (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {`Status gewijzigd voor ${selectedCount} bedrijven naar ${bulkStatus}.`}
            </span>
          ),
        });
        clearSelection();
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

  // Apollo enrichment handler - now supports companies with and without websites
  const handleApolloEnrichment = async () => {
    try {
      const payload = getApolloPayload()
      const enrichableCompanies = payload.companies.map(c => ({
        id: c.id,
        name: companies.find((comp: Company) => comp.id === c.id)?.name || 'Unknown',
        website: c.website || '' // Include companies without websites
      }))
      
      await startEnrichment(enrichableCompanies)
      clearSelection() // Clear selection after starting enrichment
    } catch (error) {
      console.error("Failed to start enrichment:", error)
      toast({
        title: "Fout bij starten enrichment",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Apollo Enrichment Feature Banner */}
      <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  Apollo Bedrijfsverrijking
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </h3>
                <p className="text-sm text-gray-600">
                  Selecteer bedrijven en verrijk ze automatisch met contactgegevens en bedrijfsinformatie
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
              <Zap className="w-4 h-4" />
              Beschikbaar
            </div>
          </div>
        </div>
      </Card>

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
              {loading && searchTerm && (
                <LoadingSpinner 
                  size="sm" 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2" 
                />
              )}
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
            <Select value={categorySizeFilter} onValueChange={setCategorySizeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Grootte filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle groottes</SelectItem>
                <SelectItem value="Klein">Klein</SelectItem>
                <SelectItem value="Middel">Middel</SelectItem>
                <SelectItem value="Groot">Groot</SelectItem>
                <SelectItem value="Onbekend">Onbekend</SelectItem>
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
            <Select value={apolloEnrichedFilter} onValueChange={setApolloEnrichedFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Apollo filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Verrijkt met Apollo</SelectItem>
                <SelectItem value="enriched">Verrijkt</SelectItem>
                <SelectItem value="not_enriched">Niet verrijkt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hasContactsFilter} onValueChange={setHasContactsFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Contacten filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Contacten</SelectItem>
                <SelectItem value="with_contacts">Met contacten</SelectItem>
                <SelectItem value="no_contacts">Zonder contacten</SelectItem>
              </SelectContent>
            </Select>
            <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Website filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Website</SelectItem>
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
                disabled={!bulkStatus || selectedCount === 0}
                onClick={handleBulkStatus}
                title={selectedCount === 0 ? 'Selecteer eerst bedrijven' : !bulkStatus ? 'Selecteer een status' : 'Wijzig status'}
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
      
      {/* Apollo Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        enrichableCount={enrichableCount}
        exceedsBatchLimit={exceedsBatchLimit}
        canEnrich={canEnrich}
        isEnriching={isEnriching}
        validationMessage={getValidationMessage()}
        onEnrichClick={handleApolloEnrichment}
        onClearSelection={clearSelection}
      />
      
      {/* Table */}
      <div className="border rounded-lg" ref={tableRef}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isAllSelected} onChange={selectAll} aria-label="Selecteer alles" />
                  <div className="flex items-center gap-1 text-xs text-blue-600" title="Apollo enrichment beschikbaar voor geselecteerde bedrijven">
                    <Zap className="w-3 h-3" />
                  </div>
                </div>
              </TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => {
                  if (orderBy === 'contact_count') {
                    setOrderDirection(orderDirection === 'desc' ? 'asc' : 'desc')
                  } else {
                    setOrderBy('contact_count')
                    setOrderDirection('desc')
                  }
                  setCurrentPage(1)
                }}
              >
                Contacten
                {orderBy !== 'contact_count' && <ArrowUpDown className="inline w-4 h-4 ml-1 text-gray-400" />}
                {orderBy === 'contact_count' && orderDirection === 'asc' && <ChevronUp className="inline w-4 h-4 ml-1 text-gray-600" />}
                {orderBy === 'contact_count' && orderDirection === 'desc' && <ChevronDown className="inline w-4 h-4 ml-1 text-gray-600" />}
              </TableHead>
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
              <TableHead>Grootte</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={8} columns={9} />
            ) : pagedCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Geen bedrijven gevonden
                </TableCell>
              </TableRow>
            ) : (
              pagedCompanies.map((company: Company) => (
                <TableRow key={company.id} className={`hover:bg-orange-50 transition-colors ${
                  selectedIds.includes(company.id) 
                    ? 'bg-orange-50 border-l-4 border-l-orange-500' 
                    : ''
                }`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(company.id)}
                      onChange={() => toggleSelection(company.id)}
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
                          onClick={(e) => handleCompanySidebarClick(company, e)}
                          className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                        >
                          {company.name}
                        </button>
                        <div className="flex items-center space-x-2 mt-1">
                                                  {company.is_customer && (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Klant
                          </Badge>
                        )}
                        {/* Apollo Enrichment Status Indicator */}
                        {company.apollo_enriched_at && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs" title={`Apollo verrijkt: ${new Date(company.apollo_enriched_at).toLocaleDateString()}`}>
                            <Zap className="w-3 h-3 mr-1" />
                            Apollo
                            {company.apollo_contacts_count && company.apollo_contacts_count > 0 && (
                              <span className="ml-1">({company.apollo_contacts_count})</span>
                            )}
                          </Badge>
                        )}
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
                  <TableCell className="text-sm">{company.postal_code || "-"}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-1 text-left justify-start"
                      onClick={(e) => handleContactsClick(company.id, e)}
                    >
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">{company.contact_count}</span>
                        <span className="text-xs text-gray-500">contacten</span>
                      </div>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{company.job_counts}</span>
                      <span className="text-xs text-gray-500">vacatures</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getCompanySizeBadge(company)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm" onClick={(e) => handleCompanySidebarClick(company, e)}>
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

      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(items) => {
          setItemsPerPage(items)
          setCurrentPage(1)
        }}
      />

      {/* Apollo Enrichment Progress Modal */}
      <EnrichmentProgressModal
        isOpen={showProgressModal}
        onClose={closeProgressModal}
        jobs={enrichmentJobs}
        onComplete={() => {
          // Additional completion actions if needed
          console.log("Enrichment completed, table will refresh")
        }}
      />

      {/* Company Details Sidebar */}
      <CompanySidebar
        company={selectedCompany}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </div>
  )
}
