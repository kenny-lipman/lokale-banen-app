"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, Eye, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { MailerLiteSyncEvent } from "@/app/api/mailerlite/sync-events/route"

interface MailerLiteEventsTableProps {
  events: MailerLiteSyncEvent[]
  loading: boolean
  onViewDetails: (event: MailerLiteSyncEvent) => void
}

export function MailerLiteEventsTable({ events, loading, onViewDetails }: MailerLiteEventsTableProps) {
  if (loading && events.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Tijd</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Groep</TableHead>
              <TableHead>Domein</TableHead>
              <TableHead>Pipedrive</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Geen sync events gevonden</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Tijd</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Groep</TableHead>
            <TableHead>Domein</TableHead>
            <TableHead>Pipedrive</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const timeAgo = formatDistanceToNow(new Date(event.created_at), {
              addSuffix: true,
              locale: nl,
            })

            return (
              <TableRow
                key={event.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewDetails(event)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {timeAgo}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="text-sm">{event.email}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                    {event.mailerlite_group_name || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
                    {event.hoofddomein || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {event.pipedrive_org_id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-sm text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(
                          `https://lokalebanen.pipedrive.com/organization/${event.pipedrive_org_id}`,
                          "_blank"
                        )
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Org #{event.pipedrive_org_id}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <SyncStatusBadge success={event.sync_success} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDetails(event)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function SyncStatusBadge({ success }: { success: boolean }) {
  if (!success) {
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Error
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="bg-green-100 text-green-700">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      OK
    </Badge>
  )
}
