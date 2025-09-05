"use client"

import { useState, useEffect } from 'react'
import { WorkflowProvider } from '@/contexts/otis-workflow-context'
import { OtisErrorBoundary } from '@/components/otis/ErrorBoundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useWebhookRateLimit } from '@/hooks/use-webhook-rate-limit'
import { VirtualizedRunList } from '@/components/VirtualizedRunList'
import { ViewModeToggle, useViewMode } from '@/components/ViewModeToggle'
import { StatusFilterPills, StatusStats, useStatusFilter, calculateStatusCounts } from '@/components/StatusFilterPills'
import { useApifyRunsProcessing } from '@/hooks/use-apify-runs-processing'
import { 
  Search, 
  Building2, 
  MapPin, 
  Briefcase, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Download,
  ExternalLink,
  Bot,
  Zap,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  History,
  Plus,
  FileText,
  Globe,
  Filter
} from 'lucide-react'
import { JobPostingsTable } from '@/components/job-postings-table'
import { CompanyDetailsDrawer } from '@/components/company-details-drawer'
import { CampaignConfirmationModal, Contact, Campaign } from '@/components/CampaignConfirmationModal'
import { supabaseService } from '@/lib/supabase-service'

interface ScrapingJob {
  id: string
  jobTitle: string
  platform: string
  selectedRegioPlatforms?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  resultsCount?: number
}

interface ScrapingConfig {
  jobTitle: string
  platform: string
  selectedRegioPlatforms: string[]
}

interface JobSource {
  id: string
  name: string
  cost_per_1000_results: number | null
  webhook_url: string | null
  active: boolean | null
}

interface ApifyRun {
  id: string
  title: string
  platform: string
  location: string
  displayName: string
  createdAt: string
  finishedAt: string
}

type ScrapingMode = 'new' | 'existing'

// Campaign status mapping
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

