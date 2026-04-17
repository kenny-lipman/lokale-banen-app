"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VacatureActionBar } from "@/components/vacature/action-bar"
import { AIRewritePanel } from "@/components/vacature/ai-rewrite-panel"
import { LivePreview } from "@/components/vacature/live-preview"
import { ActivityLog } from "@/components/vacature/activity-log"
import {
  Briefcase,
  ExternalLink,
  MapPin,
  Building2,
  Star,
  Clock,
  GraduationCap,
  Users,
  Euro,
  Calendar,
  Tag,
  FileText,
  Crown,
  Eye
} from "lucide-react"

interface PlatformInfo {
  id: string
  regio_platform: string
  domain: string | null
  preview_domain: string | null
}

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
  job_type?: string | string[]
  salary?: string
  url?: string
  country?: string
  company_website?: string
  source_id: string
  source_name?: string
  regio_platform?: string
  platform_id?: string | null
  platform?: PlatformInfo | null
  description?: string
  employment?: string
  career_level?: string
  education_level?: string
  working_hours_min?: number
  working_hours_max?: number
  categories?: string
  end_date?: string
  city?: string
  zipcode?: string
  street?: string
  created_at?: string
  updated_at?: string | null
  published_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  slug?: string | null
  header_image_url?: string | null
  content_md?: string | null
  content_enriched_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  job_sources?: { name: string | null } | null
}

interface JobPostingDrawerProps {
  job: JobPosting | null
  open: boolean
  onClose: () => void
  onCompanyClick?: (companyId: string) => void
  onJobChange?: () => void | Promise<void>
}

