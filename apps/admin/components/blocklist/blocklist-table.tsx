"use client"

import { useState, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Mail,
  Globe,
  Edit,
  Trash,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface BlocklistEntry {
  id: string
  type: "email" | "domain"
  value: string
  reason: string
  is_active: boolean
  created_at: string
  updated_at: string
  instantly_synced?: boolean
  instantly_synced_at?: string | null
  instantly_id?: string | null
  pipedrive_synced?: boolean
  pipedrive_synced_at?: string | null
  created_by_user?: {
    email: string
  }
}

interface BlocklistTableProps {
  entries: BlocklistEntry[]
  loading?: boolean
  onEdit?: (entry: BlocklistEntry) => void
  onDelete?: (entry: BlocklistEntry) => void
  onToggleActive?: (entry: BlocklistEntry) => void
  selectedEntries: string[]
  onSelectionChange: (ids: string[]) => void
}

type SortField = keyof BlocklistEntry
type SortDirection = "asc" | "desc"

export function BlocklistTable({
  entries,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  selectedEntries,
  onSelectionChange,
}: BlocklistTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Sort data
  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aValue = a[sortField] ?? ""
      const bValue = b[sortField] ?? ""

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [entries, sortField, sortDirection])

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(sortedEntries.map((entry) => entry.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedEntries, entryId])
    } else {
      onSelectionChange(selectedEntries.filter((id) => id !== entryId))
    }
  }

  const isAllSelected = sortedEntries.length > 0 && selectedEntries.length === sortedEntries.length
  const isSomeSelected = selectedEntries.length > 0 && selectedEntries.length < sortedEntries.length

  // Get sync status icon
  const getSyncIcon = (synced?: boolean) => {
    if (synced === undefined) return <Clock className="h-4 w-4 text-gray-400" />
    if (synced) return <CheckCircle2 className="h-4 w-4 text-green-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-2 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4" />
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className="translate-y-[2px]"
                {...(isSomeSelected && { "data-indeterminate": true })}
              />
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("type")}
                className="h-8 p-0 font-medium hover:bg-transparent"
              >
                Type
                {getSortIcon("type")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("value")}
                className="h-8 p-0 font-medium hover:bg-transparent"
              >
                Waarde
                {getSortIcon("value")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("reason")}
                className="h-8 p-0 font-medium hover:bg-transparent"
              >
                Reden
                {getSortIcon("reason")}
              </Button>
            </TableHead>
            <TableHead>
              <div className="flex items-center space-x-1">
                <span>Status</span>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      <strong>Actief:</strong> Entry blokkeert emails/domeinen.<br/>
                      <strong>Inactief:</strong> Entry is uitgeschakeld maar blijft bestaan.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableHead>
            <TableHead>Sync Status</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("created_at")}
                className="h-8 p-0 font-medium hover:bg-transparent"
              >
                Toegevoegd
                {getSortIcon("created_at")}
              </Button>
            </TableHead>
            <TableHead className="text-right">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center">
                Geen blocklist entries gevonden.
              </TableCell>
            </TableRow>
          ) : (
            sortedEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedEntries.includes(entry.id)}
                    onCheckedChange={(checked) =>
                      handleSelectEntry(entry.id, checked as boolean)
                    }
                    aria-label={`Select ${entry.value}`}
                    className="translate-y-[2px]"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {entry.type === "email" ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant={entry.type === "email" ? "default" : "secondary"}>
                      {entry.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{entry.value}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={entry.reason}>
                  {entry.reason}
                </TableCell>
                <TableCell>
                  <Badge variant={entry.is_active ? "default" : "secondary"} className={entry.is_active ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                    {entry.is_active ? "Actief" : "Inactief"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {getSyncIcon(entry.instantly_synced)}
                      <span className="text-xs">Instantly</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getSyncIcon(entry.pipedrive_synced)}
                      <span className="text-xs">Pipedrive</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at), {
                      addSuffix: true,
                      locale: nl,
                    })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(entry)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Bewerken
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleActive?.(entry)}>
                        {entry.is_active ? (
                          <>
                            <PowerOff className="mr-2 h-4 w-4" />
                            Deactiveren
                          </>
                        ) : (
                          <>
                            <Power className="mr-2 h-4 w-4" />
                            Activeren
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete?.(entry)}
                        className="text-red-600"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </TooltipProvider>
  )
}