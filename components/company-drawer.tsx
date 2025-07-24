"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, ExternalLink, MapPin, Briefcase, Star, Users, Globe, CheckCircle, Clock, AlertCircle, Archive } from "lucide-react"

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
  source_name?: string | null
  job_count: number
  recent_jobs: Array<{
    id: string
    title: string
    location: string
    status: string
    review_status: string
    created_at: string
    job_type?: string | string[]
    salary?: string
  }>
}

interface CompanyDrawerProps {
  company: Company | null
  open: boolean
  onClose: () => void
}

export function CompanyDrawer({ company, open, onClose }: CompanyDrawerProps) {
  if (!company) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Nieuw
          </Badge>
        )
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actief
          </Badge>
        )
      case "inactive":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="w-3 h-3 mr-1" />
            Inactief
          </Badge>
        )
      case "archived":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Archive className="w-3 h-3 mr-1" />
            Gearchiveerd
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const getCompanySize = () => {
    if (company.size_min && company.size_max) {
      return `${company.size_min} - ${company.size_max} medewerkers`
    } else if (company.size_min) {
      return `${company.size_min}+ medewerkers`
    }
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[700px] sm:max-w-[700px]">
        <SheetHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img
                  src={company.logo_url || "/placeholder.svg"}
                  alt={company.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-6 h-6 text-orange-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <SheetTitle className="text-xl">{company.name}</SheetTitle>
                {company.is_customer && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <Crown className="w-3 h-3 mr-1" />
                    Klant
                  </Badge>
                )}
              </div>
              <SheetDescription>Bedrijfsdetails en vacatures</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Company Info */}
          <div className="grid grid-cols-1 gap-4">
            {company.website && (
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="w-4 h-4 text-gray-500" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-800 hover:underline"
                >
                  {company.website}
                </a>
              </div>
            )}

            {company.indeed_url && (
              <div className="flex items-center space-x-2 text-sm">
                <ExternalLink className="w-4 h-4 text-gray-500" />
                <a
                  href={company.indeed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-800 hover:underline"
                >
                  Indeed profiel
                </a>
              </div>
            )}

            {company.location && (
              <div className="flex items-center space-x-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{company.location}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 text-sm">
              <Briefcase className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{company.job_count} actieve vacatures</span>
            </div>

            {company.rating_indeed && (
              <div className="flex items-center space-x-2 text-sm">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span className="text-gray-700">
                  {company.rating_indeed} sterren
                  {company.review_count_indeed && ` (${company.review_count_indeed} reviews)`}
                </span>
              </div>
            )}

            {getCompanySize() && (
              <div className="flex items-center space-x-2 text-sm">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{getCompanySize()}</span>
              </div>
            )}

            {company.source && (
              <div className="text-xs text-gray-500">Bron: {company.source_name || company.source}</div>
            )}
          </div>

          {/* Description */}
          {company.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Beschrijving</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
            </div>
          )}

          {/* Recent Jobs */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recente Vacatures</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vacaturetitel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.recent_jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                        Geen recente vacatures
                      </TableCell>
                    </TableRow>
                  ) : (
                    company.recent_jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-orange-50">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{job.title}</div>
                            {job.salary && <div className="text-xs text-gray-500">{job.salary}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.job_type && Array.isArray(job.job_type)
                            ? job.job_type.map((type, idx) => (
                                <Badge key={type + idx} variant="outline" className="text-xs mr-1">
                                  {type}
                                </Badge>
                              ))
                            : job.job_type &&
                              job.job_type
                                .split(/[\/,|]+|\s+/)
                                .filter((t) => t && t.trim() !== "")
                                .map((type, idx) => (
                                  <Badge key={type + idx} variant="outline" className="text-xs mr-1">
                                    {type}
                                  </Badge>
                                ))}
                        </TableCell>
                        <TableCell className="text-sm">{job.location}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(job.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            {company.indeed_url && (
              <Button variant="outline" asChild>
                <a href={company.indeed_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Indeed
                </a>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
