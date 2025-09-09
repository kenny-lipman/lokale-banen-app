"use client"

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, ExternalLink, MapPin, Briefcase, Star, Users, Globe, CheckCircle, Clock, AlertCircle, Archive, Crown, RefreshCw, Mail, Link } from "lucide-react"

interface JobPosting {
  id: string
  title: string
  location: string
  status: string
  review_status: string
  created_at: string
  job_type?: string | string[]
  salary?: string
  url?: string
  description?: string
}

interface Company {
  id: string
  name: string
  website?: string | null
  indeed_url?: string | null
  logo_url?: string | null
  location?: string | null
  description?: string | null
  rating_indeed?: number | null
  review_count_indeed?: number | null
  size_min?: number | null
  size_max?: number | null
  is_customer?: boolean | null
  source?: string | null
  source_name?: string | null
  job_count?: number
  job_counts?: number
  region_plaats?: string | null
  region_platform?: string | null
  region_id?: string | null
  qualification_status?: string | null
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
  qualification_status?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  created_at: string
}

interface CompanyDrawerProps {
  company: Company | null
  open: boolean
  onClose: () => void
}

export function CompanyDrawer({ company, open, onClose }: CompanyDrawerProps) {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch job postings and contacts when company changes
  useEffect(() => {
    if (open && company?.id) {
      fetchJobPostings()
      fetchContacts()
    }
  }, [open, company?.id])

  const fetchJobPostings = async () => {
    if (!company?.id) return

    setLoadingJobs(true)
    setJobsError(null)

    try {
      const response = await fetch(`/api/companies/${company.id}/job-postings`)
      if (!response.ok) {
        throw new Error(`Failed to fetch job postings: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load job postings')
      }

      setJobPostings(result.data.job_postings || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setJobsError(errorMessage)
      console.error('Error fetching job postings:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const fetchContacts = async () => {
    if (!company?.id) return

    setLoadingContacts(true)
    setContactsError(null)

    try {
      const response = await fetch(`/api/companies/${company.id}/contacts`)
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([
      fetchJobPostings(),
      fetchContacts()
    ])
    setIsRefreshing(false)
  }

  if (!company) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Nieuw
          </Badge>
        )
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actief
          </Badge>
        )
      case "inactive":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="w-3 h-3 mr-1" />
            Inactief
          </Badge>
        )
      case "archived":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Archive className="w-3 h-3 mr-1" />
            Gearchiveerd
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const getCompanySize = () => {
    if (company.size_min && company.size_max) {
      return `${company.size_min} - ${company.size_max} medewerkers`
    } else if (company.size_min) {
      return `${company.size_min}+ medewerkers`
    }
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center overflow-hidden">
                {company.logo_url ? (
                  <img
                    src={company.logo_url || "/placeholder.svg"}
                    alt={company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-orange-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <SheetTitle className="text-xl">{company.name}</SheetTitle>
                  {company.is_customer && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <Crown className="w-3 h-3 mr-1" />
                      Klant
                    </Badge>
                  )}
                </div>
                <SheetDescription>Bedrijfsdetails en vacatures</SheetDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="ml-1.5">Vernieuwen</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Company Info */}
          <div className="grid grid-cols-1 gap-4">
            {company.website && (
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="w-4 h-4 text-gray-500" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-800 hover:underline"
                >
                  {company.website}
                </a>
              </div>
            )}

            {company.indeed_url && (
              <div className="flex items-center space-x-2 text-sm">
                <ExternalLink className="w-4 h-4 text-gray-500" />
                <a
                  href={company.indeed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-800 hover:underline"
                >
                  Indeed profiel
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
              <span className="text-gray-700">{company.job_count || company.job_counts || 0} actieve vacatures</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-gray-700">
                {company.rating_indeed 
                  ? `${company.rating_indeed} sterren${company.review_count_indeed ? ` (${company.review_count_indeed} reviews)` : ''}`
                  : 'Geen rating bekend'}
              </span>
            </div>

            {getCompanySize() && (
              <div className="flex items-center space-x-2 text-sm">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{getCompanySize()}</span>
              </div>
            )}

            {company.region_platform && (
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Regio: {company.region_platform}</span>
                {company.region_plaats && <span className="text-gray-500">• {company.region_plaats}</span>}
              </div>
            )}

            {company.source && (
              <div className="text-xs text-gray-500">Bron: {company.source_name || company.source}</div>
            )}
          </div>

          {/* Description */}
          {company.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Beschrijving</h3>
              <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{company.description}</p>
              </div>
            </div>
          )}

          {/* Job Postings */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Vacatures ({jobPostings.length})</h3>
              {loadingJobs && (
                <div className="flex items-center text-sm text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  Laden...
                </div>
              )}
            </div>
            
            {jobsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-red-700 text-sm">{jobsError}</span>
                </div>
              </div>
            )}
            
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vacaturetitel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobPostings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {loadingJobs ? (
                          <div className="flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            Vacatures laden...
                          </div>
                        ) : (
                          <div>
                            <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p>Geen vacatures gevonden</p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobPostings.map((job) => (
                      <TableRow key={job.id} className="hover:bg-orange-50">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{job.title}</div>
                            {job.salary && <div className="text-xs text-gray-500">{job.salary}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.job_type && (
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(job.job_type) ? (
                                job.job_type.map((type, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {job.job_type}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{job.location}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(job.created_at)}</TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Contacts Section */}
          {
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span>Contacten ({contacts.length})</span>
                </h3>
                {loadingContacts && (
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Email Status</TableHead>
                      <TableHead>Qualification</TableHead>
                      <TableHead className="text-center">LinkedIn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingContacts ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                          <p className="text-gray-500">Loading contacts...</p>
                        </TableCell>
                      </TableRow>
                    ) : contactsError ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-red-500">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p>Error: {contactsError}</p>
                        </TableCell>
                      </TableRow>
                    ) : contacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No contacts found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contacts.map((contact) => (
                        <TableRow key={contact.id} className="hover:bg-purple-50">
                          <TableCell className="font-medium">
                            {contact.name || contact.first_name || '-'}
                          </TableCell>
                          <TableCell>
                            {contact.email ? (
                              <span className="text-sm text-gray-700">{contact.email}</span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.phone ? (
                              <span className="text-sm text-gray-700">{contact.phone}</span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {contact.title || '-'}
                          </TableCell>
                          <TableCell>
                            {contact.email_status ? (
                              <Badge 
                                variant="outline"
                                className={
                                  contact.email_status === 'verified' 
                                    ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                                    : contact.email_status === 'bounced'
                                    ? 'bg-red-50 text-red-700 border-red-200 text-xs'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 text-xs'
                                }
                              >
                                {contact.email_status}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.qualification_status ? (
                              <Badge 
                                variant="outline"
                                className={
                                  contact.qualification_status === 'qualified' 
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                                    : contact.qualification_status === 'disqualified'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 text-xs'
                                }
                              >
                                {contact.qualification_status}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {contact.linkedin_url ? (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex justify-center text-blue-600 hover:text-blue-800"
                                title="View LinkedIn Profile"
                              >
                                <Link className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-gray-300 inline-flex justify-center">
                                <Link className="w-4 h-4" />
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          }

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            {company.indeed_url && (
              <Button variant="outline" asChild>
                <a href={company.indeed_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Indeed
                </a>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
