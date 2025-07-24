"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableFilters, TablePagination } from "@/components/ui/table-filters"
import { ArrowUpDown, ChevronUp, ChevronDown, Mail, Building2, User, ExternalLink, CheckCircle, Clock, XCircle, AlertCircle, Send } from "lucide-react"

interface Lead {
  id: string
  name?: string | null
  email?: string | null
  company_name?: string | null
  status?: string | null
  campaign_name?: string | null
  created_at?: string | null
  phone?: string | null
  title?: string | null
  response_status?: string | null
}

interface InstantlyLeadsTableProps {
  data: Lead[]
  loading?: boolean
  error?: any
  onLeadClick?: (lead: Lead) => void
  className?: string
}

type SortField = keyof Lead
type SortDirection = 'asc' | 'desc'

export function InstantlyLeadsTable({ 
  data, 
  loading, 
  error, 
  onLeadClick,
  className = ""
}: InstantlyLeadsTableProps) {
  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")
  const [responseFilter, setResponseFilter] = useState("all")
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Selection State
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  // Get unique filter options from data
  const { statusOptions, campaignOptions, responseOptions } = useMemo(() => {
    const statuses = Array.from(new Set(data.map(lead => lead.status).filter(Boolean)))
    const campaigns = Array.from(new Set(data.map(lead => lead.campaign_name).filter(Boolean)))
    const responses = Array.from(new Set(data.map(lead => lead.response_status).filter(Boolean)))
    
    return {
      statusOptions: [
        { value: "all", label: "Alle statussen" },
        ...statuses.map(status => ({ value: status!, label: status! }))
      ],
      campaignOptions: [
        { value: "all", label: "Alle campagnes" },
        ...campaigns.map(campaign => ({ value: campaign!, label: campaign! }))
      ],
      responseOptions: [
        { value: "all", label: "Alle responses" },
        ...responses.map(response => ({ value: response!, label: response! }))
      ]
    }
  }, [data])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(lead => {
      const matchesSearch = !searchTerm || 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter
      const matchesCampaign = campaignFilter === "all" || lead.campaign_name === campaignFilter
      const matchesResponse = responseFilter === "all" || lead.response_status === responseFilter
      
      return matchesSearch && matchesStatus && matchesCampaign && matchesResponse
    })

    // Sort data
    filtered.sort((a, b) => {
      const aValue = a[sortField] ?? ''
      const bValue = b[sortField] ?? ''
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [data, searchTerm, statusFilter, campaignFilter, responseFilter, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, campaignFilter, responseFilter])

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

  // Selection handlers
  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedLeads(prev => 
      prev.length === paginatedData.length 
        ? [] 
        : paginatedData.map(lead => lead.id)
    )
  }

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setCampaignFilter("all")
    setResponseFilter("all")
    setCurrentPage(1)
  }

  // Get status badge styling
  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-gray-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          Onbekend
        </Badge>
      )
    }
    
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus.includes('replied') || normalizedStatus.includes('interested') || normalizedStatus.includes('positive')) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Positief
        </Badge>
      )
    }
    if (normalizedStatus.includes('bounced') || normalizedStatus.includes('failed') || normalizedStatus.includes('unsubscribed')) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Mislukt
        </Badge>
      )
    }
    if (normalizedStatus.includes('sent') || normalizedStatus.includes('delivered') || normalizedStatus.includes('opened')) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Send className="w-3 h-3 mr-1" />
          Verzonden
        </Badge>
      )
    }
    if (normalizedStatus.includes('pending') || normalizedStatus.includes('scheduled')) {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
          <Clock className="w-3 h-3 mr-1" />
          In wachtrij
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-gray-600">
        <AlertCircle className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    )
  }

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('nl-NL')
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

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-2">Fout bij laden van leads</div>
        <div className="text-sm text-gray-500">{error.toString()}</div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters */}
      <TableFilters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Zoek op naam, email of bedrijf..."
        totalCount={filteredAndSortedData.length}
        resultText="leads"
        onResetFilters={resetFilters}
        filters={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onValueChange: setStatusFilter,
            options: statusOptions,
            placeholder: "Filter op status"
          },
          {
            id: "campaign",
            label: "Campagne",
            value: campaignFilter,
            onValueChange: setCampaignFilter,
            options: campaignOptions,
            placeholder: "Filter op campagne"
          },
          {
            id: "response",
            label: "Response",
            value: responseFilter,
            onValueChange: setResponseFilter,
            options: responseOptions,
            placeholder: "Filter op response"
          }
        ]}
        bulkActions={
          selectedLeads.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                {selectedLeads.length} leads geselecteerd
              </span>
              <Button size="sm" variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Email versturen
              </Button>
              <Button size="sm" variant="outline">
                Export selectie
              </Button>
            </div>
          )
        }
      />

      {/* Table */}
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === paginatedData.length && paginatedData.length > 0}
                  onChange={toggleSelectAll}
                  aria-label="Selecteer alle leads"
                />
              </TableHead>
              <SortableHeader field="name">
                <User className="w-4 h-4 mr-1" />
                Naam
              </SortableHeader>
              <SortableHeader field="email">
                <Mail className="w-4 h-4 mr-1" />
                Email
              </SortableHeader>
              <SortableHeader field="company_name">
                <Building2 className="w-4 h-4 mr-1" />
                Bedrijf
              </SortableHeader>
              <TableHead>Titel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response</TableHead>
              <SortableHeader field="campaign_name">Campagne</SortableHeader>
              <SortableHeader field="created_at">Toegevoegd</SortableHeader>
              <TableHead className="w-[100px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: itemsPerPage }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 10 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="space-y-2">
                    <Mail className="w-12 h-12 mx-auto text-gray-300" />
                    <h3 className="font-medium text-gray-900">Geen leads gevonden</h3>
                    <p className="text-gray-500">
                      {searchTerm || statusFilter !== "all" || campaignFilter !== "all" || responseFilter !== "all"
                        ? "Pas je filters aan om meer resultaten te zien"
                        : "Er zijn nog geen leads beschikbaar"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className="hover:bg-orange-50 cursor-pointer"
                  onClick={() => onLeadClick && onLeadClick(lead)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                      aria-label={`Selecteer lead ${lead.name || lead.email}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{lead.name || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lead.email || '-'}
                      {lead.email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`mailto:${lead.email}`, '_blank')
                          }}
                        >
                          <Mail className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.company_name || '-'}</TableCell>
                  <TableCell>
                    {lead.title ? (
                      <Badge variant="outline" className="text-xs">
                        {lead.title}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  <TableCell>{getStatusBadge(lead.response_status)}</TableCell>
                  <TableCell>
                    {lead.campaign_name ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {lead.campaign_name}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{formatDate(lead.created_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && paginatedData.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredAndSortedData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage)
            setCurrentPage(1)
          }}
        />
      )}
    </div>
  )
} 