// Enhanced Campaign Selector Component
const EnhancedCampaignSelector = ({ 
  campaigns, 
  selectedCampaign, 
  onCampaignChange 
}: { 
  campaigns: { id: string, name: string, status: string }[]
  selectedCampaign: string
  onCampaignChange: (value: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Sort campaigns alphabetically by name
  const sortedCampaigns = [...campaigns].sort((a, b) => a.name.localeCompare(b.name))

  // Filter campaigns based on search term
  const filteredCampaigns = sortedCampaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign)
  const selectedStatus = selectedCampaignData ? CAMPAIGN_STATUS_MAP[selectedCampaignData.status as keyof typeof CAMPAIGN_STATUS_MAP] : null

  // Handle search input change with proper event handling
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setSearchTerm(e.target.value)
  }

  // Handle search input click to prevent select from closing
  const handleSearchClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="relative">
      <Select value={selectedCampaign} onValueChange={onCampaignChange} onOpenChange={setIsOpen}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select Campaign">
            {selectedCampaignData && (
              <div className="flex flex-col items-start w-full">
                <span className="truncate w-full font-medium">{selectedCampaignData.name}</span>
                {selectedStatus && (
                  <Badge className={`${selectedStatus.color} text-xs mt-1`}>
                    {selectedStatus.icon} {selectedStatus.label}
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-64 max-h-96">
          {/* Search Input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={handleSearchChange}
                onClick={handleSearchClick}
                className="pl-9 h-9 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setSearchTerm('')
                  }
                }}
              />
            </div>
          </div>
          
          {/* Campaign List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCampaigns.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchTerm ? 'No campaigns found' : 'No campaigns available'}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
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
              })
            )}
          </div>
          
          {/* Results count */}
          {searchTerm && (
            <div className="p-3 border-t text-xs text-gray-500 text-center bg-gray-50">
              {filteredCampaigns.length} of {sortedCampaigns.length} campaigns
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

// Enhanced Campaign Filter Component (for filtering contacts by campaign)
const EnhancedCampaignFilter = ({ 
  campaigns, 
  selectedCampaignId, 
  onCampaignChange 
}: { 
  campaigns: { id: string, name: string, status: string }[]
  selectedCampaignId: string
  onCampaignChange: (value: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Sort campaigns alphabetically by name
  const sortedCampaigns = [...campaigns].sort((a, b) => a.name.localeCompare(b.name))

  // Filter campaigns based on search term
  const filteredCampaigns = sortedCampaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaignId)
  const selectedStatus = selectedCampaignData ? CAMPAIGN_STATUS_MAP[selectedCampaignData.status as keyof typeof CAMPAIGN_STATUS_MAP] : null

  // Handle search input change with proper event handling
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setSearchTerm(e.target.value)
  }

  // Handle search input click to prevent select from closing
  const handleSearchClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="relative">
      <Select value={selectedCampaignId} onValueChange={onCampaignChange} onOpenChange={setIsOpen}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Specific Campaign">
            {selectedCampaignId === 'all' ? (
              <span>All Campaigns</span>
            ) : selectedCampaignData ? (
              <div className="flex flex-col items-start w-full">
                <span className="truncate w-full font-medium">{selectedCampaignData.name}</span>
                {selectedStatus && (
                  <Badge className={`${selectedStatus.color} text-xs mt-1`}>
                    {selectedStatus.icon} {selectedStatus.label}
                  </Badge>
                )}
              </div>
            ) : (
              <span>Select Campaign</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-56 max-h-96">
          {/* Search Input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={handleSearchChange}
                onClick={handleSearchClick}
                className="pl-9 h-9 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setSearchTerm('')
                  }
                }}
              />
            </div>
          </div>
          
          {/* Campaign List */}
          <div className="max-h-64 overflow-y-auto">
            <SelectItem value="all" className="py-3 font-medium">
              All Campaigns
            </SelectItem>
            {filteredCampaigns.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchTerm ? 'No campaigns found' : 'No campaigns available'}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
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
              })
            )}
          </div>
          
          {/* Results count */}
          {searchTerm && (
            <div className="p-3 border-t text-xs text-gray-500 text-center bg-gray-50">
              {filteredCampaigns.length} of {sortedCampaigns.length} campaigns
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

function FullOtisDashboard() {
  const { toast } = useToast()
  const webhookRateLimit = useWebhookRateLimit()
  
  // State management
  const [scrapingMode, setScrapingMode] = useState<ScrapingMode>('new')
  const [scrapingConfig, setScrapingConfig] = useState<ScrapingConfig>({
    jobTitle: '',
    platform: 'indeed',
    selectedRegioPlatforms: []
  })
  const [selectedExistingRun, setSelectedExistingRun] = useState<ApifyRun | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapingProgress, setScrapingProgress] = useState(0)
  const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [jobSources, setJobSources] = useState<JobSource[]>([])
  const [existingRuns, setExistingRuns] = useState<ApifyRun[]>([])
  const [isLoadingExistingRuns, setIsLoadingExistingRuns] = useState(false)
  
  // Enhanced runs processing state
  const { viewMode, setMode: setViewMode } = useViewMode('list')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  
  // Processing hooks
  const processingHooks = useApifyRunsProcessing({ initialRuns: existingRuns })
  const [recentJobPostings, setRecentJobPostings] = useState<any[]>([])
  const [loadedCompanies, setLoadedCompanies] = useState<any[]>([])
  const [loadedContacts, setLoadedContacts] = useState<any[]>([])
  const [contactsByCompany, setContactsByCompany] = useState<any[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactFilters, setContactFilters] = useState({
    qualification: 'all',
    verification: 'all',
    contactType: 'all',
    campaignStatus: 'all',
    campaignId: 'all',
    search: ''
  })
  const [currentRunData, setCurrentRunData] = useState<any>(null)
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [isQualifying, setIsQualifying] = useState<Set<string>>(new Set())
  const [isEnriching, setIsEnriching] = useState<Set<string>>(new Set())
  const [selectedCompanyForDetails, setSelectedCompanyForDetails] = useState<string | null>(null)
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('scraping')
  // Campaign management state
  const [instantlyCampaigns, setInstantlyCampaigns] = useState<{ id: string, name: string, status: string }[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [addingToCampaign, setAddingToCampaign] = useState(false)
  
  // Modal state management
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  
  // Enhanced modal state for progress tracking
  const [modalProgress, setModalProgress] = useState<{
    percentage: number
    completedSteps: number
    totalSteps: number
    currentStep: 'creation' | 'movement' | 'completed'
  } | undefined>(undefined)
  const [modalSteps, setModalSteps] = useState<{
    step1: {
      name: string
      completed: boolean
      created: number
      total: number
      status: 'success' | 'failed' | 'pending'
    }
    step2: {
      name: string
      completed: boolean
      moved: number
      total: number
      status: 'success' | 'failed' | 'skipped' | 'pending'
    }
  } | undefined>(undefined)
  const [modalRetryRecommendations, setModalRetryRecommendations] = useState<string[]>([])
  const [modalSeverity, setModalSeverity] = useState<'success' | 'warning' | 'error'>('error')

  const [stats, setStats] = useState({
    totalJobs: 0,
    totalCompanies: 0,
    todayJobs: 0
  })

  // Debounced search functionality
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  
  // Local search state for immediate UI feedback
  const [localSearchTerm, setLocalSearchTerm] = useState('')

  // Load initial data
  useEffect(() => {
    loadRegions()
    loadJobSources()
    loadStats()
    loadRecentJobPostings()
    loadInstantlyCampaigns()
  }, [])

  // Load existing runs when switching to existing mode, clear data when switching to new mode
  useEffect(() => {
    if (scrapingMode === 'existing' && existingRuns.length === 0) {
      loadExistingRuns()
    } else if (scrapingMode === 'new') {
      // Clear loaded data when switching to new mode
      setLoadedCompanies([])
      setLoadedContacts([])
      setCurrentRunData(null)
      setSelectedExistingRun(null)
      // Reset to showing general recent job postings
      loadRecentJobPostings()
      // Reset to scraping tab when switching to new mode
      setActiveTab('scraping')
    }
  }, [scrapingMode])

  // Synchronize legacy selectedExistingRun with new selection system
  useEffect(() => {
    if (selectedRunId) {
      const selectedRun = existingRuns.find(run => run.id === selectedRunId)
      if (selectedRun && selectedRun.id !== selectedExistingRun?.id) {
        setSelectedExistingRun(selectedRun)
      }
    } else {
      setSelectedExistingRun(null)
    }
  }, [selectedRunId, existingRuns, selectedExistingRun])


  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  // Local search filter function for immediate UI feedback
  const getFilteredContacts = () => {
    let filtered = loadedContacts
    
    // Apply search filter
    if (localSearchTerm) {
      const searchLower = localSearchTerm.toLowerCase()
      filtered = filtered.filter(contact => {
        const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim().toLowerCase()
        const companyName = (contact.companyName || '').toLowerCase()
        const email = (contact.email || '').toLowerCase()
        
        return name.includes(searchLower) || 
               companyName.includes(searchLower) || 
               email.includes(searchLower)
      })
    }
    
    // Apply campaign status filter (only if not 'all')
    if (contactFilters.campaignStatus === 'in_campaign') {
      filtered = filtered.filter(contact => contact.campaign_id)
    } else if (contactFilters.campaignStatus === 'not_in_campaign') {
      filtered = filtered.filter(contact => !contact.campaign_id)
    }
    
    // Apply specific campaign filter (only if a specific campaign is selected)
    if (contactFilters.campaignId && contactFilters.campaignId !== 'all') {
      filtered = filtered.filter(contact => contact.campaign_id === contactFilters.campaignId)
    }
    
    return filtered
  }

  // Keyboard shortcuts for contact qualification
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger shortcuts when on contacts tab and contacts are selected
      if (activeTab !== 'contacts' || selectedContacts.size === 0) return
      
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      
      // Check for Cmd/Ctrl + key combinations
      if (event.metaKey || event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'q':
            event.preventDefault()
            handleBulkContactQualification('qualified')
            break
          case 'r':
            event.preventDefault()
            handleBulkContactQualification('review')
            break
          case 'd':
            event.preventDefault()
            handleBulkContactQualification('disqualified')
            break
          case 'a':
            event.preventDefault()
            // Select all contacts
            const allContactIds = contactsByCompany.flatMap(company => 
              company.contacts.map((contact: any) => contact.id)
            )
            setSelectedContacts(new Set(allContactIds))
            break
          case 'escape':
            event.preventDefault()
            // Clear selection
            setSelectedContacts(new Set())
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, selectedContacts, contactsByCompany])

  const loadRegions = async () => {
    try {
      const regions = await supabaseService.getRegions()
      // Get unique regio_platform values
      const uniquePlatforms = [...new Set(regions.map((region: any) => region.regio_platform).filter(Boolean))]
      setRegions(uniquePlatforms)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading regions:', error)
      }
    }
  }

  const loadJobSources = async () => {
    try {
      const sources = await supabaseService.getJobSourcesWithCosts()
      setJobSources(sources || [])
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading job sources:', error)
      }
    }
  }

  const loadExistingRuns = async () => {
    setIsLoadingExistingRuns(true)
    try {
      const response = await fetch('/api/otis/successful-runs', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      })
      if (response.ok) {
        const data = await response.json()
        setExistingRuns(data.runs || [])
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading existing runs:', error)
      }
      toast({
        title: "Error",
        description: "Failed to load existing runs",
        variant: "destructive"
      })
    } finally {
      setIsLoadingExistingRuns(false)
    }
  }

  // Load contacts by company from Apify run
  const loadContactsByCompany = async (runId: string, searchTerm?: string, bypassCache?: boolean) => {
    if (!runId) {
      setContactsByCompany([])
      setLoadedContacts([])
      return
    }

    try {
      setContactsLoading(true)
      console.log('Loading contacts for Apify run:', runId)

      const queryParams = new URLSearchParams({
        qualification: contactFilters.qualification,
        verification: contactFilters.verification,
        contactType: contactFilters.contactType,
        limit: '100'
      })

      // Add cache bypass parameter if requested
      if (bypassCache) {
        queryParams.append('bypassCache', 'true')
      }

      // Use the passed searchTerm if provided, otherwise use the current filter
      const currentSearchTerm = searchTerm !== undefined ? searchTerm : contactFilters.search
      if (currentSearchTerm) {
        queryParams.append('search', currentSearchTerm)
      }

      // Only add campaignStatus if it's not 'all'
      if (contactFilters.campaignStatus && contactFilters.campaignStatus !== 'all') {
        queryParams.append('campaignStatus', contactFilters.campaignStatus)
      }

      // Only add campaignId if it's not 'all'
      if (contactFilters.campaignId && contactFilters.campaignId !== 'all') {
        queryParams.append('campaignId', contactFilters.campaignId)
      }

      const url = `/api/otis/contacts/by-company/${runId}?${queryParams}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Response Error:', response.status, errorText)
        throw new Error(`Failed to fetch contacts by company: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Loaded contacts by company:', result.data)
      console.log('Sample company with category_size:', result.data.companies?.[0])

      if (result.success) {
        setContactsByCompany(result.data.companies || [])
        
        // Also set flat contacts for backward compatibility
        const flatContacts = (result.data.companies || []).flatMap((company: any) => 
          company.contacts.map((contact: any) => ({
            ...contact,
            companyName: company.name,
            companyWebsite: company.website,
            companyCategorySize: company.category_size,
            companyQualification: company.qualification_status,
            companyLocation: company.location,
            region_plaats: company.region_plaats,
            region_platform: company.region_platform
          }))
        )

        // Remove duplicate contacts based on ID
        const uniqueContacts = flatContacts.filter((contact, index, self) => 
          index === self.findIndex(c => c.id === contact.id)
        )
        

        
        setLoadedContacts(uniqueContacts)

        toast({
          title: "Contacts Loaded",
          description: `Found ${result.data.total_contacts} contacts from ${result.data.total_companies} companies (${result.data.total_key_contacts} key contacts)`,
        })
      }
    } catch (error) {
      console.error('Error loading contacts by company:', error)
      toast({
        title: "Error",
        description: `Failed to load contacts: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      })
    } finally {
      setContactsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const stats = await supabaseService.getDashboardStats()
      setStats({
        totalJobs: stats.totalJobs || 0,
        totalCompanies: stats.totalCompanies || 0,
        todayJobs: stats.todayJobs || 0
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading stats:', error)
      }
    }
  }

  // Refresh functions for companies and contacts
  const [isRefreshingCompanies, setIsRefreshingCompanies] = useState(false)
  const [isRefreshingContacts, setIsRefreshingContacts] = useState(false)

  const refreshCompanies = async () => {
    if (!currentRunData?.apify_run?.id) {
      toast({
        title: "No Run Selected",
        description: "Please select an existing run first",
        variant: "destructive"
      })
      return
    }

    setIsRefreshingCompanies(true)
    try {
      toast({
        title: "Refreshing Companies",
        description: "Loading updated company data...",
      })

      // Fetch updated data from the specific Apify run
      const response = await fetch(`/api/otis/scraping-results/run/${currentRunData.apify_run.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load run data')
      }

      const { data } = result

      // Update the companies data
      if (data.companies) {
        setLoadedCompanies(data.companies)
      }

      // Update the current run data
      setCurrentRunData(data)

      toast({
        title: "Companies Refreshed",
        description: `Updated ${data.companies?.length || 0} companies`,
      })
    } catch (error) {
      console.error('Error refreshing companies:', error)
      toast({
        title: "Error",
        description: `Failed to refresh companies: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      })
    } finally {
      setIsRefreshingCompanies(false)
    }
  }

  const refreshContacts = async () => {
    if (!currentRunData?.apify_run?.id) {
      toast({
        title: "No Run Selected",
        description: "Please select an existing run first",
        variant: "destructive"
      })
      return
    }

    setIsRefreshingContacts(true)
    try {
      toast({
        title: "Refreshing Contacts",
        description: "Loading updated contact data...",
      })

      // Reload contacts data for this specific run with cache bypass
      await loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search, true)

      toast({
        title: "Contacts Refreshed",
        description: `Updated contact data from Apollo enrichment`,
      })
    } catch (error) {
      console.error('Error refreshing contacts:', error)
      toast({
        title: "Error",
        description: `Failed to refresh contacts: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      })
    } finally {
      setIsRefreshingContacts(false)
    }
  }

  const loadRecentJobPostings = async () => {
    try {
      const result = await supabaseService.getJobPostings({ limit: 10 })
      setRecentJobPostings(result.data || [])
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading recent job postings:', error)
      }
    }
  }

  const loadInstantlyCampaigns = async () => {
    try {
      const response = await fetch("/api/instantly-campaigns", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      })
      if (response.ok) {
        const data = await response.json()
        setInstantlyCampaigns(data.campaigns || [])
      } else {
        console.error('Failed to load Instantly campaigns:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading Instantly campaigns:', error)
    }
  }

  const handleStartScraping = async () => {
    if (scrapingMode === 'new') {
      if (scrapingConfig.selectedRegioPlatforms.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one Regio Platform",
          variant: "destructive"
        })
        return
      }
      await startNewScraping()
    } else {
      if (!selectedExistingRun) {
        toast({
          title: "Validation Error",
          description: "Please select an existing Apify run",
          variant: "destructive"
        })
        return
      }
      await useExistingRun()
    }
  }

  const startNewScraping = async () => {
    setIsScraping(true)
    setScrapingProgress(0)

    // Create new scraping job
    const newJob: ScrapingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jobTitle: scrapingConfig.jobTitle,
      platform: scrapingConfig.platform,
      selectedRegioPlatforms: scrapingConfig.selectedRegioPlatforms,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    setScrapingJobs(prev => [newJob, ...prev])

    try {
      // Get the selected platform's webhook URL
      const selectedSource = jobSources.find(source => source.name === scrapingConfig.platform)
      const webhookUrl = selectedSource?.webhook_url

      // Start scraping via workflow API
      const response = await fetch('/api/otis/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          action: 'start_scraping',
          data: {
            jobTitle: scrapingConfig.jobTitle,
            platform: scrapingConfig.platform,
            selectedRegioPlatforms: scrapingConfig.selectedRegioPlatforms,
            webhookUrl: webhookUrl
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update job status
        setScrapingJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { ...job, status: 'running', id: result.jobId }
            : job
        ))

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setScrapingProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + 10
          })
        }, 1000)

        toast({
          title: "Scraping Started",
          description: `Started scraping ${scrapingConfig.jobTitle || 'jobs'} with ${scrapingConfig.selectedRegioPlatforms.length} platforms`,
        })

        // Reset form
        setScrapingConfig({
          jobTitle: '',
          platform: 'indeed',
          selectedRegioPlatforms: []
        })

        // Complete after 5 seconds (simulation)
        setTimeout(() => {
          setScrapingProgress(100)
          setScrapingJobs(prev => prev.map(job => 
            job.id === newJob.id 
              ? { ...job, status: 'completed', resultsCount: Math.floor(Math.random() * 50) + 10 }
              : job
          ))
          setIsScraping(false)
          setScrapingProgress(0)
          loadStats()
          loadRecentJobPostings()
          
          toast({
            title: "Scraping Completed",
            description: `Found ${Math.floor(Math.random() * 50) + 10} job postings`,
          })
        }, 5000)

      } else {
        throw new Error('Failed to start scraping')
      }

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error starting scraping:', error)
      }
      setScrapingJobs(prev => prev.map(job => 
        job.id === newJob?.id 
          ? { ...job, status: 'failed' }
          : job
      ))
      setIsScraping(false)
      setScrapingProgress(0)
      
      toast({
        title: "Scraping Failed",
        description: "Failed to start scraping. Please try again.",
        variant: "destructive"
      })
    }
  }

  const useExistingRun = async () => {
    if (!selectedExistingRun) return

    setIsScraping(true)
    setScrapingProgress(10)

    try {
      // Create job entry for existing run
      const newJob: ScrapingJob = {
        id: selectedExistingRun.id,
        jobTitle: selectedExistingRun.title,
        platform: selectedExistingRun.platform,
        status: 'running',
        createdAt: selectedExistingRun.createdAt
      }

      setScrapingJobs(prev => [newJob, ...prev])

      toast({
        title: "Loading Existing Data",
        description: `Loading results from ${selectedExistingRun.displayName}`,
      })

      setScrapingProgress(30)

      // Fetch actual data from the specific Apify run
      const response = await fetch(`/api/otis/scraping-results/run/${selectedExistingRun.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      })
      
      setScrapingProgress(60)

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const result = await response.json()
      
      setScrapingProgress(80)

      if (!result.success) {
        throw new Error(result.error || 'Failed to load run data')
      }

      const { data } = result
      const actualResultsCount = data.job_count || 0
      const companiesCount = data.total_companies || 0

      // Update the scraping job with actual results
      setScrapingJobs(prev => prev.map(job => 
        job.id === selectedExistingRun.id 
          ? { ...job, status: 'completed', resultsCount: actualResultsCount }
          : job
      ))

      // Stats will be updated when loadStats() is called

      // Set the recent job postings to show data from this run
      // Note: The API returns companies with job details, but we need job postings for the table
      // We can extract job postings from the companies data
      const jobPostingsFromRun: any[] = []
      if (data.companies) {
        data.companies.forEach((company: any) => {
          if (company.jobs) {
            company.jobs.forEach((job: any) => {
              jobPostingsFromRun.push({
                id: job.id,
                title: job.title,
                location: job.location,
                status: job.status,
                url: job.url,
                created_at: job.created_at,
                companyName: company.name,
                company: {
                  name: company.name,
                  website: company.website,
                  location: company.location
                }
              })
            })
          }
        })
      }

      // Update recent job postings to show this run's data
      if (jobPostingsFromRun.length > 0) {
        setRecentJobPostings(jobPostingsFromRun.slice(0, 10)) // Show up to 10 most recent
      }

      // Store the companies data from this run
      if (data.companies) {
        setLoadedCompanies(data.companies)
      }

      // Store the current run data for reference
      setCurrentRunData(data)

      // Load contacts data for this specific run
      if (selectedExistingRun?.id) {
        await loadContactsByCompany(selectedExistingRun.id, contactFilters.search)
      } else {
        console.warn('No selectedExistingRun.id available for loading contacts')
      }

      setScrapingProgress(100)
      
      toast({
        title: "Data Loaded Successfully", 
        description: `Loaded ${actualResultsCount} job postings and ${companiesCount} companies`,
      })

      // Clear progress after a brief moment and navigate to companies tab
      setTimeout(() => {
        setScrapingProgress(0)
        setIsScraping(false)
        // Automatically navigate to COMPANIES tab after successful data loading
        setActiveTab('companies')
      }, 1000)

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error using existing run:', error)
      }
      setScrapingJobs(prev => prev.map(job => 
        job.id === selectedExistingRun?.id 
          ? { ...job, status: 'failed' }
          : job
      ))
      setIsScraping(false)
      setScrapingProgress(0)
      
      toast({
        title: "Error Loading Data",
        description: error instanceof Error ? error.message : "Failed to load existing run data",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Running</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Company qualification functions
  const qualifyCompany = async (companyId: string, status: 'qualified' | 'disqualified' | 'review') => {
    setIsQualifying(prev => new Set(prev).add(companyId))
    
    try {
      const response = await fetch('/api/otis/companies/qualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          companyId,
          qualification_status: status
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${status} company`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Update the company in loadedCompanies
        setLoadedCompanies(prev => 
          prev.map(company => 
            company.id === companyId 
              ? { ...company, qualification_status: status, qualification_timestamp: new Date().toISOString() }
              : company
          )
        )

        toast({
          title: "Success",
          description: result.data.message,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Error qualifying company:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update company qualification",
        variant: "destructive"
      })
    } finally {
      setIsQualifying(prev => {
        const newSet = new Set(prev)
        newSet.delete(companyId)
        return newSet
      })
    }
  }

  // Company enrichment function
  const enrichCompany = async (companyId: string) => {
    // Check rate limit before proceeding
    if (!webhookRateLimit.canCall(companyId)) {
      const remainingTime = webhookRateLimit.getRemainingTime(companyId)
      toast({
        title: "Rate Limited",
        description: `Please wait ${remainingTime} seconds before enriching this company again.`,
        variant: "destructive"
      })
      return
    }

    // Mark as loading to prevent duplicate calls
    webhookRateLimit.markAsLoading(companyId)
    setIsEnriching(prev => new Set(prev).add(companyId))
    
    try {
      // Find the company to get its details for the webhook call
      const company = loadedCompanies.find(c => c.id === companyId)
      if (!company) {
        throw new Error('Company not found')
      }

      // Call the webhook directly like the working implementation
      const response = await fetch('https://ba.grive-dev.com/webhook/receive-companies-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: company.name,
          website: company.website,
          location: company.location,
          company_id: company.id,
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to enrich company: ${response.statusText}`)
      }

      // Update the company enrichment status to completed immediately
      setLoadedCompanies(prev => 
        prev.map(comp => 
          comp.id === companyId 
            ? { 
                ...comp, 
                enrichment_status: 'completed',
                enrichment_started_at: new Date().toISOString(),
                enrichment_completed_at: new Date().toISOString()
              }
            : comp
        )
      )

      toast({
        title: "Enrichment Complete",
        description: `Successfully enriched ${company.name}`,
      })
    } catch (error: any) {
      console.error('Error enriching company:', error)
      
      // Update enrichment status to failed
      setLoadedCompanies(prev => 
        prev.map(company => 
          company.id === companyId 
            ? { ...company, enrichment_status: 'failed' }
            : company
        )
      )

      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich company data",
        variant: "destructive"
      })
    } finally {
      // Clean up loading states
      webhookRateLimit.markAsComplete(companyId)
      setIsEnriching(prev => {
        const newSet = new Set(prev)
        newSet.delete(companyId)
        return newSet
      })
    }
  }

  // Company selection functions
  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(companyId)) {
        newSet.delete(companyId)
      } else {
        newSet.add(companyId)
      }
      return newSet
    })
  }

  const selectAllCompanies = () => {
    if (selectedCompanies.size === loadedCompanies.length) {
      setSelectedCompanies(new Set())
    } else {
      setSelectedCompanies(new Set(loadedCompanies.map(c => c.id)))
    }
  }

  // Bulk qualification function
  const bulkQualifyCompanies = async (status: 'qualified' | 'disqualified' | 'review') => {
    const companyIds = Array.from(selectedCompanies)
    if (companyIds.length === 0) return

    companyIds.forEach(id => setIsQualifying(prev => new Set(prev).add(id)))
    
    try {
      const response = await fetch('/api/otis/companies/qualify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds,
          qualification_status: status
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to bulk ${status} companies`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Update all selected companies
        setLoadedCompanies(prev => 
          prev.map(company => 
            companyIds.includes(company.id)
              ? { ...company, qualification_status: status, qualification_timestamp: new Date().toISOString() }
              : company
          )
        )

        setSelectedCompanies(new Set()) // Clear selection

        toast({
          title: "Bulk Update Successful",
          description: result.data.message,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Error bulk qualifying companies:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to bulk update companies",
        variant: "destructive"
      })
    } finally {
      companyIds.forEach(id => 
        setIsQualifying(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      )
    }
  }

  // Company Details Drawer Handlers
  const openCompanyDetails = (companyId: string) => {
    setSelectedCompanyForDetails(companyId)
    setIsCompanyDrawerOpen(true)
  }

  const closeCompanyDetails = () => {
    setIsCompanyDrawerOpen(false)
    setSelectedCompanyForDetails(null)
  }

  // Contact Qualification Handler
  const handleContactQualification = async (contactId: string, status: string) => {
    try {
      const response = await fetch('/api/otis/contacts/qualification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId,
          qualification_status: status
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Contact qualification API error:', response.status, errorText)
        throw new Error(`Failed to update contact qualification: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Contact Updated",
          description: `Contact ${status} successfully`,
          variant: "default"
        })
        
        // Reload contacts to reflect the change with cache bypass
        if (currentRunData?.apify_run?.id) {
          await loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search, true)
        }
      } else {
        throw new Error(result.error || 'API returned success: false')
      }
    } catch (error) {
      console.error('Contact qualification error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update contact qualification",
        variant: "destructive"
      })
    }
  }

  // Bulk Contact Qualification Handler
  const handleBulkContactQualification = async (status: string) => {
    if (selectedContacts.size === 0) return

    try {
      const contactIds = Array.from(selectedContacts)
      const response = await fetch('/api/otis/contacts/qualification/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactIds,
          qualification_status: status
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update contacts qualification')
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Contacts Updated",
          description: result.data.message,
          variant: "default"
        })
        
        // Clear selection and reload contacts with cache bypass
        setSelectedContacts(new Set())
        if (currentRunData?.apify_run?.id) {
          await loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search, true)
        }
      }
    } catch (error) {
      console.error('Error updating contacts qualification:', error)
      toast({
        title: "Error",
        description: "Failed to update contacts qualification",
        variant: "destructive"
      })
    }
  }

  // Add Selected Contacts to Campaign Handler
  const handleAddToCampaign = async () => {
    if (selectedContacts.size === 0 || !selectedCampaign) return



    // Show confirmation modal instead of directly adding to campaign
    setIsModalOpen(true)
  }

  const handleModalConfirm = async () => {
    if (selectedContacts.size === 0 || !selectedCampaign) return

    setModalLoading(true)
    setModalError(null)
    
    // Initialize progress tracking
    setModalProgress({
      percentage: 0,
      completedSteps: 0,
      totalSteps: 2,
      currentStep: 'creation'
    })
    
    setModalSteps({
      step1: {
        name: 'Lead Creation',
        completed: false,
        created: 0,
        total: selectedContacts.size,
        status: 'pending'
      },
      step2: {
        name: 'Campaign Movement',
        completed: false,
        moved: 0,
        total: 0,
        status: 'pending'
      }
    })
    
    try {
      const contactIds = Array.from(selectedContacts)
      const campaignObj = instantlyCampaigns.find((c) => c.id === selectedCampaign)
      const campaignName = campaignObj ? campaignObj.name : ""

      // Call the API to add contacts to campaign
      const response = await fetch('/api/otis/contacts/add-to-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactIds,
          campaignId: selectedCampaign,
          campaignName,
          runId: currentRunData?.apify_run?.id
        })
      })

      const result = await response.json()
      
      // Handle enhanced API response
      if (result.success || result.data) {
        const data = result.data || result
        
        // Update progress and steps from API response
        if (data.progress) {
          setModalProgress(data.progress)
        }
        if (data.steps) {
          setModalSteps(data.steps)
        }
        
        // Handle severity and retry recommendations
        if (data.severity) {
          setModalSeverity(data.severity)
        }
        if (data.retryRecommendations) {
          setModalRetryRecommendations(data.retryRecommendations)
        }
        
        // Show appropriate toast based on severity
        if (data.severity === 'success') {
          toast({
            title: "Success",
            description: data.message || `${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} added to "${campaignName}"`,
            variant: "default"
          })
          
          // Clear selection and reload contacts on success
          setSelectedContacts(new Set())
          setSelectedCampaign("")
          if (currentRunData?.apify_run?.id) {
            await loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search)
          }
          
          // Close modal after a short delay to show success state
          setTimeout(() => {
            setIsModalOpen(false)
            setModalProgress(undefined)
            setModalSteps(undefined)
            setModalRetryRecommendations([])
          }, 2000)
          
        } else if (data.severity === 'warning') {
          toast({
            title: "Partial Success",
            description: data.message || "Some contacts were added successfully",
            variant: "default"
          })
          
          // Don't close modal for warnings, let user see details
          setModalError(data.message)
          
        } else {
          // Error case
          setModalError(data.message || 'Failed to add contacts to campaign')
          toast({
            title: "Error",
            description: data.message || "Failed to add contacts to campaign",
            variant: "destructive"
          })
        }
      } else {
        // Handle legacy error response
        throw new Error(result.error || 'Failed to add contacts to campaign')
      }
    } catch (error) {
      console.error('Error adding contacts to campaign:', error)
      setModalError(error instanceof Error ? error.message : 'Failed to add contacts to campaign')
      setModalSeverity('error')
      setModalRetryRecommendations(['Please check your connection and try again'])
      toast({
        title: "Error",
        description: "Failed to add contacts to campaign",
        variant: "destructive"
      })
    } finally {
      setModalLoading(false)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setModalError(null)
    setModalLoading(false)
    // Reset enhanced modal state
    setModalProgress(undefined)
    setModalSteps(undefined)
    setModalRetryRecommendations([])
    setModalSeverity('error')
  }

  // Enhanced company section renderer with workflow-specific styling and actions
  const renderCompaniesSection = (companies: any[], qualificationState: string) => {
    if (companies.length === 0) {
      const emptyMessages = {
        enriched: { 
          icon: '💎', 
          title: 'No enriched companies yet',
          message: 'Companies that have been enriched with Apollo data will appear here.'
        },
        qualified: { 
          icon: '❌', 
          title: 'No qualified companies yet',
          message: 'Companies you mark as qualified will appear here, ready for Apollo enrichment.'
        },
        review: { 
          icon: '✨', 
          title: 'No companies need review',
          message: 'Companies marked for review will appear here when manual verification is needed.'
        },
        disqualified: { 
          icon: '👍', 
          title: 'No disqualified companies',
          message: 'Companies marked as not suitable will be archived here.'
        },
        pending: { 
          icon: '🚀', 
          title: 'All companies processed!',
          message: 'Great work! All companies have been processed through your qualification workflow.'
        }
      }
      const empty = emptyMessages[qualificationState as keyof typeof emptyMessages] || emptyMessages.pending

      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">{empty.icon}</div>
          <h3 className="font-medium text-gray-700 mb-2">{empty.title}</h3>
          <p className="text-sm max-w-md mx-auto">{empty.message}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Bulk Actions Bar for each qualification state */}
        {companies.length > 0 && (
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            qualificationState === 'qualified' 
              ? 'bg-green-50 border-green-200' 
              : qualificationState === 'review'
              ? 'bg-yellow-50 border-yellow-200'
              : qualificationState === 'disqualified'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-4">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-orange-600 rounded border-gray-300"
                checked={companies.every(c => selectedCompanies.has(c.id))}
                onChange={() => {
                  const allSelected = companies.every(c => selectedCompanies.has(c.id))
                  companies.forEach(company => {
                    if (allSelected) {
                      setSelectedCompanies(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(company.id)
                        return newSet
                      })
                    } else {
                      setSelectedCompanies(prev => new Set(prev).add(company.id))
                    }
                  })
                }}
              />
              <span className="text-sm font-medium">
                Select All {qualificationState === 'enriched' ? 'Enriched' :
                          qualificationState === 'qualified' ? 'Qualified' : 
                          qualificationState === 'review' ? 'Review' :
                          qualificationState === 'disqualified' ? 'Disqualified' : 'Unqualified'}
              </span>
              <div className="text-sm text-gray-600">
                {companies.filter(c => selectedCompanies.has(c.id)).length} of {companies.length} selected
              </div>
            </div>
            <div className="flex items-center gap-2">
              {qualificationState === 'qualified' && (
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Enrich Selected ({companies.filter(c => selectedCompanies.has(c.id)).length})
                </Button>
              )}
              {qualificationState === 'pending' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                    onClick={() => {
                      const selectedIds = companies.filter(c => selectedCompanies.has(c.id)).map(c => c.id)
                      selectedIds.forEach(id => setIsQualifying(prev => new Set(prev).add(id)))
                      // Bulk qualify logic would go here
                      bulkQualifyCompanies('qualified')
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                    onClick={() => bulkQualifyCompanies('review')}
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Mark for Review
                  </Button>
                </>
              )}
              {qualificationState === 'review' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                    onClick={() => bulkQualifyCompanies('qualified')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                    onClick={() => bulkQualifyCompanies('disqualified')}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Disqualify Selected
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Company Cards with workflow-specific styling */}
        {companies.map((company: any) => (
          <div 
            key={company.id} 
            className={`border rounded-lg p-4 space-y-3 transition-all hover:shadow-lg ${
              qualificationState === 'qualified' 
                ? 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm' 
                : qualificationState === 'disqualified'
                ? 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-rose-50 opacity-75'
                : qualificationState === 'review'
                ? 'border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50 ring-1 ring-yellow-200'
                : 'border-l-4 border-l-gray-300 bg-white hover:bg-gray-50'
            }`}
          >
            {/* Company Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-orange-600 rounded border-gray-300"
                  checked={selectedCompanies.has(company.id)}
                  onChange={() => toggleCompanySelection(company.id)}
                />
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${
                    qualificationState === 'enriched' ? 'text-purple-600' :
                    qualificationState === 'qualified' ? 'text-green-600' :
                    qualificationState === 'review' ? 'text-yellow-600' :
                    qualificationState === 'disqualified' ? 'text-red-400' :
                    'text-gray-500'
                  }`} />
                  <span className={`font-medium ${
                    qualificationState === 'enriched' ? 'text-purple-900' :
                    qualificationState === 'qualified' ? 'text-green-900' :
                    qualificationState === 'review' ? 'text-yellow-900' :
                    qualificationState === 'disqualified' ? 'text-red-700' :
                    'text-gray-900'
                  }`}>{company.name}</span>
                </div>
                {company.website && (
                  <a 
                    href={company.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {/* Enhanced Qualification Status Badge */}
                {qualificationState === 'enriched' && (
                  <Badge className="bg-purple-200 text-purple-800 font-semibold">💎 Enriched with Apollo</Badge>
                )}
                {qualificationState === 'qualified' && (
                  <Badge className="bg-green-200 text-green-800 font-semibold">✅ Ready for Apollo</Badge>
                )}
                {qualificationState === 'review' && (
                  <Badge className="bg-yellow-200 text-yellow-800 font-semibold animate-pulse">⭕ Needs Review</Badge>
                )}
                {qualificationState === 'disqualified' && (
                  <Badge className="bg-red-200 text-red-800">❌ Archived</Badge>
                )}
                {qualificationState === 'pending' && (
                  <Badge variant="outline" className="border-gray-400">⏳ Awaiting Qualification</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline">{company.job_count} jobs</Badge>
                {company.contactsFound > 0 && (
                  <Badge variant="secondary">{company.contactsFound} contacts</Badge>
                )}
                {/* Enrichment Status */}
                {company.enrichment_status === 'completed' && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Enriched
                  </Badge>
                )}
                {company.enrichment_status === 'processing' && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Enriching
                  </Badge>
                )}
                {company.enrichment_status === 'failed' && (
                  <Badge className="bg-red-100 text-red-800">❌ Enrich Failed</Badge>
                )}
              </div>
            </div>
            
            {/* Company Details */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {company.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {company.location}
                </div>
              )}
              {company.category_size && (
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {company.category_size}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(company.created_at)}
              </div>
            </div>

            {company.description && (
              <p className="text-sm text-gray-700 line-clamp-2">{company.description}</p>
            )}

            {/* Smart Action Buttons - Different per qualification state */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {qualificationState === 'enriched' ? (
                // Enriched: No qualification actions needed
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Enriched with Apollo
                  </Badge>
                </div>
              ) : qualificationState === 'qualified' ? (
                // Qualified: Focus on enrichment
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 text-xs">✅ Apollo Ready</Badge>
                </div>
              ) : qualificationState === 'review' ? (
                // Review: Quick decision actions
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'qualified')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : '✅ Qualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'disqualified')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : '❌ Disqualify'}
                  </Button>
                </div>
              ) : qualificationState === 'disqualified' ? (
                // Disqualified: Minimal actions
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-gray-500 text-xs"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'review')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Move to Review'}
                  </Button>
                </div>
              ) : (
                // Unqualified: Full qualification options
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'qualified')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Qualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'disqualified')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Disqualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'review')}
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Review'}
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {/* Only show Enrich button for qualified companies */}
                {qualificationState === 'qualified' && (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 font-semibold shadow-sm"
                    disabled={company.enrichment_status === 'processing' || isEnriching.has(company.id)}
                    onClick={() => enrichCompany(company.id)}
                  >
                    {(company.enrichment_status === 'processing' || isEnriching.has(company.id)) ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Enriching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 mr-1" />
                        Enrich with Apollo
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => openCompanyDetails(company.id)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Enhanced contact section renderer with workflow-specific styling and actions (similar to companies)
  const renderContactsSection = (contacts: any[], qualificationState: string) => {
    if (contacts.length === 0) {
      const emptyMessages = {
        in_campaign: { 
          icon: '🎯', 
          title: 'No contacts in campaigns yet',
          message: 'Contacts added to campaigns will appear here for monitoring and management.'
        },
        qualified: { 
          icon: '❌', 
          title: 'No qualified contacts yet',
          message: 'Contacts you mark as qualified will appear here, ready for campaign addition.'
        },
        review: { 
          icon: '✨', 
          title: 'No contacts need review',
          message: 'Contacts marked for review will appear here when manual verification is needed.'
        },
        disqualified: { 
          icon: '👍', 
          title: 'No disqualified contacts',
          message: 'Contacts marked as not suitable will be archived here.'
        },
        pending: { 
          icon: '⏳', 
          title: 'No pending contacts',
          message: 'Contacts awaiting qualification will appear here for review.'
        },
        unqualified: { 
          icon: '🚀', 
          title: 'All contacts qualified!',
          message: 'Great work! All contacts have been processed through your qualification workflow.'
        }
      }
      const empty = emptyMessages[qualificationState as keyof typeof emptyMessages] || emptyMessages.pending

      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">{empty.icon}</div>
          <h3 className="font-medium text-gray-700 mb-2">{empty.title}</h3>
          <p className="text-sm max-w-md mx-auto">{empty.message}</p>
        </div>
      )
    }

    // Group contacts by company
    const contactsByCompany = contacts.reduce((acc: any, contact: any) => {
      const companyName = contact.companyName || 'Unknown Company'
      if (!acc[companyName]) {
        acc[companyName] = {
          name: companyName,
          website: contact.companyWebsite,
          category_size: contact.companyCategorySize || contact.category_size,
          location: contact.companyLocation || contact.location,
          region_plaats: contact.region_plaats,
          region_platform: contact.region_platform,
          contacts: []
        }
      }
      acc[companyName].contacts.push(contact)
      return acc
    }, {})

    const companyGroups = Object.values(contactsByCompany)

    return (
      <div className="space-y-6">
        {/* Bulk Actions Bar for each qualification state */}
        {contacts.length > 0 && (
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            qualificationState === 'qualified' 
              ? 'bg-green-50 border-green-200' 
              : qualificationState === 'review'
              ? 'bg-yellow-50 border-yellow-200'
              : qualificationState === 'disqualified'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-4">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-orange-600 rounded border-gray-300"
                checked={contacts.every(c => selectedContacts.has(c.id))}
                onChange={() => {
                  const allSelected = contacts.every(c => selectedContacts.has(c.id))
                  contacts.forEach(contact => {
                    if (allSelected) {
                      setSelectedContacts(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(contact.id)
                        return newSet
                      })
                    } else {
                      setSelectedContacts(prev => new Set(prev).add(contact.id))
                    }
                  })
                }}
              />
              <span className="text-sm font-medium">
                Select All {qualificationState === 'enriched' ? 'Enriched' :
                          qualificationState === 'qualified' ? 'Qualified' : 
                          qualificationState === 'review' ? 'Review' :
                          qualificationState === 'disqualified' ? 'Disqualified' : 'Unqualified'}
              </span>
              <div className="text-sm text-gray-600">
                {contacts.filter(c => selectedContacts.has(c.id)).length} of {contacts.length} selected
              </div>
            </div>
            <div className="flex items-center gap-2">
              {qualificationState === 'qualified' && (
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={contacts.filter(c => selectedContacts.has(c.id)).length === 0 || !selectedCampaign}
                  onClick={handleAddToCampaign}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Campaign ({contacts.filter(c => selectedContacts.has(c.id)).length})
                </Button>
              )}
              {qualificationState === 'pending' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={contacts.filter(c => selectedContacts.has(c.id)).length === 0}
                    onClick={() => handleBulkContactQualification('qualified')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={contacts.filter(c => selectedContacts.has(c.id)).length === 0}
                    onClick={() => handleBulkContactQualification('review')}
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Mark for Review
                  </Button>
                </>
              )}
              {qualificationState === 'review' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={contacts.filter(c => selectedContacts.has(c.id)).length === 0}
                    onClick={() => handleBulkContactQualification('qualified')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={contacts.filter(c => selectedContacts.has(c.id)).length === 0}
                    onClick={() => handleBulkContactQualification('disqualified')}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Disqualify Selected
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Company Groups with Contact Cards */}
        {companyGroups.map((companyGroup: any) => (
          <div key={companyGroup.name} className="border rounded-lg overflow-hidden">
            {/* Company Header */}
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-orange-600 rounded border-gray-300"
                    checked={companyGroup.contacts.every((c: any) => selectedContacts.has(c.id))}
                    ref={(el) => {
                      if (el) {
                        // Handle indeterminate state (some contacts selected but not all)
                        const selectedCount = companyGroup.contacts.filter((c: any) => selectedContacts.has(c.id)).length
                        el.indeterminate = selectedCount > 0 && selectedCount < companyGroup.contacts.length
                      }
                    }}
                    onChange={(e) => {
                      // Select/deselect all contacts in this company
                      const newSelected = new Set(selectedContacts)
                      if (e.target.checked) {
                        // Select all contacts in this company
                        companyGroup.contacts.forEach((contact: any) => {
                          newSelected.add(contact.id)
                        })
                      } else {
                        // Deselect all contacts in this company
                        companyGroup.contacts.forEach((contact: any) => {
                          newSelected.delete(contact.id)
                        })
                      }
                      setSelectedContacts(newSelected)
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-700" />
                    <div>
                      <span className="font-medium text-lg">{companyGroup.name}</span>
                      <p className="text-sm text-gray-600">
                        {companyGroup.website} • {companyGroup.contacts.length} contacts
                        {companyGroup.category_size && ` • ${companyGroup.category_size}`}
                        {companyGroup.location && ` • 📍 ${companyGroup.location}`}
                        {companyGroup.region_plaats && ` • 🏢 ${companyGroup.region_plaats}`}
                        {companyGroup.region_platform && ` • 🌐 ${companyGroup.region_platform}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{companyGroup.contacts.length} contacts</Badge>
                  {companyGroup.contacts.some((c: any) => c.isKeyContact) && (
                    <Badge className="bg-yellow-100 text-yellow-800">👑 Key Contacts</Badge>
                  )}
                  {companyGroup.contacts.some((c: any) => c.verificationStatus === 'verified') && (
                    <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>
                  )}
                  {/* Show selection count for this company */}
                  <Badge variant="secondary">
                    {companyGroup.contacts.filter((c: any) => selectedContacts.has(c.id)).length} selected
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contact Cards */}
            <div className="p-4 space-y-3">
              {companyGroup.contacts.map((contact: any) => (
                <div 
                  key={contact.id} 
                  className={`border rounded-lg p-4 space-y-3 transition-all hover:shadow-lg ${
                    qualificationState === 'qualified' 
                      ? 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm' 
                      : qualificationState === 'disqualified'
                      ? 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-rose-50 opacity-75'
                      : qualificationState === 'review'
                      ? 'border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50 ring-1 ring-yellow-200'
                      : 'border-l-4 border-l-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  {/* Contact Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-orange-600 rounded border-gray-300"
                        checked={selectedContacts.has(contact.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedContacts)
                          if (e.target.checked) {
                            newSelected.add(contact.id)
                          } else {
                            newSelected.delete(contact.id)
                          }
                          setSelectedContacts(newSelected)
                        }}
                      />
                      <div className="flex items-center gap-2">
                        {contact.isKeyContact && (
                          <span className="text-xl">👑</span>
                        )}
                        <div>
                          <div className={`font-medium ${
                            qualificationState === 'qualified' ? 'text-green-900' :
                            qualificationState === 'review' ? 'text-yellow-900' :
                            qualificationState === 'disqualified' ? 'text-red-700' :
                            'text-gray-900'
                          }`}>
                            {contact.first_name || contact.last_name 
                              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                              : contact.name || 'No name'
                            }
                          </div>
                          {contact.title && (
                            <div className="text-sm text-gray-600">{contact.title}</div>
                          )}
                        </div>
                      </div>
                      {/* Enhanced Qualification Status Badge */}
                      {qualificationState === 'qualified' && (
                        <Badge className="bg-green-200 text-green-800 font-semibold">✅ Ready for Campaign</Badge>
                      )}
                      {qualificationState === 'review' && (
                        <Badge className="bg-yellow-200 text-yellow-800 font-semibold animate-pulse">⭕ Needs Review</Badge>
                      )}
                      {qualificationState === 'disqualified' && (
                        <Badge className="bg-red-200 text-red-800">❌ Archived</Badge>
                      )}
                      {qualificationState === 'pending' && (
                        <Badge variant="outline" className="border-gray-400">⏳ Awaiting Qualification</Badge>
                      )}
                      
                      {/* Campaign Status Badge */}
                      {contact.campaign_id && contact.campaign_name && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          <Target className="w-3 h-3 mr-1" />
                          {contact.campaign_name}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {contact.isKeyContact && (
                        <Badge className="bg-yellow-100 text-yellow-800">👑 Key Contact</Badge>
                      )}
                      {contact.verificationStatus === 'verified' && (
                        <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>
                      )}
                      {contact.verificationStatus === 'pending' && (
                        <Badge variant="outline">⏳ Pending</Badge>
                      )}
                      {contact.verificationStatus === 'failed' && (
                        <Badge className="bg-red-100 text-red-800">❌ Failed</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Contact Details */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>📧</span>
                      {contact.email || 'No email'}
                    </div>
                    {contact.linkedin_url && (
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        LinkedIn Profile
                      </a>
                    )}
                    {contact.companyWebsite && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {contact.companyWebsite}
                      </div>
                    )}
                  </div>

                  {/* Smart Action Buttons - Different per qualification state */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    {qualificationState === 'qualified' ? (
                      // Qualified: Focus on campaign addition
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 text-xs">✅ Campaign Ready</Badge>
                      </div>
                    ) : qualificationState === 'review' ? (
                      // Review: Quick decision actions
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleContactQualification(contact.id, 'qualified')}
                        >
                          ✅ Qualify
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleContactQualification(contact.id, 'disqualified')}
                        >
                          ❌ Disqualify
                        </Button>
                      </div>
                    ) : qualificationState === 'disqualified' ? (
                      // Disqualified: Minimal actions
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-gray-500 text-xs"
                          onClick={() => handleContactQualification(contact.id, 'review')}
                        >
                          Move to Review
                        </Button>
                      </div>
                    ) : (
                      // Unqualified: Full qualification options
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleContactQualification(contact.id, 'qualified')}
                        >
                          Qualify
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleContactQualification(contact.id, 'disqualified')}
                        >
                          Disqualify
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                          onClick={() => handleContactQualification(contact.id, 'review')}
                        >
                          Review
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {/* Only show Add to Campaign button for qualified contacts */}
                      {qualificationState === 'qualified' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 font-semibold shadow-sm"
                          disabled={!selectedCampaign}
                          onClick={handleAddToCampaign}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add to Campaign
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">OTIS Agent Dashboard</h1>
          </div>
          <p className="text-gray-600">Intelligent job vacancy scraping and management system</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold">{stats.totalJobs.toLocaleString()}</p>
                </div>
                <Briefcase className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Companies</p>
                  <p className="text-2xl font-bold">{stats.totalCompanies.toLocaleString()}</p>
                </div>
                <Building2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Jobs</p>
                  <p className="text-2xl font-bold">{stats.todayJobs.toLocaleString()}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="scraping">1. SCRAPE</TabsTrigger>
            <TabsTrigger value="companies">2. COMPANIES</TabsTrigger>
            <TabsTrigger value="contacts">3. CONTACTS</TabsTrigger>
          </TabsList>

          <TabsContent value="scraping" className="space-y-6">
            {/* Mode Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Scraping Configuration
                </CardTitle>
                <CardDescription>
                  Choose how you want to gather job data - start a new scraping job or use existing results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mode Selection Tabs */}
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setScrapingMode('new')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all hover-lift ${
                      scrapingMode === 'new'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Start New Scraping
                  </button>
                  <button
                    onClick={() => setScrapingMode('existing')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all hover-lift ${
                      scrapingMode === 'existing'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    Use Existing Run
                  </button>
                </div>

                {/* New Scraping Form */}
                {scrapingMode === 'new' && (
                  <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="jobTitle" className="flex items-center gap-2">
                          Job Title
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Input
                          id="jobTitle"
                          placeholder="e.g., Software Engineer, Marketing Manager"
                          value={scrapingConfig.jobTitle}
                          onChange={(e) => setScrapingConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                          className="mt-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to scrape all job types
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="platform">Platform</Label>
                        <Select 
                          value={scrapingConfig.platform} 
                          onValueChange={(value) => setScrapingConfig(prev => ({ ...prev, platform: value }))}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {jobSources.map(source => (
                              <SelectItem key={source.id} value={source.name}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{source.name}</span>
                                  {source.cost_per_1000_results && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      ${source.cost_per_1000_results}/1k
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        Regio Platforms
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      </Label>
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {regions.map((platform) => (
                            <div key={platform} className="flex items-center space-x-2">
                              <Checkbox
                                id={platform}
                                checked={scrapingConfig.selectedRegioPlatforms.includes(platform)}
                                onCheckedChange={(checked) => {
                                  setScrapingConfig(prev => ({
                                    ...prev,
                                    selectedRegioPlatforms: checked 
                                      ? [...prev.selectedRegioPlatforms, platform]
                                      : prev.selectedRegioPlatforms.filter(p => p !== platform)
                                  }))
                                }}
                              />
                              <Label htmlFor={platform} className="text-sm font-normal cursor-pointer flex-1">
                                {platform}
                              </Label>
                            </div>
                          ))}
                        </div>
                        {scrapingConfig.selectedRegioPlatforms.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                Selected: {scrapingConfig.selectedRegioPlatforms.length} platform{scrapingConfig.selectedRegioPlatforms.length !== 1 ? 's' : ''}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScrapingConfig(prev => ({ ...prev, selectedRegioPlatforms: [] }))}
                              >
                                Clear All
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Existing Run Selection */}
                {scrapingMode === 'existing' && (
                  <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Label>
                          Select & Manage Existing Runs
                        </Label>
                        
                        {!isLoadingExistingRuns && existingRuns.length > 0 && (
                          <div className="flex items-center gap-3">
                            <ViewModeToggle
                              currentMode={viewMode}
                              onModeChange={setViewMode}
                              availableModes={['list']}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Status filters and stats */}
                      {!isLoadingExistingRuns && existingRuns.length > 0 && (
                        <div className="space-y-3">
                          <StatusFilterPills
                            activeFilter={processingHooks.activeFilter}
                            counts={processingHooks.statusCounts}
                            onFilterChange={processingHooks.setActiveFilter}
                          />
                          <StatusStats counts={processingHooks.statusCounts} />
                        </div>
                      )}
                      
                      {isLoadingExistingRuns ? (
                        <div className="border rounded-lg p-8 text-center">
                          <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-400" />
                          <p className="text-gray-600">Loading existing runs...</p>
                        </div>
                      ) : existingRuns.length === 0 ? (
                        <div className="border rounded-lg p-8 text-center bg-gray-50">
                          <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <h3 className="font-medium text-gray-900 mb-2">No Existing Runs Found</h3>
                          <p className="text-gray-500 mb-4">
                            Start your first scraping job to see results here
                          </p>
                          <Button 
                            onClick={() => setScrapingMode('new')}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Start New Scraping
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Virtualized runs list */}
                          <VirtualizedRunList
                            runs={processingHooks.runs}
                            selectedRun={selectedRunId}
                            onRunSelect={setSelectedRunId}
                            onStatusChange={processingHooks.updateRunStatus}
                            onNotesChange={processingHooks.updateRunNotes}
                            height={600}
                          />
                          
                          {/* Selection info for legacy compatibility */}
                          {selectedRunId && (
                            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-500" />
                                <span>
                                  Selected run will be used for workflow: 
                                  <span className="font-medium ml-1">
                                    {processingHooks.runs.find(r => r.id === selectedRunId)?.displayName}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}
                          
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {isScraping && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        {scrapingMode === 'new' ? 'Starting new scraping...' : 'Loading existing data...'}
                      </span>
                      <span>{scrapingProgress}%</span>
                    </div>
                    <Progress value={scrapingProgress} className="w-full" />
                  </div>
                )}

                {/* Action Button */}
                <Button 
                  onClick={handleStartScraping} 
                  disabled={isScraping || 
                    (scrapingMode === 'new' && scrapingConfig.selectedRegioPlatforms.length === 0) ||
                    (scrapingMode === 'existing' && !selectedExistingRun)
                  }
                  className="w-full md:w-auto hover-lift"
                  size="lg"
                >
                  {isScraping ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {scrapingMode === 'new' ? 'Starting Scraping...' : 'Loading Data...'}
                    </>
                  ) : (
                    <>
                      {scrapingMode === 'new' ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Start New Scraping
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Use Selected Run
                        </>
                      )}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="companies" className="space-y-6">
            {/* Companies Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Companies Management
                      {currentRunData && (
                        <Badge variant="outline" className="ml-2">
                          From: {currentRunData.apify_run?.title || 'Selected Run'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {loadedCompanies.length > 0 
                        ? `Qualify companies and manage Apollo enrichment (${loadedCompanies.length} companies)`
                        : "No companies data loaded. Select an existing run to manage companies."
                      }
                    </CardDescription>
                  </div>
                  {currentRunData && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshCompanies}
                      className="flex items-center gap-2"
                      disabled={isRefreshingCompanies}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshingCompanies ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadedCompanies.length > 0 ? (
                  <>
                    {/* Qualification Progress Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600">💎 Enriched</p>
                            <p className="text-2xl font-bold text-purple-700">
                              {loadedCompanies.filter(c => c.qualification_status === 'enriched').length}
                            </p>
                            <p className="text-xs text-purple-600">Apollo data added</p>
                          </div>
                          <Sparkles className="w-8 h-8 text-purple-500" />
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">✅ Qualified</p>
                            <p className="text-2xl font-bold text-green-700">
                              {loadedCompanies.filter(c => c.qualification_status === 'qualified').length}
                            </p>
                            <p className="text-xs text-green-600">Ready for Apollo</p>
                          </div>
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-yellow-600">⭕ Review Needed</p>
                            <p className="text-2xl font-bold text-yellow-700">
                              {loadedCompanies.filter(c => c.qualification_status === 'review').length}
                            </p>
                            <p className="text-xs text-yellow-600">Needs attention</p>
                          </div>
                          <AlertCircle className="w-8 h-8 text-yellow-500" />
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">❌ Disqualified</p>
                            <p className="text-2xl font-bold text-red-700">
                              {loadedCompanies.filter(c => c.qualification_status === 'disqualified').length}
                            </p>
                            <p className="text-xs text-red-600">Not suitable</p>
                          </div>
                          <RefreshCw className="w-8 h-8 text-red-500" />
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">⏳ Unqualified</p>
                            <p className="text-2xl font-bold text-gray-700">
                              {loadedCompanies.filter(c => !c.qualification_status || c.qualification_status === 'pending').length}
                            </p>
                            <p className="text-xs text-gray-600">Needs qualification</p>
                          </div>
                          <Clock className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Qualification Workflow Tabs */}
                    <Tabs defaultValue="enriched" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="enriched" className="text-purple-700 data-[state=active]:bg-purple-100">
                          💎 Enriched ({loadedCompanies.filter(c => c.qualification_status === 'enriched').length})
                        </TabsTrigger>
                        <TabsTrigger value="qualified" className="text-green-700 data-[state=active]:bg-green-100">
                          ✅ Qualified ({loadedCompanies.filter(c => c.qualification_status === 'qualified').length})
                        </TabsTrigger>
                        <TabsTrigger value="review" className="text-yellow-700 data-[state=active]:bg-yellow-100">
                          ⭕ Review ({loadedCompanies.filter(c => c.qualification_status === 'review').length})
                        </TabsTrigger>
                        <TabsTrigger value="disqualified" className="text-red-700 data-[state=active]:bg-red-100">
                          ❌ Disqualified ({loadedCompanies.filter(c => c.qualification_status === 'disqualified').length})
                        </TabsTrigger>
                        <TabsTrigger value="pending" className="text-gray-700 data-[state=active]:bg-gray-100">
                          ⏳ Pending ({loadedCompanies.filter(c => !c.qualification_status || c.qualification_status === 'pending').length})
                        </TabsTrigger>
                      </TabsList>

                      {/* Enriched Companies - Successfully Enriched with Apollo */}
                      <TabsContent value="enriched" className="space-y-4">
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-purple-800">💎 Enriched Companies</h3>
                                <p className="text-sm text-purple-600">
                                  Companies successfully enriched with Apollo data
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {renderCompaniesSection(loadedCompanies.filter(c => c.qualification_status === 'enriched'), 'enriched')}
                      </TabsContent>

                      {/* Qualified Companies - Apollo Ready Zone */}
                      <TabsContent value="qualified" className="space-y-4">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-green-800">🚀 Apollo Enrichment Zone</h3>
                                <p className="text-sm text-green-600">
                                  {loadedCompanies.filter(c => c.qualification_status === 'qualified').length} qualified companies ready for enrichment
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="default" 
                                className="bg-green-600 hover:bg-green-700"
                                disabled={loadedCompanies.filter(c => c.qualification_status === 'qualified').length === 0}
                              >
                                <Zap className="w-4 h-4 mr-2" />
                                Enrich All Qualified
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderCompaniesSection(loadedCompanies.filter(c => c.qualification_status === 'qualified'), 'qualified')}
                      </TabsContent>

                      {/* Review Needed - Attention Required Zone */}
                      <TabsContent value="review" className="space-y-4">
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-yellow-800">⭕ Review Required</h3>
                                <p className="text-sm text-yellow-600">
                                  Companies marked for manual review - decide qualification status
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Quick Actions
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderCompaniesSection(loadedCompanies.filter(c => c.qualification_status === 'review'), 'review')}
                      </TabsContent>

                      {/* Disqualified - Archive Zone */}
                      <TabsContent value="disqualified" className="space-y-4">
                        <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <RefreshCw className="w-5 h-5 text-red-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-red-800">❌ Disqualified Companies</h3>
                                <p className="text-sm text-red-600">
                                  Companies not suitable for outreach - archived from workflow
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {renderCompaniesSection(loadedCompanies.filter(c => c.qualification_status === 'disqualified'), 'disqualified')}
                      </TabsContent>

                      {/* Pending - Triage Zone */}
                      <TabsContent value="pending" className="space-y-4">
                        <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Target className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-800">⏳ Qualification Needed</h3>
                                <p className="text-sm text-gray-600">
                                  New companies awaiting qualification - start your workflow here
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Bulk Qualify
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderCompaniesSection(loadedCompanies.filter(c => !c.qualification_status || c.qualification_status === 'pending'), 'pending')}
                      </TabsContent>
                    </Tabs>


                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No companies data available</p>
                    <p className="text-sm">Select an existing run to view companies data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            {/* Contact Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Contact Management
                      {currentRunData && (
                        <Badge variant="outline" className="ml-2">
                          From: {currentRunData.apify_run?.title || 'Selected Run'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {contactsLoading 
                        ? "Loading contacts from Apollo-enriched companies..."
                        : loadedContacts.length > 0 
                          ? `Qualify contacts and manage campaign addition (${loadedContacts.length} contacts)`
                          : "No contacts data loaded. Contacts are enriched from companies after scraping."
                      }
                    </CardDescription>
                  </div>
                  {currentRunData && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshContacts}
                      className="flex items-center gap-2"
                      disabled={contactsLoading || isRefreshingContacts}
                    >
                      <RefreshCw className={`w-4 h-4 ${contactsLoading || isRefreshingContacts ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {currentRunData ? (
                  <>
                    {/* Contact Status Cards - Matching Companies tab design */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600">🎯 In Campaigns</p>
                            <p className="text-2xl font-bold text-blue-700">
                              {getFilteredContacts().filter(c => c.qualificationStatus === 'in_campaign').length}
                            </p>
                            <p className="text-xs text-blue-600">Active in campaigns</p>
                          </div>
                          <Target className="w-8 h-8 text-blue-500" />
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">✅ Qualified</p>
                            <p className="text-2xl font-bold text-green-700">
                              {getFilteredContacts().filter(c => c.qualificationStatus === 'qualified').length}
                            </p>
                            <p className="text-xs text-green-600">Ready for Campaign</p>
                          </div>
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-yellow-600">⭕ Review Needed</p>
                            <p className="text-2xl font-bold text-yellow-700">
                              {getFilteredContacts().filter(c => c.qualificationStatus === 'review').length}
                            </p>
                            <p className="text-xs text-yellow-600">Needs attention</p>
                          </div>
                          <AlertCircle className="w-8 h-8 text-yellow-500" />
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">❌ Disqualified</p>
                            <p className="text-2xl font-bold text-red-700">
                              {getFilteredContacts().filter(c => c.qualificationStatus === 'disqualified').length}
                            </p>
                            <p className="text-xs text-red-600">Not suitable</p>
                          </div>
                          <RefreshCw className="w-8 h-8 text-red-500" />
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">⏳ Pending</p>
                            <p className="text-2xl font-bold text-gray-700">
                              {getFilteredContacts().filter(c => !c.qualificationStatus || c.qualificationStatus === 'pending').length}
                            </p>
                            <p className="text-xs text-gray-600">Needs qualification</p>
                          </div>
                          <Clock className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Campaign Selection Bar */}
                    <div className="relative flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      {/* Active Filters Display */}
                      {(localSearchTerm || contactFilters.campaignStatus !== 'all' || contactFilters.campaignId !== 'all') && (
                        <div className="absolute -top-2 left-4 bg-white px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded shadow-sm flex items-center gap-2">
                          <span>Active filters:</span>
                          {localSearchTerm && <span className="text-blue-600">"{localSearchTerm}"</span>}
                          {contactFilters.campaignStatus !== 'all' && (
                            <span className="text-green-600">
                              {contactFilters.campaignStatus === 'in_campaign' ? 'In Campaign' : 'Not in Campaign'}
                            </span>
                          )}
                          {contactFilters.campaignId !== 'all' && (
                            <span className="text-purple-600">
                              {instantlyCampaigns.find(c => c.id === contactFilters.campaignId)?.name || 'Specific Campaign'}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setLocalSearchTerm('')
                              setContactFilters({
                                qualification: 'all',
                                verification: 'all',
                                contactType: 'all',
                                campaignStatus: 'all',
                                campaignId: 'all',
                                search: ''
                              })
                              if (searchTimeout) {
                                clearTimeout(searchTimeout)
                              }
                              if (currentRunData?.apify_run?.id) {
                                loadContactsByCompany(currentRunData.apify_run.id, '')
                              }
                            }}
                            className="text-red-500 hover:text-red-700 ml-1"
                            title="Clear all filters"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        {/* Enhanced Contact Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Search by name, company, or email..."
                            value={localSearchTerm}
                            onChange={(e) => {
                              const newSearchTerm = e.target.value
                              setLocalSearchTerm(newSearchTerm)
                              setContactFilters(prev => ({ ...prev, search: newSearchTerm }))
                              
                              // Clear existing timeout
                              if (searchTimeout) {
                                clearTimeout(searchTimeout)
                              }
                              
                              // If search term is empty, immediately reset the filter
                              if (newSearchTerm === '') {
                                if (currentRunData?.apify_run?.id) {
                                  loadContactsByCompany(currentRunData.apify_run.id, '')
                                }
                              } else {
                                // Set new timeout for debounced search only if there's a search term
                                const timeout = setTimeout(() => {
                                  if (currentRunData?.apify_run?.id) {
                                    loadContactsByCompany(currentRunData.apify_run.id, newSearchTerm)
                                  }
                                }, 300) // Reduced from 500ms to 300ms for better responsiveness
                                
                                setSearchTimeout(timeout)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && currentRunData?.apify_run?.id) {
                                // Clear timeout and search immediately on Enter
                                if (searchTimeout) {
                                  clearTimeout(searchTimeout)
                                }
                                loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search)
                              }
                            }}
                            className="pl-10 pr-12 py-2 border border-gray-300 rounded-md text-sm w-80 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                            {contactFilters.search && (
                              <button
                                                              onClick={() => {
                                setLocalSearchTerm('')
                                setContactFilters(prev => ({ ...prev, search: '' }))
                                if (searchTimeout) {
                                  clearTimeout(searchTimeout)
                                }
                                if (currentRunData?.apify_run?.id) {
                                  loadContactsByCompany(currentRunData.apify_run.id, '')
                                }
                              }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Clear search"
                              >
                                ✕
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (searchTimeout) {
                                  clearTimeout(searchTimeout)
                                }
                                if (currentRunData?.apify_run?.id) {
                                  loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search)
                                }
                              }}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title="Search"
                            >
                              <Search className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Campaign Status Filter */}
                        <Select 
                          value={contactFilters.campaignStatus} 
                          onValueChange={(value) => {
                            setContactFilters(prev => ({ ...prev, campaignStatus: value }))
                            if (currentRunData?.apify_run?.id) {
                              loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search)
                            }
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Campaign Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Contacts</SelectItem>
                            <SelectItem value="in_campaign">📧 In Campaign</SelectItem>
                            <SelectItem value="not_in_campaign">⏳ Not in Campaign</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Specific Campaign Filter */}
                        <EnhancedCampaignFilter
                          campaigns={instantlyCampaigns}
                          selectedCampaignId={contactFilters.campaignId}
                          onCampaignChange={(value) => {
                            setContactFilters(prev => ({ ...prev, campaignId: value }))
                            if (currentRunData?.apify_run?.id) {
                              loadContactsByCompany(currentRunData.apify_run.id, contactFilters.search)
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {contactsLoading && (
                          <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                        )}
                        <EnhancedCampaignSelector
                          campaigns={instantlyCampaigns}
                          selectedCampaign={selectedCampaign}
                          onCampaignChange={setSelectedCampaign}
                        />
                      </div>
                    </div>

                    {/* Qualification Workflow Tabs - Matching Companies tab structure */}
                    <Tabs defaultValue="in_campaign" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="in_campaign" className="text-blue-700 data-[state=active]:bg-blue-100">
                          🎯 In Campaign ({getFilteredContacts().filter(c => c.qualificationStatus === 'in_campaign').length})
                        </TabsTrigger>
                        <TabsTrigger value="qualified" className="text-green-700 data-[state=active]:bg-green-100">
                          ✅ Qualified ({getFilteredContacts().filter(c => c.qualificationStatus === 'qualified').length})
                        </TabsTrigger>
                        <TabsTrigger value="review" className="text-yellow-700 data-[state=active]:bg-yellow-100">
                          ⭕ Review ({getFilteredContacts().filter(c => c.qualificationStatus === 'review').length})
                        </TabsTrigger>
                        <TabsTrigger value="disqualified" className="text-red-700 data-[state=active]:bg-red-100">
                          ❌ Disqualified ({getFilteredContacts().filter(c => c.qualificationStatus === 'disqualified').length})
                        </TabsTrigger>
                        <TabsTrigger value="pending" className="text-gray-700 data-[state=active]:bg-gray-100">
                          ⏳ Pending ({getFilteredContacts().filter(c => !c.qualificationStatus || c.qualificationStatus === 'pending').length})
                        </TabsTrigger>
                      </TabsList>

                      {/* In Campaign Contacts - Active in Campaigns */}
                      <TabsContent value="in_campaign" className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-blue-800">🎯 Contacts in Campaigns</h3>
                                <p className="text-sm text-blue-600">
                                  Contacts actively enrolled in campaigns - manage and monitor campaign performance
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {renderContactsSection(getFilteredContacts().filter(c => c.qualificationStatus === 'in_campaign'), 'in_campaign')}
                      </TabsContent>

                      {/* Qualified Contacts - Campaign Ready Zone */}
                      <TabsContent value="qualified" className="space-y-4">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Plus className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-green-800">🚀 Campaign Addition Zone</h3>
                                <p className="text-sm text-green-600">
                                  {loadedContacts.filter(c => c.qualificationStatus === 'qualified').length} qualified contacts ready for campaign addition
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="default" 
                                className="bg-green-600 hover:bg-green-700"
                                disabled={loadedContacts.filter(c => c.qualificationStatus === 'qualified').length === 0 || !selectedCampaign}
                                onClick={handleAddToCampaign}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add All Qualified to Campaign
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderContactsSection(getFilteredContacts().filter(c => c.qualificationStatus === 'qualified'), 'qualified')}
                      </TabsContent>

                      {/* Review Needed - Attention Required Zone */}
                      <TabsContent value="review" className="space-y-4">
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-yellow-800">⭕ Review Required</h3>
                                <p className="text-sm text-yellow-600">
                                  Contacts marked for manual review - decide qualification status
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Quick Actions
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderContactsSection(getFilteredContacts().filter(c => c.qualificationStatus === 'review'), 'review')}
                      </TabsContent>

                      {/* Disqualified - Archive Zone */}
                      <TabsContent value="disqualified" className="space-y-4">
                        <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <RefreshCw className="w-5 h-5 text-red-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-red-800">❌ Disqualified Contacts</h3>
                                <p className="text-sm text-red-600">
                                  Contacts not suitable for outreach - archived from workflow
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {renderContactsSection(getFilteredContacts().filter(c => c.qualificationStatus === 'disqualified'), 'disqualified')}
                      </TabsContent>

                      {/* Pending - Triage Zone */}
                      <TabsContent value="pending" className="space-y-4">
                        <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Target className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-800">⏳ Qualification Needed</h3>
                                <p className="text-sm text-gray-600">
                                  New contacts awaiting qualification - start your workflow here
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Bulk Qualify
                              </Button>
                            </div>
                          </div>
                        </div>
                        {renderContactsSection(getFilteredContacts().filter(c => !c.qualificationStatus || c.qualificationStatus === 'pending'), 'pending')}
                      </TabsContent>
                    </Tabs>

                    {/* No Results State - Show when there are no contacts due to filters */}
                    {getFilteredContacts().length === 0 && loadedContacts.length > 0 && currentRunData && (
                      <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="font-medium text-gray-700 mb-2">No contacts found</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          No contacts match your current search criteria and filters
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                          <span>Try adjusting your:</span>
                          <Badge variant="outline" className="text-xs">Search terms</Badge>
                          <Badge variant="outline" className="text-xs">Campaign filters</Badge>
                          <Badge variant="outline" className="text-xs">Status filters</Badge>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={() => {
                            setContactFilters({
                              qualification: 'all',
                              verification: 'all',
                              contactType: 'all',
                              campaignStatus: 'all',
                              campaignId: 'all',
                              search: ''
                            })
                            if (searchTimeout) {
                              clearTimeout(searchTimeout)
                            }
                            if (currentRunData?.apify_run?.id) {
                              loadContactsByCompany(currentRunData.apify_run.id, '')
                            }
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No contacts data available</p>
                    <p className="text-sm">
                      Select an Apify run to view contacts from Apollo-enriched companies
                    </p>
                    <p className="text-sm">
                      Go to the <strong>COMPANIES</strong> tab and enrich companies with Apollo to generate contacts
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Company Details Drawer */}
      <CompanyDetailsDrawer
        companyId={selectedCompanyForDetails}
        open={isCompanyDrawerOpen}
        onClose={closeCompanyDetails}
        onQualify={qualifyCompany}
        onEnrich={enrichCompany}
        isEnrichingExternal={selectedCompanyForDetails ? webhookRateLimit.isLoading(selectedCompanyForDetails) : false}
      />

      {/* Campaign Confirmation Modal */}
      <CampaignConfirmationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        selectedContacts={Array.from(selectedContacts).map(contactId => {
          const contact = loadedContacts.find(c => c.id === contactId)
          // Construct name from first_name and last_name, fallback to name field, then to 'Unknown Contact'
          const contactName = contact?.first_name || contact?.last_name 
            ? `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
            : contact?.name || 'Unknown Contact'
          

          
          return {
            id: contact?.id || contactId,
            name: contactName,
            first_name: contact?.first_name,
            last_name: contact?.last_name,
            email: contact?.email || '',
            title: contact?.title,
            companyName: contact?.companyName,
            qualificationStatus: contact?.qualificationStatus,
            isKeyContact: contact?.isKeyContact
          } as Contact
        })}
        selectedCampaign={selectedCampaign ? {
          id: selectedCampaign,
          name: instantlyCampaigns.find(c => c.id === selectedCampaign)?.name || 'Unknown Campaign',
          status: instantlyCampaigns.find(c => c.id === selectedCampaign)?.status
        } as Campaign : null}
        isLoading={modalLoading}
        error={modalError}
        onRetry={handleModalConfirm}
        onSuccess={() => {
          // Success is handled in handleModalConfirm
        }}
        onError={(error) => {
          setModalError(error)
        }}
        // Enhanced props for progress tracking
        progress={modalProgress}
        steps={modalSteps}
        retryRecommendations={modalRetryRecommendations}
        severity={modalSeverity}
      />
    </div>
  )
}

export default function OtisEnhancedPage() {
  return (
    <OtisErrorBoundary>
      <WorkflowProvider>
        <FullOtisDashboard />
      </WorkflowProvider>
    </OtisErrorBoundary>
  )
} 