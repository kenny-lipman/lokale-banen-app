"use client"

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { authFetch } from "@/lib/authenticated-fetch"
import { EnrichmentButton, EnrichmentStatusBadge } from "@/components/ui/enrichment-button"
import { ContextualHelp, QuickHelpTooltip, ProgressiveHelp } from "@/components/ui/contextual-help"
import { useEnrichmentPolling } from "@/hooks/use-enrichment-polling"
import { useEnrichmentToasts } from "@/components/ui/enrichment-toast"
import { 
  Building2, 
  ExternalLink, 
  MapPin, 
  Briefcase, 
  Users, 
  Globe, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Sparkles,
  RefreshCw,
  Mail,
  Calendar,
  BarChart3,
  Target,
  Link
} from "lucide-react"
import { useToast } from '@/hooks/use-toast'

interface CompanyJobPosting {
  id: string
  title: string
  location: string
  status: string
  review_status: string
  created_at: string
  job_type?: string
  salary?: string
  url?: string
  description?: string
}

interface CompanyContact {
  id: string
  name: string
  email: string
  title: string
  linkedin_url?: string
  phone?: string
  email_status: string
  created_at: string
  is_key_contact?: boolean
}

interface Contact {
  id: string
  name: string
  first_name?: string | null
  email?: string | null
  title?: string | null
  linkedin_url?: string | null
  phone?: string | null
  email_status?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  created_at: string
}

interface EnrichmentData {
  organization?: {
    name: string
    employees: number
    industry: string
    founded_year?: number
    revenue?: string
    headquarters?: string
  }
  enriched_at?: string
  enrichment_source?: string
}

interface CompanyDetails {
  id: string
  name: string
  website?: string
  location?: string
  description?: string
  category_size?: string
  size_min?: number
  size_max?: number
  qualification_status?: 'pending' | 'qualified' | 'disqualified' | 'review' | 'enriched'
  qualification_timestamp?: string
  qualification_notes?: string
  enrichment_status?: 'idle' | 'processing' | 'completed' | 'failed'
  enrichment_started_at?: string
  enrichment_completed_at?: string
  enrichment_error_message?: string
  apollo_enriched_at?: string
  apollo_contacts_count?: number
  current_batch_id?: string
  job_count: number
  contactsFound: number
  created_at: string
  job_postings: CompanyJobPosting[]
  contacts: CompanyContact[]
  enrichment_data?: EnrichmentData
}

interface CompanyDetailsDrawerProps {
  companyId: string | null
  open: boolean
  onClose: () => void
  onQualify?: (companyId: string, status: 'qualified' | 'disqualified' | 'review') => void
  onEnrich?: (companyId: string) => void
  isEnrichingExternal?: boolean // External enriching state for rate limiting
}

