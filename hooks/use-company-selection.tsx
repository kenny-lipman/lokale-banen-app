"use client"

import { useState, useMemo, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface Company {
  id: string
  name: string
  website?: string | null
  location?: string | null
  job_counts: number // Number of job postings for this company
  apollo_enriched_at?: string | null // Apollo enrichment timestamp
  // Add other Company interface properties as needed
}

interface UseCompanySelectionOptions {
  companies: Company[]
  maxBatchSize?: number
  onSelectionChange?: (selectedIds: string[]) => void
}

export function useCompanySelection({ 
  companies, 
  maxBatchSize = 100, 
  onSelectionChange 
}: UseCompanySelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isEnriching, setIsEnriching] = useState(false)
  const { toast } = useToast()

  // Get selected companies with their data
  const selectedCompanies = useMemo(() => 
    companies.filter(company => selectedIds.includes(company.id)),
    [companies, selectedIds]
  )

  // Get selected companies eligible for Apollo enrichment (must have job postings)
  const enrichableCompanies = useMemo(() => 
    selectedCompanies.filter(company => company.job_counts > 0 && !company.apollo_enriched_at), // Only companies with job postings and not yet enriched
    [selectedCompanies]
  )

  // Get companies that cannot be enriched (0 job postings or already enriched)
  const unenrichableCompanies = useMemo(() => 
    selectedCompanies.filter(company => company.job_counts === 0 || company.apollo_enriched_at),
    [selectedCompanies]
  )

  // Get companies that are already enriched
  const alreadyEnrichedCompanies = useMemo(() => 
    selectedCompanies.filter(company => company.apollo_enriched_at),
    [selectedCompanies]
  )

  // Get companies with no job postings
  const noJobPostingsCompanies = useMemo(() => 
    selectedCompanies.filter(company => company.job_counts === 0),
    [selectedCompanies]
  )

  // Check if selection exceeds batch size limit
  const exceedsBatchLimit = selectedIds.length > maxBatchSize
  const canEnrich = enrichableCompanies.length > 0 && !exceedsBatchLimit && !isEnriching

  // Toggle single company selection
  const toggleSelection = useCallback((companyId: string) => {
    setSelectedIds(prev => {
      const newSelection = prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
      
      // Check batch size limit
      if (newSelection.length > maxBatchSize) {
        toast({
          title: "Selection Limit Exceeded",
          description: `Maximum ${maxBatchSize} companies can be selected for batch enrichment.`,
          variant: "destructive",
        })
        return prev // Don't update if exceeds limit
      }
      
      onSelectionChange?.(newSelection)
      return newSelection
    })
  }, [maxBatchSize, onSelectionChange, toast])

  // Select all companies (with batch limit validation)
  const selectAll = useCallback(() => {
    // Get all companies that can be enriched (have job postings and not already enriched)
    const enrichableCompanyIds = companies
      .filter(c => c.job_counts > 0 && !c.apollo_enriched_at)
      .map(c => c.id)
    
    if (selectedIds.length === enrichableCompanyIds.length) {
      // Deselect all
      setSelectedIds([])
      onSelectionChange?.([])
    } else {
      // Select all enrichable companies (up to batch limit)
      const limitedSelection = enrichableCompanyIds.slice(0, maxBatchSize)
      
      if (enrichableCompanyIds.length > maxBatchSize) {
        toast({
          title: "Selection Limited",
          description: `Selected first ${maxBatchSize} enrichable companies. Maximum batch size is ${maxBatchSize}.`,
          variant: "default",
        })
      }
      
      setSelectedIds(limitedSelection)
      onSelectionChange?.(limitedSelection)
    }
  }, [companies, selectedIds.length, maxBatchSize, onSelectionChange, toast])

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds([])
    onSelectionChange?.([])
  }, [onSelectionChange])

  // Check if all (visible) companies are selected
  const isAllSelected = useMemo(() => {
    const enrichableCompanyIds = companies
      .filter(c => c.job_counts > 0 && !c.apollo_enriched_at)
      .map(c => c.id)
    return enrichableCompanyIds.length > 0 && selectedIds.length === Math.min(enrichableCompanyIds.length, maxBatchSize)
  }, [companies, selectedIds.length, maxBatchSize])

  // Get companies for Apollo webhook (including those without websites)
  const getApolloPayload = useCallback(() => {
    return {
      companies: enrichableCompanies.map(company => ({
        id: company.id,
        website: company.website || '', // Include empty string for companies without websites
        name: company.name,
        location: company.location || null,
        region_id: company.region_id
      }))
    }
  }, [enrichableCompanies])

  // Validation messages
  const getValidationMessage = useCallback(() => {
    if (selectedIds.length === 0) return "Select companies to enrich with Apollo"
    if (exceedsBatchLimit) return `Too many companies selected. Maximum: ${maxBatchSize}`
    
    const alreadyEnrichedCount = alreadyEnrichedCompanies.length
    const noJobPostingsCount = noJobPostingsCompanies.length
    const enrichableCount = enrichableCompanies.length
    
    if (enrichableCount === 0) {
      const reasons = []
      if (alreadyEnrichedCount > 0) reasons.push(`${alreadyEnrichedCount} already enriched`)
      if (noJobPostingsCount > 0) reasons.push(`${noJobPostingsCount} have no job postings`)
      return `Cannot enrich selected companies: ${reasons.join(', ')}`
    }
    
    const excludedReasons = []
    if (alreadyEnrichedCount > 0) excludedReasons.push(`${alreadyEnrichedCount} already enriched`)
    if (noJobPostingsCount > 0) excludedReasons.push(`${noJobPostingsCount} no job postings`)
    
    if (excludedReasons.length > 0) {
      return `Ready to enrich ${enrichableCount} companies with Apollo (${excludedReasons.join(', ')} excluded)`
    }
    
    return `Ready to enrich ${enrichableCount} companies with Apollo`
  }, [selectedIds.length, exceedsBatchLimit, enrichableCompanies.length, alreadyEnrichedCompanies.length, noJobPostingsCompanies.length, maxBatchSize])

  return {
    // Selection state
    selectedIds,
    selectedCompanies,
    enrichableCompanies,
    unenrichableCompanies,
    selectedCount: selectedIds.length,
    enrichableCount: enrichableCompanies.length,
    unenrichableCount: unenrichableCompanies.length,
    
    // Selection actions
    toggleSelection,
    selectAll,
    clearSelection,
    isAllSelected,
    
    // Apollo enrichment
    canEnrich,
    isEnriching,
    setIsEnriching,
    getApolloPayload,
    
    // Validation
    exceedsBatchLimit,
    maxBatchSize,
    getValidationMessage,
  }
} 