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
import { Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { CampaignAssignmentLog, getStatusConfig } from "@/hooks/use-campaign-assignment"

interface CampaignAssignmentLogsTableProps {
  logs: CampaignAssignmentLog[]
  loading: boolean
  onViewDetails: (log: CampaignAssignmentLog) => void
}

export function CampaignAssignmentLogsTable({
  logs,
  loading,
  onViewDetails,
}: CampaignAssignmentLogsTableProps) {
  if (loading && logs.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Tijd</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Geen assignment logs gevonden</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Tijd</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Bedrijf</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const config = getStatusConfig(log.status)
            const timeAgo = formatDistanceToNow(new Date(log.created_at), {
              addSuffix: true,
              locale: nl,
            })

            return (
              <TableRow
                key={log.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewDetails(log)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {timeAgo}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="text-sm">{log.contact_email}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                    {log.company_name || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {log.platform_name ? (
                    <Badge variant="outline" className="font-normal">
                      {log.platform_name}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`${config.color} font-normal`}>
                    <span className="mr-1">{config.icon}</span>
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDetails(log)
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
