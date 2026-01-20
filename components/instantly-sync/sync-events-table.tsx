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
import { CheckCircle2, XCircle, SkipForward, ExternalLink, Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { SyncEvent } from "@/app/api/instantly/sync-events/route"
import { getEventTypeConfig } from "@/hooks/use-instantly-sync"

interface SyncEventsTableProps {
  events: SyncEvent[]
  loading: boolean
  onViewDetails: (event: SyncEvent) => void
}

export function SyncEventsTable({ events, loading, onViewDetails }: SyncEventsTableProps) {
  if (loading && events.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Tijd</TableHead>
              <TableHead className="w-[160px]">Event</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Pipedrive</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
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
            <TableHead className="w-[160px]">Event</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Pipedrive</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const config = getEventTypeConfig(event.event_type)
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
                <TableCell>
                  <Badge variant="secondary" className={`${config.color} font-normal`}>
                    <span className="mr-1">{config.icon}</span>
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <span className="text-sm">{event.instantly_lead_email}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                    {event.instantly_campaign_name || event.instantly_campaign_id}
                  </span>
                </TableCell>
                <TableCell>
                  {event.pipedrive_org_name ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium truncate max-w-[180px] block">
                        {event.pipedrive_org_name}
                      </span>
                      {event.status_prospect_set && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {event.status_prospect_set}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <SyncStatusBadge event={event} />
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

function SyncStatusBadge({ event }: { event: SyncEvent }) {
  if (event.status_skipped) {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
        <SkipForward className="h-3 w-3 mr-1" />
        Skipped
      </Badge>
    )
  }

  if (!event.sync_success) {
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
