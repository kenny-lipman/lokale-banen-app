"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Eye, Edit, ExternalLink, Star } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"

interface JobPosting {
  id: string
  title: string
  company_name: string
  company_logo?: string
  company_rating?: number
  is_customer?: boolean
  location: string
  platform: string
  status: string
  review_status: string
  scraped_at: string
  company_id: string
  job_type?: string
  salary?: string
  url?: string
  country?: string
}

interface JobPostingsTableProps {
  onCompanyClick?: (company: any) => void
}

export function JobPostingsTable({ onCompanyClick = () => {} }: JobPostingsTableProps) {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  const fetchJobPostings = async () => {
    setLoading(true)

    try {
      const result = await supabaseService.getJobPostings({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter === "all" ? undefined : statusFilter,
        review_status: reviewStatusFilter === "all" ? undefined : reviewStatusFilter,
      })

      setJobPostings(result.data)
      setTotalCount(result.count)
      setTotalPages(result.totalPages)
    } catch (error) {
      console.error("Error fetching job postings:", error)
      // Fall back to empty data if database is not accessible
      setJobPostings([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(fetchJobPostings, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, reviewStatusFilter, currentPage])

  const handleCompanyClick = async (job: JobPosting) => {
    try {
      const companyData = await supabaseService.getCompanyDetails(job.company_id)
      onCompanyClick(companyData)
    } catch (error) {
      console.error("Error fetching company details:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-blue-800">Nieuw</Badge>
      case "active":
        return <Badge className="bg-green-100 text-green-800">Actief</Badge>
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800">Inactief</Badge>
      case "archived":
        return <Badge className="bg-red-100 text-red-800">Gearchiveerd</Badge>
      default:
        return <Badge className="bg-orange-100 text-orange-800">{status || "Onbekend"}</Badge>
    }
  }

  const getReviewStatusBadge = (reviewStatus: string) => {
    switch (reviewStatus) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
            In afwachting
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300">
            Goedgekeurd
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300">
            Afgewezen
          </Badge>
        )
      default:
        return <Badge variant="outline">{reviewStatus || "Onbekend"}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Zoek op titel, locatie, bedrijf..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="new">Nieuw</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="inactive">Inactief</SelectItem>
            <SelectItem value="archived">Gearchiveerd</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewStatusFilter} onValueChange={setReviewStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Review status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle reviews</SelectItem>
            <SelectItem value="pending">In afwachting</SelectItem>
            <SelectItem value="approved">Goedgekeurd</SelectItem>
            <SelectItem value="rejected">Afgewezen</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-600 flex items-center">
          {totalCount > 0 ? `${totalCount} vacatures gevonden` : "Geen vacatures gevonden"}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vacature</TableHead>
              <TableHead>Bedrijf</TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 9 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : jobPostings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Geen vacatures gevonden
                </TableCell>
              </TableRow>
            ) : (
              jobPostings.map((job) => (
                <TableRow key={job.id} className="hover:bg-orange-50">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{job.title}</div>
                      {job.salary && <div className="text-xs text-gray-500">{job.salary}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {job.company_logo && (
                        <img
                          src={job.company_logo || "/placeholder.svg"}
                          alt={job.company_name}
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <div>
                        <button
                          onClick={() => handleCompanyClick(job)}
                          className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                        >
                          {job.company_name}
                        </button>
                        {job.is_customer && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Klant
                          </Badge>
                        )}
                        {job.company_rating && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                            {job.company_rating}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {job.location}
                      {job.country && job.country !== "Netherlands" && (
                        <div className="text-xs text-gray-500">{job.country}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {job.job_type && (
                      <Badge variant="outline" className="text-xs">
                        {job.job_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{job.platform}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>{getReviewStatusBadge(job.review_status)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{formatDate(job.scraped_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </Button>
                      {job.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
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
