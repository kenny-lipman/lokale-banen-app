"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Loader2, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Mail, 
  Search, 
  Clock, 
  X, 
  Phone, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  Filter,
  Send,
  Download,
  Eye,
  Edit,
  MoreHorizontal,
  Check,
  XCircle,
  UserPlus,
  Building2,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabaseService } from '@/lib/supabase-service'

interface Company {
  id: string
  name: string
  website?: string
  location?: string
  status: string
  job_count: number
  enrichment_status: string
  contactsFound: number
  category_size?: string
  lastScraped?: string
  scrapingInProgress?: boolean
}

interface Contact {
  id: string
  name: string
  email: string
  title: string
  linkedin_url?: string
  campaign_id?: string
  campaign_name?: string
  email_status?: string
  phone?: string
  companyName: string
  companyId: string
  isKeyContact?: boolean
  scrapingStatus?: 'scraped' | 'pending' | 'failed' | 'inProgress'
}

interface Campaign {
  id: string
  name: string
  status: string
}

export default function BufferzonePage() {
  const { toast } = useToast()
  
  // State management
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  
  // Selection state
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  
  // Expandable state
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  
  // Campaign assignment
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [assignmentType, setAssignmentType] = useState<'individual' | 'bulk'>('individual')
  const [contactToAssign, setContactToAssign] = useState<Contact | null>(null)
  
  // Statistics
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalContacts: 0,
    assignedContacts: 0,
    pendingContacts: 0
  })

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [])

  // Update statistics when data changes
  useEffect(() => {
    updateStats()
  }, [companies, contacts])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadCompanies(),
        loadContacts(),
        loadCampaigns()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: "Error loading data",
        description: "Failed to load bufferzone data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      // Load companies from the current scraping results
      const response = await fetch('/api/otis/scraping-results/latest')
      if (response.ok) {
        const data = await response.json()
        if (data.companies) {
          setCompanies(data.companies.map((company: any) => ({
            ...company,
            contactsFound: 0, // Will be updated when contacts are loaded
            scrapingInProgress: false
          })))
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const loadContacts = async () => {
    try {
      // Load contacts from enrichment jobs
      const response = await fetch('/api/otis/contacts')
      if (response.ok) {
        const data = await response.json()
        if (data.contacts) {
          setContacts(data.contacts)
          
          // Update company contact counts
          setCompanies(prev => prev.map(company => ({
            ...company,
            contactsFound: data.contacts.filter((contact: Contact) => contact.companyId === company.id).length
          })))
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/instantly-campaigns')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }

  const updateStats = () => {
    const totalCompanies = companies.length
    const totalContacts = contacts.length
    const assignedContacts = contacts.filter(contact => contact.campaign_id).length
    const pendingContacts = contacts.filter(contact => !contact.campaign_id).length

    setStats({
      totalCompanies,
      totalContacts,
      assignedContacts,
      pendingContacts
    })
  }

  // Filter companies based on search and filters
  const getFilteredCompanies = () => {
    return companies.filter(company => {
      const matchesSearch = !searchTerm || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.location?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'scraped' && company.enrichment_status === 'enriched') ||
        (statusFilter === 'pending' && company.enrichment_status === 'pending') ||
        (statusFilter === 'failed' && company.enrichment_status === 'failed')
      
      const matchesCompanyFilter = companyFilter === 'all' ||
        (companyFilter === 'with-contacts' && company.contactsFound > 0) ||
        (companyFilter === 'without-contacts' && company.contactsFound === 0)
      
      return matchesSearch && matchesStatus && matchesCompanyFilter
    })
  }

  // Get contacts for a specific company
  const getContactsForCompany = (companyId: string) => {
    return contacts.filter(contact => contact.companyId === companyId)
  }

  // Expand/collapse company
  const toggleCompanyExpanded = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(companyId)) {
        newSet.delete(companyId)
      } else {
        newSet.add(companyId)
      }
      return newSet
    })
  }

  // Auto-expand companies when searching
  useEffect(() => {
    if (searchTerm) {
      const matchingCompanies = getFilteredCompanies()
      const newExpanded = new Set<string>()
      matchingCompanies.forEach(company => {
        const companyContacts = getContactsForCompany(company.id)
        const hasMatchingContacts = companyContacts.some(contact =>
          contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (hasMatchingContacts) {
          newExpanded.add(company.id)
        }
      })
      setExpandedCompanies(newExpanded)
    }
  }, [searchTerm])

  // Selection handlers
  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(companyId)) {
        newSet.delete(companyId)
        // Also deselect all contacts from this company
        const companyContacts = getContactsForCompany(companyId)
        companyContacts.forEach(contact => {
          setSelectedContacts(prevContacts => {
            const newContactSet = new Set(prevContacts)
            newContactSet.delete(contact.id)
            return newContactSet
          })
        })
      } else {
        newSet.add(companyId)
        // Also select all contacts from this company
        const companyContacts = getContactsForCompany(companyId)
        companyContacts.forEach(contact => {
          setSelectedContacts(prevContacts => {
            const newContactSet = new Set(prevContacts)
            newContactSet.add(contact.id)
            return newContactSet
          })
        })
      }
      return newSet
    })
  }

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contactId)) {
        newSet.delete(contactId)
      } else {
        newSet.add(contactId)
      }
      return newSet
    })
  }

  // Scrape contacts for a company
  const handleScrapeContacts = async (company: Company) => {
    try {
      setCompanies(prev => prev.map(c => 
        c.id === company.id ? { ...c, scrapingInProgress: true } : c
      ))

      const response = await fetch('/api/otis/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds: [company.id],
          apifyRunId: company.apifyRunId
        })
      })

      if (response.ok) {
        toast({
          title: "Contact scraping started",
          description: `Started scraping contacts for ${company.name}`,
        })
        
        // Start polling for results
        startEnrichmentPolling(company.id)
      } else {
        throw new Error('Failed to start contact scraping')
      }
    } catch (error) {
      console.error('Error scraping contacts:', error)
      toast({
        title: "Error scraping contacts",
        description: "Failed to start contact scraping. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCompanies(prev => prev.map(c => 
        c.id === company.id ? { ...c, scrapingInProgress: false } : c
      ))
    }
  }

  const startEnrichmentPolling = (companyId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/otis/status/${companyId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'completed') {
            clearInterval(pollInterval)
            await loadContacts() // Reload contacts
            toast({
              title: "Contact scraping completed",
              description: `Successfully scraped contacts for ${companies.find(c => c.id === companyId)?.name}`,
            })
          } else if (data.status === 'failed') {
            clearInterval(pollInterval)
            toast({
              title: "Contact scraping failed",
              description: "Failed to scrape contacts. Please try again.",
              variant: "destructive",
            })
          }
        }
      } catch (error) {
        console.error('Error polling enrichment status:', error)
      }
    }, 5000) // Poll every 5 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
    }, 300000)
  }

  // Campaign assignment
  const handleAssignContact = (contact: Contact) => {
    setContactToAssign(contact)
    setAssignmentType('individual')
    setShowAssignmentModal(true)
  }

  const handleBulkAssign = () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to assign to a campaign.",
        variant: "destructive",
      })
      return
    }
    setAssignmentType('bulk')
    setShowAssignmentModal(true)
  }

  const handleAssignToCampaign = async () => {
    if (!selectedCampaign) {
      toast({
        title: "No campaign selected",
        description: "Please select a campaign to assign contacts to.",
        variant: "destructive",
      })
      return
    }

    setIsAddingToCampaign(true)
    try {
      const contactsToAssign = assignmentType === 'individual' && contactToAssign 
        ? [contactToAssign] 
        : Array.from(selectedContacts).map(id => contacts.find(c => c.id === id)).filter(Boolean)

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contactIds: contactsToAssign.map(c => c!.id), 
          campaignId: selectedCampaign, 
          campaignName: campaigns.find(c => c.id === selectedCampaign)?.name 
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        const successCount = data.results?.filter((r: any) => r.status === "success").length || 0
        
        if (successCount > 0) {
          toast({
            title: "Contacts assigned successfully! ✅",
            description: `${successCount} contact${successCount !== 1 ? 's' : ''} assigned to campaign`,
          })
          
          // Update contacts in UI
          setContacts(prev => prev.map(contact => {
            const isAssigned = contactsToAssign.some(c => c!.id === contact.id)
            if (isAssigned) {
              return {
                ...contact,
                campaign_id: selectedCampaign,
                campaign_name: campaigns.find(c => c.id === selectedCampaign)?.name
              }
            }
            return contact
          }))
          
          // Clear selection
          setSelectedContacts(new Set())
          setSelectedCampaign('')
          setShowAssignmentModal(false)
        }
      } else {
        throw new Error(data.error || 'Failed to assign contacts')
      }
    } catch (error) {
      console.error('Error assigning contacts:', error)
      toast({
        title: "Error assigning contacts",
        description: "Failed to assign contacts to campaign. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCampaign(false)
    }
  }



  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading Bufferzone...</p>
        </div>
      </div>
    )
  }

  const filteredCompanies = getFilteredCompanies()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Bufferzone</h1>
            <Badge variant="secondary">{stats.totalCompanies} Companies</Badge>
            <Badge variant="secondary">{stats.totalContacts} Contacts</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button 
              size="sm" 
              onClick={handleBulkAssign}
              disabled={selectedContacts.size === 0}
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Assign ({selectedContacts.size})
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input 
                placeholder="Search companies or contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scraped">Scraped</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="with-contacts">With Contacts</SelectItem>
                <SelectItem value="without-contacts">Without Contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-lg">
          {filteredCompanies.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No companies in bufferzone
              </h3>
              <p className="text-gray-600 mb-4">
                Start by scraping companies from your Otis agent
              </p>
              <Button onClick={() => window.location.href = '/agents/otis'}>
                <Play className="w-4 h-4 mr-2" />
                Go to Otis Agent
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCompanies.map((company) => {
                const companyContacts = getContactsForCompany(company.id)
                const isExpanded = expandedCompanies.has(company.id)
                const isCompanySelected = selectedCompanies.has(company.id)
                const hasSelectedContacts = companyContacts.some(contact => selectedContacts.has(contact.id))
                const allContactsSelected = companyContacts.length > 0 && 
                  companyContacts.every(contact => selectedContacts.has(contact.id))

                return (
                  <div key={company.id}>
                    {/* Company Row */}
                    <div className="bg-orange-50 hover:bg-orange-100 border-b p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12">
                          <Checkbox 
                            checked={isCompanySelected || (hasSelectedContacts && allContactsSelected)}
                            onChange={() => toggleCompanySelection(company.id)}
                            aria-label={`Select all contacts for ${company.name}`}
                          />
                        </div>
                        
                        <div className="w-12">
                          <button
                            onClick={() => toggleCompanyExpanded(company.id)}
                            className="p-1 hover:bg-orange-200 rounded"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-orange-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-orange-600" />
                            )}
                          </button>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-base">{company.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {company.contactsFound} contacts
                            </Badge>
                            {company.job_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {company.job_count} jobs
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {company.location} • {company.category_size || 'Unknown size'}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <StatusBadge status={company.enrichment_status} />
                          {company.lastScraped && (
                            <span className="text-xs text-gray-500">
                              {new Date(company.lastScraped).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {company.contactsFound > 0 ? (
                            <Badge variant="success" className="text-xs">
                              {companyContacts.filter(c => c.campaign_id).length} assigned
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleScrapeContacts(company)}
                              disabled={company.scrapingInProgress}
                            >
                              {company.scrapingInProgress ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Users className="w-3 h-3 mr-1" />
                              )}
                              Scrape Contacts
                            </Button>
                          )}
                        </div>
                        
                        <div className="w-20">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleBulkAssign()}>
                                <Send className="w-4 h-4 mr-2" />
                                Assign All to Campaign
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="w-4 h-4 mr-2" />
                                Export Contacts
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {/* Contact Rows */}
                    {isExpanded && (
                      <div className="bg-white">
                        {companyContacts.length === 0 ? (
                          <div className="text-center py-8">
                            <UserPlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 mb-2">
                              No contacts scraped yet
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleScrapeContacts(company)}
                            >
                              <Users className="w-3 h-3 mr-1" />
                              Scrape Contacts
                            </Button>
                          </div>
                        ) : (
                          companyContacts.map((contact) => {
                            const isContactSelected = selectedContacts.has(contact.id)
                            
                            return (
                              <div key={contact.id} className="bg-white hover:bg-gray-50 border-b p-4 pl-16">
                                <div className="flex items-center gap-3">
                                  <div className="w-12">
                                    <Checkbox 
                                      checked={isContactSelected}
                                      onChange={() => toggleContactSelection(contact.id)}
                                      aria-label={`Select ${contact.name}`}
                                    />
                                  </div>
                                  
                                  <div className="w-12"></div>
                                  
                                  <div className="flex items-center gap-3 flex-1">
                                    <Avatar className="w-8 h-8">
                                      <AvatarFallback className="text-xs">
                                        {getInitials(contact.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium text-sm">{contact.name}</div>
                                      <div className="text-xs text-gray-600">{contact.title}</div>
                                    </div>
                                    {contact.isKeyContact && (
                                      <Badge variant="outline" className="text-xs">
                                        Key Contact
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="text-sm">
                                    <div>{contact.email}</div>
                                    {contact.phone && (
                                      <div className="text-xs text-gray-600">{contact.phone}</div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={contact.scrapingStatus || 'scraped'} />
                                    {contact.campaign_name && (
                                      <Badge variant="success" className="text-xs">
                                        {contact.campaign_name}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {contact.campaign_name ? (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleAssignContact(contact)}
                                      >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Change
                                      </Button>
                                    ) : (
                                      <Button 
                                        size="sm"
                                        onClick={() => handleAssignContact(contact)}
                                      >
                                        <Send className="w-3 h-3 mr-1" />
                                        Assign
                                      </Button>
                                    )}
                                  </div>
                                  
                                  <div className="w-20">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem>
                                          <Eye className="w-4 h-4 mr-2" />
                                          View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit Contact
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                          <RefreshCw className="w-4 h-4 mr-2" />
                                          Re-scrape
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Campaign Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className={assignmentType === 'bulk' ? 'max-w-2xl' : ''}>
          <DialogHeader>
            <DialogTitle>
              {assignmentType === 'individual' ? 'Assign Contact to Campaign' : 'Bulk Assign to Campaign'}
            </DialogTitle>
            <DialogDescription>
              {assignmentType === 'individual' 
                ? `Assign ${contactToAssign?.name} to a campaign`
                : `Assign ${selectedContacts.size} contacts to a campaign`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {assignmentType === 'individual' && contactToAssign && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Avatar className="w-10 h-10">
                  <AvatarFallback>{getInitials(contactToAssign.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{contactToAssign.name}</div>
                  <div className="text-sm text-gray-600">{contactToAssign.email}</div>
                </div>
              </div>
            )}
            
            <div>
              <Label>Select Campaign</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {assignmentType === 'bulk' && (
              <div>
                <Label>Selected Contacts</Label>
                <div className="max-h-60 overflow-y-auto border rounded p-2">
                  {Array.from(selectedContacts).map(contactId => {
                    const contact = contacts.find(c => c.id === contactId)
                    return contact ? (
                      <div key={contact.id} className="flex items-center gap-2 py-1">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{contact.name}</span>
                        <span className="text-xs text-gray-600">{contact.email}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignToCampaign}
              disabled={!selectedCampaign || isAddingToCampaign}
            >
              {isAddingToCampaign ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Assign to Campaign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 