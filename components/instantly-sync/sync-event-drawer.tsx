"use client"

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
} from "lucide-react"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { SyncEvent } from "@/app/api/instantly/sync-events/route"
import { getEventTypeConfig } from "@/hooks/use-instantly-sync"
import { Button } from "@/components/ui/button"

interface SyncEventDrawerProps {
  event: SyncEvent | null
  open: boolean
  onClose: () => void
}

export function SyncEventDrawer({ event, open, onClose }: SyncEventDrawerProps) {
  if (!event) return null

  const config = getEventTypeConfig(event.event_type)
  const createdAt = new Date(event.created_at)
  const syncedAt = event.synced_at ? new Date(event.synced_at) : null
  const eventAt = event.instantly_event_at ? new Date(event.instantly_event_at) : null

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
