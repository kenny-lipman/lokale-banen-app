"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Play, CheckCircle, AlertCircle, Database, Users, Mail, ChevronsUpDown, Check, RefreshCw, Building2, ExternalLink, X, Search, Clock, XCircle, Phone, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabaseService } from '@/lib/supabase-service'

interface ScrapingJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  jobTitle: string
  location: string
  platform: string
  apifyRunId?: string
  createdAt: string
  completedAt?: string
  jobCount?: number
  companyCount?: number
  detailedResults?: {
    status: string
    job_count: number
    companies: Array<{
      id: string
      name: string
      website: string
      location: string
      status: string
      job_count: number
      enrichment_status: string
      contactsFound: number
      category_size?: string
    }>
    jobs: Array<{
      id: string
      title: string
      location: string
      url: string
      job_type: string
      salary: string
      status: string
      review_status: string
      created_at: string
      company: {
        id: string
        name: string
        website: string
        location: string
        status: string
      } | null
    }>
    apify_run_id: string
  }
}

interface EnrichmentJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  companyCount: number
  contactsFound: number
  createdAt: string
  completedAt?: string
  contacts?: Array<{
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
  }>
}



interface Region {
  id: string
  plaats: string
  regio_platform: string
  created_at: string
}

interface ApifyRun {
  id: string
  title: string
  platform: string
  location: string
  regionPlatform: string
  createdAt: string
  finishedAt: string
  displayName: string
}

