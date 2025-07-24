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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
      <Card className="mb-6 p-4 border rounded-lg bg-gray-50">
        <div className="flex flex-col md:flex-row md:items-end md:gap-6 gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 flex-1">
            <Select value={hoofddomeinFilter} onValueChange={setHoofddomeinFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op hoofddomein" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle hoofddomeinen</SelectItem>
                <SelectItem value="none">Geen hoofddomein</SelectItem>
                {filteredHoofddomeinen.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op grootte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle groottes</SelectItem>
                {filteredSizes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={v => setCampaignFilter(v as 'all' | 'with' | 'without')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op campagne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle contacten</SelectItem>
                <SelectItem value="without">Zonder campagne</SelectItem>
                <SelectItem value="with">Met campagne</SelectItem>
              </SelectContent>
            </Select>
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="Prospect">Prospect</SelectItem>
                <SelectItem value="Qualified">Qualified</SelectItem>
                <SelectItem value="Disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
            {/* Bron filter */}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op bron" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle bronnen</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.name}>{source.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Campagne filter */}
            <Select value={statusCampagneFilter} onValueChange={setStatusCampagneFilter}>
              <SelectTrigger className="w-48">"
                <SelectValue placeholder="Status campagne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {statusCampagneOptions.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Start filter */}
            <Select value={startFilter} onValueChange={setStartFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Start" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="with">Met start waarde</SelectItem>
                <SelectItem value="without">Zonder start waarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Bulk-actie: campagne-selectie + knop */}
          <div className="flex flex-col gap-2 min-w-[270px]">
            <label className="text-sm font-medium text-gray-700 mb-1">Contacten toevoegen aan campagne</label>
            <div className="flex gap-2">
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
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4"
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
                    Bezig met toevoegen...
                  </>
                ) : (
                  'Voeg toe aan campagne'
                )}
              </Button>
            </div>
            <span className="text-xs text-gray-500">
              Selecteer eerst contacten en een campagne om toe te voegen.
            </span>
          </div>
        </div>
      </Card>
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
                        {c.companies?.category_size ? (
                          <Badge 
                            variant="outline" 
                            className={
                              c.companies.category_size === "Groot"
                                ? "text-amber-800 bg-amber-100 border-amber-200 text-xs"
                                : c.companies.category_size === "Middel"
                                ? "text-blue-800 bg-blue-100 border-blue-200 text-xs"
                                : c.companies.category_size === "Klein"
                                ? "text-yellow-800 bg-yellow-100 border-yellow-200 text-xs"
                                : "text-xs"
                            }
                          >
                            {c.companies.category_size}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-400">
                            Onbekend
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.campaign_name || '-'}</TableCell>
                      <TableCell>{(c.found_at || c.created_at) ? new Date(c.found_at || c.created_at!).toLocaleDateString("nl-NL") : '-'}</TableCell>
                      <TableCell>
                        {c.company_status ? (
                          <Badge
                            variant="outline"
                            className={
                              c.company_status === "Qualified"
                                ? "text-green-800 bg-green-100 border-green-200"
                                : c.company_status === "Disqualified"
                                ? "text-red-800 bg-red-100 border-red-200"
                                : "text-gray-800 bg-gray-100 border-gray-200"
                            }
                          >
                            {c.company_status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">
                            -
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.company_source_name || c.source || '-'}</TableCell>

                      <TableCell>
                        {c.companies?.status ? (
                          <Badge
                            variant="outline"
                            className={
                              c.companies.status === "Qualified"
                                ? "text-green-800 bg-green-100 border-green-200"
                                : c.companies.status === "Disqualified"
                                ? "text-red-800 bg-red-100 border-red-200"
                                : "text-gray-800 bg-gray-100 border-gray-200"
                            }
                          >
                            {c.companies.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">
                            Prospect
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.companies?.status && c.companies.status !== "Prospect" ? (
                          <Badge variant="outline" className="text-xs">
                            {c.companies.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-400">
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Pagina {currentPage} van {totalPages} ({totalRows} totaal)
              </span>
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
        </CardContent>
      </Card>
    </div>
  )
} 