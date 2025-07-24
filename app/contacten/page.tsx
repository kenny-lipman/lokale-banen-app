"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabaseService } from "@/lib/supabase-service"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useContactsCache } from "@/hooks/use-contacts-cache"
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle, Building2, Users, Crown, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableFilters, TablePagination } from "@/components/ui/table-filters";

interface Contact {
  id: string
  company_id: string | null
  first_name: string | null
  name: string | null
  title: string | null
  email: string | null
  linkedin_url: string | null
  source: string | null
  found_at: string | null
  last_touch: string | null
  created_at: string | null
  companies?: {
    name: string | null
    location: string | null
    size_min?: number
    size_max?: number
    category_size?: string | null
    status?: string | null
  }
  campaign_name?: string | null
  company_status?: string | null
  company_source_name?: string | null
  company_region?: string | null
}

export default function ContactsPage() {
  const { data: contacts, loading, error, refetch } = useContactsCache()
  const [selected, setSelected] = useState<string[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [hoofddomeinFilter, setHoofddomeinFilter] = useState<string>("all")
  const [sizeFilter, setSizeFilter] = useState<string>("all")
  const [instantlyCampaigns, setInstantlyCampaigns] = useState<{ id: string, name: string }[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'with' | 'without'>('all');
  const [regions, setRegions] = useState<{ id: string, plaats: string, regio_platform: string }[]>([]);

  // Helper functions for consistent badge styling
  const getCompanySizeBadge = (size: string | null | undefined) => {
    if (!size) {
      return (
        <Badge variant="outline" className="text-gray-600 text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          Onbekend
        </Badge>
      )
    }
    
    switch (size) {
      case "Groot":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
            <Building2 className="w-3 h-3 mr-1" />
            Groot
          </Badge>
        )
      case "Middel":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
            <Users className="w-3 h-3 mr-1" />
            Middel
          </Badge>
        )
      case "Klein":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            Klein
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-600 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            {size}
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string | null | undefined, isCompanyStatus = false) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-gray-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          {isCompanyStatus ? "Prospect" : "Onbekend"}
        </Badge>
      )
    }

    switch (status.toLowerCase()) {
      case "qualified":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Qualified
          </Badge>
        )
      case "disqualified":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Disqualified
          </Badge>
        )
      case "prospect":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Target className="w-3 h-3 mr-1" />
            Prospect
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [startFilter, setStartFilter] = useState<string>("all");
  const [statusCampagneFilter, setStatusCampagneFilter] = useState<string>("all");
  const [sources, setSources] = useState<{ id: string, name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [addingToCampaign, setAddingToCampaign] = useState(false);
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
  }, [])

  const toggleSelect = (id: string) => {
    // Vind het contact
    const contact = filteredContacts.find((c: Contact) => c.id === id);
    // Alleen selecteren als het contact GEEN campagne heeft
    if (contact && (!contact.campaign_name || contact.campaign_name.trim() === '' || contact.campaign_name === null)) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    }
  }
  const selectAll = () => {
    // Alleen contacten zonder campagne selecteren
    const ids = filteredContacts
      .filter((c: Contact) => !c.campaign_name || c.campaign_name.trim() === '' || c.campaign_name === null)
      .map((c: Contact) => c.id);
    if (selected.length === ids.length) setSelected([]);
    else setSelected(ids);
  }

  const { toast } = useToast();

  const handleAddToCampaign = async () => {
    if (!selectedCampaign || selected.length === 0) return;
    
    // Controleer eerst of alle geselecteerde contacten een email hebben
    const selectedContactsData = filteredContacts.filter((c: Contact) => selected.includes(c.id));
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

  // Filter contacts client-side
  const filteredContacts = (contacts ?? []).filter((c: Contact) => {
    let hoofddomeinOk = true
    let sizeOk = true
    let campaignOk = true;
    let statusOk = true;
    let sourceOk = true;
    let startOk = true;
    let statusCampagneOk = true;
    
    if (hoofddomeinFilter !== "all") {
      if (hoofddomeinFilter === "none") {
        hoofddomeinOk = !c.company_region || c.company_region === '';
      } else {
        hoofddomeinOk = c.company_region === hoofddomeinFilter;
      }
    }
    if (sizeFilter !== "all") {
      // Gebruik category_size in plaats van berekening
      sizeOk = c.companies?.category_size === sizeFilter;
    }
    if (campaignFilter === 'with') campaignOk = Boolean(c.campaign_name && c.campaign_name.trim() !== '' && c.campaign_name !== null);
    if (campaignFilter === 'without') campaignOk = Boolean(!c.campaign_name || c.campaign_name.trim() === '' || c.campaign_name === null);
    if (statusFilter !== "all") statusOk = c.company_status === statusFilter;
    
    // Fix source filtering - check beide company_source_name EN source velden tegen de bronnen lijst
    if (sourceFilter !== "all") {
      const selectedSource = sources.find(s => s.id === sourceFilter);
      if (selectedSource) {
        sourceOk = c.company_source_name === selectedSource.name || c.source === selectedSource.name;
        // Debug logging voor Indeed filtering
        if (selectedSource.name === "Indeed") {
          console.log(`Checking contact ${c.id}: company_source_name="${c.company_source_name}", source="${c.source}", sourceOk=${sourceOk}`);
        }
      } else {
        sourceOk = false;
      }
    }
    

    if (statusCampagneFilter !== "all") statusCampagneOk = c.companies?.status === statusCampagneFilter;
    if (startFilter !== "all") {
      // Filter op basis van company status (als alternatief voor start)
      const statusValue = c.companies?.status;
      if (startFilter === "with") startOk = Boolean(statusValue && statusValue !== "Prospect");
      else if (startFilter === "without") startOk = Boolean(!statusValue || statusValue === "Prospect");
    }
    return hoofddomeinOk && sizeOk && campaignOk && statusOk && sourceOk && startOk && statusCampagneOk
  })

  // Extract unique sizes from contacts using category_size
  const sizes = Array.from(new Set((contacts ?? [])
    .map((c: Contact) => c.companies?.category_size)
    .filter((s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== "")));

  // Statistieken
  const contactsWithCampaign = (contacts ?? []).filter((c: Contact) => c.campaign_name && c.campaign_name.trim() !== '' && c.campaign_name !== null);
  const contactsWithoutCampaign = (contacts ?? []).filter((c: Contact) => !c.campaign_name || c.campaign_name.trim() === '' || c.campaign_name === null);

  // Final bulletproof filter for rendering
  const filteredHoofddomeinen = Array.from(new Set(regions.map((r: { id: string, plaats: string, regio_platform: string }) => r.regio_platform).filter((r: string): r is string => typeof r === "string" && r.trim() !== "")));
  const filteredSizes = (sizes as string[]).filter((s: string) => typeof s === "string" && s.trim() !== "");
  const filteredSources = sources.map(s => s.name).filter((s: string) => typeof s === "string" && s.trim() !== "");
  const statusCampagneOptions = ['Prospect', 'Qualified', 'Disqualified'];

  // Na filtering:
  const totalRows = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const pagedContacts = filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            <div className="text-2xl font-bold">{contactsWithoutCampaign.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacten met campagne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactsWithCampaign.length}</div>
          </CardContent>
        </Card>
      </div>
      {/* Filters en bulk-actie gegroepeerd */}
      <TableFilters
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Zoek contacten op naam, email of bedrijf..."
        totalCount={totalRows}
        resultText="contacten"
        onResetFilters={() => {
          setHoofddomeinFilter("all")
          setSizeFilter("all") 
          setCampaignFilter("all")
          setStatusFilter("all")
          setSourceFilter("all")
          setStatusCampagneFilter("all")
          setStartFilter("all")
          setCurrentPage(1)
        }}
        filters={[
          {
            id: "hoofddomein",
            label: "Regio",
            value: hoofddomeinFilter,
            onValueChange: setHoofddomeinFilter,
            options: [
              { value: "all", label: "Alle regio's" },
              { value: "none", label: "Geen regio" },
              ...filteredHoofddomeinen.map(r => ({ value: r, label: r }))
            ],
            placeholder: "Filter op regio"
          },
          {
            id: "size",
            label: "Bedrijfsgrootte", 
            value: sizeFilter,
            onValueChange: setSizeFilter,
            options: [
              { value: "all", label: "Alle groottes" },
              ...filteredSizes.map(s => ({ value: s, label: s }))
            ],
            placeholder: "Filter op grootte"
          },
          {
            id: "campaign",
            label: "Campagne",
            value: campaignFilter,
            onValueChange: (v: string) => setCampaignFilter(v as 'all' | 'with' | 'without'),
            options: [
              { value: "all", label: "Alle contacten" },
              { value: "without", label: "Zonder campagne" },
              { value: "with", label: "Met campagne" }
            ],
            placeholder: "Filter op campagne"
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
            id: "source",
            label: "Bron",
            value: sourceFilter,
            onValueChange: setSourceFilter,
            options: [
              { value: "all", label: "Alle bronnen" },
              ...sources.map(source => ({ value: source.name, label: source.name }))
            ],
            placeholder: "Filter op bron"
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
          </div>
        }
      />
      <Card className="border rounded-lg">
        <CardHeader>
          <CardTitle>Contactenoverzicht</CardTitle>
          <CardDescription>Alle contacten in de database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={selected.length === filteredContacts.length && filteredContacts.length > 0}
                      onChange={selectAll}
                      aria-label="Selecteer alles"
                    />
                  </TableHead>
                  <TableHead>Hoofddomein</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Grootte</TableHead>
                  <TableHead>Campagne</TableHead>
                  <TableHead>Laatste contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bron</TableHead>
                  <TableHead>Status campagne</TableHead>
                  <TableHead>Start</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : pagedContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                  Geen contacten gevonden.
                </TableCell>
              </TableRow>
                ) : (
                  pagedContacts.map((c: Contact) => (
                    <TableRow key={c.id} className={selected.includes(c.id) ? "bg-orange-50" : undefined}>
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
                      <TableCell>
                        {c.email ? (
                          c.email
                        ) : (
                          <span className="text-red-500 text-sm italic">Geen email</span>
                        )}
                      </TableCell>
                      <TableCell>{c.companies?.name || '-'}</TableCell>
                      <TableCell>
                        {getCompanySizeBadge(c.companies?.category_size)}
                      </TableCell>
                      <TableCell>{c.campaign_name || '-'}</TableCell>
                      <TableCell>{(c.found_at || c.created_at) ? new Date(c.found_at || c.created_at!).toLocaleDateString("nl-NL") : '-'}</TableCell>
                      <TableCell>
                        {getStatusBadge(c.company_status, true)}
                      </TableCell>
                      <TableCell>{c.company_source_name || c.source || '-'}</TableCell>

                      <TableCell>
                        {getStatusBadge(c.companies?.status || "prospect", true)}
                      </TableCell>
                      <TableCell>
                        {c.companies?.status && c.companies.status.toLowerCase() !== "prospect" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {c.companies.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-600">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            -
                          </Badge>
                        )}
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
            onPageChange={setCurrentPage}
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