/**
 * Sanitize HTML from scraped descriptions — strip script/style tags and
 * event handler attributes to prevent XSS from third-party data.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove script, style, iframe, object, embed tags entirely
    .replace(/<(script|style|iframe|object|embed|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|noscript)[^>]*\/?>/gi, '')
    // Remove event handler attributes (on*)
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: protocol in href/src
    .replace(/(href|src)\s*=\s*["']?\s*javascript:/gi, '$1="')
    // Decode common HTML entities for display
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/\n/g, '<br/>')
}

export function JobPostingDrawer({ job, open, onClose, onCompanyClick, onJobChange }: JobPostingDrawerProps) {
  if (!job) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  }

  const getWorkingHours = () => {
    if (job.working_hours_min && job.working_hours_max) {
      if (job.working_hours_min === job.working_hours_max) {
        return `${job.working_hours_min} uur per week`
      }
      return `${job.working_hours_min} - ${job.working_hours_max} uur per week`
    } else if (job.working_hours_min) {
      return `${job.working_hours_min}+ uur per week`
    } else if (job.working_hours_max) {
      return `Tot ${job.working_hours_max} uur per week`
    }
    return null
  }

  const getFullAddress = () => {
    const parts = []
    if (job.street) parts.push(job.street)
    if (job.zipcode) parts.push(job.zipcode)
    if (job.city) parts.push(job.city)
    if (parts.length === 0 && job.location) return job.location
    return parts.join(', ') || job.location
  }

  const jobTypes = job.job_type
    ? (Array.isArray(job.job_type) ? job.job_type : job.job_type.split(/[\/,|]+/).filter(t => t.trim()))
    : []

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[900px] sm:max-w-[900px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div>
            <SheetTitle className="text-xl leading-tight">{job.title}</SheetTitle>
            <SheetDescription className="mt-1">
              Vacaturedetails en informatie
            </SheetDescription>
          </div>
          <VacatureActionBar
            vacature={{
              id: job.id,
              slug: job.slug ?? null,
              review_status: job.review_status,
              published_at: job.published_at ?? null,
              status: job.status ?? null,
              platform_id: job.platform_id ?? null,
            }}
            platform={job.platform ?? null}
            variant="full"
            onChange={onJobChange}
          />
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Header image preview */}
          {job.header_image_url && (
            <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border bg-gray-50">
              <img
                src={job.header_image_url}
                alt={`Header voor ${job.title}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Company Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                {job.company_logo ? (
                  <img
                    src={job.company_logo}
                    alt={job.company_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{job.company_name}</h3>
                  {job.is_customer && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <Crown className="w-3 h-3 mr-1" />
                      Klant
                    </Badge>
                  )}
                </div>
                {job.company_rating && job.company_rating > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{job.company_rating} sterren</span>
                  </div>
                )}
                {job.company_website && (
                  <a
                    href={job.company_website.startsWith('http') ? job.company_website : `https://${job.company_website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-600 hover:text-orange-800 hover:underline mt-1 inline-block"
                  >
                    {job.company_website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Locatie</p>
                <p className="text-sm text-gray-600">{getFullAddress()}</p>
                {job.country && job.country !== "Netherlands" && job.country !== "Nederland" && (
                  <p className="text-xs text-gray-500">{job.country}</p>
                )}
              </div>
            </div>

            {/* Employment Type */}
            {job.employment && (
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Dienstverband</p>
                  <p className="text-sm text-gray-600">{job.employment}</p>
                </div>
              </div>
            )}

            {/* Salary */}
            {job.salary && job.salary !== " - " && (
              <div className="flex items-start gap-3">
                <Euro className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Salaris</p>
                  <p className="text-sm text-gray-600">{job.salary}</p>
                </div>
              </div>
            )}

            {/* Working Hours */}
            {getWorkingHours() && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Werkuren</p>
                  <p className="text-sm text-gray-600">{getWorkingHours()}</p>
                </div>
              </div>
            )}

            {/* Career Level */}
            {job.career_level && (
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Ervaringsniveau</p>
                  <p className="text-sm text-gray-600">{job.career_level}</p>
                </div>
              </div>
            )}

            {/* Education Level */}
            {job.education_level && (
              <div className="flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Opleidingsniveau</p>
                  <p className="text-sm text-gray-600">{job.education_level}</p>
                </div>
              </div>
            )}

            {/* End Date */}
            {job.end_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Sluitingsdatum</p>
                  <p className="text-sm text-gray-600">{formatDate(job.end_date)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Job Types */}
          {jobTypes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Type vacature
              </h4>
              <div className="flex flex-wrap gap-2">
                {jobTypes.map((type, idx) => (
                  <Badge key={idx} variant="outline" className="text-sm">
                    {type.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {job.categories && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Categorie
              </h4>
              <Badge variant="secondary" className="text-sm">
                {job.categories}
              </Badge>
            </div>
          )}

          {/* Source & Platform */}
          <div className="flex flex-wrap gap-2">
            {job.source_name && (
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                Bron: {job.source_name}
              </Badge>
            )}
            {job.regio_platform && (
              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                Platform: {job.regio_platform}
              </Badge>
            )}
          </div>

          {/* AI Rewrite Panel */}
          <div className="border border-purple-100 rounded-lg p-4 bg-purple-50/30">
            <AIRewritePanel
              vacatureId={job.id}
              hasDescription={!!job.description}
              currentContentMd={job.content_md ?? null}
              contentEnrichedAt={job.content_enriched_at ?? null}
              onAccepted={async () => { await onJobChange?.() }}
            />
          </div>

          {/* Description */}
          {job.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ruwe vacaturetekst (bron)
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(job.description)
                  }}
                />
              </div>
            </div>
          )}

          {/* Activity log */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Activiteit</h4>
            <ActivityLog
              vacature={{
                id: job.id,
                scraped_at: job.scraped_at ?? null,
                created_at: job.created_at ?? null,
                updated_at: job.updated_at ?? null,
                published_at: job.published_at ?? null,
                reviewed_at: job.reviewed_at ?? null,
                reviewed_by: job.reviewed_by ?? null,
                review_status: job.review_status,
                job_sources: job.job_sources ?? null,
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            <LivePreview
              vacature={{
                id: job.id,
                slug: job.slug ?? null,
                title: job.title,
                review_status: job.review_status,
                published_at: job.published_at ?? null,
              }}
              platform={job.platform ?? null}
              trigger={
                <Button variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Live preview
                </Button>
              }
            />
            {job.url && (
              <Button variant="outline" asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Originele bron
                </a>
              </Button>
            )}
            {onCompanyClick && (
              <Button
                variant="outline"
                onClick={() => onCompanyClick(job.company_id)}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Bekijk bedrijf
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
