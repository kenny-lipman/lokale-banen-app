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
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Mail,
  Building2,
  User,
  Clock,
  ExternalLink,
  Brain,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CampaignAssignmentLog, getStatusConfig } from "@/hooks/use-campaign-assignment"

interface CampaignAssignmentLogDrawerProps {
  log: CampaignAssignmentLog | null
  open: boolean
  onClose: () => void
}

export function CampaignAssignmentLogDrawer({
  log,
  open,
  onClose,
}: CampaignAssignmentLogDrawerProps) {
  if (!log) return null

  const config = getStatusConfig(log.status)
  const createdAt = new Date(log.created_at)

  const personalization = log.ai_personalization as {
    personalization?: string
    sector?: string
    normalized_company?: string
    similar_companies?: string
    category?: string
    region?: string
    normalized_title?: string
    company_description?: string
  } | null

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            {config.label}
          </SheetTitle>
          <SheetDescription>
            Campaign assignment details
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Status */}
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={`${config.color}`}>
                  {log.status === 'added' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {log.status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                  {log.status.startsWith('skipped') && <SkipForward className="h-3 w-3 mr-1" />}
                  {config.label}
                </Badge>
              </div>
              {log.skip_reason && (
                <p className="text-sm text-muted-foreground mt-2">
                  Reden: {log.skip_reason}
                </p>
              )}
              {log.error_message && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md mt-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{log.error_message}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Contact Info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Contact</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{log.contact_email}</span>
                </div>
                {log.company_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{log.company_name}</span>
                  </div>
                )}
                {log.platform_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">{log.platform_name}</Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Pipedrive Info */}
            {log.pipedrive_org_id && (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-3">Pipedrive</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Org #{log.pipedrive_org_id}</span>
                      {log.pipedrive_is_klant && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          Klant
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(
                          `https://lokalebanen.pipedrive.com/organization/${log.pipedrive_org_id}`,
                          "_blank"
                        )
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Instantly Info */}
            {log.instantly_lead_id && (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-3">Instantly</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Lead ID:</span>
                      <span className="font-mono text-xs">{log.instantly_lead_id}</span>
                    </div>
                    {log.instantly_campaign_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Campaign:</span>
                        <span className="font-mono text-xs">{log.instantly_campaign_id}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* AI Personalization */}
            {personalization && (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Personalisatie
                    {log.ai_processing_time_ms && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({log.ai_processing_time_ms}ms)
                      </span>
                    )}
                  </h4>
                  <div className="space-y-3">
                    {personalization.personalization && (
                      <div>
                        <label className="text-xs text-muted-foreground">Opening</label>
                        <p className="text-sm bg-muted p-2 rounded-md mt-1">
                          {personalization.personalization}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {personalization.sector && (
                        <div>
                          <label className="text-xs text-muted-foreground">Sector</label>
                          <p className="text-sm font-medium">{personalization.sector}</p>
                        </div>
                      )}
                      {personalization.category && (
                        <div>
                          <label className="text-xs text-muted-foreground">Categorie</label>
                          <p className="text-sm font-medium">{personalization.category}</p>
                        </div>
                      )}
                      {personalization.region && (
                        <div>
                          <label className="text-xs text-muted-foreground">Regio</label>
                          <p className="text-sm font-medium">{personalization.region}</p>
                        </div>
                      )}
                      {personalization.normalized_title && (
                        <div>
                          <label className="text-xs text-muted-foreground">Titel</label>
                          <p className="text-sm font-medium">{personalization.normalized_title}</p>
                        </div>
                      )}
                    </div>
                    {personalization.normalized_company && (
                      <div>
                        <label className="text-xs text-muted-foreground">Bedrijfsnaam (normalized)</label>
                        <p className="text-sm font-medium">{personalization.normalized_company}</p>
                      </div>
                    )}
                    {personalization.similar_companies && (
                      <div>
                        <label className="text-xs text-muted-foreground">Vergelijkbare bedrijven</label>
                        <p className="text-sm">{personalization.similar_companies}</p>
                      </div>
                    )}
                    {personalization.company_description && (
                      <div>
                        <label className="text-xs text-muted-foreground">Beschrijving</label>
                        <p className="text-sm text-muted-foreground">{personalization.company_description}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Timestamp */}
            <div>
              <h4 className="text-sm font-medium mb-3">Tijdlijn</h4>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Verwerkt:</span>
                <span>{format(createdAt, "d MMM yyyy HH:mm:ss", { locale: nl })}</span>
              </div>
            </div>

            <Separator />

            {/* Technical Details */}
            <div>
              <h4 className="text-sm font-medium mb-3">Technische Details</h4>
              <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-md">
                <div>Log ID: {log.id}</div>
                <div>Batch ID: {log.batch_id}</div>
                <div>Contact ID: {log.contact_id}</div>
                {log.company_id && <div>Company ID: {log.company_id}</div>}
                {log.platform_id && <div>Platform ID: {log.platform_id}</div>}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
