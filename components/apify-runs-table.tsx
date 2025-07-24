"use client"

import { useState, useMemo, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, ChevronUp, ChevronDown, Search, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { TablePagination } from "@/components/ui/table-filters"

export interface ApifyRun {
  id: string
  status: string | null
  platform: string | null
  functie: string | null
  locatie: string | null
  job_count: number | null
  error: string | null
  created_at: string | null
  finished_at: string | null
}

type SortField = keyof ApifyRun
type SortDirection = 'asc' | 'desc'

interface ApifyRunsTableProps {
  data: ApifyRun[]
  onRowClick?: (id: string) => void
  selectedId?: string | null
  className?: string
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatusBadge(status: string | null) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-gray-600">
        <AlertCircle className="w-3 h-3 mr-1" />
        Onbekend
      </Badge>
    )
  }
  
  const normalized = status.toLowerCase()
  if (["success", "completed", "succeeded"].includes(normalized)) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Succesvol
      </Badge>
    )
  }
  if (["running", "in_progress", "active", "processing", "ready"].includes(normalized)) {
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        <Clock className="w-3 h-3 mr-1" />
        Bezig
      </Badge>
    )
  }
  if (["error", "failed", "fail", "aborted", "cancelled"].includes(normalized)) {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <XCircle className="w-3 h-3 mr-1" />
        Mislukt
      </Badge>
    )
  }
  
  return <Badge variant="outline">{status}</Badge>
}

export function ApifyRunsTable({ 
  data, 
  onRowClick, 
  selectedId,
  className = ""
}: ApifyRunsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(run => {
      if (!searchTerm) return true
      
      const searchLower = searchTerm.toLowerCase()
      return (
        run.platform?.toLowerCase().includes(searchLower) ||
        run.functie?.toLowerCase().includes(searchLower) ||
        run.locatie?.toLowerCase().includes(searchLower) ||
        run.status?.toLowerCase().includes(searchLower)
      )
    })

    // Sort data
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      // Handle null values
      if (aValue === null && bValue === null) return 0
      if (aValue === null) return sortDirection === 'asc' ? 1 : -1
      if (bValue === null) return sortDirection === 'asc' ? -1 : 1
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [data, searchTerm, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, sortField, sortDirection])

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  // Render sortable column header
  const SortableHeader = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField !== field && <ArrowUpDown className="w-4 h-4 text-gray-400" />}
        {sortField === field && sortDirection === 'asc' && <ChevronUp className="w-4 h-4 text-gray-600" />}
        {sortField === field && sortDirection === 'desc' && <ChevronDown className="w-4 h-4 text-gray-600" />}
      </div>
    </TableHead>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Stats */}
      <Card className="p-4 bg-gradient-to-r from-gray-50 to-gray-100/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Zoek op platform, functie, locatie of status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <Badge variant="outline" className="bg-white">
              {filteredAndSortedData.length} van {data.length} runs
            </Badge>
            {filteredAndSortedData.length > itemsPerPage && (
              <Badge variant="outline" className="bg-white">
                Pagina {currentPage} van {totalPages}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="created_at">Starttijd</SortableHeader>
              <SortableHeader field="finished_at">Eindtijd</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="platform">Platform</SortableHeader>
              <SortableHeader field="functie">Functie</SortableHeader>
              <SortableHeader field="locatie">Locatie</SortableHeader>
              <SortableHeader field="job_count">Vacatures</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="space-y-2">
                    <Clock className="w-12 h-12 mx-auto text-gray-300" />
                    <h3 className="font-medium text-gray-900">Geen runs gevonden</h3>
                    <p className="text-gray-500">
                      {searchTerm 
                        ? "Pas je zoekopdracht aan om meer resultaten te zien"
                        : "Er zijn nog geen Otis runs beschikbaar"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((run) => (
                <TableRow
                  key={run.id}
                  className={
                    "cursor-pointer transition-colors " +
                    (selectedId === run.id 
                      ? "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500" 
                      : "hover:bg-orange-50")
                  }
                  onClick={() => onRowClick && onRowClick(run.id)}
                >
                  <TableCell>
                    <div className="font-mono text-sm">
                      {formatDate(run.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {formatDate(run.finished_at)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>
                    {run.platform ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {run.platform}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={run.functie || ''}>
                      {run.functie || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={run.locatie || ''}>
                      {run.locatie || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.job_count !== null ? (
                      <Badge 
                        variant="outline" 
                        className={
                          run.job_count > 0 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-gray-50 text-gray-600"
                        }
                      >
                        {run.job_count} vacatures
                      </Badge>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredAndSortedData.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredAndSortedData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(items) => {
            setItemsPerPage(items)
            setCurrentPage(1)
          }}
        />
      )}

      {/* Run Details for Selected */}
      {selectedId && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-2">
            <Clock className="w-4 h-4" />
            Geselecteerde run details
          </div>
          {(() => {
            const selectedRun = data.find(run => run.id === selectedId)
            if (!selectedRun) return null
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Run ID:</span>
                  <div className="font-mono">{selectedRun.id}</div>
                </div>
                {selectedRun.error && (
                  <div className="md:col-span-3">
                    <span className="text-red-600 font-medium">Error:</span>
                    <div className="text-red-700 bg-red-50 p-2 rounded mt-1 font-mono text-xs">
                      {selectedRun.error}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </Card>
      )}
    </div>
  )
} 