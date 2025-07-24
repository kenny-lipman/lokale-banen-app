"use client"

import { useState, useMemo, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface Company {
  id: string
  name: string
  website?: string | null
  location?: string | null
  job_counts: number // Number of job postings for this company
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
    selectedCompanies.filter(company => company.job_counts > 0), // Only companies with job postings
    [selectedCompanies]
  )

  // Get companies that cannot be enriched (0 job postings)
  const unenrichableCompanies = useMemo(() => 
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
    if (selectedIds.length === companies.length) {
      // Deselect all
      setSelectedIds([])
      onSelectionChange?.([])
    } else {
      // Select all (up to batch limit)
      const allIds = companies.map(c => c.id)
      const limitedSelection = allIds.slice(0, maxBatchSize)
      
      if (allIds.length > maxBatchSize) {
        toast({
          title: "Selection Limited",
          description: `Selected first ${maxBatchSize} companies. Maximum batch size is ${maxBatchSize}.`,
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
  const isAllSelected = companies.length > 0 && selectedIds.length === Math.min(companies.length, maxBatchSize)

  // Get companies for Apollo webhook (including those without websites)
  const getApolloPayload = useCallback(() => {
    return {
      companies: enrichableCompanies.map(company => ({
        id: company.id,
        website: company.website || '' // Include empty string for companies without websites
      }))
    }
  }, [enrichableCompanies])

  // Validation messages
  const getValidationMessage = useCallback(() => {
    if (selectedIds.length === 0) return "Select companies to enrich with Apollo"
    if (exceedsBatchLimit) return `Too many companies selected. Maximum: ${maxBatchSize}`
    
    const unenrichableCount = unenrichableCompanies.length
    if (unenrichableCount > 0 && enrichableCompanies.length === 0) {
      return `Cannot enrich selected companies: ${unenrichableCount} ${unenrichableCount === 1 ? 'company has' : 'companies have'} 0 job postings`
    }
    if (unenrichableCount > 0) {
      return `Ready to enrich ${enrichableCompanies.length} companies with Apollo (${unenrichableCount} excluded: no job postings)`
    }
    
    return `Ready to enrich ${enrichableCompanies.length} companies with Apollo`
  }, [selectedIds.length, exceedsBatchLimit, enrichableCompanies.length, unenrichableCompanies.length, maxBatchSize])

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