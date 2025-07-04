"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Eye, Edit, ExternalLink, Star, Building2, Globe } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"

interface Company {
  id: string
  name: string
  website?: string | null
  indeed_url?: string | null
  logo_url?: string | null
  location?: string | null
  description?: string | null
  rating_indeed?: number | null
  review_count_indeed?: number | null
  size_min?: number | null
  size_max?: number | null
  is_customer?: boolean | null
  source?: string | null
  created_at: string | null
  job_count: number
}

interface CompaniesTableProps {
  onCompanyClick: (company: any) => void
}

export function CompaniesTable({ onCompanyClick }: CompaniesTableProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 15

  const fetchCompanies = async () => {
    setLoading(true)

    try {
      const result = await supabaseService.getCompanies({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        is_customer: customerFilter === "all" ? undefined : customerFilter === "customers",
        source: sourceFilter === "all" ? undefined : sourceFilter,
      })

      setCompanies(result.data)
      setTotalCount(result.count)
      setTotalPages(result.totalPages)
    } catch (error) {
      console.error("Error fetching companies:", error)
      setCompanies([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(fetchCompanies, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchTerm, customerFilter, sourceFilter, currentPage])

  const handleCompanyClick = async (company: Company) => {
    try {
      const companyData = await supabaseService.getCompanyDetails(company.id)
      onCompanyClick(companyData)
    } catch (error) {
      console.error("Error fetching company details:", error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Onbekend"
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getCompanySize = (company: Company) => {
    if (company.size_min && company.size_max) {
      return `${company.size_min}-${company.size_max}`
    } else if (company.size_min) {
      return `${company.size_min}+`
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Zoek bedrijven..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Klant status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle bedrijven</SelectItem>
            <SelectItem value="customers">Alleen klanten</SelectItem>
            <SelectItem value="non-customers">Geen klanten</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Bron filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle bronnen</SelectItem>
            <SelectItem value="scraped">Gescraped</SelectItem>
            <SelectItem value="manual">Handmatig</SelectItem>
            <SelectItem value="import">Import</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-600 flex items-center">
          {totalCount > 0 ? `${totalCount} bedrijven gevonden` : "Geen bedrijven gevonden"}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead>Vacatures</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Grootte</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Toegevoegd</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 8 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Geen bedrijven gevonden
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id} className="hover:bg-orange-50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url || "/placeholder.svg"}
                            alt={company.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => handleCompanyClick(company)}
                          className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                        >
                          {company.name}
                        </button>
                        <div className="flex items-center space-x-2 mt-1">
                          {company.is_customer && <Badge className="bg-green-100 text-green-800 text-xs">Klant</Badge>}
                          {company.source && (
                            <Badge variant="outline" className="text-xs">
                              {company.source}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{company.location || "Onbekend"}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{company.job_count}</span>
                      <span className="text-xs text-gray-500">vacatures</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.rating_indeed ? (
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{company.rating_indeed}</span>
                        {company.review_count_indeed && (
                          <span className="text-xs text-gray-500">({company.review_count_indeed})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Geen rating</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getCompanySize(company) ? (
                      <div className="text-sm">
                        {getCompanySize(company)} <span className="text-gray-500">medewerkers</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Onbekend</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.is_customer ? (
                      <Badge className="bg-green-100 text-green-800">Klant</Badge>
                    ) : (
                      <Badge variant="outline">Prospect</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDate(company.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleCompanyClick(company)}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </Button>
                      {company.website && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={company.website} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 text-gray-500" />
                          </a>
                        </Button>
                      )}
                      {company.indeed_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={company.indeed_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Pagina {currentPage} van {totalPages} ({totalCount} totaal)
        </p>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Vorige
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Volgende
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
