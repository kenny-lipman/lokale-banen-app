"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Mail,
  Building2,
  User,
  Calendar,
  Clock,
  MessageSquare,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Reply,
  Bot,
} from "lucide-react"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { SyncEvent } from "@/app/api/instantly/sync-events/route"
import { getEventTypeConfig } from "@/hooks/use-instantly-sync"
import { Button } from "@/components/ui/button"
import { LeadEmailResponse } from "@/app/api/instantly/lead-emails/route"
import { cn } from "@/lib/utils"

interface SyncEventDrawerProps {
  event: SyncEvent | null
  open: boolean
  onClose: () => void
}

interface EmailItem {
  id: string
  type: 'sent' | 'received'
  date: string
  subject: string
  body: string
  preview: string
  isAutoReply: boolean
  step?: number
}

export function SyncEventDrawer({ event, open, onClose }: SyncEventDrawerProps) {
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState<string | null>(null)
  const [emailsLoaded, setEmailsLoaded] = useState(false)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)

  // Reset state and auto-load conversation when drawer opens with a new event
  useEffect(() => {
    if (open && event?.instantly_lead_email) {
      // Reset state
      setEmails([])
      setEmailsError(null)
      setEmailsLoaded(false)
      setExpandedEmailId(null)

      // Auto-load conversation
      const loadEmails = async () => {
        setEmailsLoading(true)
        try {
          const params = new URLSearchParams({
            email: event.instantly_lead_email,
          })
          if (event.instantly_campaign_id) {
            params.set('campaign_id', event.instantly_campaign_id)
          }

          const response = await fetch(`/api/instantly/lead-emails?${params}`)
          const data: LeadEmailResponse = await response.json()

          if (!data.success || !data.data) {
            throw new Error(data.error || 'Failed to load emails')
          }

          setEmails(data.data.emails)
          setEmailsLoaded(true)
        } catch (error) {
          setEmailsError(error instanceof Error ? error.message : 'Failed to load conversation')
        } finally {
          setEmailsLoading(false)
        }
      }

      loadEmails()
    } else if (!open) {
      // Reset when drawer closes
      setEmails([])
      setEmailsLoading(false)
      setEmailsError(null)
      setEmailsLoaded(false)
      setExpandedEmailId(null)
    }
  }, [open, event?.id, event?.instantly_lead_email, event?.instantly_campaign_id])

  // Retry loading conversation (for error recovery)
  const retryLoadConversation = () => {
    if (!event?.instantly_lead_email) return

    setEmailsLoading(true)
    setEmailsError(null)

    const params = new URLSearchParams({
      email: event.instantly_lead_email,
    })
    if (event.instantly_campaign_id) {
      params.set('campaign_id', event.instantly_campaign_id)
    }

    fetch(`/api/instantly/lead-emails?${params}`)
      .then(response => response.json())
      .then((data: LeadEmailResponse) => {
        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to load emails')
        }
        setEmails(data.data.emails)
        setEmailsLoaded(true)
      })
      .catch(error => {
        setEmailsError(error instanceof Error ? error.message : 'Failed to load conversation')
      })
      .finally(() => {
        setEmailsLoading(false)
      })
  }

  if (!event) return null

  const config = getEventTypeConfig(event.event_type)
  const createdAt = new Date(event.created_at)
  const syncedAt = event.synced_at ? new Date(event.synced_at) : null
  const eventAt = event.instantly_event_at ? new Date(event.instantly_event_at) : null

  // Find the most recent reply (received email)
  const latestReply = emails.find(e => e.type === 'received')
  const receivedCount = emails.filter(e => e.type === 'received').length
  const sentCount = emails.filter(e => e.type === 'sent').length

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            {config.label}
          </SheetTitle>
          <SheetDescription>
            Event details en sync informatie
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Status */}
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <div className="flex items-center gap-2">
                {event.status_skipped ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                    <SkipForward className="h-3 w-3 mr-1" />
                    Overgeslagen
                  </Badge>
                ) : event.sync_success ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Succesvol
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Gefaald
                  </Badge>
                )}
                <Badge variant="outline">{event.sync_source}</Badge>
              </div>
              {event.skip_reason && (
                <p className="text-sm text-muted-foreground mt-2">
                  Reden: {event.skip_reason}
                </p>
              )}
              {event.sync_error && (
                <p className="text-sm text-red-600 mt-2">
                  Error: {event.sync_error}
                </p>
              )}
            </div>

            <Separator />

            {/* Lead Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Lead Informatie</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{event.instantly_lead_email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Campaign: {event.instantly_campaign_name || event.instantly_campaign_id}</span>
                </div>
                {event.has_reply && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Reply: {event.reply_sentiment || "Onbekend sentiment"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Pipedrive Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Pipedrive</h4>
              {(event.pipedrive_org_id || event.pipedrive_person_id) ? (
                <div className="space-y-3">
                  {/* Organization */}
                  {event.pipedrive_org_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{event.pipedrive_org_name || `Org #${event.pipedrive_org_id}`}</span>
                        {event.org_created && (
                          <Badge variant="secondary" className="text-xs">Nieuw</Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(
                            `https://lokalebanen.pipedrive.com/organization/${event.pipedrive_org_id}`,
                            "_blank"
                          )
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  )}

                  {/* Person */}
                  {event.pipedrive_person_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Person #{event.pipedrive_person_id}</span>
                        {event.person_created && (
                          <Badge variant="secondary" className="text-xs">Nieuw</Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(
                            `https://lokalebanen.pipedrive.com/person/${event.pipedrive_person_id}`,
                            "_blank"
                          )
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  )}

                  {/* Status */}
                  {event.status_prospect_set && (
                    <div className="flex items-center gap-2 text-sm pt-1">
                      <Badge variant="outline" className="font-normal">
                        Status: {event.status_prospect_set}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen Pipedrive data gekoppeld
                </p>
              )}
            </div>

            <Separator />

            {/* Timestamps */}
            <div>
              <h4 className="text-sm font-medium mb-3">Tijdlijn</h4>
              <div className="space-y-2 text-sm">
                {eventAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Event:</span>
                    <span>{format(eventAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Ontvangen:</span>
                  <span>{format(createdAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
                </div>
                {syncedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Gesynced:</span>
                    <span>{format(syncedAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Conversation / Email History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Email Conversatie</h4>
                {emailsLoading && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Laden...
                  </div>
                )}
              </div>

              {emailsError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md mb-2 flex items-center justify-between">
                  <span>{emailsError}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={retryLoadConversation}
                    className="ml-2 h-6 px-2"
                  >
                    Opnieuw
                  </Button>
                </div>
              )}

              {emailsLoaded && emails.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Geen emails gevonden voor deze lead.
                </p>
              )}

              {emailsLoaded && emails.length > 0 && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      <Send className="h-3 w-3 mr-1" />
                      {sentCount} verzonden
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      <Reply className="h-3 w-3 mr-1" />
                      {receivedCount} ontvangen
                    </Badge>
                  </div>

                  {/* Email list */}
                  <div className="space-y-2">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        className={cn(
                          "border rounded-md overflow-hidden",
                          email.type === 'received'
                            ? "border-blue-200 bg-blue-50/50"
                            : "border-gray-200 bg-gray-50/50"
                        )}
                      >
                        {/* Email header - clickable */}
                        <button
                          className="w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedEmailId(
                            expandedEmailId === email.id ? null : email.id
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {email.type === 'received' ? (
                                <Reply className="h-3 w-3 text-blue-600 flex-shrink-0" />
                              ) : (
                                <Send className="h-3 w-3 text-gray-600 flex-shrink-0" />
                              )}
                              <span className={cn(
                                "text-xs font-medium",
                                email.type === 'received' ? "text-blue-700" : "text-gray-700"
                              )}>
                                {email.type === 'received' ? 'Reply van lead' : `Email verzonden${email.step ? ` (stap ${email.step})` : ''}`}
                              </span>
                              {email.isAutoReply && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  <Bot className="h-3 w-3 mr-1" />
                                  Auto-reply
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {format(new Date(email.date), "d MMM yyyy HH:mm", { locale: nl })}
                            </div>
                            <div className="text-sm font-medium truncate">
                              {email.subject}
                            </div>
                            {expandedEmailId !== email.id && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {email.preview}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 pt-1">
                            {expandedEmailId === email.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Expanded email body */}
                        {expandedEmailId === email.id && (
                          <div className="px-3 pb-3 border-t">
                            <div className="mt-2 text-sm whitespace-pre-wrap bg-white p-3 rounded border max-h-[300px] overflow-y-auto">
                              {email.body || '(geen inhoud)'}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Technical Details */}
            <div>
              <h4 className="text-sm font-medium mb-3">Technische Details</h4>
              <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-md">
                <div>ID: {event.id}</div>
                <div>Event Type: {event.event_type}</div>
                <div>Campaign ID: {event.instantly_campaign_id}</div>
                {event.pipedrive_org_id && (
                  <div>Pipedrive Org ID: {event.pipedrive_org_id}</div>
                )}
                {event.pipedrive_person_id && (
                  <div>Pipedrive Person ID: {event.pipedrive_person_id}</div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
