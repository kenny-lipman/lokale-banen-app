"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabaseService } from "@/lib/supabase-service"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useContactsPaginated, useContactStats } from "@/hooks/use-contacts-paginated"
import { useDebounce } from "@/hooks/use-debounce"
import { ChevronLeft, ChevronRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Building2, Users, Crown, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableFilters, TablePagination } from "@/components/ui/table-filters";

interface Contact {
  id: string
  company_id: string | null
  first_name: string | null
  last_name: string | null
  name: string | null
  title: string | null
  email: string | null
  email_status: string | null
  linkedin_url: string | null
  source: string | null
  found_at: string | null
  last_touch: string | null
  created_at: string | null
  campaign_id: string | null
  campaign_name: string | null
  phone: string | null
  instantly_id: string | null
  apollo_id: string | null
  status: string | null
  company_status: string | null
  // Company data from optimized view
  company_name: string | null
  company_location: string | null
  size_min: number | null
  size_max: number | null
  category_size: string | null
  company_status_field: string | null
  klant_status: string | null
  start: string | null
  website: string | null
  company_phone: string | null
  company_linkedin: string | null
  company_region: string | null
  source_name: string | null
  enrichment_status: string | null
  // Additional fields from job_postings mapping
  region_id: string | null
  source_id: string | null
}

