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
  Mail,
  Building2,
  User,
  Clock,
  ExternalLink,
  Globe,
  Users,
} from "lucide-react"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { MailerLiteSyncEvent } from "@/app/api/mailerlite/sync-events/route"
import { Button } from "@/components/ui/button"

interface MailerLiteEventDrawerProps {
  event: MailerLiteSyncEvent | null
  open: boolean
  onClose: () => void
}

export function MailerLiteEventDrawer({ event, open, onClose }: MailerLiteEventDrawerProps) {
  if (!event) return null

  const createdAt = new Date(event.created_at)
  const syncedAt = event.synced_at ? new Date(event.synced_at) : null
  const updatedAt = event.updated_at ? new Date(event.updated_at) : null

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            MailerLite Sync Detail
          </SheetTitle>
          <SheetDescription>
            Sync informatie voor {event.email}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Status */}
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <div className="flex items-center gap-2">
                {event.sync_success ? (
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
              {event.sync_error && (
                <p className="text-sm text-red-600 mt-2">
                  Error: {event.sync_error}
                </p>
              )}
            </div>

            <Separator />

            {/* Subscriber Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Subscriber</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{event.email}</span>
                </div>
                {event.mailerlite_subscriber_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Subscriber ID: {event.mailerlite_subscriber_id}</span>
                  </div>
                )}
                {event.hoofddomein && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{event.hoofddomein}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Group Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">MailerLite Groep</h4>
              {event.mailerlite_group_name || event.mailerlite_group_id ? (
                <div className="space-y-2">
                  {event.mailerlite_group_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{event.mailerlite_group_name}</span>
                    </div>
                  )}
                  {event.mailerlite_group_id && (
                    <div className="text-xs text-muted-foreground font-mono">
                      Group ID: {event.mailerlite_group_id}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen groep informatie
                </p>
              )}
            </div>

            <Separator />

            {/* Pipedrive Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Pipedrive</h4>
              {(event.pipedrive_org_id || event.pipedrive_person_id) ? (
                <div className="space-y-3">
                  {event.pipedrive_org_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Org #{event.pipedrive_org_id}</span>
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

                  {event.pipedrive_person_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Person #{event.pipedrive_person_id}</span>
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
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Aangemaakt:</span>
                  <span>{format(createdAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
                </div>
                {syncedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Gesynced:</span>
                    <span>{format(syncedAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
                  </div>
                )}
                {updatedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Bijgewerkt:</span>
                    <span>{format(updatedAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
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
                <div>Sync Source: {event.sync_source}</div>
                {event.mailerlite_subscriber_id && (
                  <div>Subscriber ID: {event.mailerlite_subscriber_id}</div>
                )}
                {event.mailerlite_group_id && (
                  <div>Group ID: {event.mailerlite_group_id}</div>
                )}
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