export function CompanyDetailsDrawer({ 
  companyId, 
  open, 
  onClose, 
  onQualify, 
  onEnrich,
  isEnrichingExternal = false
}: CompanyDetailsDrawerProps) {
  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isQualifying, setIsQualifying] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const { toast } = useToast()
  
  // Enhanced toast system
  const {
    showEnrichmentStart,
    showEnrichmentSuccess,
    showEnrichmentError,
    showPartialSuccess
  } = useEnrichmentToasts()

  // Polling system for enrichment status
  const pollingState = useEnrichmentPolling(
    company?.current_batch_id || null,
    {
      onStatusChange: (status) => {
        console.log('📊 Enrichment status update:', status)
        // Update company data when status changes
        if (company && status.company_results) {
          const companyResult = status.company_results.find(r => r.company_id === company.id)
          if (companyResult) {
            setCompany(prev => prev ? {
              ...prev,
              enrichment_status: companyResult.status as any,
              apollo_contacts_count: companyResult.apollo_contacts_count || 0,
              apollo_enriched_at: companyResult.enriched_at || undefined
            } : null)
          }
        }
      },
      onComplete: (batchId, results) => {
        console.log('✅ Enrichment complete:', results)
        // Refresh company data
        fetchCompanyDetails()
        
        // Show completion toast
        if (results.status === 'completed') {
          const companyResult = results.company_results.find(r => r.company_id === company?.id)
          showEnrichmentSuccess(batchId, {
            companies_enriched: 1,
            contacts_found: companyResult?.apollo_contacts_count || 0,
            failed_companies: 0
          })
        } else if (results.status === 'partial_success') {
          showPartialSuccess(batchId, {
            companies_enriched: results.completed_companies,
            contacts_found: results.company_results.reduce((sum, r) => sum + (r.apollo_contacts_count || 0), 0),
            failed_companies: results.failed_companies
          })
        }
      },
      onError: (error) => {
        console.error('❌ Polling error:', error)
        toast({
          title: "Status Check Failed",
          description: error,
          variant: "destructive"
        })
      }
    }
  )

  useEffect(() => {
    if (open && companyId) {
      fetchCompanyDetails()
    }
  }, [open, companyId])

  // Separate useEffect to fetch contacts when company data is loaded
  useEffect(() => {
    if (company && companyId) {
      fetchContacts()
    }
  }, [company?.id, companyId])

  const fetchCompanyDetails = async () => {
    if (!companyId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/otis/companies/${companyId}/details`)
      if (!response.ok) {
        throw new Error(`Failed to fetch company details: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load company details')
      }

      setCompany(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async () => {
    if (!companyId || !company) return

    setLoadingContacts(true)
    setContactsError(null)

    try {
      const response = await authFetch(`/api/companies/${companyId}/contacts`)
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.statusText}`)
      }
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load contacts')
      }
      setContacts(result.data.contacts || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setContactsError(errorMessage)
      console.error('Error fetching contacts:', err)
    } finally {
      setLoadingContacts(false)
    }
  }

  const handleQualify = async (status: 'qualified' | 'disqualified' | 'review') => {
    if (!company || !onQualify) return

    setIsQualifying(true)
    try {
      await onQualify(company.id, status)
      // Refresh company data to get updated status
      await fetchCompanyDetails()
      toast({
        title: "Success",
        description: `Company ${status} successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${status} company`,
        variant: "destructive"
      })
    } finally {
      setIsQualifying(false)
    }
  }

  const handleEnrich = async () => {
    if (!company || !onEnrich) return

    setIsEnriching(true)
    try {
      // Generate batch ID for this enrichment
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Show start toast
      showEnrichmentStart(batchId, 1)
      
      // Start enrichment
      await onEnrich(company.id)
      
      // Update company with batch ID to start polling
      setCompany(prev => prev ? {
        ...prev,
        current_batch_id: batchId,
        enrichment_status: 'processing',
        enrichment_started_at: new Date().toISOString()
      } : null)
      
      // Polling will automatically start due to the batch ID change
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start enrichment"
      console.error('❌ Enrichment error:', error)
      
      showEnrichmentError(company.current_batch_id || 'unknown', errorMessage)
      
      // Reset enrichment status on error
      setCompany(prev => prev ? {
        ...prev,
        current_batch_id: undefined,
        enrichment_status: 'failed',
        enrichment_error_message: errorMessage
      } : null)
    } finally {
      setIsEnriching(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getQualificationBadge = (status?: string) => {
    switch (status) {
      case 'qualified':
        return <Badge className="bg-green-100 text-green-800">✅ Qualified</Badge>
      case 'disqualified':
        return <Badge className="bg-red-100 text-red-800">❌ Disqualified</Badge>
      case 'review':
        return <Badge className="bg-yellow-100 text-yellow-800">⭕ Review</Badge>
      default:
        return <Badge variant="outline">⏳ Pending</Badge>
    }
  }

  const getEnrichmentBadge = (status?: string, contactsCount?: number) => {
    return (
      <EnrichmentStatusBadge 
        status={status || 'idle'} 
        contactsCount={contactsCount}
      />
    )
  }

  const getJobStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>
      case 'new':
        return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />New</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }


  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <SheetTitle className="text-xl">{company?.name || 'Loading...'}</SheetTitle>
                {company?.qualification_status && getQualificationBadge(company.qualification_status)}
                {getEnrichmentBadge(company?.enrichment_status, company?.apollo_contacts_count)}
              </div>
              <SheetDescription>Company details, job postings, and contacts</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading company details...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {company && !loading && !error && (
          <div className="mt-6 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <QuickHelpTooltip content="Mark this company as qualified for outreach">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                      disabled={isQualifying}
                      onClick={() => handleQualify('qualified')}
                    >
                      {isQualifying ? 'Updating...' : 'Qualify'}
                    </Button>
                  </QuickHelpTooltip>
                  
                  <QuickHelpTooltip content="Mark this company as not suitable for outreach">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={isQualifying}
                      onClick={() => handleQualify('disqualified')}
                    >
                      {isQualifying ? 'Updating...' : 'Disqualify'}
                    </Button>
                  </QuickHelpTooltip>
                  
                  <QuickHelpTooltip content="Mark this company for further review">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                      disabled={isQualifying}
                      onClick={() => handleQualify('review')}
                    >
                      {isQualifying ? 'Updating...' : 'Review'}
                    </Button>
                  </QuickHelpTooltip>
                  
                  <EnrichmentButton
                    status={company.enrichment_status || 'idle'}
                    isLoading={isEnriching || pollingState.isPolling || isEnrichingExternal}
                    contactsCount={company.apollo_contacts_count}
                    lastEnrichedAt={company.apollo_enriched_at}
                    onClick={handleEnrich}
                    size="sm"
                  />
                  
                  {/* Manual refresh button for manual polling phase */}
                  {pollingState.pollingPhase === 'manual' && pollingState.canManualRefresh && (
                    <QuickHelpTooltip content="Check current enrichment status">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={pollingState.manualRefresh}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Check Status
                      </Button>
                    </QuickHelpTooltip>
                  )}
                </div>

                {/* Enrichment progress and help */}
                {pollingState.isPolling && (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    {pollingState.progress && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Enrichment Progress</span>
                          <span className="font-medium">{pollingState.progress.percentage}%</span>
                        </div>
                        <Progress value={pollingState.progress.percentage} className="h-2" />
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Completed: {pollingState.progress.completed}</span>
                          <span>Failed: {pollingState.progress.failed}</span>
                          <span>Total: {pollingState.progress.total}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Status message */}
                    <ProgressiveHelp 
                      phase={pollingState.pollingPhase} 
                      elapsedTime={pollingState.elapsedTime} 
                    />
                  </div>
                )}

                {/* Contextual help */}
                <ContextualHelp
                  phase={pollingState.isPolling ? pollingState.pollingPhase : (company.enrichment_status || 'idle')}
                  elapsedTime={pollingState.elapsedTime}
                  progress={pollingState.progress}
                  className="mt-4"
                />
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="jobs">Job Postings ({company.job_postings?.length || 0})</TabsTrigger>
                <TabsTrigger value="contacts">Contacten ({contacts.length})</TabsTrigger>
                <TabsTrigger value="enrichment">Enrichment Data</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {company.website && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-800 hover:underline"
                        >
                          {company.website}
                        </a>
                      </div>
                    )}

                    {company.location && (
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{company.location}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-sm">
                      <Briefcase className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{company.job_count} job postings</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                      <Target className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{company.contactsFound} contacts found</span>
                    </div>

                    {(company.size_min || company.size_max) && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {company.size_min && company.size_max 
                            ? `${company.size_min} - ${company.size_max} employees`
                            : company.size_min 
                            ? `${company.size_min}+ employees`
                            : `Up to ${company.size_max} employees`
                          }
                        </span>
                      </div>
                    )}

                    {company.category_size && (
                      <div className="flex items-center space-x-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{company.category_size}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">Added: {formatDate(company.created_at)}</span>
                    </div>

                    {company.qualification_timestamp && (
                      <div className="flex items-center space-x-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          Qualified: {formatDate(company.qualification_timestamp)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {company.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
                    </CardContent>
                  </Card>
                )}

                {company.qualification_notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Qualification Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700">{company.qualification_notes}</p>
                    </CardContent>
                  </Card>
                )}

              </TabsContent>

              {/* Job Postings Tab */}
              <TabsContent value="jobs">
                <Card>
                  <CardHeader>
                    <CardTitle>Job Postings</CardTitle>
                    <CardDescription>
                      All job postings from this company in the current scraping run
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {company.job_postings && company.job_postings.length > 0 ? (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Job Title</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Posted</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {company.job_postings.map((job) => (
                              <TableRow key={job.id} className="hover:bg-orange-50">
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="font-medium text-sm">{job.title}</div>
                                    {job.salary && <div className="text-xs text-gray-500">{job.salary}</div>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{job.location}</TableCell>
                                <TableCell>
                                  {job.job_type && (
                                    <Badge variant="outline" className="text-xs">
                                      {job.job_type}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {formatDate(job.created_at)}
                                </TableCell>
                                <TableCell>
                                  {job.url && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No job postings found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span>Contacten</span>
                      {loadingContacts && (
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      Contacten die gelinkt zijn aan dit bedrijf
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-purple-50">
                            <TableHead>Naam</TableHead>
                            <TableHead>Functie</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Telefoon</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>LinkedIn</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingContacts ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                                <p className="text-gray-500">Contacten laden...</p>
                              </TableCell>
                            </TableRow>
                          ) : contactsError ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-red-500">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                                <p>Error: {contactsError}</p>
                              </TableCell>
                            </TableRow>
                          ) : contacts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>Geen contacten gevonden</p>
                                {company.qualification_status !== 'enriched' && (
                                  <p className="text-sm mt-2">Verrijk eerst het bedrijf om contacten te vinden</p>
                                )}
                              </TableCell>
                            </TableRow>
                          ) : (
                            contacts.map((contact) => (
                              <TableRow key={contact.id} className="hover:bg-purple-50">
                                <TableCell className="font-medium">
                                  {contact.first_name || contact.name || '-'}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {contact.title || '-'}
                                </TableCell>
                                <TableCell>
                                  {contact.email ? (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span className="text-sm">{contact.email}</span>
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {contact.phone || '-'}
                                </TableCell>
                                <TableCell>
                                  {contact.email_status ? (
                                    <Badge 
                                      className={
                                        contact.email_status === 'verified' 
                                          ? 'bg-green-100 text-green-800 border-green-200'
                                          : contact.email_status === 'bounced'
                                          ? 'bg-red-100 text-red-800 border-red-200'
                                          : 'bg-gray-100 text-gray-800 border-gray-200'
                                      }
                                    >
                                      {contact.email_status}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {contact.linkedin_url ? (
                                    <a
                                      href={contact.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Link className="w-4 h-4" />
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Enrichment Data Tab */}
              <TabsContent value="enrichment">
                <Card>
                  <CardHeader>
                    <CardTitle>Apollo Enrichment Data</CardTitle>
                    <CardDescription>
                      Additional company information from Apollo API
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {company.enrichment_data ? (
                      <div className="space-y-4">
                        {company.enrichment_data.organization && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-600">Industry</label>
                              <p className="text-sm">{company.enrichment_data.organization.industry}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Employees</label>
                              <p className="text-sm">{company.enrichment_data.organization.employees}</p>
                            </div>
                            {company.enrichment_data.organization.founded_year && (
                              <div>
                                <label className="text-sm font-medium text-gray-600">Founded</label>
                                <p className="text-sm">{company.enrichment_data.organization.founded_year}</p>
                              </div>
                            )}
                            {company.enrichment_data.organization.revenue && (
                              <div>
                                <label className="text-sm font-medium text-gray-600">Revenue</label>
                                <p className="text-sm">{company.enrichment_data.organization.revenue}</p>
                              </div>
                            )}
                            {company.enrichment_data.organization.headquarters && (
                              <div>
                                <label className="text-sm font-medium text-gray-600">Headquarters</label>
                                <p className="text-sm">{company.enrichment_data.organization.headquarters}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {company.enrichment_data.enriched_at && (
                          <div className="pt-4 border-t">
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Sparkles className="w-4 h-4" />
                              <span>Enriched: {formatDate(company.enrichment_data.enriched_at)}</span>
                              {company.enrichment_data.enrichment_source && (
                                <Badge variant="outline">
                                  {company.enrichment_data.enrichment_source}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No enrichment data available</p>
                        <p className="text-sm">Use the "Enrich" button to fetch additional company data</p>
                      </div>
                    )}

                    {company.enrichment_error_message && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-red-800">Enrichment Error</p>
                            <p className="text-sm text-red-700">{company.enrichment_error_message}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}