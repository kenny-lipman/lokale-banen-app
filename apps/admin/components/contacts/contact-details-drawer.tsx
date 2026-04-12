"use client"

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  User,
  Mail,
  Phone,
  Linkedin,
  Building2,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Target,
  Zap,
  MessageSquare,
  ArrowRight,
  Shield,
  Star,
  Briefcase
} from "lucide-react"

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  name?: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  email_status: string | null
  qualification_status: string | null
  qualification_timestamp: string | null
  qualification_notes: string | null
  qualified_by_user: string | null
  is_key_contact: boolean | null
  is_blocked: boolean | null
  contact_priority: number | null
  confidence_score_ai: number | null
  source: string | null
  created_at: string | null
  found_at: string | null
  last_touch: string | null
  campaign_id: string | null
  campaign_name: string | null
  company_id: string | null
  companies_name?: string | null
  companies_status?: string | null
  companies_size?: string | null
  pipedrive_synced: boolean | null
  pipedrive_synced_at: string | null
  pipedrive_person_id: string | null
  instantly_synced: boolean | null
  instantly_synced_at: string | null
  instantly_status: string | null
  instantly_campaign_ids: string[] | null
}

interface SyncEvent {
  id: string
  event_type: string
  instantly_campaign_name: string | null
  pipedrive_org_name: string | null
  has_reply: boolean | null
  reply_sentiment: string | null
  sync_success: boolean | null
  synced_at: string | null
  created_at: string | null
}

interface JobPosting {
  id: string
  title: string
  location: string | null
  status: string | null
  created_at: string | null
  url: string | null
}

interface ContactDetailsDrawerProps {
  contact: Contact | null
  open: boolean
  onClose: () => void
}

