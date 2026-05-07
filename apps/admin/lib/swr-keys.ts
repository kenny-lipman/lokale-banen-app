export interface CompaniesParams {
  page?: number
  limit?: number
  search?: string
  orderBy?: string
  orderDirection?: "asc" | "desc"
  status?: string
  source?: string
  is_customer?: boolean
  regionIds?: string[]
  sizeRange?: { min: number; max: number | null }
  unknownSize?: boolean
  websiteFilter?: "all" | "with" | "without"
}

export interface JobPostingsFilterParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  review_status?: string
  platform_id?: string[] | null
  source_id?: string[] | null
  date_from?: string | null
  date_to?: string | null
  employment?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  career_level?: string[] | null
  education_level?: string[] | null
  hours_min?: number | null
  hours_max?: number | null
  archived_filter?: "active" | "archived" | "all"
  skipFetch?: boolean
}

export const swrKeys = {
  regions: ["regions", "cities-with-counts"] as const,
  activeRegions: ["regions", "active"] as const,
  platformStats: ["platforms", "stats"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  dashboardApifyRuns: ["dashboard", "apify-runs"] as const,
  dashboardContactStats: ["dashboard", "contact-stats"] as const,
  contacts: ["contacts", "all"] as const,
  instantlyLeads: ["instantly-leads"] as const,
  companies: (p: CompaniesParams) => ["companies", p] as const,
  jobPostings: (p: JobPostingsFilterParams) => ["job-postings", p] as const,
}
