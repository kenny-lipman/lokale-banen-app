"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Search, Users, Target, Edit, CheckCircle, Clock, AlertCircle, Building2, RotateCcw, X, MapPin, Sparkles, Edit3 } from "lucide-react"
import { useContactsPaginated } from "@/hooks/use-contacts-paginated"
import { useDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/hooks/use-toast"
import { MultiSelect } from "@/components/ui/multi-select"
import { useRecommendedPlatform } from "@/hooks/use-recommended-platform"
import { EditContactModal } from "@/components/contacts/edit-contact-modal"
import { ColumnVisibilityToggle, ColumnVisibility } from "@/components/contacts/column-visibility-toggle"
import { formatDutchPhone } from "@/lib/validators/contact"
import { TableCellWithTooltip } from "@/components/ui/table-cell-with-tooltip"

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  email_status: string | null
  source: string | null
  companies_name: string | null
  companies_size: string | null
  companies_status: string | null
  companies_start: string | null
  qualification_status: string | null
  linkedin_url: string | null
  created_at: string | null
  campaign_name: string | null
  company_status: string | null
  status: string | null
  in_campaign?: boolean
  company_id: string
}

interface Campaign {
  id: string
  name: string
  status: string
}

// Campaign status mapping from OTIS enhanced page
const CAMPAIGN_STATUS_MAP = {
  '0': { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  '1': { label: 'Active', color: 'bg-green-100 text-green-800', icon: '✅' },
  '2': { label: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: '⏸️' },
  '3': { label: 'Completed', color: 'bg-blue-100 text-blue-800', icon: '🏁' },
  '4': { label: 'Running Subsequences', color: 'bg-purple-100 text-purple-800', icon: '🔄' },
  '-99': { label: 'Account Suspended', color: 'bg-red-100 text-red-800', icon: '🚫' },
  '-1': { label: 'Accounts Unhealthy', color: 'bg-orange-100 text-orange-800', icon: '⚠️' },
  '-2': { label: 'Bounce Protect', color: 'bg-red-100 text-red-800', icon: '🛡️' }
}

const getEmailStatusBadge = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'valid':
    case 'verified':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0" title="Valid">✅</Badge>
    case 'invalid':
    case 'bounced':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs px-1 py-0" title="Invalid">❌</Badge>
    case 'risky':
    case 'catch_all':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs px-1 py-0" title="Risky">⚠️</Badge>
    case 'unknown':
    case 'accept_all':
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-1 py-0" title="Unknown">❓</Badge>
    case 'disposable':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs px-1 py-0" title="Disposable">🗑️</Badge>
    default:
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-1 py-0" title="Unknown">❓</Badge>
  }
}

const getQualificationStatusBadge = (status: string | null) => {
  switch (status) {
    case 'in_campaign':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0" title="In Campaign">🎯</Badge>
    case 'qualified':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0" title="Qualified">✅</Badge>
    case 'disqualified':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs px-1 py-0" title="Disqualified">❌</Badge>
    case 'review':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs px-1 py-0 animate-pulse" title="Review">⭕</Badge>
    case 'pending':
    default:
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-1 py-0" title="Pending">⏳</Badge>
  }
}