export default function ContactsPage() {
  console.log('ContactsPage: Component rendering...')
  
  const [selected, setSelected] = useState<string[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [selectionScope, setSelectionScope] = useState<'page' | 'all'>('page')
  const [hoofddomeinFilter, setHoofddomeinFilter] = useState<string[]>([])
  const [sizeFilter, setSizeFilter] = useState<string[]>([])
  const [instantlyCampaigns, setInstantlyCampaigns] = useState<{ id: string, name: string }[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string[]>(['all']);
  const [regions, setRegions] = useState<{ id: string, plaats: string, regio_platform: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [startFilter, setStartFilter] = useState<string[]>([]);
  const [statusCampagneFilter, setStatusCampagneFilter] = useState<string[]>([]);
  const [statusBedrijfFilter, setStatusBedrijfFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sources, setSources] = useState<{ id: string, name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [addingToCampaign, setAddingToCampaign] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // State for all available filter options (independent of current filters)
  const [allAvailableSizes, setAllAvailableSizes] = useState<string[]>([]);
  const [allAvailableBedrijfStatuses, setAllAvailableBedrijfStatuses] = useState<string[]>([]);
  const [allAvailableCampagneStatuses, setAllAvailableCampagneStatuses] = useState<string[]>([]);

  // Debounced search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset page to 1 when filters change (additional safety measure)
  useEffect(() => {
    setCurrentPage(1)
  }, [
    JSON.stringify(hoofddomeinFilter),
    JSON.stringify(sizeFilter), 
    JSON.stringify(campaignFilter),
    JSON.stringify(statusFilter),
    JSON.stringify(sourceFilter),
    JSON.stringify(startFilter),
    JSON.stringify(statusCampagneFilter),
    JSON.stringify(statusBedrijfFilter),
    debouncedSearchQuery
  ])

  // Build filters object for server-side pagination
  const filters = {
    search: debouncedSearchQuery,
    hoofddomein: hoofddomeinFilter,
    size: sizeFilter,
    campaign: campaignFilter.length > 0 ? campaignFilter[0] as 'all' | 'with' | 'without' : 'all',
    status: statusFilter,
    source: sourceFilter,
    start: startFilter,
    statusCampagne: statusCampagneFilter,
    statusBedrijf: statusBedrijfFilter,
  }

  const { data: contacts, loading, error, count, totalPages: serverTotalPages, currentPage: actualPage, refetch } = useContactsPaginated(
    currentPage, 
    itemsPerPage, 
    filters,
    (newPage) => setCurrentPage(newPage)
  )

  // Use optimized contact statistics hook
  const { stats: contactStats, loading: statsLoading } = useContactStats()

  // Handler functions for multiple select filters
  const handleHoofddomeinFilterChange = (value: string) => {
    setHoofddomeinFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSizeFilterChange = (value: string) => {
    setSizeFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSourceFilterChange = (value: string) => {
    setSourceFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleStartFilterChange = (value: string) => {
    setStartFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleStatusBedrijfFilterChange = (value: string) => {
    setStatusBedrijfFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleStatusCampagneFilterChange = (value: string) => {
    setStatusCampagneFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleCampaignFilterChange = (value: string) => {
    setCampaignFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  // Helper functions for consistent badge styling
  const getCompanySizeBadge = (size: string | null | undefined) => {
    if (!size) {
      return (
        <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
          <AlertCircle className="w-3 h-3 mr-1" />
          -
        </Badge>
      )
    }
    
    switch (size) {
      case "Groot":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
            <Building2 className="w-3 h-3 mr-1" />
            Groot
          </Badge>
        )
      case "Middel":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-2 py-1">
            <Users className="w-3 h-3 mr-1" />
            Middel
          </Badge>
        )
      case "Klein":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Klein
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            {size}
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string | null | undefined, isCompanyStatus = false) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
          <AlertCircle className="w-3 h-3 mr-1" />
          {isCompanyStatus ? "Prospect" : "-"}
        </Badge>
      )
    }

    switch (status.toLowerCase()) {
      case "qualified":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            Qualified
          </Badge>
        )
      case "disqualified":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs px-2 py-1">
            <XCircle className="w-3 h-3 mr-1" />
            Disqualified
          </Badge>
        )
      case "prospect":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-2 py-1">
            <Target className="w-3 h-3 mr-1" />
            Prospect
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const getEmailStatusBadge = (emailStatus: string | null | undefined) => {
    if (!emailStatus) {
      return (
        <Badge variant="outline" className="text-gray-500 text-xs px-2 py-1 border-gray-300">
          <AlertCircle className="w-3 h-3 mr-1" />
          Onbekend
        </Badge>
      )
    }

    switch (emailStatus.toLowerCase()) {
      case "valid":
      case "verified":
      case "confirmed":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2 py-1 font-medium">
            <CheckCircle className="w-3 h-3 mr-1" />
            Geldig
          </Badge>
        )
      case "invalid":
      case "bounced":
      case "hard_bounce":
      case "soft_bounce":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 text-xs px-2 py-1 font-medium">
            <XCircle className="w-3 h-3 mr-1" />
            Ongeldig
          </Badge>
        )
      case "pending":
      case "checking":
      case "verifying":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-2 py-1 font-medium">
            <AlertCircle className="w-3 h-3 mr-1" />
            In behandeling
          </Badge>
        )
      case "unknown":
      case "unverified":
        return (
          <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Onbekend
          </Badge>
        )
      case "disposable":
      case "temp":
        return (
          <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-2 py-1 font-medium">
            <AlertCircle className="w-3 h-3 mr-1" />
            Tijdelijk
          </Badge>
        )
      case "role":
      case "generic":
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-2 py-1 font-medium">
            <Users className="w-3 h-3 mr-1" />
            Generiek
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-xs px-2 py-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            {emailStatus}
          </Badge>
        )
    }
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
  // Haal Instantly campagnes op via eigen API route
  useEffect(() => {
    async function fetchInstantlyCampaigns() {
      try {
        const res = await fetch("/api/instantly-campaigns");
        if (res.ok) {
          const data = await res.json();
          setInstantlyCampaigns(data.campaigns || []);
        }
      } catch (e) {
        // Foutafhandeling
      }
    }
    fetchInstantlyCampaigns();
  }, []);

  // Haal regio's en bronnen op uit Supabase
  useEffect(() => {
    supabaseService.getRegions().then((data) => {
      setRegions(data || [])
    })
    supabaseService.getCompanySources().then((data) => {
      setSources(data || [])
    })
    // Fetch all available filter options
    supabaseService.getContactFilterOptions().then((data) => {
      setAllAvailableSizes(data.sizes || [])
      setAllAvailableBedrijfStatuses(data.bedrijfStatuses || [])
      setAllAvailableCampagneStatuses(data.campagneStatuses || [])
    })
  }, [])

  const toggleSelect = (id: string) => {
    // Vind het contact
    const contact = uniqueContacts.find((c: Contact) => c.id === id);
    // Alleen selecteren als het contact GEEN campagne heeft
    if (contact && (!contact.campaign_name || contact.campaign_name.trim() === '' || contact.campaign_name === null)) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    }
  }
  const selectPage = () => {
    // Selecteer alleen contacten op de huidige pagina zonder campagne
    const pageIds = getPageAvailableContacts().map((c: Contact) => c.id);
    
    const allPageSelected = pageIds.every((id: string) => selected.includes(id));
    if (allPageSelected) {
      // Deselecteer alle contacten op deze pagina
      setSelected(prev => prev.filter((id: string) => !pageIds.includes(id)));
    } else {
      // Selecteer alle contacten op deze pagina
      setSelected(prev => [...new Set([...prev, ...pageIds])]);
    }
  }

  const selectAll = () => {
    // Selecteer alle contacten zonder campagne (alle pagina's)
    const allIds = getAvailableContacts().map((c: Contact) => c.id);
    
    const allSelected = allIds.every((id: string) => selected.includes(id));
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(allIds);
    }
  }

  const { toast } = useToast();

  // Helper function to get available contacts for selection
  const getAvailableContacts = () => {
    return uniqueContacts.filter((c: Contact) => !c.campaign_name || c.campaign_name.trim() === '' || c.campaign_name === null);
  };

  const getPageAvailableContacts = () => {
    return uniqueContacts.filter((c: Contact) => !c.campaign_name || c.campaign_name.trim() === '' || c.campaign_name === null);
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaign || selected.length === 0) return;
    
    // Controleer eerst of alle geselecteerde contacten een email hebben
    const selectedContactsData = uniqueContacts.filter((c: Contact) => selected.includes(c.id));
    const contactsWithoutEmail = selectedContactsData.filter((c: Contact) => !c.email || c.email.trim() === '');
    
    if (contactsWithoutEmail.length > 0) {
      toast({
        title: "⚠️ Contacten zonder email",
        description: `${contactsWithoutEmail.length} van de ${selected.length} geselecteerde contacten hebben geen email adres. Deze kunnen niet worden toegevoegd aan een campagne.`,
        variant: "destructive",
      });
      return;
    }
    
    // Haal de naam van de geselecteerde campagne op
    const campaignObj = instantlyCampaigns.find((c: { id: string, name: string }) => c.id === selectedCampaign);
    const campaignName = campaignObj ? campaignObj.name : "";
    
    setAddingToCampaign(true);
    
    // Dedupliceer de selected array voor extra zekerheid
    const uniqueContactIds = [...new Set(selected)];
    console.log(`Frontend: Originele selectie: ${selected.length}, na deduplicatie: ${uniqueContactIds.length}`);
    
    // Toon loading toast
    toast({
      title: "Bezig met toevoegen...",
      description: `${uniqueContactIds.length} contacten worden toegevoegd aan "${campaignName}". Dit kan even duren.`,
    });
    
    try {
      
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: uniqueContactIds, campaignId: selectedCampaign, campaignName }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.status === "success").length || 0;
        const errorCount = data.results?.filter((r: any) => r.status === "error").length || 0;
        
        if (successCount > 0 && errorCount === 0) {
          toast({
            title: "Volledig succesvol! ✅",
            description: `Alle ${successCount} contacten zijn succesvol toegevoegd aan "${campaignName}".`,
          });
        } else if (successCount > 0 && errorCount > 0) {
          toast({
            title: "Gedeeltelijk succesvol ⚠️",
            description: `${successCount} contacten toegevoegd, ${errorCount} mislukt. Bekijk de details voor meer informatie.`,
            variant: "destructive",
          });
          
          // Toon details van fouten
          const errors = data.results?.filter((r: any) => r.status === "error") || [];
          if (errors.length > 0) {
            console.log("Fouten bij toevoegen contacten:", errors);
            // Toon eerste paar fouten als extra toast
            const firstErrors = errors.slice(0, 3);
            toast({
              title: "Details van fouten:",
              description: firstErrors.map((err: any) => `• ${err.contactName || 'Contact'}: ${err.error}`).join('\n'),
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Alle contacten mislukt ❌",
            description: data.error || "Alle contacten konden niet worden toegevoegd.",
            variant: "destructive",
          });
        }
        
        // Refresh contactenlijst
        await refetch();
        setSelected([]);
      } else {
        toast({
          title: "Fout bij toevoegen",
          description: data.error || "Er is een onbekende fout opgetreden bij het toevoegen van contacten.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Netwerkfout",
        description: `Er is een netwerkfout opgetreden: ${e?.toString() || "Onbekende fout"}`,
        variant: "destructive",
      });
    } finally {
      setAddingToCampaign(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedStatus || selected.length === 0) return;
    
    setUpdatingStatus(true);
    
    toast({
      title: "Bezig met bijwerken...",
      description: `${selected.length} contacten worden bijgewerkt naar status "${selectedStatus}".`,
    });
    
    try {
      const res = await fetch("/api/contacts/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contactIds: selected, 
          status: selectedStatus 
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Status bijgewerkt! ✅",
          description: `Status van ${selected.length} contacten succesvol bijgewerkt naar "${selectedStatus}".`,
        });
        
        // Refresh contactenlijst
        await refetch();
        setSelected([]);
        setSelectedStatus("");
      } else {
        toast({
          title: "Fout bij bijwerken",
          description: data.error || "Er is een fout opgetreden bij het bijwerken van de status.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Netwerkfout",
        description: `Er is een netwerkfout opgetreden: ${e?.toString() || "Onbekende fout"}`,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Use server-side paginated data directly (no client-side filtering needed)
  const uniqueContacts = contacts || []

  // Optimized computed values with useMemo
  const sizes = useMemo(() => Array.from(new Set(uniqueContacts
    .map((c: Contact) => c.category_size)
    .filter((s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== ""))), [uniqueContacts]);

  // Extract unique status values for bedrijf and campagne
  const bedrijfStatuses = useMemo(() => Array.from(new Set(uniqueContacts
    .map((c: Contact) => c.klant_status)
    .filter((s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== ""))), [uniqueContacts]);

  const campagneStatuses = useMemo(() => Array.from(new Set(uniqueContacts
    .map((c: Contact) => c.company_status_field)
    .filter((s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== ""))), [uniqueContacts]);

  // Final bulletproof filter for rendering
  const filteredHoofddomeinen = useMemo(() => Array.from(new Set(regions.map((r: { id: string, plaats: string, regio_platform: string }) => r.regio_platform).filter((r: string): r is string => typeof r === "string" && r.trim() !== ""))), [regions]);
  const filteredSizes = useMemo(() => (allAvailableSizes as string[]).filter((s: string) => typeof s === "string" && s.trim() !== ""), [allAvailableSizes]);
  const filteredSources = useMemo(() => sources.map(s => s.name).filter((s: string) => typeof s === "string" && s.trim() !== ""), [sources]);
  const filteredBedrijfStatuses = useMemo(() => (allAvailableBedrijfStatuses as string[]).filter((s: string) => typeof s === "string" && s.trim() !== ""), [allAvailableBedrijfStatuses]);
  const filteredCampagneStatuses = useMemo(() => (allAvailableCampagneStatuses as string[]).filter((s: string) => typeof s === "string" && s.trim() !== ""), [allAvailableCampagneStatuses]);

  // Use server-side pagination data
  const totalRows = count || 0;
  const totalPages = serverTotalPages || 1;
  const pagedContacts = uniqueContacts;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Contacten</h1>
        <p className="text-gray-600 mt-2">Overzicht van alle contacten in de database</p>
      </div>
      {/* Statistieken cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Contacten zonder campagne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contactStats ? contactStats.contactsWithoutCampaign : (statsLoading ? '...' : '0')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacten met campagne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contactStats ? contactStats.contactsWithCampaign : (statsLoading ? '...' : '0')}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Filters en bulk-actie gegroepeerd */}
      <TableFilters
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Zoek contacten op naam, email of bedrijf..."
        totalCount={totalRows}
        resultText="contacten"
        onResetFilters={() => {
          setHoofddomeinFilter([])
          setSizeFilter([]) 
          setCampaignFilter(['all'])
          setStatusFilter([])
          setSourceFilter([])
          setStatusCampagneFilter([])
          setStatusBedrijfFilter([])
          setStartFilter([])
          setSearchQuery("")
          setCurrentPage(1)
        }}
        filters={[
          {
            id: "hoofddomein",
            label: "Regio",
            value: hoofddomeinFilter,
            onValueChange: handleHoofddomeinFilterChange,
            options: [
              { value: "none", label: "Geen regio" },
              ...filteredHoofddomeinen.map(r => ({ value: r, label: r }))
            ],
            placeholder: "Filter op regio",
            multiple: true
          },
          {
            id: "size",
            label: "Bedrijfsgrootte", 
            value: sizeFilter,
            onValueChange: handleSizeFilterChange,
            options: [
              ...filteredSizes.map(s => ({ value: s, label: s }))
            ],
            placeholder: "Filter op grootte",
            multiple: true
          },
          {
            id: "campaign",
            label: "Campagne",
            value: campaignFilter,
            onValueChange: handleCampaignFilterChange,
            options: [
              { value: "all", label: "Alle contacten" },
              { value: "without", label: "Zonder campagne" },
              { value: "with", label: "Met campagne" }
            ],
            placeholder: "Filter op campagne",
            multiple: true
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onValueChange: handleStatusFilterChange,
            options: [
              { value: "Prospect", label: "Prospect" },
              { value: "Qualified", label: "Qualified" },
              { value: "Disqualified", label: "Disqualified" }
            ],
            placeholder: "Filter op status",
            multiple: true
          },
          {
            id: "source",
            label: "Bron",
            value: sourceFilter,
            onValueChange: handleSourceFilterChange,
            options: [
              ...sources.map(source => ({ value: source.name, label: source.name }))
            ],
            placeholder: "Filter op bron",
            multiple: true
          },
          {
            id: "start",
            label: "Start",
            value: startFilter,
            onValueChange: handleStartFilterChange,
            options: [
              { value: "Ja", label: "Ja" },
              { value: "Nee", label: "Nee" },
              { value: "On Hold", label: "On Hold" },
              { value: "Onbekend", label: "Onbekend" }
            ],
            placeholder: "Filter op start",
            multiple: true
          },
          {
            id: "statusBedrijf",
            label: "Status Bedrijf",
            value: statusBedrijfFilter,
            onValueChange: handleStatusBedrijfFilterChange,
            options: [
              ...filteredBedrijfStatuses.map(s => ({ value: s, label: s }))
            ],
            placeholder: "Filter op status PH campagne",
            multiple: true
          },
          {
            id: "statusCampagne",
            label: "Status Campagne",
            value: statusCampagneFilter,
            onValueChange: handleStatusCampagneFilterChange,
            options: [
              ...filteredCampagneStatuses.map(s => ({ value: s, label: s }))
            ],
            placeholder: "Filter op PH status bedrijf",
            multiple: true
          }
        ]}
        bulkActions={
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Geselecteerd:</span>
              <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                <Users className="w-3 h-3 mr-1" />
                {selected.length} contacten
              </Badge>
              {selected.length > 0 && (
                <span className="text-xs text-gray-500">
                  ({pagedContacts.filter((c: Contact) => selected.includes(c.id)).length} op deze pagina)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecteer campagne" />
                </SelectTrigger>
                <SelectContent>
                  {instantlyCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                disabled={selected.length === 0 || !selectedCampaign || addingToCampaign}
                onClick={handleAddToCampaign}
                title={
                  addingToCampaign 
                    ? 'Bezig met toevoegen aan campagne...' 
                    : selected.length === 0 
                    ? 'Selecteer eerst contacten zonder campagne' 
                    : !selectedCampaign 
                    ? 'Selecteer een campagne' 
                    : 'Voeg toe aan campagne'
                }
              >
                {addingToCampaign ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Bezig...
                  </>
                ) : (
                  'Voeg toe aan campagne'
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status wijzigen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Disqualified">Disqualified</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                disabled={selected.length === 0 || !selectedStatus || updatingStatus}
                onClick={handleBulkStatusUpdate}
                title={
                  updatingStatus 
                    ? 'Bezig met bijwerken van status...' 
                    : selected.length === 0 
                    ? 'Selecteer eerst contacten' 
                    : !selectedStatus 
                    ? 'Selecteer een status' 
                    : 'Wijzig status'
                }
              >
                {updatingStatus ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Bezig...
                  </>
                ) : (
                  'Wijzig Status'
                )}
              </Button>
            </div>
          </div>
        }
      />
      <Card className="border rounded-lg">
        <CardHeader>
          <CardTitle>Contactenoverzicht</CardTitle>
          <CardDescription>Alle contacten in de database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={getPageAvailableContacts().length > 0 && getPageAvailableContacts()
                          .every((c: Contact) => selected.includes(c.id))}
                        onChange={selectPage}
                        aria-label="Selecteer pagina"
                        className="cursor-pointer"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-4 w-4 p-0 hover:bg-gray-100"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="p-2">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Selectie opties:</div>
                            <div className="space-y-1">
                              <button
                                onClick={selectPage}
                                className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                              >
                                Selecteer pagina ({getPageAvailableContacts().length} contacten)
                              </button>
                              <button
                                onClick={selectAll}
                                className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                              >
                                Selecteer alles ({getAvailableContacts().length} contacten)
                              </button>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead className="w-24">Hoofddomein</TableHead>
                  <TableHead className="w-32">Naam</TableHead>
                  <TableHead className="w-28">Functie</TableHead>
                  <TableHead className="w-40">Email</TableHead>
                  <TableHead className="w-24">Email Status</TableHead>
                  <TableHead className="w-36">Bedrijf</TableHead>
                  <TableHead className="w-20">Verrijkt</TableHead>
                  <TableHead className="w-20">Grootte</TableHead>
                  <TableHead className="w-32">Campagne</TableHead>
                  <TableHead className="w-24">Laatste contact</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20">Bron</TableHead>
                  <TableHead className="w-28">Status campagne</TableHead>
                  <TableHead className="w-20">Start</TableHead>
                  <TableHead className="w-24">Status Bedrijf PH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                            {loading ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : pagedContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                  Geen contacten gevonden.
                </TableCell>
              </TableRow>
                ) : (
                  pagedContacts.map((c: Contact, index: number) => (
                    <TableRow key={`${c.id}-${index}`} className={selected.includes(c.id) ? "bg-orange-50" : undefined}>
                      <TableCell>
                        {Boolean(c.campaign_name && c.campaign_name.trim() !== '' && c.campaign_name !== null) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <input
                                  type="checkbox"
                                  checked={selected.includes(c.id)}
                                  onChange={() => toggleSelect(c.id)}
                                  disabled
                                  aria-label={`Selecteer contact ${c.first_name || c.name || c.email || c.id}`}
                                  style={{ cursor: "not-allowed" }}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              Al toegevoegd aan campagne
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`Selecteer contact ${c.first_name || c.name || c.email || c.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>{c.company_region || '-'}</TableCell>
                      <TableCell>{c.first_name || c.name || '-'}</TableCell>
                      <TableCell>{c.title || '-'}</TableCell>
                      <TableCell>
                        {c.email ? (
                          c.email
                        ) : (
                          <span className="text-red-500 text-sm italic">Geen email</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getEmailStatusBadge(c.email_status)}
                      </TableCell>
                      <TableCell>{c.company_name || '-'}</TableCell>
                      <TableCell>
                        {getEnrichmentStatusBadge(c.enrichment_status)}
                      </TableCell>
                      <TableCell>
                        {c.category_size ? (
                          <Badge 
                            variant="outline" 
                            className={
                              c.category_size === "Groot"
                                ? "text-amber-800 bg-amber-100 border-amber-200 text-xs"
                                : c.category_size === "Middel"
                                ? "text-blue-800 bg-blue-100 border-blue-200 text-xs"
                                : c.category_size === "Klein"
                                ? "text-yellow-800 bg-yellow-100 border-yellow-200 text-xs"
                                : "text-xs"
                            }
                          >
                            {c.category_size}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-400">
                            Onbekend
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.campaign_name || '-'}</TableCell>
                      <TableCell>
                        {c.last_touch ? 
                          new Date(c.last_touch).toLocaleDateString("nl-NL") : 
                          (c.found_at ? new Date(c.found_at).toLocaleDateString("nl-NL") : '-')
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(c.company_status, true)}
                      </TableCell>
                      <TableCell>{c.source_name || c.source || '-'}</TableCell>
                      <TableCell>
                        {getStatusBadge(c.company_status_field, true)}
                      </TableCell>
                      <TableCell>{c.start || '-'}</TableCell>
                      <TableCell>
                        {getStatusBadge(c.klant_status, true)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination Controls */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalRows}
            itemsPerPage={itemsPerPage}
            onPageChange={(newPage: number) => {
              setCurrentPage(newPage)
            }}
            onItemsPerPageChange={(newItemsPerPage: number) => {
              setItemsPerPage(newItemsPerPage)
              setCurrentPage(1)
            }}
            className="mt-4"
          />
        </CardContent>
      </Card>
    </div>
  )
} 