export function ContactDetailsDrawer({
  contact,
  open,
  onClose
}: ContactDetailsDrawerProps) {
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([])
  const [loadingSyncEvents, setLoadingSyncEvents] = useState(false)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [loadingJobPostings, setLoadingJobPostings] = useState(false)
  const [instantlyCampaigns, setInstantlyCampaigns] = useState<string[]>([])

  useEffect(() => {
    if (open && contact?.email) {
      fetchSyncEvents()
    }
    if (open && contact?.company_id) {
      fetchJobPostings()
    }
  }, [open, contact?.email, contact?.company_id])

  const fetchSyncEvents = async () => {
    if (!contact?.email) return

    setLoadingSyncEvents(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/sync-events`)
      if (response.ok) {
        const result = await response.json()
        const events = result.data || []
        setSyncEvents(events)

        // Extract unique campaign names from sync events
        const campaignNames = [...new Set(
          events
            .filter((e: SyncEvent) => e.instantly_campaign_name)
            .map((e: SyncEvent) => e.instantly_campaign_name)
        )] as string[]
        setInstantlyCampaigns(campaignNames)
      }
    } catch (error) {
      console.error('Error fetching sync events:', error)
    } finally {
      setLoadingSyncEvents(false)
    }
  }

  const fetchJobPostings = async () => {
    if (!contact?.company_id) return

    setLoadingJobPostings(true)
    try {
      const response = await fetch(`/api/companies/${contact.company_id}/job-postings`)
      if (response.ok) {
        const result = await response.json()
        // API returns { data: { job_postings: [...] } }
        setJobPostings(result.data?.job_postings || [])
      }
    } catch (error) {
      console.error('Error fetching job postings:', error)
    } finally {
      setLoadingJobPostings(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getEmailStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'valid':
      case 'verified':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Valid</Badge>
      case 'invalid':
      case 'bounced':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Invalid</Badge>
      case 'risky':
      case 'catch_all':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Risky</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Unknown</Badge>
    }
  }

  const getQualificationBadge = (status: string | null) => {
    switch (status) {
      case 'qualified':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Qualified</Badge>
      case 'disqualified':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Disqualified</Badge>
      case 'review':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Review</Badge>
      case 'in_campaign':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Campaign</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Pending</Badge>
    }
  }

  const getEventTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'campaign_completed':
        return <Badge className="bg-blue-100 text-blue-800">Campaign Completed</Badge>
      case 'reply_received':
        return <Badge className="bg-green-100 text-green-800">Reply Received</Badge>
      case 'lead_interested':
        return <Badge className="bg-emerald-100 text-emerald-800">Interested</Badge>
      case 'lead_not_interested':
        return <Badge className="bg-orange-100 text-orange-800">Not Interested</Badge>
      case 'lead_added':
        return <Badge className="bg-purple-100 text-purple-800">Lead Added</Badge>
      case 'backfill':
        return <Badge className="bg-gray-100 text-gray-800">Backfill</Badge>
      default:
        return <Badge variant="outline">{eventType}</Badge>
    }
  }

  if (!open || !contact) return null

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.name || 'Unnamed Contact'

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-xl">{fullName}</SheetTitle>
                  {contact.is_key_contact && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  )}
                  {contact.is_blocked && (
                    <Shield className="w-4 h-4 text-red-500" />
                  )}
                </div>
                {contact.title && (
                  <SheetDescription className="text-sm">{contact.title}</SheetDescription>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {getQualificationBadge(contact.qualification_status)}
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Contact Informatie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.email && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm">
                      {contact.email}
                    </a>
                  </div>
                  {getEmailStatusBadge(contact.email_status)}
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${contact.phone}`} className="text-green-600 hover:underline text-sm">
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact.linkedin_url && (
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-gray-400" />
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                  >
                    LinkedIn Profile
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company */}
          {contact.company_id && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Bedrijf</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/companies?id=${contact.company_id}`}
                  onClick={onClose}
                  className="flex items-center justify-between group hover:bg-gray-50 -m-2 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">{contact.companies_name || 'Unknown Company'}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {contact.companies_status && <span>{contact.companies_status}</span>}
                        {contact.companies_size && (
                          <>
                            <span>•</span>
                            <span>{contact.companies_size}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Instantly Campaigns */}
          {(contact.campaign_name || instantlyCampaigns.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Instantly Campagnes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Show current campaign */}
                {contact.campaign_name && (
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{contact.campaign_name}</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Actief</Badge>
                  </div>
                )}
                {/* Show campaigns from sync events */}
                {instantlyCampaigns
                  .filter(name => name !== contact.campaign_name)
                  .map((campaignName, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{campaignName}</span>
                    </div>
                  ))
                }
                {contact.last_touch && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>Last touch: {formatDate(contact.last_touch)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job Postings */}
          {contact.company_id && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Vacatures ({jobPostings.length})
                  </CardTitle>
                  {loadingJobPostings && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
                </div>
              </CardHeader>
              <CardContent>
                {jobPostings.length > 0 ? (
                  <div className="space-y-2">
                    {jobPostings.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{job.title}</p>
                            {job.location && (
                              <p className="text-xs text-gray-500">{job.location}</p>
                            )}
                          </div>
                        </div>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 ml-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                    {jobPostings.length > 5 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        + {jobPostings.length - 5} meer vacatures
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Geen vacatures gevonden</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Qualification */}
          {(contact.qualification_notes || contact.qualification_timestamp) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Kwalificatie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.qualification_timestamp && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Gekwalificeerd op: {formatDateTime(contact.qualification_timestamp)}</span>
                  </div>
                )}
                {contact.qualification_notes && (
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {contact.qualification_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Sync Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Pipedrive */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contact.pipedrive_synced ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">Pipedrive</span>
                </div>
                {contact.pipedrive_synced ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800 border-green-200">Synced</Badge>
                    {contact.pipedrive_synced_at && (
                      <span className="text-xs text-gray-500">{formatDate(contact.pipedrive_synced_at)}</span>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">Not Synced</Badge>
                )}
              </div>

              {/* Instantly */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contact.instantly_synced ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">Instantly</span>
                </div>
                {contact.instantly_synced ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      {contact.instantly_status || 'Synced'}
                    </Badge>
                    {contact.instantly_synced_at && (
                      <span className="text-xs text-gray-500">{formatDate(contact.instantly_synced_at)}</span>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">Not Synced</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sync Events / Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Activiteit & Sync Events</CardTitle>
                {loadingSyncEvents && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
            </CardHeader>
            <CardContent>
              {syncEvents.length > 0 ? (
                <div className="space-y-3">
                  {syncEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                      <div className="mt-0.5">
                        {event.sync_success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getEventTypeBadge(event.event_type)}
                          {event.has_reply && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {event.reply_sentiment || 'Reply'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {event.instantly_campaign_name && (
                            <span>Campaign: {event.instantly_campaign_name}</span>
                          )}
                          {event.pipedrive_org_name && (
                            <span> • Org: {event.pipedrive_org_name}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDateTime(event.synced_at || event.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Geen sync events gevonden</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {contact.source && (
                  <div>
                    <span className="text-gray-500">Bron:</span>
                    <span className="ml-2 font-medium">{contact.source}</span>
                  </div>
                )}
                {contact.created_at && (
                  <div>
                    <span className="text-gray-500">Aangemaakt:</span>
                    <span className="ml-2">{formatDate(contact.created_at)}</span>
                  </div>
                )}
                {contact.found_at && (
                  <div>
                    <span className="text-gray-500">Gevonden:</span>
                    <span className="ml-2">{formatDate(contact.found_at)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
