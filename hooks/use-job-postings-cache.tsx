import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"

// In-memory cache (per sessie/tab)
const jobPostingsCache: Record<string, any> = {}

export interface JobPostingsFilterParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  platform_id?: string[] | null
  source_id?: string[] | null
  // New filter parameters
  date_from?: string | null
  date_to?: string | null
  employment?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  career_level?: string[] | null
  education_level?: string[] | null
  hours_min?: number | null
  hours_max?: number | null
  // Flag to skip fetching (used when external data is provided)
  skipFetch?: boolean
}

export function useJobPostingsCache(params: JobPostingsFilterParams) {
  const cacheKey = JSON.stringify(params)
  const [data, setData] = useState<any>(jobPostingsCache[cacheKey] || null)
  const [loading, setLoading] = useState(!jobPostingsCache[cacheKey])
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchJobPostings = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current

    try {
      const supabase = createClient()
      const page = params.page || 1
      const limit = params.limit || 10

      // Use the PostgreSQL function for searching
      // Handle special "null" value in platform filter array for "no platform" selection
      const platformFilterArray = params.platform_id && params.platform_id.length > 0
        ? (params.platform_id.includes('null') ? null : params.platform_id)
        : null

      const rpcParams = {
        search_term: params.search || null,
        status_filter: params.status || null,
        source_filter: params.source_id && params.source_id.length > 0 ? params.source_id : null,
        platform_filter: platformFilterArray,
        page_number: page,
        page_size: limit,
        // New filter parameters
        date_from: params.date_from || null,
        date_to: params.date_to || null,
        employment_filter: params.employment && params.employment.length > 0 ? params.employment : null,
        salary_min: params.salary_min ?? null,
        salary_max: params.salary_max ?? null,
        career_level_filter: params.career_level && params.career_level.length > 0 ? params.career_level : null,
        education_level_filter: params.education_level && params.education_level.length > 0 ? params.education_level : null,
        hours_min: params.hours_min ?? null,
        hours_max: params.hours_max ?? null
      }

      const { data, error } = await supabase.rpc('search_job_postings', rpcParams)

      if (error) {
        console.error('Supabase RPC error:', error.message)
        throw new Error(error.message || 'Database error')
      }

      // Get total count from the first row (all rows have the same count)
      const totalCount = data && data.length > 0 ? data[0].total_count : 0

      // Format the data to match the expected structure
      const formattedData = data?.map(item => ({
        id: item.id,
        title: item.title,
        company_id: item.company_id,
        company_name: item.company_name,
        company_logo: item.company_logo_url,
        company_website: item.company_website,
        company_rating: item.company_rating_indeed,
        is_customer: item.company_is_customer,
        location: item.location,
        platform: item.platform_regio_platform,
        source_name: item.source_name,
        source_id: item.source_id,
        platform_id: item.platform_id,
        regio_platform: item.platform_regio_platform,
        status: item.status,
        review_status: item.review_status,
        scraped_at: item.scraped_at,
        job_type: item.job_type,
        salary: item.salary,
        url: item.url,
        country: item.country,
        // New fields for drawer
        description: item.description,
        employment: item.employment,
        career_level: item.career_level,
        education_level: item.education_level,
        working_hours_min: item.working_hours_min,
        working_hours_max: item.working_hours_max,
        categories: item.categories,
        end_date: item.end_date,
        city: item.city,
        zipcode: item.zipcode,
        street: item.street,
        created_at: item.created_at
      })) || []

      const formattedResult = {
        data: formattedData,
        count: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }

      jobPostingsCache[cacheKey] = formattedResult
      if (thisFetch === fetchRef.current) {
        setData(formattedResult)
        setLoading(false)
      }

    } catch (e: any) {
      if (thisFetch === fetchRef.current) {
        const errorMessage = e?.message || 'Er is een fout opgetreden bij het ophalen van vacatures'
        console.error('Error fetching job postings:', errorMessage)
        setError(new Error(errorMessage))
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Skip fetching if skipFetch is true (external data provided)
    if (params.skipFetch) {
      setLoading(false)
      return
    }

    if (!jobPostingsCache[cacheKey]) {
      fetchJobPostings()
    } else {
      setData(jobPostingsCache[cacheKey])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, params.skipFetch])

  const refetch = () => {
    fetchJobPostings()
  }

  return { data, loading, error, refetch }
} 