export default function SimplifiedOtisDashboard() {
  const { toast } = useToast()
  
  // Form state
  const [jobTitle, setJobTitle] = useState('')
  const [location, setLocation] = useState('')
  const [selectedRegionId, setSelectedRegionId] = useState<string>('')
  const [platform, setPlatform] = useState('indeed')
  
  // Existing run selection state
  const [useExistingRun, setUseExistingRun] = useState(false)
  const [existingRuns, setExistingRuns] = useState<ApifyRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>('')
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [runSearchTerm, setRunSearchTerm] = useState('')
  
  // Regions state
  const [regions, setRegions] = useState<Region[]>([])
  const [isLoadingRegions, setIsLoadingRegions] = useState(true)
  const [locationSearchOpen, setLocationSearchOpen] = useState(false)
  
  // Job states
  const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([])
  const [enrichmentJobs, setEnrichmentJobs] = useState<EnrichmentJob[]>([])
  
  // Loading states
  const [isStartingScraping, setIsStartingScraping] = useState(false)
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false)
  const [isRefreshingResults, setIsRefreshingResults] = useState<string | null>(null)
  
  // Polling state
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  
  // Company selection state
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [companyPage, setCompanyPage] = useState<Record<string, number>>({})
  const [companiesPerPage] = useState(100) // Show more companies at once with compact design
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  
  // Contact selection state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  
  // Campaign management state
  const [campaigns, setCampaigns] = useState<Array<{id: string, name: string, status: string}>>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
  const [linkingCampaign, setLinkingCampaign] = useState<string | null>(null)
  
  // Company drawer state
  const [selectedCompanyForDrawer, setSelectedCompanyForDrawer] = useState<string | null>(null)
  const [companyJobPostings, setCompanyJobPostings] = useState<any[]>([])
  const [isLoadingCompanyJobs, setIsLoadingCompanyJobs] = useState(false)

  // Collapsible section states
  const [configExpanded, setConfigExpanded] = useState(false)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const [contactsExpanded, setContactsExpanded] = useState(false)
  
  // Bulk campaign management state
  const [selectedCampaignForBulk, setSelectedCampaignForBulk] = useState<string>('')
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false)
  
  // Start job scraping
  const startScraping = async () => {
    if (!jobTitle.trim() || !selectedRegionId) {
      toast({
        title: "Validation Error",
        description: "Please fill in both job title and select a location",
        variant: "destructive"
      })
      return
    }

    setIsStartingScraping(true)
    
    try {
      const selectedRegion = getSelectedRegion()
      if (!selectedRegion) {
        throw new Error('Selected region not found')
      }

      const response = await fetch('/api/otis/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_scraping',
          data: {
            jobTitle: jobTitle.trim(),
            location: selectedRegion.plaats,
            platform,
            regionId: selectedRegion.id,
            regioPlatform: selectedRegion.regio_platform
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start scraping job')
      }

      const result = await response.json()
      
      const newJob: ScrapingJob = {
        id: result.jobId || `job_${Date.now()}`,
        status: 'pending',
        jobTitle: jobTitle.trim(),
        location: selectedRegion.plaats,
        platform,
        createdAt: new Date().toISOString()
      }
      
      // Replace any existing jobs when starting a new scraping (clear existing runs)
      setScrapingJobs([newJob])
      
      // Clear existing run selection when starting new scraping
      setSelectedRunId('')
      setCompanySearchTerm('')
      setSelectedCompanies(new Set())
      
      // Clear existing contacts when starting new scraping
      setEnrichmentJobs([])
      setSelectedContacts(new Set())
      setContactSearchTerm('')
      
      toast({
        title: "Scraping Started",
        description: `Job scraping started for "${jobTitle}" in ${selectedRegion.plaats}. Any existing runs have been cleared.`,
      })

      // Start background polling for this job (Refresh Results functionality)
      startBackgroundResultsPolling(newJob.id)
      
    } catch (error) {
      console.error('Error starting scraping:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start scraping",
        variant: "destructive"
      })
    } finally {
      setIsStartingScraping(false)
    }
  }

  // Start Apollo enrichment
  const startEnrichment = async (apifyRunId: string) => {
    setIsStartingEnrichment(true)
    
    try {
      // Check if any companies are selected
      if (selectedCompanies.size === 0) {
        throw new Error('Please select at least one company for enrichment')
      }

      // Get selected company IDs
      const selectedCompanyIds = Array.from(selectedCompanies)
      
      console.log('🎯 Starting enrichment with:', {
        apifyRunId,
        selectedCompanyIds,
        selectedCount: selectedCompanyIds.length
      })

      const response = await fetch('/api/apollo/enrich-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCompanyIds,
          apifyRunId
        })
      })

      console.log('📥 API Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', errorText)
        throw new Error(`Failed to start enrichment: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('📦 API Response data:', result)
      
      if (!result.success) {
        throw new Error(result.error || 'Enrichment failed')
      }

      const newJob: EnrichmentJob = {
        id: result.data.batchId,
        status: 'pending',
        companyCount: result.data.totalCompanies,
        contactsFound: 0,
        createdAt: new Date().toISOString()
      }
      
      setEnrichmentJobs(prev => [newJob, ...prev])
      
      // Update UI to reflect the changes
      setScrapingJobs(prev => prev.map(job => {
        if (job.apifyRunId === apifyRunId && job.detailedResults?.companies) {
          return {
            ...job,
            detailedResults: {
              ...job.detailedResults,
              companies: job.detailedResults.companies.map(company => 
                selectedCompanies.has(company.id) 
                  ? { 
                      ...company, 
                      status: 'Qualified',
                      enrichment_status: 'pending'
                    }
                  : company
              )
            }
          }
        }
        return job
      }))
      
      // Clear selection after successful enrichment
      clearCompanySelection()
      
      toast({
        title: "Enrichment Started",
        description: `Started enrichment for ${result.data.totalCompanies} selected companies. ${result.data.successfulRequests} webhook requests successful, ${result.data.failedRequests} failed.`,
      })

      // Start polling for enrichment progress
      startEnrichmentPolling(newJob.id)
      
    } catch (error) {
      console.error('Error starting enrichment:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start enrichment",
        variant: "destructive"
      })
    } finally {
      setIsStartingEnrichment(false)
    }
  }



  // Load existing successful Apify runs
  const loadExistingRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    
    try {
      const response = await fetch('/api/otis/successful-runs')
      if (!response.ok) {
        throw new Error('Failed to fetch existing runs')
      }

      const data = await response.json()
      setExistingRuns(data.runs || [])
      
      if (data.runs && data.runs.length === 0) {
        toast({
          title: "No Runs Found",
          description: "No successful Apify runs found. Start a new scraping session instead.",
          variant: "destructive"
        })
      }
      
    } catch (error) {
      console.error('Error loading existing runs:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load existing runs",
        variant: "destructive"
      })
    } finally {
      setIsLoadingRuns(false)
    }
  }, [toast])

  // Load results from existing run
  const loadExistingRunResults = async () => {
    if (!selectedRunId) {
      toast({
        title: "Selection Required",
        description: "Please select an existing run first",
        variant: "destructive"
      })
      return
    }

    setIsStartingScraping(true)
    
    try {
      // Find the selected run details
      const selectedRun = existingRuns.find(run => run.id === selectedRunId)
      if (!selectedRun) {
        throw new Error('Selected run not found')
      }

      // Create a job entry for the existing run
      const newJob: ScrapingJob = {
        id: `existing_${selectedRunId}`,
        status: 'completed',
        jobTitle: selectedRun.title,
        location: selectedRun.location,
        platform: selectedRun.platform,
        apifyRunId: selectedRunId,
        createdAt: selectedRun.createdAt,
        completedAt: selectedRun.finishedAt
      }
      
      // Replace any existing jobs with the new one (only show one run at a time)
      setScrapingJobs([newJob])
      
      // Load contacts immediately for this run (don't wait for detailed results)
      await loadAllContactsForCurrentRun()
      
      // Load results from the apify run directly
      try {
        const response = await fetch(`/api/otis/scraping-results/run/${selectedRunId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch run results')
        }

        const runResults = await response.json()
        
        if (runResults.success && runResults.data) {
          setScrapingJobs(prev => prev.map(job => {
            if (job.id === newJob.id) {
              return {
                ...job,
                detailedResults: runResults.data,
                jobCount: runResults.data.job_count,
                companyCount: runResults.data.total_companies
              }
            }
            return job
          }))
          
          // Refresh contacts with the detailed results data
          await loadAllContactsForCurrentRun(runResults.data)
        }
      } catch (error) {
        console.error('Error loading run results:', error)
        // Fallback to refreshResults if the run endpoint fails
        await refreshResults(newJob.id)
      }
      
      // Start background polling for this existing run
      startBackgroundResultsPolling(newJob.id)
      
      toast({
        title: "Existing Run Loaded",
        description: `Loaded results from "${selectedRun.title}" in ${selectedRun.location}`,
      })
      
    } catch (error) {
      console.error('Error loading existing run:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load existing run",
        variant: "destructive"
      })
    } finally {
      setIsStartingScraping(false)
    }
  }

  // Refresh detailed results from Supabase
  const refreshResults = async (jobId: string) => {
    setIsRefreshingResults(jobId)
    
    try {
      // Find the job
      const job = scrapingJobs.find(j => j.id === jobId)
      if (!job) {
        throw new Error('Job not found')
      }

      // For pending/running jobs without apifyRunId, first check the job status
      if (!job.apifyRunId) {
        const statusResponse = await fetch(`/api/otis/apify-runs?jobId=${jobId}`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          // Update job with latest status and apifyRunId if available
          setScrapingJobs(prev => prev.map(j => {
            if (j.id === jobId) {
              return {
                ...j,
                status: statusData.status || j.status,
                apifyRunId: statusData.apifyRunId || j.apifyRunId,
                jobCount: statusData.jobCount || j.jobCount,
                companyCount: statusData.companyCount || j.companyCount,
                completedAt: statusData.completedAt || j.completedAt
              }
            }
            return j
          }))

          // If job is still pending/running without apifyRunId, show appropriate message
          if (!statusData.apifyRunId) {
            toast({
              title: "Job Still Processing",
              description: "The scraping job is still running. Please wait for it to complete.",
            })
            return
          }
        }
      }

      // Now get the updated job with apifyRunId
      const updatedJob = scrapingJobs.find(j => j.id === jobId)
      if (!updatedJob?.apifyRunId) {
        throw new Error('No Apify Run ID found for this job')
      }

      const response = await fetch(`/api/otis/scraping-results/run/${updatedJob.apifyRunId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch detailed results')
      }

      const detailedResults = await response.json()
      
      setScrapingJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          return {
            ...job,
            detailedResults: detailedResults.data,
            jobCount: detailedResults.data.job_count,
            companyCount: detailedResults.data.companies?.length || 0
          }
        }
        return job
      }))
      
      // Load contacts after updating the scraping results
      await loadAllContactsForCurrentRun(detailedResults.data)
      
      toast({
        title: "Results Refreshed",
        description: `Found ${detailedResults.data.job_count} jobs and ${detailedResults.data.companies?.length || 0} companies`,
      })
      
    } catch (error) {
      console.error('Error refreshing results:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh results",
        variant: "destructive"
      })
    } finally {
      setIsRefreshingResults(null)
    }
  }

  // Background polling for scraping results (Refresh Results functionality)
  const startBackgroundResultsPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        // Find the job
        const job = scrapingJobs.find(j => j.id === jobId)
        if (!job) {
          clearInterval(interval)
          return
        }

        // For pending/running jobs without apifyRunId, first check the job status
        if (!job.apifyRunId) {
          const statusResponse = await fetch(`/api/otis/apify-runs?jobId=${jobId}`)
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            
            // Update job with latest status and apifyRunId if available
            setScrapingJobs(prev => prev.map(j => {
              if (j.id === jobId) {
                return {
                  ...j,
                  status: statusData.status || j.status,
                  apifyRunId: statusData.apifyRunId || j.apifyRunId,
                  jobCount: statusData.jobCount || j.jobCount,
                  companyCount: statusData.companyCount || j.companyCount,
                  completedAt: statusData.completedAt || j.completedAt
                }
              }
              return j
            }))

            // If job is still pending/running without apifyRunId, continue polling
            if (!statusData.apifyRunId) {
              return
            }
          }
        }

        // Now get the updated job with apifyRunId
        const updatedJob = scrapingJobs.find(j => j.id === jobId)
        if (!updatedJob?.apifyRunId) {
          return
        }

        // Fetch detailed results from the database
        const response = await fetch(`/api/otis/scraping-results/run/${updatedJob.apifyRunId}`)
        if (response.ok) {
          const detailedResults = await response.json()
          
          setScrapingJobs(prev => prev.map(job => {
            if (job.id === jobId) {
              return {
                ...job,
                detailedResults: detailedResults.data,
                jobCount: detailedResults.data.job_count,
                companyCount: detailedResults.data.companies?.length || 0
              }
            }
            return job
          }))
          
          // Refresh contacts for the updated results
          await loadAllContactsForCurrentRun(detailedResults.data)
        }
      } catch (error) {
        console.error('Background results polling error:', error)
      }
    }, 5000) // Poll every 5 seconds
    
    setPollingInterval(interval)
  }

  // Simple polling for scraping progress (legacy - for job status only)
  const startPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/otis/apify-runs?jobId=${jobId}`)
        if (response.ok) {
          const data = await response.json()
          
          setScrapingJobs(prev => prev.map(job => {
            if (job.id === jobId) {
              return {
                ...job,
                status: data.status || job.status,
                apifyRunId: data.apifyRunId || job.apifyRunId,
                jobCount: data.jobCount || job.jobCount,
                companyCount: data.companyCount || job.companyCount,
                completedAt: data.completedAt || job.completedAt
              }
            }
            return job
          }))
          
          // Stop polling if job is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds
    
    setPollingInterval(interval)
  }

  // Company selection and management functions
  const toggleCompanySelection = (companyId: string) => {
    console.log('🔍 Toggle called for company:', companyId)
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      const wasSelected = newSet.has(companyId)
      if (wasSelected) {
        newSet.delete(companyId)
        console.log('❌ Removed company from selection')
      } else {
        newSet.add(companyId)
        console.log('✅ Added company to selection')
      }
      console.log('📊 New selection count:', newSet.size)
      return newSet
    })
  }

  const selectAllCompanies = (companies: Array<{ id: string }>) => {
    setSelectedCompanies(new Set(companies.map(c => c.id)))
  }

  const clearCompanySelection = () => {
    setSelectedCompanies(new Set())
  }

  // Contact selection functions
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

  const selectAllContacts = (contacts: Array<{ id: string }>) => {
    setSelectedContacts(new Set(contacts.map(c => c.id)))
  }

  const clearContactSelection = () => {
    setSelectedContacts(new Set())
  }



  const updateCompanyStatus = async (companyId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update company status')
      }

      const result = await response.json()
      
      // Update the company status in the UI
      setScrapingJobs(prev => prev.map(job => {
        if (job.detailedResults?.companies) {
          return {
            ...job,
            detailedResults: {
              ...job.detailedResults,
              companies: job.detailedResults.companies.map(company => 
                company.id === companyId 
                  ? { ...company, status: newStatus }
                  : company
              )
            }
          }
        }
        return job
      }))

      toast({
        title: "Status Updated",
        description: `${result.data.name} status changed to ${newStatus}`,
      })

    } catch (error) {
      console.error('Error updating company status:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update company status",
        variant: "destructive"
      })
    }
  }

  const updateSelectedCompaniesStatus = async (newStatus: string) => {
    try {
      const promises = Array.from(selectedCompanies).map(companyId => 
        updateCompanyStatus(companyId, newStatus)
      )
      
      await Promise.all(promises)
      
      toast({
        title: "Bulk Update Complete",
        description: `Updated ${selectedCompanies.size} companies to ${newStatus}`,
      })
      
      clearCompanySelection()
      
    } catch (error) {
      console.error('Error updating selected companies:', error)
      toast({
        title: "Error",
        description: "Failed to update some companies",
        variant: "destructive"
      })
    }
  }

  // Company drawer functions
  const openCompanyDrawer = async (companyId: string) => {
    setSelectedCompanyForDrawer(companyId)
    setIsLoadingCompanyJobs(true)
    
    try {
      const response = await fetch(`/api/companies/${companyId}/job-postings`)
      if (!response.ok) {
        throw new Error(`Failed to fetch company job postings: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load job postings')
      }
      
      setCompanyJobPostings(result.data.job_postings || [])
      
    } catch (error) {
      console.error('Error fetching company job postings:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load job postings",
        variant: "destructive"
      })
      setCompanyJobPostings([])
    } finally {
      setIsLoadingCompanyJobs(false)
    }
  }

  const closeCompanyDrawer = () => {
    setSelectedCompanyForDrawer(null)
    setCompanyJobPostings([])
  }

  // Simple polling for enrichment progress
  const startEnrichmentPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/apollo/status/${jobId}`)
        if (response.ok) {
          const data = await response.json()
          
          // If enrichment is completed, fetch contact details
          let contacts: any[] = []
          if (data.status === 'completed' && data.companies) {
            // Get contact details for enriched companies
            const enrichedCompanyIds = data.companies
              .filter((c: any) => c.status === 'enriched' && c.contactsFound > 0)
              .map((c: any) => c.companyId)
            
            if (enrichedCompanyIds.length > 0) {
              try {
                const contactsResponse = await fetch('/api/contacts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ companyIds: enrichedCompanyIds })
                })
                
                if (contactsResponse.ok) {
                  const contactsData = await contactsResponse.json()
                  contacts = contactsData.map((contact: any) => ({
                    id: contact.id,
                    name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                    email: contact.email,
                    title: contact.title,
                    companyName: contact.companies?.name || 'Unknown Company',
                    companyId: contact.company_id
                  }))
                }
              } catch (contactError) {
                console.error('Error fetching contact details:', contactError)
              }
            }
          }
          
          setEnrichmentJobs(prev => prev.map(job => {
            if (job.id === jobId) {
              return {
                ...job,
                status: data.status || job.status,
                companyCount: data.totalCompanies || job.companyCount,
                contactsFound: data.companies?.reduce((sum: number, c: any) => sum + (c.contactsFound || 0), 0) || job.contactsFound,
                completedAt: data.completedAt || job.completedAt,
                contacts: contacts.length > 0 ? contacts : job.contacts
              }
            }
            return job
          }))
          
          // Stop polling if job is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Enrichment polling error:', error)
      }
    }, 5000) // Poll every 5 seconds
  }

  // Load regions data on component mount
  useEffect(() => {
    const loadRegions = async () => {
      try {
        setIsLoadingRegions(true)
        const regionsData = await supabaseService.getRegions()
        setRegions(regionsData)
      } catch (error) {
        console.error('Error loading regions:', error)
        toast({
          title: "Error",
          description: "Failed to load regions data",
          variant: "destructive"
        })
      } finally {
        setIsLoadingRegions(false)
      }
    }

    const initializeData = async () => {
      await loadRegions()
      await loadCampaigns()
    }

    initializeData()
  }, []) // Removed toast dependency to prevent infinite re-renders

  // Load existing runs when toggle is switched on
  useEffect(() => {
    if (useExistingRun && existingRuns.length === 0) {
      loadExistingRuns()
    }
    // Clear search when switching modes
    if (!useExistingRun) {
      setRunSearchTerm('')
      setSelectedRunId('')
    }
  }, [useExistingRun, loadExistingRuns, existingRuns.length])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // Helper functions for location selection
  const getSelectedRegion = () => {
    return regions.find(region => region.id === selectedRegionId)
  }

  const handleLocationSelect = (regionId: string) => {
    setSelectedRegionId(regionId)
    const selectedRegion = regions.find(region => region.id === regionId)
    if (selectedRegion) {
      setLocation(selectedRegion.plaats)
    }
    setLocationSearchOpen(false)
  }

  // Group regions by plaats and get unique combinations
  const getGroupedRegions = () => {
    const grouped = regions.reduce((acc, region) => {
      const key = region.plaats
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(region)
      return acc
    }, {} as Record<string, Region[]>)

    // For each plaats, prefer the one with the most descriptive regio_platform
    return Object.entries(grouped).map(([plaats, regions]) => {
      // Sort by regio_platform length (longer descriptions first) and take the first one
      const sortedRegions = regions.sort((a, b) => b.regio_platform.length - a.regio_platform.length)
      return sortedRegions[0]
    }).sort((a, b) => a.plaats.localeCompare(b.plaats))
  }

  // Filter existing runs based on search term
  const getFilteredRuns = () => {
    if (!runSearchTerm.trim()) {
      return existingRuns
    }
    
    const searchLower = runSearchTerm.toLowerCase()
    return existingRuns.filter(run => 
      run.title.toLowerCase().includes(searchLower) ||
      run.location.toLowerCase().includes(searchLower) ||
      run.platform.toLowerCase().includes(searchLower) ||
      run.displayName.toLowerCase().includes(searchLower)
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    } as const
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    )
  }

  const getEmailStatusBadge = (emailStatus: string) => {
    switch (emailStatus?.toLowerCase()) {
      case 'verified':
      case 'valid':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">✓ {emailStatus}</Badge>
      case 'invalid':
        return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">✗ {emailStatus}</Badge>
      case 'unknown':
      case 'unverified':
        return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">? {emailStatus}</Badge>
      default:
        return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">{emailStatus}</Badge>
    }
  }

  const getCategorySizeBadge = (categorySize: string) => {
    switch (categorySize?.toLowerCase()) {
      case 'klein':
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Klein</Badge>
      case 'middel':
        return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Middel</Badge>
      case 'groot':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Groot</Badge>
      default:
        return null
    }
  }

  // Load available campaigns
  const loadCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true)
      const response = await fetch('/api/instantly-campaigns')
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const result = await response.json()
      if (result.campaigns) {
        setCampaigns(result.campaigns)
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive"
      })
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  // Link campaign to contact
  const linkCampaignToContact = async (contactId: string, campaignId: string, campaignName: string) => {
    try {
      setLinkingCampaign(contactId)
      const response = await fetch('/api/otis/contacts/link-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, campaignId, campaignName })
      })

      if (!response.ok) {
        throw new Error('Failed to link campaign')
      }

      const result = await response.json()
      if (result.success) {
        // Update the contact in the enrichment jobs
        setEnrichmentJobs(prev => prev.map(job => ({
          ...job,
          contacts: job.contacts?.map(contact => 
            contact.id === contactId 
              ? { ...contact, campaign_id: campaignId, campaign_name: campaignName }
              : contact
          )
        })))

        toast({
          title: "Success",
          description: `Campaign linked to ${result.data.name || 'contact'}`,
        })
      }
    } catch (error) {
      console.error('Error linking campaign:', error)
      toast({
        title: "Error",
        description: "Failed to link campaign to contact",
        variant: "destructive"
      })
    } finally {
      setLinkingCampaign(null)
    }
  }

  // Load all contacts for the current run's companies
  const loadAllContactsForCurrentRun = async (detailedResultsData?: any) => {
    console.log('🔄 loadAllContactsForCurrentRun called')
    try {
      // Get the current scraping job
      const currentJob = scrapingJobs[0]
      if (!currentJob?.apifyRunId) {
        console.log('❌ No current run with apifyRunId found')
        return
      }

      console.log('✅ Loading all contacts for current run:', currentJob.apifyRunId)
      
      // Get all company IDs from the current run
      // Use passed detailedResultsData if available, otherwise try to get from state
      let companyIds: string[] = []
      
      if (detailedResultsData?.companies) {
        // Use the data passed directly (avoiding state timing issues)
        companyIds = detailedResultsData.companies.map((c: any) => c.id)
        console.log('Using passed detailed results data, found companies:', companyIds.length)
      } else {
        // Fallback to state (might be stale due to async updates)
        companyIds = currentJob.detailedResults?.companies?.map(c => c.id) || []
        console.log('Using state data, found companies:', companyIds.length)
      }
      
      // If still no companies, try to get them from the database directly
      if (companyIds.length === 0) {
        console.log('No companies found, fetching from database...')
        try {
          const response = await fetch(`/api/otis/scraping-results/run/${currentJob.apifyRunId}`)
          if (response.ok) {
            const runResults = await response.json()
            if (runResults.success && runResults.data?.companies) {
              companyIds = runResults.data.companies.map((c: any) => c.id)
              console.log('Fetched company IDs from database:', companyIds.length)
            }
          }
        } catch (error) {
          console.error('Error fetching companies from database:', error)
        }
      }
      
      if (companyIds.length === 0) {
        console.log('No companies found in current run')
        return
      }

      console.log('Fetching contacts for company IDs:', companyIds.slice(0, 5), '... (total:', companyIds.length, ')')

      // Fetch contacts for all companies in the current run
      let result = null
      
      try {
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyIds })
        })

        if (!response.ok) {
          throw new Error('Failed to fetch contacts')
        }

        result = await response.json()
        console.log('All contacts API result:', result)
        console.log('Result type:', typeof result, 'Is array:', Array.isArray(result))
        console.log('Result length:', result?.length)
      } catch (error) {
        console.error('Error fetching contacts via /api/contacts:', error)
        
        // Fallback: try the otis contacts endpoint
        try {
          console.log('Trying fallback to /api/otis/contacts...')
          const fallbackResponse = await fetch(`/api/otis/contacts?apifyRunId=${currentJob.apifyRunId}`)
          if (fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json()
            if (fallbackResult.success && fallbackResult.data?.contacts) {
              result = fallbackResult.data.contacts
              console.log('Fallback successful, got contacts:', result.length)
            }
          }
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError)
        }
      }
      
      if (result && Array.isArray(result)) {
        console.log('✅ Got contacts result, processing...')
      }
      
      if (result && Array.isArray(result)) {
          // Create a single enrichment job entry with all contacts
          const enrichmentJob: EnrichmentJob = {
            id: `all_contacts_${currentJob.apifyRunId}`,
            status: 'completed',
            companyCount: companyIds.length,
            contactsFound: result.length,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
                        contacts: result.map((contact: any) => ({
              id: contact.id,
              name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
              email: contact.email || '',
              title: contact.title || '',
              linkedin_url: contact.linkedin_url,
              campaign_id: contact.campaign_id,
              campaign_name: contact.campaign_name,
              email_status: contact.email_status,
              phone: contact.phone,
              companyName: contact.companies?.name || '',
              companyId: contact.company_id
            }))
        }
        
        console.log('✅ Setting all contacts enrichment job:', enrichmentJob)
        setEnrichmentJobs([enrichmentJob])
        console.log('✅ Contacts set in state, should now appear in UI')
      }
    } catch (error) {
      console.error('Error loading all contacts:', error)
      // Don't show error toast as this is not critical
    }
  }

  // Load contacts for the current apify run (legacy - for backward compatibility)
  const loadContactsForRun = async (apifyRunId: string) => {
    try {
      console.log('Loading contacts for apify run:', apifyRunId)
      const response = await fetch(`/api/otis/contacts?apifyRunId=${apifyRunId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const result = await response.json()
      console.log('Contacts API result:', result)
      
      if (result.success && result.data) {
        // Create an enrichment job entry with the contacts
        const enrichmentJob: EnrichmentJob = {
          id: `enrichment_${apifyRunId}`,
          status: 'completed',
          companyCount: result.data.companyCount || 0,
          contactsFound: result.data.contacts.length,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          contacts: result.data.contacts.map((contact: any) => ({
            id: contact.id,
            name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
            email: contact.email || '',
            title: contact.title || '',
            linkedin_url: contact.linkedin_url,
            campaign_id: contact.campaign_id,
            campaign_name: contact.campaign_name,
            email_status: contact.email_status,
            phone: contact.phone,
            companyName: contact.company_name || '',
            companyId: contact.company_id
          }))
        }
        
        console.log('Setting enrichment jobs with:', enrichmentJob)
        setEnrichmentJobs([enrichmentJob])
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      // Don't show error toast as this is not critical
    }
  }

  // Bulk add contacts to campaign
  const addSelectedContactsToCampaign = async () => {
    if (!selectedCampaignForBulk || selectedContacts.size === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a campaign and at least one contact",
        variant: "destructive"
      })
      return
    }

    setIsAddingToCampaign(true)
    
    try {
      const campaign = campaigns.find(c => c.id === selectedCampaignForBulk)
      if (!campaign) {
        throw new Error('Selected campaign not found')
      }

      // Get all contacts from all enrichment jobs
      const allContacts = enrichmentJobs.flatMap(job => job.contacts || [])
      const selectedContactData = allContacts.filter(contact => selectedContacts.has(contact.id))
      
      // Check if contacts have emails
      const contactsWithoutEmail = selectedContactData.filter(contact => !contact.email || contact.email.trim() === '')
      if (contactsWithoutEmail.length > 0) {
        toast({
          title: "⚠️ Contacten zonder email",
          description: `${contactsWithoutEmail.length} van de ${selectedContacts.size} geselecteerde contacten hebben geen email adres.`,
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contactIds: Array.from(selectedContacts), 
          campaignId: selectedCampaignForBulk, 
          campaignName: campaign.name 
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        const successCount = data.results?.filter((r: any) => r.status === "success").length || 0
        const errorCount = data.results?.filter((r: any) => r.status === "error").length || 0
        
        if (successCount > 0) {
          toast({
            title: successCount === selectedContacts.size ? "Volledig succesvol! ✅" : "Gedeeltelijk succesvol ⚠️",
            description: `${successCount} contacten toegevoegd aan "${campaign.name}"${errorCount > 0 ? `, ${errorCount} mislukt` : ''}`,
            variant: errorCount > 0 ? "destructive" : "default",
          })
          
          // Update contacts in UI to show they're linked
          setEnrichmentJobs(prev => prev.map(job => ({
            ...job,
            contacts: job.contacts?.map(contact => 
              selectedContacts.has(contact.id) 
                ? { ...contact, campaign_id: selectedCampaignForBulk, campaign_name: campaign.name }
                : contact
            )
          })))
          
          // Clear selection
          setSelectedContacts(new Set())
          setSelectedCampaignForBulk('')
        } else {
          toast({
            title: "Alle contacten mislukt ❌",
            description: data.error || "Alle contacten konden niet worden toegevoegd.",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Fout bij toevoegen",
          description: data.error || "Er is een onbekende fout opgetreden.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding contacts to campaign:', error)
      toast({
        title: "Netwerkfout",
        description: `Er is een netwerkfout opgetreden: ${error instanceof Error ? error.message : "Onbekende fout"}`,
        variant: "destructive",
      })
    } finally {
      setIsAddingToCampaign(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">OTIS Job Scraper</h1>
          <p className="text-gray-600 mt-2">Simple job scraping workflow with Apollo enrichment and Instantly campaigns</p>
        </div>

        {/* Job Configuration - Collapsible */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setConfigExpanded(!configExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                <CardTitle className="text-lg">Job Scraping Configuration</CardTitle>
              </div>
              {configExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <CardDescription>
              Configure and start a new job scraping session
            </CardDescription>
          </CardHeader>
          
          {configExpanded && (
            <CardContent>
              {/* Mode Selection */}
              <div className="mb-6">
                <Label className="text-base font-medium mb-3 block">Scraping Mode</Label>
                <RadioGroup 
                  value={useExistingRun ? "existing" : "new"} 
                  onValueChange={(value) => setUseExistingRun(value === "existing")}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new-scraping" />
                    <Label htmlFor="new-scraping" className="flex items-center gap-2 cursor-pointer">
                      <Play className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Start New Scraping</div>
                        <div className="text-sm text-gray-500">Create a new job scraping session</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="existing-run" />
                    <Label htmlFor="existing-run" className="flex items-center gap-2 cursor-pointer">
                      <Database className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Use Existing Run</div>
                        <div className="text-sm text-gray-500">Load results from previous successful runs</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* New Scraping Form */}
              {!useExistingRun && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={locationSearchOpen}
                            className="w-full justify-between"
                            disabled={isLoadingRegions}
                          >
                            {isLoadingRegions ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading locations...
                              </>
                            ) : selectedRegionId ? (
                              (() => {
                                const selected = getSelectedRegion()
                                return selected ? (
                                  <div className="text-left">
                                    <div className="font-medium">{selected.plaats}</div>
                                    <div className="text-xs text-gray-500">{selected.regio_platform}</div>
                                  </div>
                                ) : "Select location..."
                              })()
                            ) : (
                              "Select location..."
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search locations..." />
                            <CommandList>
                              <CommandEmpty>No location found.</CommandEmpty>
                              <CommandGroup>
                                {getGroupedRegions().map((region) => (
                                  <CommandItem
                                    key={region.id}
                                    value={`${region.plaats} ${region.regio_platform}`}
                                    onSelect={() => handleLocationSelect(region.id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedRegionId === region.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{region.plaats}</span>
                                      <span className="text-xs text-gray-500">{region.regio_platform}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="platform">Platform</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indeed" className="flex items-center justify-between">
                            <span>Indeed</span>
                          </SelectItem>
                          <SelectItem value="linkedin" disabled className="flex items-center justify-between">
                            <span>LinkedIn</span>
                            <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                          </SelectItem>
                          <SelectItem value="glassdoor" disabled className="flex items-center justify-between">
                            <span>Glassdoor</span>
                            <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={startScraping} 
                    disabled={isStartingScraping || !jobTitle.trim() || !selectedRegionId}
                    className="w-full md:w-auto"
                  >
                    {isStartingScraping ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Starting Scraping...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Job Scraping
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Existing Run Selection */}
              {useExistingRun && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="existingRun">Select Existing Run</Label>
                      {scrapingJobs.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setScrapingJobs([])
                            setSelectedRunId('')
                            setCompanySearchTerm('')
                            setSelectedCompanies(new Set())
                            setEnrichmentJobs([]) // Clear the scraped contacts
                            setSelectedContacts(new Set()) // Clear selected contacts
                            setContactSearchTerm('') // Clear contact search term
                            setLinkingCampaign(null) // Clear linking state
                            toast({
                              title: "Run Cleared",
                              description: "Current run has been cleared. You can now select a different run.",
                            })
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear Current Run
                        </Button>
                      )}
                    </div>
                    
                    {/* Search Input */}
                    <div className="mb-3">
                      <div className="relative">
                        <Input
                          placeholder="Search runs by title, location, or platform..."
                          value={runSearchTerm}
                          onChange={(e) => setRunSearchTerm(e.target.value)}
                          className="mb-2 pr-8"
                        />
                        {runSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRunSearchTerm('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {runSearchTerm && (
                        <div className="text-sm text-gray-500 mb-2">
                          Found {getFilteredRuns().length} of {existingRuns.length} runs
                        </div>
                      )}
                    </div>

                    <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                      <SelectTrigger disabled={isLoadingRuns}>
                        {isLoadingRuns ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading runs...
                          </>
                        ) : (
                          <SelectValue placeholder={
                            scrapingJobs.length > 0 
                              ? "Choose a different run to replace current" 
                              : "Choose a successful run to load"
                          } />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredRuns().length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">
                            {runSearchTerm ? 'No runs match your search' : 'No successful runs found'}
                          </div>
                        ) : (
                          getFilteredRuns().map((run) => (
                            <SelectItem key={run.id} value={run.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{run.displayName}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(run.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    
                    {/* Current Run Status */}
                    {scrapingJobs.length > 0 && scrapingJobs[0]?.apifyRunId && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Currently Loaded Run</span>
                        </div>
                        <div className="text-sm text-blue-700">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{scrapingJobs[0].jobTitle}</span>
                            <span className="text-blue-600">•</span>
                            <span>{scrapingJobs[0].location}</span>
                            <span className="text-blue-600">•</span>
                            <span>{scrapingJobs[0].companyCount || 0} companies</span>
                            <span className="text-blue-600">•</span>
                            <span>{scrapingJobs[0].jobCount || 0} jobs</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={loadExistingRunResults} 
                    disabled={isStartingScraping || !selectedRunId}
                    className="w-full md:w-auto"
                  >
                    {isStartingScraping ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading Results...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        {scrapingJobs.length > 0 ? 'Replace Current Run' : 'Load Selected Run'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* Scraping Jobs - Collapsible */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setResultsExpanded(!resultsExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                <CardTitle className="text-lg">
                  {useExistingRun ? 'Current Run Results' : 'Scraping Jobs'}
                </CardTitle>
              </div>
              {resultsExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <CardDescription>
              {useExistingRun 
                ? 'View and manage results from the selected existing run' 
                : 'Monitor job scraping progress and results'
              }
            </CardDescription>
          </CardHeader>
          
          {resultsExpanded && (
            <CardContent>
              {scrapingJobs.length === 0 ? (
                <div className="text-center py-12">
                  {useExistingRun ? (
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Database className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Run Loaded</h4>
                      <p className="text-gray-600 mb-4">Select an existing run from the dropdown above to view its results.</p>
                      <div className="text-sm text-gray-500">
                        <p>• Choose a run from the "Select Existing Run" dropdown</p>
                        <p>• Click "Load Selected Run" to view companies and jobs</p>
                        <p>• Only one run can be viewed at a time</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No scraping jobs yet. Start a new job above.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {scrapingJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="font-medium">{job.jobTitle}</span>
                          <span className="text-gray-500">in {job.location}</span>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <span className="text-sm text-gray-500">Platform:</span>
                          <p className="font-medium">{job.platform}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Jobs Found:</span>
                          <p className="font-medium">{job.jobCount || 0}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Companies:</span>
                          <p className="font-medium">{job.companyCount || 0}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Created:</span>
                          <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Summary when detailed results are available */}
                      {job.detailedResults && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-900">Latest Results from Database</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-blue-700">Total Jobs:</span>
                              <p className="font-medium text-blue-900">{job.detailedResults.job_count}</p>
                            </div>
                            <div>
                              <span className="text-blue-700">Total Companies:</span>
                              <p className="font-medium text-blue-900">{job.detailedResults.companies?.length || 0}</p>
                            </div>
                            <div>
                              <span className="text-blue-700">Last Updated:</span>
                              <p className="font-medium text-blue-900">{new Date().toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-blue-700">Status:</span>
                              <Badge variant="outline" className="text-xs">
                                {job.detailedResults.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      {job.status === 'running' && (
                        <Progress value={job.jobCount ? Math.min((job.jobCount / 100) * 100, 100) : 0} className="mb-3" />
                      )}

                      {/* Action buttons for different job statuses */}
                      {(job.status === 'pending' || job.status === 'running') && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refreshResults(job.id)}
                            disabled={isRefreshingResults === job.id}
                          >
                            {isRefreshingResults === job.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {job.apifyRunId ? 'Refresh Results' : 'Check Status'}
                              </>
                            )}
                          </Button>
                          {!job.apifyRunId && (
                            <div className="text-xs text-gray-500 flex items-center">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Waiting for Apify run to start...
                            </div>
                          )}
                        </div>
                      )}

                      {job.status === 'completed' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refreshResults(job.id)}
                            disabled={isRefreshingResults === job.id}
                          >
                            {isRefreshingResults === job.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh Results
                              </>
                            )}
                          </Button>
                          {job.apifyRunId && (
                            <Button
                              size="sm"
                              onClick={() => startEnrichment(job.apifyRunId!)}
                              disabled={isStartingEnrichment || selectedCompanies.size === 0}
                              title={
                                selectedCompanies.size === 0 
                                  ? 'Please select at least one company to start enrichment' 
                                  : ''
                              }
                            >
                              {isStartingEnrichment ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <Users className="w-4 h-4 mr-2" />
                                  Start Apollo Enrichment
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Detailed Company Information */}
                      {job.detailedResults && job.detailedResults.companies && job.detailedResults.companies.length > 0 && (
                        <div className="mt-4">
                          <Separator className="my-3" />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-600" />
                              <h4 className="font-medium text-gray-900">
                                Companies Found ({job.detailedResults.companies.length})
                                {selectedCompanies.size > 0 && (
                                  <span className="text-sm font-semibold text-blue-700 ml-2 bg-blue-100 px-2 py-1 rounded-full">
                                    {selectedCompanies.size} selected
                                  </span>
                                )}
                              </h4>
                            </div>
                            
                            {/* Bulk Actions */}
                            {selectedCompanies.size > 0 && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateSelectedCompaniesStatus('Disqualified')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Disqualify Selected
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateSelectedCompaniesStatus('Qualified')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Qualify Selected
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={clearCompanySelection}
                                >
                                  Clear Selection
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Company Selection Controls */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => selectAllCompanies(job.detailedResults?.companies || [])}
                              >
                                Select All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={clearCompanySelection}
                              >
                                Clear All
                              </Button>
                            </div>
                            
                            {/* Search Companies */}
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search companies..."
                                  value={companySearchTerm}
                                  onChange={(e) => {
                                    setCompanySearchTerm(e.target.value)
                                    // Reset page when searching
                                    setCompanyPage(prev => ({ ...prev, [job.id]: 1 }))
                                  }}
                                  className="pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              {companySearchTerm && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setCompanySearchTerm('')
                                    setCompanyPage(prev => ({ ...prev, [job.id]: 1 }))
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Pagination Controls */}
                          {(() => {
                            const filteredCompanies = (job.detailedResults?.companies || []).filter(company => 
                              !companySearchTerm || 
                              company.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
                              company.location?.toLowerCase().includes(companySearchTerm.toLowerCase())
                            )
                            const totalPages = Math.ceil(filteredCompanies.length / companiesPerPage)
                            
                            return filteredCompanies.length > companiesPerPage && (
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm text-gray-600">
                                  Page {companyPage[job.id] || 1} of {totalPages} 
                                  {companySearchTerm && (
                                    <span className="ml-2 text-blue-600">
                                      ({filteredCompanies.length} of {job.detailedResults?.companies?.length || 0} companies)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCompanyPage(prev => ({ ...prev, [job.id]: Math.max(1, (prev[job.id] || 1) - 1) }))}
                                    disabled={(companyPage[job.id] || 1) <= 1}
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCompanyPage(prev => ({ ...prev, [job.id]: Math.min(totalPages, (prev[job.id] || 1) + 1) }))}
                                    disabled={(companyPage[job.id] || 1) >= totalPages}
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            )
                          })()}

                          <div className="grid gap-2 max-h-[600px] overflow-y-auto">
                            {(job.detailedResults?.companies || [])
                              .filter(company => 
                                !companySearchTerm || 
                                company.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
                                company.location?.toLowerCase().includes(companySearchTerm.toLowerCase())
                              )
                              .slice(
                                ((companyPage[job.id] || 1) - 1) * companiesPerPage,
                                (companyPage[job.id] || 1) * companiesPerPage
                              )
                              .map((company) => (
                              <div key={company.id} className={`border rounded-md p-2 transition-colors ${
                                selectedCompanies.has(company.id) ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-200' : 'bg-gray-50 border-gray-200'
                              }`}>
                                <div className="flex items-center gap-2">
                                  {/* Checkbox for selection - separate clickable area */}
                                  <div 
                                    className={`flex items-center justify-center w-6 h-6 cursor-pointer rounded transition-colors ${
                                      selectedCompanies.has(company.id) 
                                        ? 'bg-blue-100 hover:bg-blue-200' 
                                        : 'hover:bg-gray-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCompanies.has(company.id)}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        toggleCompanySelection(company.id)
                                      }}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                      aria-label={`Select ${company.name}`}
                                    />
                                  </div>
                                  
                                  {/* Company info - clickable area for drawer */}
                                  <div 
                                    className="flex-1 min-w-0 cursor-pointer hover:bg-gray-100 rounded p-1 -m-1"
                                    onClick={() => openCompanyDrawer(company.id)}
                                  >
                                  
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="font-medium text-gray-900 truncate">{company.name}</h5>
                                      <Badge variant="outline" className="text-xs flex-shrink-0">
                                        {company.job_count} job{company.job_count !== 1 ? 's' : ''}
                                      </Badge>
                                      {company.category_size && getCategorySizeBadge(company.category_size)}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">Location:</span>
                                        <span className="truncate">{company.location || 'Not specified'}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">Status:</span>
                                        <Badge 
                                          variant={company.status === 'Prospect' ? 'default' : 
                                                 company.status === 'Qualified' ? 'secondary' : 
                                                 company.status === 'Disqualified' ? 'destructive' : 'outline'}
                                          className="text-xs"
                                        >
                                          {company.status || 'Unknown'}
                                        </Badge>
                                        {company.status === 'Prospect' && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation() // Prevent drawer from opening
                                              updateCompanyStatus(company.id, 'Disqualified')
                                            }}
                                            className="h-5 px-1 text-red-600 hover:text-red-700"
                                          >
                                            <X className="w-3 h-3" />
                                          </Button>
                                        )}
                                        {company.status === 'Disqualified' && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation() // Prevent drawer from opening
                                              updateCompanyStatus(company.id, 'Prospect')
                                            }}
                                            className="h-5 px-1 text-blue-600 hover:text-blue-700"
                                          >
                                            <Check className="w-3 h-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">Enrichment:</span>
                                        <Badge 
                                          variant={
                                            company.enrichment_status === 'enriched' ? 'default' : 
                                            company.enrichment_status === 'completed' ? 'default' :
                                            company.enrichment_status === 'processing' ? 'secondary' :
                                            company.enrichment_status === 'failed' ? 'destructive' :
                                            company.enrichment_status === 'pending' ? 'outline' : 'secondary'
                                          }
                                          className={`text-xs font-semibold ${
                                            company.enrichment_status === 'enriched' || company.enrichment_status === 'completed'
                                              ? 'bg-green-100 text-green-800 border-green-200'
                                              : company.enrichment_status === 'processing'
                                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                                              : company.enrichment_status === 'failed'
                                              ? 'bg-red-100 text-red-800 border-red-200'
                                              : company.enrichment_status === 'pending'
                                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                              : 'bg-gray-100 text-gray-600 border-gray-200'
                                          }`}
                                        >
                                          {company.enrichment_status === 'enriched' || company.enrichment_status === 'completed' ? (
                                            <>
                                              <CheckCircle className="w-3 h-3 mr-1" />
                                              Enriched
                                            </>
                                          ) : company.enrichment_status === 'processing' ? (
                                            <>
                                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                              Processing
                                            </>
                                          ) : company.enrichment_status === 'failed' ? (
                                            <>
                                              <XCircle className="w-3 h-3 mr-1" />
                                              Failed
                                            </>
                                          ) : company.enrichment_status === 'pending' ? (
                                            <>
                                              <Clock className="w-3 h-3 mr-1" />
                                              Pending
                                            </>
                                          ) : (
                                            <>
                                              <XCircle className="w-3 h-3 mr-1" />
                                              Not enriched
                                            </>
                                          )}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">Contacts:</span>
                                        <Badge 
                                          variant={company.contactsFound > 0 ? 'default' : 'outline'}
                                          className={`text-xs font-semibold ${
                                            company.contactsFound > 0 
                                              ? 'bg-green-100 text-green-800 border-green-200' 
                                              : 'bg-gray-100 text-gray-600 border-gray-200'
                                          }`}
                                        >
                                          <Users className="w-3 h-3 mr-1" />
                                          {company.contactsFound} contact{company.contactsFound !== 1 ? 's' : ''}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Website button - separate clickable area */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {company.website && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation() // Prevent drawer from opening
                                        window.open(company.website, '_blank')
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Job Information */}
                      {job.detailedResults && job.detailedResults.jobs && job.detailedResults.jobs.length > 0 && (
                        <div className="mt-4">
                          <Separator className="my-3" />
                          <div className="flex items-center gap-2 mb-3">
                            <Database className="w-4 h-4 text-gray-600" />
                            <h4 className="font-medium text-gray-900">Jobs Found ({job.detailedResults.jobs.length})</h4>
                          </div>
                          <div className="grid gap-3 max-h-60 overflow-y-auto">
                            {job.detailedResults.jobs.map((jobPosting) => (
                              <div key={jobPosting.id} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="font-medium text-gray-900">{jobPosting.title}</h5>
                                      {jobPosting.url && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => window.open(jobPosting.url, '_blank')}
                                          className="h-6 w-6 p-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-600 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Company:</span>
                                        <span>{jobPosting.company?.name || 'Unknown'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Location:</span>
                                        <span>{jobPosting.location || 'Not specified'}</span>
                                      </div>
                                      {jobPosting.job_type && (
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">Type:</span>
                                          <Badge variant="outline" className="text-xs">
                                            {jobPosting.job_type}
                                          </Badge>
                                        </div>
                                      )}
                                      {jobPosting.salary && (
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">Salary:</span>
                                          <span>{jobPosting.salary}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Status:</span>
                                        <Badge 
                                          variant={jobPosting.status === 'new' ? 'default' : 
                                                 jobPosting.status === 'reviewed' ? 'secondary' : 'outline'}
                                          className="text-xs"
                                        >
                                          {jobPosting.status || 'Unknown'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Review:</span>
                                        <Badge 
                                          variant={jobPosting.review_status === 'approved' ? 'default' : 
                                                 jobPosting.review_status === 'pending' ? 'outline' : 'destructive'}
                                          className="text-xs"
                                        >
                                          {jobPosting.review_status || 'Unknown'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Created:</span>
                                        <span>{new Date(jobPosting.created_at).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* All Contacts - Collapsible */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setContactsExpanded(!contactsExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <CardTitle className="text-lg">All Scraped Contacts</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {enrichmentJobs.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {enrichmentJobs.reduce((total, job) => total + (job.contactsFound || 0), 0)} contacts
                  </Badge>
                )}
                {contactsExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
            <CardDescription>
              All contacts from companies in the current run
            </CardDescription>
          </CardHeader>
          
          {contactsExpanded && (
            <CardContent>
              {enrichmentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Contacts Found</h4>
                  <p className="text-gray-600 mb-4">Load a run with enriched companies to see contacts.</p>
                  <div className="text-sm text-gray-500">
                    <p>• Select an existing run from the dropdown above</p>
                    <p>• Or start a new scraping job and run enrichment</p>
                    <p>• Contacts will appear here automatically</p>
                  </div>
                </div>
                              ) : (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-900">Contacts Summary</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadAllContactsForCurrentRun()}
                          className="bg-white hover:bg-blue-100 text-blue-700 border-blue-300"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Refresh Contacts
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700">Total Contacts:</span>
                          <p className="font-medium text-blue-900">
                            {enrichmentJobs.reduce((total, job) => total + (job.contactsFound || 0), 0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-700">Companies with Contacts:</span>
                          <p className="font-medium text-blue-900">
                            {enrichmentJobs.reduce((total, job) => total + (job.companyCount || 0), 0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-700">Linked to Campaigns:</span>
                          <p className="font-medium text-blue-900">
                            {enrichmentJobs.flatMap(job => job.contacts || []).filter(c => c.campaign_id).length}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-700">Last Updated:</span>
                          <p className="font-medium text-blue-900">{new Date().toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {enrichmentJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="font-medium">Enrichment Batch</span>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <span className="text-sm text-gray-500">Companies:</span>
                          <p className="font-medium">{job.companyCount}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Contacts Found:</span>
                          <p className="font-medium">{job.contactsFound}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Created:</span>
                          <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Completed:</span>
                          <p className="font-medium">
                            {job.completedAt ? new Date(job.completedAt).toLocaleString() : 'Pending'}
                          </p>
                        </div>
                      </div>

                      {job.status === 'completed' && job.contactsFound > 0 && (
                        <div className="space-y-3">
                          {/* Bulk Campaign Management */}
                          {selectedContacts.size > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                                    {selectedContacts.size} contacten geselecteerd
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedContacts(new Set())
                                    setSelectedCampaignForBulk('')
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select value={selectedCampaignForBulk} onValueChange={setSelectedCampaignForBulk}>
                                  <SelectTrigger className="w-64 h-9 text-sm">
                                    <SelectValue placeholder="Selecteer campagne">
                                      {selectedCampaignForBulk && (() => {
                                        const campaign = campaigns.find(c => c.id === selectedCampaignForBulk)
                                        return campaign ? (
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{campaign.name}</span>
                                            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                              {campaign.status}
                                            </Badge>
                                          </div>
                                        ) : null
                                      })()}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {campaigns.map((campaign) => (
                                      <SelectItem key={campaign.id} value={campaign.id}>
                                        <div className="flex items-center justify-between w-full">
                                          <span className="text-sm font-medium text-gray-900">{campaign.name}</span>
                                          <Badge variant="outline" className="text-xs px-1.5 py-0.5 ml-2">
                                            {campaign.status}
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={addSelectedContactsToCampaign}
                                  disabled={!selectedCampaignForBulk || isAddingToCampaign}
                                  className="bg-orange-500 hover:bg-orange-600 text-white"
                                >
                                  {isAddingToCampaign ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Bezig...
                                    </>
                                  ) : (
                                    'Voeg toe aan campagne'
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Contact Selection Controls */}
                          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => selectAllContacts(job.contacts || [])}
                                className="bg-white hover:bg-gray-50"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Select All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={clearContactSelection}
                                className="bg-white hover:bg-gray-50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear All
                              </Button>
                              {selectedContacts.size > 0 && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                                    {selectedContacts.size} selected
                                  </Badge>
                                  <span className="text-sm text-gray-600">
                                    of {(job.contacts || []).length} total
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Search Contacts */}
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search contacts..."
                                  value={contactSearchTerm}
                                  onChange={(e) => setContactSearchTerm(e.target.value)}
                                  className="pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              {contactSearchTerm && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setContactSearchTerm('')}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Compact Contacts List */}
                          <div className="border rounded-lg bg-white max-h-96 overflow-y-auto shadow-sm">
                            <div className="p-3 border-b bg-gray-50">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-600" />
                                <span className="font-medium text-gray-900">Contacts Found</span>
                                <Badge variant="outline" className="text-xs">
                                  {(job.contacts || []).length} total
                                </Badge>
                              </div>
                            </div>
                            <div className="p-2 space-y-1">
                              {(job.contacts || [])
                                .filter(contact => 
                                  !contactSearchTerm || 
                                  contact.name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                                  contact.email.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                                  contact.companyName.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
                                  (contact.phone && contact.phone.toLowerCase().includes(contactSearchTerm.toLowerCase()))
                                )
                                .map((contact) => (
                                <div key={contact.id} className={`border rounded-md p-2 transition-all duration-200 hover:shadow-sm ${
                                  selectedContacts.has(contact.id) 
                                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' 
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {/* Checkbox for contact selection */}
                                    <div className="flex items-center justify-center w-4 h-4 cursor-pointer rounded transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={selectedContacts.has(contact.id)}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          toggleContactSelection(contact.id)
                                        }}
                                        className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                        aria-label={`Select ${contact.name}`}
                                      />
                                    </div>
                                  
                                    {/* Compact contact info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h6 className="font-medium text-gray-900 text-sm truncate">{contact.name}</h6>
                                        <Badge 
                                          variant="outline" 
                                          className="text-xs flex-shrink-0 bg-gray-50 text-gray-700 border-gray-200"
                                        >
                                          {contact.title}
                                        </Badge>
                                        {contact.campaign_name && (
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                            {contact.campaign_name}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-gray-600">
                                        <div className="flex items-center gap-1">
                                          <Mail className="w-3 h-3 text-gray-400" />
                                          <span className="truncate font-mono">{contact.email}</span>
                                          {contact.email_status && getEmailStatusBadge(contact.email_status)}
                                        </div>
                                        {contact.phone && (
                                          <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-gray-400" />
                                            <span className="truncate font-mono">{contact.phone}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                          <Building2 className="w-3 h-3 text-gray-400" />
                                          <span className="truncate text-gray-700 font-medium">{contact.companyName}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Selection indicator */}
                                    {selectedContacts.has(contact.id) && (
                                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Company Job Postings Drawer */}
        {selectedCompanyForDrawer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-3xl h-full overflow-hidden flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <div>
                  <h3 className="text-lg font-semibold">Company Job Postings</h3>
                  <p className="text-sm text-gray-600">
                    {companyJobPostings.length} job posting{companyJobPostings.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeCompanyDrawer}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingCompanyJobs ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Loading job postings...</span>
                  </div>
                ) : companyJobPostings.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Database className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Job Postings Found</h4>
                      <p className="text-gray-600">This company doesn't have any job postings in our database.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Summary Stats */}
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-blue-900">Total Jobs:</span>
                          <p className="text-blue-700 font-semibold">{companyJobPostings.length}</p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-900">New:</span>
                          <p className="text-blue-700 font-semibold">
                            {companyJobPostings.filter(j => j.status === 'new').length}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-900">Reviewed:</span>
                          <p className="text-blue-700 font-semibold">
                            {companyJobPostings.filter(j => j.status === 'reviewed').length}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-blue-900">Approved:</span>
                          <p className="text-blue-700 font-semibold">
                            {companyJobPostings.filter(j => j.review_status === 'approved').length}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Job Postings List */}
                    <div className="space-y-3">
                      {companyJobPostings.map((jobPosting, index) => (
                        <div key={jobPosting.id} className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 font-mono">#{index + 1}</span>
                                <h4 className="font-medium text-gray-900 truncate">{jobPosting.title}</h4>
                              </div>
                              {jobPosting.url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(jobPosting.url, '_blank')}
                                  className="h-6 w-6 p-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Location:</span>
                              <span className="truncate">{jobPosting.location || 'Not specified'}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Status:</span>
                              <Badge 
                                variant={jobPosting.status === 'new' ? 'default' : 
                                       jobPosting.status === 'reviewed' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {jobPosting.status || 'Unknown'}
                              </Badge>
                            </div>
                            
                            {jobPosting.job_type && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Type:</span>
                                <Badge variant="outline" className="text-xs">
                                  {jobPosting.job_type}
                                </Badge>
                              </div>
                            )}
                            
                            {jobPosting.salary && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Salary:</span>
                                <span className="truncate">{jobPosting.salary}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Review:</span>
                              <Badge 
                                variant={jobPosting.review_status === 'approved' ? 'default' : 
                                       jobPosting.review_status === 'pending' ? 'outline' : 'destructive'}
                                className="text-xs"
                              >
                                {jobPosting.review_status || 'Unknown'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Created:</span>
                              <span className="text-xs">
                                {new Date(jobPosting.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          {jobPosting.description && (
                            <div className="mt-2">
                              <details className="group">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                                  Description
                                  <span className="ml-1 text-gray-500 group-open:hidden">▼</span>
                                  <span className="ml-1 text-gray-500 hidden group-open:inline">▲</span>
                                </summary>
                                <p className="text-sm text-gray-600 mt-1 pl-4 border-l-2 border-gray-200">
                                  {jobPosting.description}
                                </p>
                              </details>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}