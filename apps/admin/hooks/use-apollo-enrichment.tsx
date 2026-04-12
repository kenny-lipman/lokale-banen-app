"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { EnrichmentJob } from "@/components/enrichment-progress-modal"

interface UseApolloEnrichmentOptions {
  onComplete?: () => void
  onRefreshData?: () => void
}

export function useApolloEnrichment({
  onComplete,
  onRefreshData
}: UseApolloEnrichmentOptions = {}) {
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichmentJobs, setEnrichmentJobs] = useState<EnrichmentJob[]>([])
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const companyIdsRef = useRef<string[]>([])

  // Start enrichment process
  const startEnrichment = useCallback(async (companies: Array<{ id: string, name: string, website: string, location?: string, region_id?: string }>) => {
    try {
      setIsEnriching(true)
      
      // Store company IDs for individual status polling
      companyIdsRef.current = companies.map(c => c.id)
      
      // Create initial jobs
      const jobs: EnrichmentJob[] = companies.map(company => ({
        companyId: company.id,
        companyName: company.name,
        website: company.website,
        status: 'queued'
      }))
      
      setEnrichmentJobs(jobs)
      setShowProgressModal(true)
      
      // Generate batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setCurrentBatchId(batchId)

      // Prepare webhook payload
      const payload = {
        batchId,
        companies: companies.map(c => ({
          id: c.id,
          website: c.website,
          name: c.name,
          location: c.location,
          region_id: c.region_id
        }))
      }

      console.log("Starting Apollo enrichment with payload:", payload)

      // Call our Apollo enrichment API endpoint
      const response = await fetch("/api/apollo/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `API failed: ${response.statusText}`)
      }

      const apiResponse = await response.json()
      console.log("Enrichment API response:", apiResponse)

      // Start status monitoring
      startStatusPolling(batchId)

      toast({
        title: "Apollo Enrichment Gestart",
        description: `${companies.length} bedrijven worden verrijkt met Apollo data`,
      })

    } catch (error) {
      console.error("Enrichment failed:", error)
      setIsEnriching(false)
      
      // Mark all jobs as failed
      setEnrichmentJobs(prev => prev.map(job => ({
        ...job,
        status: 'failed',
        result: { error: error instanceof Error ? error.message : "Onbekende fout" }
      })))

      toast({
        title: "Enrichment Mislukt",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden",
        variant: "destructive",
      })
    }
  }, [toast])

  // Real-time status polling from API
  const startStatusPolling = useCallback((batchId: string) => {
    // Clear existing interval if any
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Poll both batch status and individual company status
        const [batchResponse, companiesResponse] = await Promise.all([
          fetch(`/api/apollo/status/${batchId}`),
          fetch('/api/apollo/companies-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyIds: companyIdsRef.current })
          })
        ])

        if (!batchResponse.ok) {
          console.error('Failed to fetch batch status:', batchResponse.statusText)
          return
        }

        if (!companiesResponse.ok) {
          console.error('Failed to fetch companies status:', companiesResponse.statusText)
          return
        }

        const batchStatus = await batchResponse.json()
        const companiesStatus = await companiesResponse.json()
        
        // Merge batch status with individual company status for more accurate data
        const updatedJobs: EnrichmentJob[] = companiesStatus.companies.map((company: any) => ({
          companyId: company.companyId,
          companyName: company.companyName,
          website: company.website,
          status: company.enrichmentStatus,
          result: {
            contactsFound: company.contactsFound,
            error: company.errorMessage
          }
        }))

        setEnrichmentJobs(updatedJobs)

        // Check if batch is complete
        if (batchStatus.status === 'completed' || batchStatus.progressPercentage === 100) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsEnriching(false)
          onComplete?.()
        }

      } catch (error) {
        console.error('Status polling error:', error)
      }
    }, 2000) // Poll every 2 seconds
  }, [onComplete])

  // Manual refresh function
  const refreshResults = useCallback(async () => {
    if (companyIdsRef.current.length === 0) {
      toast({
        title: "Geen bedrijven om te verversen",
        description: "Er zijn geen bedrijven geselecteerd voor verrijking",
        variant: "destructive",
      })
      return
    }

    try {
      setIsRefreshing(true)
      
      const response = await fetch('/api/apollo/companies-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: companyIdsRef.current })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch companies status')
      }

      const companiesStatus = await response.json()
      
      // Update jobs with fresh data
      const updatedJobs: EnrichmentJob[] = companiesStatus.companies.map((company: any) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        website: company.website,
        status: company.enrichmentStatus,
        result: {
          contactsFound: company.contactsFound,
          error: company.errorMessage
        }
      }))

      setEnrichmentJobs(updatedJobs)

      toast({
        title: "Resultaten Ververst",
        description: "De verrijkingsstatus is bijgewerkt",
      })

    } catch (error) {
      console.error('Refresh error:', error)
      toast({
        title: "Verversing Mislukt",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het verversen",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [toast])

  // Handle enrichment completion
  const handleEnrichmentComplete = useCallback(() => {
    const completedJobs = enrichmentJobs.filter(job => job.status === 'completed').length
    const failedJobs = enrichmentJobs.filter(job => job.status === 'failed').length
    
    toast({
      title: "Apollo Enrichment Voltooid",
      description: `${completedJobs} bedrijven succesvol verrijkt${failedJobs > 0 ? `, ${failedJobs} mislukt` : ''}`,
    })

    // Trigger data refresh
    onRefreshData?.()
  }, [enrichmentJobs, toast, onRefreshData])

  // Close progress modal
  const closeProgressModal = useCallback(() => {
    setShowProgressModal(false)
    
    // Reset state after modal closes
    setTimeout(() => {
      setEnrichmentJobs([])
      setCurrentBatchId(null)
      companyIdsRef.current = []
    }, 300)
  }, [])

  // Reset enrichment state
  const resetEnrichment = useCallback(() => {
    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsEnriching(false)
    setEnrichmentJobs([])
    setShowProgressModal(false)
    setCurrentBatchId(null)
    companyIdsRef.current = []
  }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return {
    // State
    isEnriching,
    enrichmentJobs,
    showProgressModal,
    currentBatchId,
    isRefreshing,
    
    // Actions
    startEnrichment,
    closeProgressModal,
    resetEnrichment,
    handleEnrichmentComplete,
    refreshResults,
    
    // Computed
    progressStats: {
      total: enrichmentJobs.length,
      completed: enrichmentJobs.filter(job => job.status === 'completed').length,
      failed: enrichmentJobs.filter(job => job.status === 'failed').length,
      processing: enrichmentJobs.filter(job => job.status === 'processing').length,
      queued: enrichmentJobs.filter(job => job.status === 'queued').length,
    }
  }
} 