const getCompanySizeBadge = (size: string | null) => {
  switch (size?.toLowerCase()) {
    case 'groot':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs px-1 py-0" title="Groot">🏢</Badge>
    case 'middel':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0" title="Middel">🏬</Badge>
    case 'klein':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0" title="Klein">🏪</Badge>
    default:
      return size ? (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs px-1 py-0" title={size}>
          {size.charAt(0).toUpperCase()}
        </Badge>
      ) : (
        <span className="text-gray-400 text-xs">-</span>
      )
  }
}

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [inCampaignFilter, setInCampaignFilter] = useState<string>("all")
  const [hasEmailFilter, setHasEmailFilter] = useState<string>("all")
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string[]>([])
  const [companyStartFilter, setCompanyStartFilter] = useState<string[]>([])
  const [companySizeFilter, setCompanySizeFilter] = useState<string[]>([])
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  
  // Selection state
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set())
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  
  // Modal states
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isQualificationModalOpen, setIsQualificationModalOpen] = useState(false)
  const [selectedQualificationStatus, setSelectedQualificationStatus] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Edit contact modal state
  const [editContactModal, setEditContactModal] = useState<{
    isOpen: boolean
    contact: Contact | null
  }>({ isOpen: false, contact: null })
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    naam: true,
    kwalificatiestatus: true,
    functie: true,
    telefoon: true,
    email: true,
    emailStatus: false,
    bron: false,
    bedrijf: true,
    bedrijfsgrootte: false,
    companyStatus: false,
    companyStart: false,
    linkedin: false,
    campagne: true,
    aangemaakt: false
  })
  
  const { toast } = useToast()

  // Debounced search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    debouncedSearchQuery,
    inCampaignFilter,
    hasEmailFilter,
    companyStatusFilter,
    companyStartFilter,
    companySizeFilter,
    categoryStatusFilter
  ])

  // Build filters object for API call
  const filters = {
    search: debouncedSearchQuery || undefined,
    inCampaign: inCampaignFilter === "all" ? undefined : inCampaignFilter,
    hasEmail: hasEmailFilter === "all" ? undefined : hasEmailFilter,
    companyStatus: companyStatusFilter.length > 0 ? companyStatusFilter.join(',') : undefined,
    companyStart: companyStartFilter.length > 0 ? companyStartFilter.join(',') : undefined,
    companySize: companySizeFilter.length > 0 ? companySizeFilter.join(',') : undefined,
    categoryStatus: categoryStatusFilter.length > 0 ? categoryStatusFilter.join(',') : undefined
  }

  const { data: contacts, loading, error, count, totalPages } = useContactsPaginated(
    currentPage, 
    itemsPerPage, 
    filters
  )

  // Platform recommendation logic (only when modal is open)
  const selectedContactsData = useMemo(() => {
    if (!isCampaignModalOpen || !contacts) return [];
    const indices = Array.from(selectedContacts).sort();
    return indices.map(index => contacts[index]).filter(Boolean)
  }, [Array.from(selectedContacts).sort().join(','), contacts, isCampaignModalOpen])

  const { aggregatedRecommendation: platformRecommendation, loading: recommendationLoading } = useRecommendedPlatform(
    selectedContactsData
  )

  // Load campaigns on component mount
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch('/api/instantly-campaigns')
        const data = await response.json()
        if (data.campaigns) {
          // Filter campaigns to only show status 1, 2, 3, 4 as requested
          const activeCampaigns = data.campaigns.filter((campaign: Campaign) => 
            ['1', '2', '3', '4'].includes(String(campaign.status))
          )
          // Sort campaigns A-Z by name
          activeCampaigns.sort((a: Campaign, b: Campaign) => a.name.localeCompare(b.name))
          setCampaigns(activeCampaigns)
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
        toast({
          title: "Error",
          description: "Could not load campaigns",
          variant: "destructive"
        })
      }
    }
    loadCampaigns()
  }, [toast])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setSelectedContacts(new Set()) // Clear selections when changing page
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(contacts.map((_, index) => index))
      setSelectedContacts(allIds)
    } else {
      setSelectedContacts(new Set())
    }
  }


  const handleSelectContact = (index: number) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedContacts(newSelected)
  }

  const getSelectedContactsData = () => {
    return Array.from(selectedContacts).map(index => contacts[index]).filter(Boolean)
  }

  const resetAllFilters = () => {
    setSearchQuery("")
    setInCampaignFilter("all")
    setHasEmailFilter("all")
    setCompanyStatusFilter([])
    setCompanyStartFilter([])
    setCompanySizeFilter([])
    setCategoryStatusFilter([])
    setCurrentPage(1)
  }

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (searchQuery) count++
    if (inCampaignFilter !== "all") count++
    if (hasEmailFilter !== "all") count++
    if (companyStatusFilter.length > 0) count++
    if (companyStartFilter.length > 0) count++
    if (companySizeFilter.length > 0) count++
    if (categoryStatusFilter.length > 0) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  const handleAddToCampaign = async () => {
    if (!selectedCampaign || selectedContacts.size === 0) {
      toast({
        title: "Error",
        description: "Please select contacts and a campaign",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const selectedContactsData = getSelectedContactsData()
      const contactIds = selectedContactsData.map(contact => contact.id)
      
      console.log('Selected contact IDs:', contactIds)
      
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactIds,
          campaignId: selectedCampaign,
          campaignName: campaigns.find(c => c.id === selectedCampaign)?.name || ''
        })
      })

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: result.message || `Successfully added ${selectedContacts.size} contacts to campaign`,
      })
      
      setSelectedContacts(new Set())
      setIsCampaignModalOpen(false)
      setSelectedCampaign("")
      
      // Refresh the contacts data
      window.location.reload()
      
    } catch (error) {
      console.error('Error adding contacts to campaign:', error)
      toast({
        title: "Error",
        description: "Failed to add contacts to campaign",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditContact = (contact: Contact) => {
    setEditContactModal({ isOpen: true, contact })
  }

  const handleCloseEditModal = () => {
    setEditContactModal({ isOpen: false, contact: null })
  }

  const handleEditSuccess = (updatedContact: Contact) => {
    // Update the contact in the current list
    const updatedContacts = contacts.map(contact => 
      contact.id === updatedContact.id ? updatedContact : contact
    )
    // Note: In a real app, you'd update the contacts state or refetch data
    // For now, we'll just refresh the page to show updated data
    window.location.reload()
  }

  const handleUpdateQualificationStatus = async () => {
    if (!selectedQualificationStatus || selectedContacts.size === 0) {
      toast({
        title: "Error", 
        description: "Please select contacts and a qualification status",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const selectedContactsData = getSelectedContactsData()
      
      // We'll need to implement this API endpoint
      const response = await fetch('/api/contacts/qualification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contacts: selectedContactsData,
          qualification_status: selectedQualificationStatus
        })
      })

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      toast({
        title: "Success",
        description: `Successfully updated ${selectedContacts.size} contacts`,
      })
      
      setSelectedContacts(new Set())
      setIsQualificationModalOpen(false)
      setSelectedQualificationStatus("")
      
      // Refresh the contacts data
      window.location.reload()
      
    } catch (error) {
      console.error('Error updating qualification status:', error)
      toast({
        title: "Error",
        description: "Failed to update qualification status",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to load contacts: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contactenoverzicht</h1>
          <p className="text-gray-600">
            {count} contacten gevonden
            {selectedContacts.size > 0 && ` • ${selectedContacts.size} geselecteerd`}
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <Dialog open={isCampaignModalOpen} onOpenChange={setIsCampaignModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="default" 
                disabled={selectedContacts.size === 0}
                className={selectedContacts.size === 0 ? "opacity-50 cursor-not-allowed" : ""}
              >
                <Target className="w-4 h-4 mr-2" />
                Naar campagne {selectedContacts.size > 0 ? `(${selectedContacts.size})` : ""}
              </Button>
            </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Contacten toevoegen aan campagne</DialogTitle>
                  <DialogDescription>
                    Voeg {selectedContacts.size} geselecteerde contacten toe aan een Instantly campagne.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Platform Recommendation */}
                  {selectedContacts.size > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-full shadow-sm">
                          <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-700">Aanbevolen platform</span>
                            <MapPin className="w-4 h-4 text-purple-400" />
                          </div>
                          {recommendationLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                              <span className="text-sm text-gray-500">Analyseren...</span>
                            </div>
                          ) : platformRecommendation ? (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-purple-800">
                                  {platformRecommendation.platform}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-sm font-medium ${
                                    platformRecommendation.confidence >= 80 
                                      ? 'bg-green-50 text-green-700 border-green-300' 
                                      : platformRecommendation.confidence >= 50
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                                      : 'bg-orange-50 text-orange-700 border-orange-300'
                                  }`}
                                >
                                  {platformRecommendation.confidence}% match
                                </Badge>
                                {platformRecommendation.platformData?.distance_km && (
                                  <Badge variant="secondary" className="text-xs">
                                    {platformRecommendation.platformData.distance_km} km
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {platformRecommendation.contacts} van {selectedContacts.size} contacten passen bij dit platform
                              </p>
                              {platformRecommendation.platformData?.central_place && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Centrale locatie: {platformRecommendation.platformData.central_place}
                                  {platformRecommendation.matchMethod === 'postcode_fallback' && ' (via postcode)'}
                                  {platformRecommendation.matchMethod === 'geocoding' && ' (via GPS-locatie)'}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Geen platform aanbeveling beschikbaar</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer campagne..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => {
                        const status = CAMPAIGN_STATUS_MAP[campaign.status as keyof typeof CAMPAIGN_STATUS_MAP]
                        return (
                          <SelectItem key={campaign.id} value={campaign.id} className="py-3">
                            <div className="flex flex-col items-start w-full">
                              <span className="truncate w-full font-medium">{campaign.name}</span>
                              {status && (
                                <Badge className={`${status.color} text-xs mt-1`}>
                                  {status.icon} {status.label}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCampaignModalOpen(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={handleAddToCampaign} disabled={isLoading}>
                      {isLoading ? "Bezig..." : "Toevoegen"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          <Dialog open={isQualificationModalOpen} onOpenChange={setIsQualificationModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                disabled={selectedContacts.size === 0}
                className={selectedContacts.size === 0 ? "opacity-50 cursor-not-allowed" : ""}
              >
                <Edit className="w-4 h-4 mr-2" />
                Status wijzigen
              </Button>
            </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Kwalificatiestatus wijzigen</DialogTitle>
                  <DialogDescription>
                    Wijzig de kwalificatiestatus van {selectedContacts.size} geselecteerde contacten.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedQualificationStatus} onValueChange={setSelectedQualificationStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="disqualified">Disqualified</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsQualificationModalOpen(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={handleUpdateQualificationStatus} disabled={isLoading}>
                      {isLoading ? "Bezig..." : "Wijzigen"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-orange-900">
                  Actieve filters ({activeFilterCount}):
                </span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Zoekterm: "{searchQuery}"
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setSearchQuery("")}
                    />
                  </Badge>
                )}
                {inCampaignFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Campagne: {inCampaignFilter === "with" ? "Met" : "Zonder"}
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setInCampaignFilter("all")}
                    />
                  </Badge>
                )}
                {hasEmailFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Email: {hasEmailFilter === "with" ? "Met" : "Zonder"}
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setHasEmailFilter("all")}
                    />
                  </Badge>
                )}
                {companyStatusFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Company Status: {companyStatusFilter.length} geselecteerd
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setCompanyStatusFilter([])}
                    />
                  </Badge>
                )}
                {companyStartFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Company Start: {companyStartFilter.length} geselecteerd
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setCompanyStartFilter([])}
                    />
                  </Badge>
                )}
                {companySizeFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Bedrijfsgrootte: {companySizeFilter.length} geselecteerd
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setCompanySizeFilter([])}
                    />
                  </Badge>
                )}
                {categoryStatusFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Kwalificatiestatus: {categoryStatusFilter.length} geselecteerd
                    <X 
                      className="h-3 w-3 cursor-pointer ml-1" 
                      onClick={() => setCategoryStatusFilter([])}
                    />
                  </Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={resetAllFilters}
                className="text-orange-700 hover:text-orange-900"
              >
                Alles wissen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zoeken en Filteren</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Zoek op voornaam, achternaam, bedrijf of email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* In Campaign Filter */}
            <Select value={inCampaignFilter} onValueChange={setInCampaignFilter}>
              <SelectTrigger>
                <SelectValue placeholder="In campagne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Campagne</SelectItem>
                <SelectItem value="with">Met campagne</SelectItem>
                <SelectItem value="without">Zonder campagne</SelectItem>
              </SelectContent>
            </Select>

            {/* Has Email Filter */}
            <Select value={hasEmailFilter} onValueChange={setHasEmailFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Email status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Email</SelectItem>
                <SelectItem value="with">Met email</SelectItem>
                <SelectItem value="without">Zonder email</SelectItem>
              </SelectContent>
            </Select>

            {/* Company Status Filter */}
            <MultiSelect
              options={[
                { value: "Benaderen", label: "Benaderen" },
                { value: "Prospect", label: "Prospect" },
                { value: "Disqualified", label: "Disqualified" },
                { value: "Niet meer benaderen", label: "Niet meer benaderen" },
                { value: "null", label: "Leeg" }
              ]}
              selected={companyStatusFilter}
              onChange={setCompanyStatusFilter}
              placeholder="Company Status"
            />

            {/* Company Start Filter */}
            <MultiSelect
              options={[
                { value: "true", label: "Ja" },
                { value: "false", label: "Nee" },
                { value: "hold", label: "Hold" },
                { value: "null", label: "Leeg" }
              ]}
              selected={companyStartFilter}
              onChange={setCompanyStartFilter}
              placeholder="Company Start"
            />

            {/* Company Size (Bedrijfsgrootte) Filter */}
            <MultiSelect
              options={[
                { value: "Klein", label: "Klein" },
                { value: "Middel", label: "Middel" },
                { value: "Groot", label: "Groot" },
                { value: "null", label: "Leeg" }
              ]}
              selected={companySizeFilter}
              onChange={setCompanySizeFilter}
              placeholder="Bedrijfsgrootte"
            />

            {/* Category Status Filter */}
            <MultiSelect
              options={[
                { value: "pending", label: "Pending" },
                { value: "qualified", label: "Qualified" },
                { value: "disqualified", label: "Disqualified" },
                { value: "review", label: "Review" },
                { value: "in_campaign", label: "In Campaign" }
              ]}
              selected={categoryStatusFilter}
              onChange={setCategoryStatusFilter}
              placeholder="Kwalificatiestatus"
            />

            {/* Reset Filters Button */}
            <Button 
              variant="outline" 
              onClick={resetAllFilters}
              className="w-full flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Contacten</CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-1">
                {Object.values(columnVisibility).filter(Boolean).length} van {Object.keys(columnVisibility).length} kolommen zichtbaar
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              <ColumnVisibilityToggle
                visibility={columnVisibility}
                onVisibilityChange={setColumnVisibility}
              />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Rijen per pagina:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(value === 'all' ? count || 1000 : parseInt(value))
                  setCurrentPage(1)
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="all">Alle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-gray-600">
                Pagina {currentPage} van {totalPages}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>Laden...</p>
            </div>
          ) : (
            <>
              {/* Selection Toolbar - only shown when contacts are selected */}
              {selectedContacts.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {selectedContacts.size} contact{selectedContacts.size === 1 ? '' : 'en'} geselecteerd
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContacts(new Set())}
                      className="bg-white hover:bg-gray-50 border-blue-300 text-blue-700 hover:text-blue-800"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Deselecteer alle
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedContacts.size === contacts.length && contacts.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all contacts"
                        />
                      </TableHead>
                      {columnVisibility.naam && <TableHead className="w-24">Naam</TableHead>}
                      {columnVisibility.kwalificatiestatus && <TableHead className="w-20">Status</TableHead>}
                      {columnVisibility.functie && <TableHead className="w-24">Functie</TableHead>}
                      {columnVisibility.telefoon && <TableHead className="w-24">Telefoon</TableHead>}
                      {columnVisibility.email && <TableHead className="w-32">Email</TableHead>}
                      {columnVisibility.emailStatus && <TableHead className="w-12" title="Email Status">✉️</TableHead>}
                      {columnVisibility.bron && <TableHead className="w-16">Bron</TableHead>}
                      {columnVisibility.bedrijf && <TableHead className="w-28">Bedrijf</TableHead>}
                      {columnVisibility.bedrijfsgrootte && <TableHead className="w-20">Grootte</TableHead>}
                      {columnVisibility.companyStatus && <TableHead className="w-20">C.Status</TableHead>}
                      {columnVisibility.companyStart && <TableHead className="w-20">C.Start</TableHead>}
                      {columnVisibility.linkedin && <TableHead className="w-12" title="LinkedIn">💼</TableHead>}
                      {columnVisibility.campagne && <TableHead className="w-24">Campagne</TableHead>}
                      {columnVisibility.aangemaakt && <TableHead className="w-20">Datum</TableHead>}
                      <TableHead className="w-[60px] sticky right-0 bg-white shadow-sm">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={1 + Object.values(columnVisibility).filter(Boolean).length + 1} 
                          className="text-center py-8"
                        >
                          Geen contacten gevonden
                        </TableCell>
                      </TableRow>
                    ) : (
                      contacts.map((contact, index) => (
                        <TableRow key={index} className={`h-12 ${selectedContacts.has(index) ? 'bg-blue-50' : ''}`}>
                          <TableCell className="py-2">
                            <Checkbox
                              checked={selectedContacts.has(index)}
                              onCheckedChange={() => handleSelectContact(index)}
                              aria-label={`Select contact ${contact.first_name} ${contact.last_name}`}
                            />
                          </TableCell>
                          {columnVisibility.naam && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.first_name || contact.last_name 
                                  ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                                  : null
                                }
                                className="font-medium"
                                maxWidth="w-24"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.kwalificatiestatus && (
                            <TableCell className="py-2 w-20">
                              {getQualificationStatusBadge(contact.qualification_status)}
                            </TableCell>
                          )}
                          {columnVisibility.functie && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.title}
                                maxWidth="w-24"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.telefoon && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.phone ? formatDutchPhone(contact.phone) : null}
                                href={contact.phone ? `tel:${contact.phone}` : undefined}
                                hrefClassName="text-green-600 hover:text-green-800 hover:underline text-xs font-medium"
                                maxWidth="w-24"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.email && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.email}
                                href={contact.email ? `mailto:${contact.email}` : undefined}
                                hrefClassName="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                                maxWidth="w-32"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.emailStatus && (
                            <TableCell className="py-2 w-12">
                              {getEmailStatusBadge(contact.email_status)}
                            </TableCell>
                          )}
                          {columnVisibility.bron && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.source}
                                maxWidth="w-16"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.bedrijf && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.companies_name}
                                maxWidth="w-28"
                                className="font-medium"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.bedrijfsgrootte && (
                            <TableCell className="py-2 w-20">
                              {getCompanySizeBadge(contact.companies_size)}
                            </TableCell>
                          )}
                          {columnVisibility.companyStatus && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.companies_status}
                                maxWidth="w-20"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.companyStart && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.companies_start}
                                maxWidth="w-20"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.linkedin && (
                            <TableCell className="py-2 w-12">
                              {contact.linkedin_url ? (
                                <a 
                                  href={contact.linkedin_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs"
                                  title="LinkedIn profiel"
                                >
                                  🔗
                                </a>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </TableCell>
                          )}
                          {columnVisibility.campagne && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.campaign_name}
                                maxWidth="w-24"
                              />
                            </TableCell>
                          )}
                          {columnVisibility.aangemaakt && (
                            <TableCell className="py-2">
                              <TableCellWithTooltip 
                                value={contact.created_at 
                                  ? new Date(contact.created_at).toLocaleDateString('nl-NL')
                                  : null
                                }
                                className="text-gray-600"
                                maxWidth="w-20"
                              />
                            </TableCell>
                          )}
                          <TableCell className="py-2 w-[60px] sticky right-0 bg-white">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditContact(contact)}
                              className="h-8 w-8 p-0 hover:bg-blue-100 shadow-sm"
                              title="Contact bewerken"
                            >
                              <Edit3 className="h-4 w-4 text-blue-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Toont {((currentPage - 1) * itemsPerPage) + 1} tot {Math.min(currentPage * itemsPerPage, count)} van {count} contacten
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Vorige
                    </Button>
                    <span className="text-sm">
                      Pagina {currentPage} van {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Volgende
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Contact Modal */}
      <EditContactModal
        contact={editContactModal.contact}
        isOpen={editContactModal.isOpen}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}