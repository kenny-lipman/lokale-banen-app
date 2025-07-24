"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Globe, Linkedin, Phone, MapPin, Building2, Calendar, ExternalLink, Users, Briefcase, Star, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface Company {
  id: string
  name: string
  website?: string | null
  linkedin_url?: string | null
  phone?: string | null
  description?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  street_address?: string | null
  postal_code?: string | null
  industries?: string[] | null
  keywords?: string[] | null
  kvk?: string | null
  category_size?: string | null
  apollo_enriched_at?: string | null
  apollo_contacts_count?: number | null
  apollo_enrichment_data?: any
  contact_count: number
  job_counts: number
  indeed_url?: string | null
  created_at: string | null
  rating_indeed?: number | null
  review_count_indeed?: number | null
  logo_url?: string | null
  is_customer?: boolean | null
}

interface CompanySidebarProps {
  company: Company | null
  isOpen: boolean
  onClose: () => void
}

export function CompanySidebar({ company, isOpen, onClose }: CompanySidebarProps) {
  const router = useRouter()

  if (!company) return null

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Onbekend"
    return new Date(dateString).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatFullAddress = () => {
    const parts = [
      company.street_address,
      company.postal_code && company.city ? `${company.postal_code} ${company.city}` : company.city,
      company.country
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  const handleContactsClick = () => {
    router.push(`/contacten?company=${company.id}`)
    onClose()
  }

  const handleJobPostingsClick = () => {
    router.push(`/job-postings?company=${company.id}`)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[540px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-xl font-semibold text-gray-900 break-words">
                    {company.name}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {company.is_customer && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Klant
                      </Badge>
                    )}
                    {company.apollo_enriched_at && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        <Zap className="w-3 h-3 mr-1" />
                        Apollo Verrijkt
                      </Badge>
                    )}
                    {company.category_size && (
                      <Badge variant="outline">
                        {company.category_size.trim()}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="h-auto p-3 flex flex-col items-center gap-2"
                  onClick={handleContactsClick}
                >
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <div className="font-medium">{company.contact_count}</div>
                    <div className="text-xs text-gray-500">Contacten</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto p-3 flex flex-col items-center gap-2"
                  onClick={handleJobPostingsClick}
                >
                  <Briefcase className="h-5 w-5 text-green-600" />
                  <div className="text-center">
                    <div className="font-medium">{company.job_counts}</div>
                    <div className="text-xs text-gray-500">Vacatures</div>
                  </div>
                </Button>
              </div>

              <Separator />

              {/* Contact Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  Contact Informatie
                </h3>
                <div className="space-y-2">
                  {company.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm break-all"
                      >
                        {company.website}
                      </a>
                      <ExternalLink className="h-3 w-3 text-gray-400" />
                    </div>
                  )}
                  {company.linkedin_url && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-gray-400" />
                      <a 
                        href={company.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm break-all"
                      >
                        LinkedIn Profiel
                      </a>
                      <ExternalLink className="h-3 w-3 text-gray-400" />
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{company.phone}</span>
                    </div>
                  )}
                  {!company.website && !company.linkedin_url && !company.phone && (
                    <p className="text-sm text-gray-500">Geen contact informatie beschikbaar</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Address Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  Adres Informatie
                </h3>
                <div className="space-y-2">
                  {formatFullAddress() ? (
                    <p className="text-sm">{formatFullAddress()}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Geen adres informatie beschikbaar</p>
                  )}
                  {company.postal_code && (
                    <div className="text-xs text-gray-500">
                      Postcode: {company.postal_code}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Business Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  Bedrijfs Informatie
                </h3>
                <div className="space-y-3">
                  {company.kvk && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">KvK Nummer</div>
                      <div className="text-sm">{company.kvk}</div>
                    </div>
                  )}
                  {company.category_size && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Bedrijfsgrootte</div>
                      <div className="text-sm">{company.category_size.trim()}</div>
                    </div>
                  )}
                  {company.industries && company.industries.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Industrieën</div>
                      <div className="flex flex-wrap gap-1">
                        {company.industries.map((industry, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {company.keywords && company.keywords.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Keywords</div>
                      <div className="flex flex-wrap gap-1">
                        {company.keywords.slice(0, 10).map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {company.keywords.length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{company.keywords.length - 10} meer
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {company.description && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Beschrijving</div>
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {company.description.length > 200 
                          ? `${company.description.substring(0, 200)}...` 
                          : company.description
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Apollo Enrichment Data */}
              {company.apollo_enriched_at && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      Apollo Verrijking
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Verrijkt op:</span>
                        <span>{formatDate(company.apollo_enriched_at)}</span>
                      </div>
                      {company.apollo_contacts_count !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Apollo Contacten:</span>
                          <span className="font-medium">{company.apollo_contacts_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* External Links */}
              {(company.indeed_url || company.rating_indeed) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-gray-500" />
                      Externe Links
                    </h3>
                    <div className="space-y-2">
                      {company.indeed_url && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-blue-600" />
                          <a 
                            href={company.indeed_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Indeed Profiel
                          </a>
                          <ExternalLink className="h-3 w-3 text-gray-400" />
                        </div>
                      )}
                      {company.rating_indeed && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">
                            {company.rating_indeed} sterren
                            {company.review_count_indeed && (
                              <span className="text-gray-500"> ({company.review_count_indeed} reviews)</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* System Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  Systeem Informatie
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Toegevoegd:</span>
                    <span>{formatDate(company.created_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Company ID:</span>
                    <span className="font-mono text-xs">{company.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
} 