"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useWebhookRateLimit } from '@/hooks/use-webhook-rate-limit'
import { 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  Sparkles,
  Zap,
  MapPin,
  BarChart3,
  ExternalLink,
  User,
  Crown
} from 'lucide-react'
import { supabaseService } from '@/lib/supabase-service'

interface Company {
  id: string
  name: string
  website?: string | null
  location?: string | null
  qualification_status?: string | null
  qualification_timestamp?: string | null
  job_counts: number
  contact_count: number
  category_size?: string | null
  apollo_enriched_at?: string | null
  enrichment_status?: string | null
  is_customer?: boolean | null
  pipedrive_synced?: boolean | null
  pipedrive_synced_at?: string | null
}

interface CompaniesTabContainerProps {
  // Filter state from parent (companies page)
  searchTerm?: string
  statusFilter?: string
  sourceFilter?: string
  customerFilter?: string
  websiteFilter?: string
  categorySizeFilter?: string
  apolloEnrichedFilter?: string
  hasContactsFilter?: string
  regioPlatformFilter?: string
  onCompanyClick?: (company: Company) => void
}

interface QualificationCounts {
  qualified: number
  review: number
  disqualified: number
  pending: number
  enriched: number
}

export function CompaniesTabContainer({
  searchTerm = "",
  statusFilter = "all",
  sourceFilter = "all", 
  customerFilter = "all",
  websiteFilter = "all",
  categorySizeFilter = "all",
  apolloEnrichedFilter = "all",
  hasContactsFilter = "all",
  regioPlatformFilter = "all",
  onCompanyClick
}: CompaniesTabContainerProps) {
  const [activeTab, setActiveTab] = useState<'qualified' | 'review' | 'disqualified' | 'pending' | 'enriched'>('qualified')
  const [companies, setCompanies] = useState<Company[]>([])
  const [counts, setCounts] = useState<QualificationCounts>({ qualified: 0, review: 0, disqualified: 0, pending: 0, enriched: 0 })
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [isQualifying, setIsQualifying] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const webhookRateLimit = useWebhookRateLimit()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const prevSearchTermRef = useRef(searchTerm)

  // Build filter object for API calls
  const getFilterParams = (qualificationStatus?: string) => ({
    search: searchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    is_customer: customerFilter === "all" ? undefined : customerFilter === "customers",
    websiteFilter,
    categorySize: categorySizeFilter !== "all" ? categorySizeFilter : undefined,
    apolloEnriched: apolloEnrichedFilter !== "all" ? apolloEnrichedFilter : undefined,
    hasContacts: hasContactsFilter !== "all" ? hasContactsFilter : undefined,
    regioPlatformFilter: regioPlatformFilter !== "all" ? regioPlatformFilter : undefined,
    qualification_status: qualificationStatus || 'all',
    limit: 100 // Load more companies per tab
  })

  // Load companies for active tab
  const loadTabData = async (tabName: string) => {
    try {
      setLoading(true)
      const result = await supabaseService.getCompanies(getFilterParams(tabName))
      setCompanies(result.data || [])
    } catch (error) {
      console.error('Error loading tab data:', error)
      toast({
        title: "Error loading companies",
        description: "Failed to load company data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Load qualification counts for all tabs
  const loadCounts = async () => {
    try {
      const countsResult = await supabaseService.getCompanyCountsByQualificationStatus(getFilterParams())
      setCounts(countsResult)
    } catch (error) {
      console.error('Error loading counts:', error)
    }
  }

  // Load data when tab changes
  useEffect(() => {
    loadTabData(activeTab)
  }, [activeTab])

  // Handle search term changes with debounce
  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce search term changes (600ms for natural typing speed)
    debounceTimerRef.current = setTimeout(() => {
      loadTabData(activeTab)
      loadCounts()
    }, 600)

    // Update ref for next comparison
    prevSearchTermRef.current = searchTerm

    // Cleanup timeout on unmount or when search term changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchTerm])

  // Handle other filter changes immediately (no debounce)
  useEffect(() => {
    loadTabData(activeTab)
    loadCounts()
  }, [statusFilter, sourceFilter, customerFilter, websiteFilter, categorySizeFilter, apolloEnrichedFilter, hasContactsFilter, regioPlatformFilter])

  // Refresh all data
  const refreshData = async () => {
    setIsRefreshing(true)
    await Promise.all([
      loadTabData(activeTab),
      loadCounts()
    ])
    setIsRefreshing(false)
  }

  // Toggle company selection
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

  // Select all companies in current tab
  const selectAllCompanies = () => {
    const allSelected = companies.every(c => selectedCompanies.has(c.id))
    if (allSelected) {
      // Deselect all
      setSelectedCompanies(prev => {
        const newSet = new Set(prev)
        companies.forEach(c => newSet.delete(c.id))
        return newSet
      })
    } else {
      // Select all
      setSelectedCompanies(prev => {
        const newSet = new Set(prev)
        companies.forEach(c => newSet.add(c.id))
        return newSet
      })
    }
  }

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedCompanies(new Set())
  }, [activeTab])

  // Enrichment functions
  const handleEnrichSingle = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId)
    if (!company) return

    // Check rate limit before proceeding
    if (!webhookRateLimit.canCall(companyId)) {
      const remainingTime = webhookRateLimit.getRemainingTime(companyId)
      toast({
        title: "Rate Limited",
        description: `Please wait ${remainingTime} seconds before enriching ${company.name} again.`,
        variant: "destructive"
      })
      return
    }

    // Mark as loading to prevent duplicate calls
    webhookRateLimit.markAsLoading(companyId)

    try {
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

      if (response.ok) {
        toast({
          title: "Enrichment triggered",
          description: `Webhook sent for ${company.name}`,
        })
      } else {
        throw new Error(`Failed to trigger webhook: ${response.status}`)
      }
    } catch (error) {
      console.error('Error triggering enrichment:', error)
      toast({
        title: "Error triggering enrichment",
        description: error instanceof Error ? error.message : "Failed to trigger webhook",
        variant: "destructive",
      })
    } finally {
      // Clean up loading state
      webhookRateLimit.markAsComplete(companyId)
    }
  }

  const handleEnrichSelected = async () => {
    const selectedIds = Array.from(selectedCompanies)
    const selectedCompaniesData = companies.filter(c => selectedIds.includes(c.id))
    
    if (selectedCompaniesData.length === 0) return

    // Filter out rate-limited companies
    const eligibleCompanies = selectedCompaniesData.filter(company => webhookRateLimit.canCall(company.id))
    const rateLimitedCount = selectedCompaniesData.length - eligibleCompanies.length

    if (eligibleCompanies.length === 0) {
      toast({
        title: "All Companies Rate Limited",
        description: `All ${selectedCompaniesData.length} selected companies are currently rate limited. Please wait before trying again.`,
        variant: "destructive"
      })
      return
    }

    // Mark eligible companies as loading
    eligibleCompanies.forEach(company => webhookRateLimit.markAsLoading(company.id))

    let successCount = 0
    let failCount = 0

    for (const company of eligibleCompanies) {
      try {
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

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        failCount++
        console.error(`Error enriching ${company.name}:`, error)
      } finally {
        // Clean up loading state
        webhookRateLimit.markAsComplete(company.id)
      }
    }

    let description = `${successCount} webhooks sent successfully`
    if (failCount > 0) description += `, ${failCount} failed`
    if (rateLimitedCount > 0) description += `, ${rateLimitedCount} skipped (rate limited)`

    toast({
      title: "Enrichment triggered",
      description,
    })

    setSelectedCompanies(new Set())
  }

  const handleEnrichAllQualified = async () => {
    try {
      // Load all qualified companies (not just the current page)
      const allQualifiedResult = await supabaseService.getCompanies({
        ...getFilterParams('qualified'),
        limit: 1000 // Get all qualified companies
      })
      
      const allQualifiedCompanies = allQualifiedResult.data || []
      
      if (allQualifiedCompanies.length === 0) {
        toast({
          title: "No qualified companies",
          description: "No qualified companies found to enrich",
          variant: "destructive",
        })
        return
      }

      // Filter out rate-limited companies
      const eligibleCompanies = allQualifiedCompanies.filter(company => webhookRateLimit.canCall(company.id))
      const rateLimitedCount = allQualifiedCompanies.length - eligibleCompanies.length

      if (eligibleCompanies.length === 0) {
        toast({
          title: "All Qualified Companies Rate Limited",
          description: `All ${allQualifiedCompanies.length} qualified companies are currently rate limited. Please wait before trying again.`,
          variant: "destructive"
        })
        return
      }

      // Mark eligible companies as loading
      eligibleCompanies.forEach(company => webhookRateLimit.markAsLoading(company.id))

      let successCount = 0
      let failCount = 0

      for (const company of eligibleCompanies) {
        try {
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

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
          console.error(`Error enriching ${company.name}:`, error)
        } finally {
          // Clean up loading state
          webhookRateLimit.markAsComplete(company.id)
        }
      }

      let description = `${successCount} webhooks sent successfully`
      if (failCount > 0) description += `, ${failCount} failed`
      if (rateLimitedCount > 0) description += `, ${rateLimitedCount} skipped (rate limited)`

      toast({
        title: "Enrichment triggered for all qualified companies",
        description,
      })
    } catch (error) {
      console.error('Error enriching all qualified companies:', error)
      toast({
        title: "Error enriching companies",
        description: "Failed to trigger enrichment for qualified companies",
        variant: "destructive",
      })
    }
  }

  // Qualification functions
  const qualifyCompany = async (companyId: string, status: 'qualified' | 'disqualified' | 'review' | 'pending') => {
    setIsQualifying(prev => new Set(prev).add(companyId))
    
    try {
      const response = await fetch('/api/companies/qualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, qualification_status: status })
      })

      if (!response.ok) {
        throw new Error(`Failed to update company qualification: ${response.status}`)
      }

      toast({
        title: "Company qualification updated",
        description: `Company ${status} successfully`,
      })

      // Refresh data
      await refreshData()
    } catch (error) {
      console.error('Error qualifying company:', error)
      toast({
        title: "Error updating qualification",
        description: error instanceof Error ? error.message : "Failed to update company qualification",
        variant: "destructive",
      })
    } finally {
      setIsQualifying(prev => {
        const next = new Set(prev)
        next.delete(companyId)
        return next
      })
    }
  }

  // Bulk qualification
  const bulkQualifyCompanies = async (status: 'qualified' | 'disqualified' | 'review' | 'pending') => {
    const selectedIds = Array.from(selectedCompanies)
    if (selectedIds.length === 0) return

    selectedIds.forEach(id => setIsQualifying(prev => new Set(prev).add(id)))

    try {
      const response = await fetch('/api/companies/qualify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: selectedIds, qualification_status: status })
      })

      if (!response.ok) {
        throw new Error(`Failed to bulk update qualifications: ${response.status}`)
      }

      toast({
        title: "Bulk qualification updated",
        description: `${selectedIds.length} companies ${status} successfully`,
      })

      setSelectedCompanies(new Set())
      await refreshData()
    } catch (error) {
      console.error('Error bulk qualifying companies:', error)
      toast({
        title: "Error updating qualifications",
        description: "Failed to update company qualifications",
        variant: "destructive",
      })
    } finally {
      selectedIds.forEach(id => {
        setIsQualifying(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
    }
  }

  // Render companies section with cards (matching OTIS enhanced layout)
  const renderCompaniesSection = (qualificationState: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading companies...
        </div>
      )
    }

    if (companies.length === 0) {
      const emptyMessages = {
        qualified: { 
          icon: '❌', 
          title: 'No qualified companies yet',
          message: 'Companies you mark as qualified will appear here, ready for Apollo enrichment.'
        },
        enriched: { 
          icon: '💎', 
          title: 'No enriched companies yet',
          message: 'Companies that have been enriched with Apollo data will appear here.'
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
              : qualificationState === 'enriched'
              ? 'bg-purple-50 border-purple-200'
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
                onChange={selectAllCompanies}
              />
              <span className="text-sm font-medium">
                Select All {qualificationState === 'qualified' ? 'Qualified' : 
                          qualificationState === 'enriched' ? 'Enriched' :
                          qualificationState === 'review' ? 'Review' :
                          qualificationState === 'disqualified' ? 'Disqualified' : 'Pending'}
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
                  onClick={handleEnrichSelected}
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
                    onClick={() => bulkQualifyCompanies('qualified')}
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                  >
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => bulkQualifyCompanies('review')}
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                  >
                    Review Selected
                  </Button>
                </>
              )}
              {qualificationState === 'review' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => bulkQualifyCompanies('qualified')}
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                  >
                    Qualify Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => bulkQualifyCompanies('disqualified')}
                    disabled={companies.filter(c => selectedCompanies.has(c.id)).length === 0}
                  >
                    Disqualify Selected
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Company Cards with workflow-specific styling */}
        {companies.map((company: Company) => (
          <div 
            key={company.id} 
            className={`border rounded-lg p-4 space-y-3 transition-all hover:shadow-lg ${
              qualificationState === 'qualified' 
                ? 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm' 
                : qualificationState === 'enriched'
                ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50 shadow-md'
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
                    qualificationState === 'qualified' ? 'text-green-600' :
                    qualificationState === 'enriched' ? 'text-purple-600' :
                    qualificationState === 'review' ? 'text-yellow-600' :
                    qualificationState === 'disqualified' ? 'text-red-400' :
                    'text-gray-500'
                  }`} />
                  <span 
                    className={`font-medium cursor-pointer hover:underline ${
                      qualificationState === 'qualified' ? 'text-green-900' :
                      qualificationState === 'review' ? 'text-yellow-900' :
                      qualificationState === 'disqualified' ? 'text-red-700' :
                      'text-gray-900'
                    }`}
                    onClick={() => onCompanyClick?.(company)}
                  >
                    {company.name}
                  </span>
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
                <Badge variant="outline">{company.job_counts} jobs</Badge>
                {company.contact_count > 0 && (
                  <Badge variant="secondary">{company.contact_count} contacts</Badge>
                )}
                {company.is_customer && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Customer
                  </Badge>
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
                {/* Pipedrive Sync Status */}
                {company.pipedrive_synced ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Pipedrive
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    No Pipedrive
                  </Badge>
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
              {company.website && (
                <div className="flex items-center gap-1 text-blue-600">
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{company.website}</span>
                </div>
              )}
            </div>

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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-green-600 border-green-300"
                    onClick={() => handleEnrichSingle(company.id)}
                    disabled={webhookRateLimit.isLoading(company.id) || !webhookRateLimit.canCall(company.id)}
                  >
                    {webhookRateLimit.isLoading(company.id) ? (
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    {webhookRateLimit.isLoading(company.id) ? 'Enriching...' : 'Enrich with Apollo'}
                  </Button>
                </div>
              ) : qualificationState === 'review' ? (
                // Review: Show qualify or disqualify options
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'qualified')}
                    className="text-green-600 border-green-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : '✅ Qualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'disqualified')}
                    className="text-red-600 border-red-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : '❌ Disqualify'}
                  </Button>
                </div>
              ) : qualificationState === 'disqualified' ? (
                // Disqualified: Minimal actions
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'review')}
                    className="text-yellow-600 border-yellow-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Move to Review'}
                  </Button>
                </div>
              ) : (
                // Pending: Full qualification options
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'qualified')}
                    className="text-green-600 border-green-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Qualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'disqualified')}
                    className="text-red-600 border-red-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Disqualify'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isQualifying.has(company.id)}
                    onClick={() => qualifyCompany(company.id, 'review')}
                    className="text-yellow-600 border-yellow-300"
                  >
                    {isQualifying.has(company.id) ? 'Updating...' : 'Review'}
                  </Button>
                </div>
              )}
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onCompanyClick?.(company)}
              >
                View Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Companies Management
            </CardTitle>
            <CardDescription>
              Qualify companies and manage Apollo enrichment ({counts.qualified + counts.review + counts.disqualified + counts.pending} companies total)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            className="flex items-center gap-2"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Qualification Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">💎 Enriched</p>
                <p className="text-2xl font-bold text-purple-700">{counts.enriched}</p>
                <p className="text-xs text-purple-600">Apollo data added</p>
              </div>
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">✅ Qualified</p>
                <p className="text-2xl font-bold text-green-700">{counts.qualified}</p>
                <p className="text-xs text-green-600">Ready for Apollo</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">⭕ Review Needed</p>
                <p className="text-2xl font-bold text-yellow-700">{counts.review}</p>
                <p className="text-xs text-yellow-600">Needs attention</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">❌ Disqualified</p>
                <p className="text-2xl font-bold text-red-700">{counts.disqualified}</p>
                <p className="text-xs text-red-600">Not suitable</p>
              </div>
              <RefreshCw className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">⏳ Pending</p>
                <p className="text-2xl font-bold text-gray-700">{counts.pending}</p>
                <p className="text-xs text-gray-600">Needs qualification</p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Qualification Workflow Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="enriched" className="text-purple-700 data-[state=active]:bg-purple-100">
              💎 Enriched ({counts.enriched})
            </TabsTrigger>
            <TabsTrigger value="qualified" className="text-green-700 data-[state=active]:bg-green-100">
              ✅ Qualified ({counts.qualified})
            </TabsTrigger>
            <TabsTrigger value="review" className="text-yellow-700 data-[state=active]:bg-yellow-100">
              ⭕ Review ({counts.review})
            </TabsTrigger>
            <TabsTrigger value="disqualified" className="text-red-700 data-[state=active]:bg-red-100">
              ❌ Disqualified ({counts.disqualified})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-gray-700 data-[state=active]:bg-gray-100">
              ⏳ Pending ({counts.pending})
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
            {renderCompaniesSection('enriched')}
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
                      {counts.qualified} qualified companies ready for enrichment
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={counts.qualified === 0}
                    onClick={handleEnrichAllQualified}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Enrich All Qualified
                  </Button>
                </div>
              </div>
            </div>
            {renderCompaniesSection('qualified')}
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
              </div>
            </div>
            {renderCompaniesSection('review')}
          </TabsContent>

          {/* Disqualified Companies - Archive Zone */}
          <TabsContent value="disqualified" className="space-y-4">
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800">❌ Archived Companies</h3>
                  <p className="text-sm text-red-600">
                    Companies marked as not suitable for current campaigns
                  </p>
                </div>
              </div>
            </div>
            {renderCompaniesSection('disqualified')}
          </TabsContent>

          {/* Pending Companies - Processing Queue */}
          <TabsContent value="pending" className="space-y-4">
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">⏳ Qualification Queue</h3>
                  <p className="text-sm text-gray-600">
                    Companies awaiting qualification - review and categorize
                  </p>
                </div>
              </div>
            </div>
            {renderCompaniesSection('pending')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}