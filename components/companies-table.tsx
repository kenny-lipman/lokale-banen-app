"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Eye, Edit, ExternalLink, Star, Building2, Globe, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle, XCircle, User, Crown, Zap, Sparkles, AlertCircle, Target, Send } from "lucide-react"
import { authFetch } from "@/lib/authenticated-fetch"
import { supabaseService } from "@/lib/supabase-service"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { useCompaniesCache } from "@/hooks/use-companies-cache"
import { TablePagination, TableFilters } from "@/components/ui/table-filters"
import { useCompanySelection } from "@/hooks/use-company-selection"
import { BulkActionBar } from "@/components/bulk-action-bar"
import { useApolloEnrichment } from "@/hooks/use-apollo-enrichment"
import { EnrichmentProgressModal } from "@/components/enrichment-progress-modal"
import { CompanySidebar } from "@/components/company-sidebar"
import { useDebounce } from "@/hooks/use-debounce"
import { TableSkeleton, LoadingSpinner } from "@/components/ui/loading-states"
import { CompanyQualificationActions } from "@/components/company-qualification-actions"
import { CompanyQualificationBulkBar } from "@/components/company-qualification-bulk-bar"

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
  category_size?: string | null // Company size category
  region_id?: string | null; // Added for client-side filtering
  status?: string | null; // Added for bulk status
  apollo_enriched_at?: string | null; // Apollo enrichment timestamp
  apollo_contacts_count?: number | null; // Number of contacts found
  apollo_enrichment_data?: any; // Apollo enrichment data
  last_enrichment_batch_id?: string | null; // Last enrichment batch
  company_region?: string | null; // Added for Hoofddomein column
  enrichment_status?: string | null; // Added for Verrijkt column
  qualification_status?: string | null; // Added for qualification workflow
  qualification_timestamp?: string | null; // Added for qualification workflow
  pipedrive_synced?: boolean | null; // Added for Pipedrive sync status
  pipedrive_synced_at?: string | null; // Added for Pipedrive sync timestamp
  instantly_synced?: boolean | null; // Added for Instantly sync status (derived from contacts)
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

  const [regioPlatformFilter, setRegioPlatformFilter] = useState<string>("all"); // Add regio_platform filter
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const tableRef = useRef<HTMLDivElement | null>(null)
  const [orderBy, setOrderBy] = useState<string>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const [allSources, setAllSources] = useState<{id: string, name: string}[]>([]);
  const [regions, setRegions] = useState<{ id: string, plaats: string, regio_platform: string }[]>([]); // Add regions state
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
    regioPlatformFilter: regioPlatformFilter !== "all" ? regioPlatformFilter : undefined,
  };
  // Enhanced companies cache with optimistic updates
  const {
    data: companiesResult,
    loading,
    error,
    refetch,
    updateCompanyOptimistically,
    updateCompaniesOptimistically,
    revertOptimisticUpdate,
  } = useCompaniesCache(backendFilters)
  const companies = companiesResult?.data || []
  const totalCount = companiesResult?.count || 0
  const totalPages = companiesResult?.totalPages || 1

  // No client-side filtering needed since it's all handled server-side now
  const filteredCompanies = companies;

  // State for all available regio_platform options (loaded from server)
  const [allRegioPlatformOptions, setAllRegioPlatformOptions] = useState<{ value: string; label: string; key: string }[]>([]);
  
  // Qualification state
  const [isQualifying, setIsQualifying] = useState<Set<string>>(new Set())
  const [qualificationSelectedIds, setQualificationSelectedIds] = useState<string[]>([]);

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
    companies: filteredCompanies, // Use filtered companies
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
    isRefreshing,
    startEnrichment,
    closeProgressModal,
    refreshResults
  } = useApolloEnrichment({
    onRefreshData: refetch
  })

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  
  useEffect(() => {
    refetch()
  }, [debouncedSearchTerm, customerFilter, sourceFilter, currentPage, statusFilter, websiteFilter, categorySizeFilter, apolloEnrichedFilter, hasContactsFilter, regioPlatformFilter])

  useEffect(() => {
    refetch()
  }, [orderBy, orderDirection])

  useEffect(() => {
    // Haal alle mogelijke sources op bij laden
    supabaseService.getCompanySources().then(setAllSources)
  }, [])

  useEffect(() => {
    // Haal alle mogelijke regio's op bij laden
    supabaseService.getRegions().then(setRegions)
  }, [])

  useEffect(() => {
    // Haal alle unieke regio_platform waarden op voor hoofddomein filter
    supabaseService.getUniqueRegioPlatforms().then((platforms) => {
      const options = platforms.map((platform, index) => ({
        value: platform,
        label: platform,
        key: `${platform}-${index}`
      }))
      setAllRegioPlatformOptions(options)
    })
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

  const getEnrichmentStatusBadge = (enrichmentStatus: string | null | undefined) => {
    if (!enrichmentStatus) {
      return (
        <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
          <AlertCircle className="w-3 h-3 mr-1" />
          -
        </Badge>
      )
    }

    switch (enrichmentStatus.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs px-2 py-1">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            {enrichmentStatus}
          </Badge>
        )
    }
  }

  const getPipedriveSyncBadge = (synced: boolean | null | undefined, syncedAt: string | null | undefined) => {
    if (synced === true) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
          <CheckCircle className="w-3 h-3 mr-1" />
          Gesynct
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
        <XCircle className="w-3 h-3 mr-1" />
        Niet gesynct
      </Badge>
    )
  }

  const getInstantlySyncBadge = (synced: boolean | null | undefined) => {
    if (synced === true) {
      return (
        <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-xs px-2 py-1">
          <Send className="w-3 h-3 mr-1" />
          In Instantly
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
        <XCircle className="w-3 h-3 mr-1" />
        -
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

  // Company qualification functions with optimistic updates
  const qualifyCompany = async (companyId: string, status: 'qualified' | 'disqualified' | 'review') => {
    setIsQualifying(prev => new Set(prev).add(companyId))
    
    try {
      // 1. OPTIMISTIC UPDATE: Update UI immediately
      updateCompanyOptimistically(companyId, {
        qualification_status: status,
        qualification_timestamp: new Date().toISOString()
      });

      // 2. API CALL: Send to backend
      const response = await authFetch('/api/companies/qualify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          qualification_status: status
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Company qualification API error:', response.status, errorText)
        
        // Revert optimistic update on error
        revertOptimisticUpdate();
        throw new Error(`Failed to update company qualification: ${response.status}`)
      }

      // 3. SUCCESS: Show feedback (UI already updated!)
      toast({
        title: "Company qualification updated",
        description: `Company ${status === 'qualified' ? 'qualified' : status === 'disqualified' ? 'disqualified' : 'marked for review'} successfully`,
      })

      // Background sync to ensure consistency
      setTimeout(() => refetch(), 1000);

    } catch (error) {
      console.error('Error qualifying company:', error)
      toast({
        title: "Error updating qualification",
        description: error instanceof Error ? error.message : "Failed to update company qualification",
        variant: "destructive",
      })
    } finally {
      setIsQualifying(prev => {
        const next = new Set(prev)
        next.delete(companyId)
        return next
      })
    }
  }

  // Bulk qualification function with optimistic updates
  const bulkQualifyCompanies = async (status: 'qualified' | 'disqualified' | 'review') => {
    if (qualificationSelectedIds.length === 0) return

    const companyIds = qualificationSelectedIds
    companyIds.forEach(id => setIsQualifying(prev => new Set(prev).add(id)))

    try {
      // 1. OPTIMISTIC UPDATE: Update UI immediately
      updateCompaniesOptimistically(companyIds, {
        qualification_status: status,
        qualification_timestamp: new Date().toISOString()
      });

      // 2. API CALL: Send to backend
      const response = await authFetch('/api/companies/qualify', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyIds,
          qualification_status: status
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Bulk company qualification API error:', response.status, errorText)
        
        // Revert optimistic update on error
        revertOptimisticUpdate();
        throw new Error(`Failed to bulk update company qualifications: ${response.status}`)
      }

      // 3. SUCCESS: Show feedback (UI already updated!)
      toast({
        title: "Bulk qualification updated",
        description: `${companyIds.length} companies ${status === 'qualified' ? 'qualified' : status === 'disqualified' ? 'disqualified' : 'marked for review'} successfully`,
      })

      // Clear selection after successful update
      setQualificationSelectedIds([])

      // Background sync to ensure consistency
      setTimeout(() => refetch(), 1000);

    } catch (error) {
      console.error('Error bulk qualifying companies:', error)
      toast({
        title: "Error updating qualifications",
        description: "Failed to update company qualifications",
        variant: "destructive",
      })
    } finally {
      // Clear all qualifying states
      companyIds.forEach(id => {
        setIsQualifying(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
    }
  }

  // Qualification selection handlers
  const toggleQualificationSelection = (companyId: string) => {
    setQualificationSelectedIds(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  const selectAllForQualification = () => {
    const allIds = filteredCompanies.map(company => company.id)
    setQualificationSelectedIds(
      qualificationSelectedIds.length === allIds.length ? [] : allIds
    )
  }

  const clearQualificationSelection = () => {
    setQualificationSelectedIds([])
  }

  // No client-side pagination needed since server handles it
  const pagedCompanies = filteredCompanies;
  // Scroll to top on page change
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [currentPage, itemsPerPage])

  console.log('CompaniesTable render', companies);

  // Selection functions now provided by useCompanySelection hook

  // Optimistic UI update for bulk status changes
  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedCount === 0) return;
    
    const selectedCompanyIds = selectedIds;
    
    try {
      // 1. OPTIMISTIC UPDATE: Update UI immediately without page refresh
      updateCompaniesOptimistically(selectedCompanyIds, { status: bulkStatus });
      
      // 2. API CALL: Send to backend
      const res = await authFetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selectedCompanyIds, status: bulkStatus }),
      });
      
      if (res.ok) {
        const result = await res.json();
        
        // 3. SUCCESS: Show feedback, clear selection (scroll position preserved!)
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
        
        // Background sync (optional - UI already updated)
        setTimeout(() => refetch(), 1000);
        if (onStatusChange) onStatusChange();
        
      } else {
        // 4. ERROR: Revert optimistic update and show error
        const data = await res.json();
        revertOptimisticUpdate(); // Rollback UI changes
        
        toast({ 
          title: "Fout bij bijwerken", 
          description: data.error || "Onbekende fout", 
          variant: "destructive" 
        });
      }
    } catch (e) {
      // 5. NETWORK ERROR: Revert and show error
      revertOptimisticUpdate(); // Rollback UI changes
      
      toast({ 
        title: "Netwerkfout", 
        description: e?.toString() || "Onbekende fout", 
        variant: "destructive" 
      });
    }
  }

  // Apollo enrichment handler - now supports companies with and without websites
  const handleApolloEnrichment = async () => {
    try {
      const payload = getApolloPayload()
      const enrichableCompanies = payload.companies.map(c => ({
        id: c.id,
        name: companies.find((comp: Company) => comp.id === c.id)?.name || 'Unknown',
        website: c.website || '', // Include companies without websites
        location: companies.find((comp: Company) => comp.id === c.id)?.location || null,
        region_id: companies.find((comp: Company) => comp.id === c.id)?.region_id
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

      {/* Filters using TableFilters component for consistent styling */}
      <TableFilters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Zoek op bedrijf of locatie..."
        totalCount={totalCount}
        resultText="bedrijven"
        onResetFilters={() => {
          setSearchTerm("")
          setCustomerFilter("all")
          setSourceFilter("all")
          setRegioPlatformFilter("all")
          setStatusFilter("all")
          setWebsiteFilter("all")
          setCategorySizeFilter("all")
          setApolloEnrichedFilter("all")
          setHasContactsFilter("all")
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
              ...allSources.map((s) => ({ value: s.id, label: s.name }))
            ],
            placeholder: "Filter op bron"
          },
          {
            id: "categorySize",
            label: "Grootte",
            value: categorySizeFilter,
            onValueChange: setCategorySizeFilter,
            options: [
              { value: "all", label: "Alle groottes" },
              { value: "Klein", label: "Klein" },
              { value: "Middel", label: "Middel" },
              { value: "Groot", label: "Groot" },
              { value: "Onbekend", label: "Onbekend" }
            ],
            placeholder: "Filter op grootte"
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onValueChange: setStatusFilter,
            options: [
              { value: "all", label: "Alle statussen" },
              { value: "Prospect", label: "Prospect" },
              { value: "Qualified", label: "Qualified" },
              { value: "Disqualified", label: "Disqualified" }
            ],
            placeholder: "Filter op status"
          },
          {
            id: "apolloEnriched",
            label: "Apollo",
            value: apolloEnrichedFilter,
            onValueChange: setApolloEnrichedFilter,
            options: [
              { value: "all", label: "Verrijkt met Apollo" },
              { value: "enriched", label: "Verrijkt" },
              { value: "not_enriched", label: "Niet verrijkt" }
            ],
            placeholder: "Filter op Apollo"
          },
          {
            id: "hasContacts",
            label: "Contacten",
            value: hasContactsFilter,
            onValueChange: setHasContactsFilter,
            options: [
              { value: "all", label: "Contacten" },
              { value: "with_contacts", label: "Met contacten" },
              { value: "no_contacts", label: "Zonder contacten" }
            ],
            placeholder: "Filter op contacten"
          },
          {
            id: "website",
            label: "Website",
            value: websiteFilter,
            onValueChange: setWebsiteFilter,
            options: [
              { value: "all", label: "Website" },
              { value: "with", label: "Met website" },
              { value: "without", label: "Zonder website" }
            ],
            placeholder: "Filter op website"
          },

                      {
              id: "regioPlatform",
              label: "Hoofddomein",
              value: regioPlatformFilter,
              onValueChange: setRegioPlatformFilter,
              options: [
                { value: "all", label: "Alle hoofddomeinen" },
                { value: "none", label: "Geen hoofddomein" },
                ...allRegioPlatformOptions
              ],
              placeholder: "Filter op hoofddomein"
            }
        ]}
        bulkActions={
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Wijzig status naar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Disqualified">Disqualified</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                disabled={!bulkStatus || selectedCount === 0}
                onClick={handleBulkStatus}
                title={selectedCount === 0 ? 'Selecteer eerst bedrijven' : !bulkStatus ? 'Selecteer een status' : 'Wijzig status'}
              >
                Wijzig status
              </Button>
            </div>
          </div>
        }
      />
      
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

      {/* Company Qualification Bulk Bar */}
      <CompanyQualificationBulkBar
        selectedCount={qualificationSelectedIds.length}
        onQualify={bulkQualifyCompanies}
        onClearSelection={clearQualificationSelection}
        isQualifying={Array.from(isQualifying).some(id => qualificationSelectedIds.includes(id))}
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
              <TableHead>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={qualificationSelectedIds.length === filteredCompanies.length && filteredCompanies.length > 0} 
                    onChange={selectAllForQualification} 
                    aria-label="Selecteer alles voor qualification" 
                  />
                  <div className="flex items-center gap-1 text-xs text-green-600" title="Qualification selectie">
                    <Target className="w-3 h-3" />
                  </div>
                </div>
              </TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead className="w-[180px]">Website</TableHead>
              <TableHead>Hoofddomein</TableHead>
              <TableHead>Verrijkt</TableHead>
              <TableHead>Pipedrive</TableHead>
              <TableHead>Instantly</TableHead>
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
              <>
                <TableSkeleton rows={8} columns={12} />
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-4 text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Bedrijven laden... ({totalCount.toLocaleString('nl-NL')} totaal)</span>
                    </div>
                  </TableCell>
                </TableRow>
              </>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-red-500">
                  <div className="flex flex-col items-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <span>Fout bij het laden van bedrijven</span>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Opnieuw proberen
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : pagedCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
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
                      disabled={company.apollo_enriched_at !== null} // Disable selection if already enriched
                      aria-label={`Selecteer bedrijf ${company.name}`}
                      className={`${company.apollo_enriched_at ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={company.apollo_enriched_at ? 'Dit bedrijf is al verrijkt met Apollo' : `Selecteer bedrijf ${company.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={qualificationSelectedIds.includes(company.id)}
                      onChange={() => toggleQualificationSelection(company.id)}
                      aria-label={`Selecteer bedrijf ${company.name} voor qualification`}
                      title={`Selecteer bedrijf ${company.name} voor qualification`}
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
                    <CompanyQualificationActions
                      company={company}
                      isQualifying={isQualifying.has(company.id)}
                      onQualify={qualifyCompany}
                      size="sm"
                      className="min-w-[200px]"
                    />
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {company.website && company.website.trim() !== "" ? (
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline block truncate"
                        title={company.website}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{company.company_region || "-"}</TableCell>
                  <TableCell>
                    {getEnrichmentStatusBadge(company.enrichment_status)}
                  </TableCell>
                  <TableCell>
                    {getPipedriveSyncBadge(company.pipedrive_synced, company.pipedrive_synced_at)}
                  </TableCell>
                  <TableCell>
                    {getInstantlySyncBadge(company.instantly_synced)}
                  </TableCell>
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
                          <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">
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
        onRefresh={refreshResults}
        isRefreshing={isRefreshing}
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
