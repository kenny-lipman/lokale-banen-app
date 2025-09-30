import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"

// In-memory cache (per sessie/tab)
const jobPostingsCache: Record<string, any> = {}

export function useJobPostingsCache(params: {
  page?: number
  limit?: number
  search?: string
  status?: string
  platform_id?: string | null
  source_id?: string | null
}) {
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

      // Build the query
      let query = supabase
        .from('job_postings')
        .select(`
          id,
          title,
          location,
          status,
          review_status,
          scraped_at,
          job_type,
          salary,
          url,
          country,
          companies!inner(
            id,
            name,
            website,
            logo_url,
            rating_indeed,
            is_customer
          ),
          job_sources!inner(
            name
          ),
          platforms(
            regio_platform
          )
        `, { count: 'exact' })

      // Apply filters
      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,companies.name.ilike.%${params.search}%,location.ilike.%${params.search}%`)
      }

      if (params.status) {
        query = query.eq('status', params.status)
      }

      if (params.platform_id !== undefined && params.platform_id !== null) {
        if (params.platform_id === 'null') {
          // Filter for jobs with no platform
          query = query.is('platform_id', null)
        } else {
          // Filter for specific platform
          query = query.eq('platform_id', params.platform_id)
        }
      }

      if (params.source_id) {
        query = query.eq('source_id', params.source_id)
      }

      // Apply pagination
      const page = params.page || 1
      const limit = params.limit || 10
      const from = (page - 1) * limit
      const to = from + limit - 1

      query = query.range(from, to).order('scraped_at', { ascending: false })

      const { data, error, count } = await query

      if (error) {
        throw new Error(error.message)
      }

      // Format the data to match the expected structure
      const formattedData = data?.map(item => ({
        id: item.id,
        title: item.title,
        company_name: item.companies?.name,
        company_logo: item.companies?.logo_url,
        company_website: item.companies?.website,
        company_rating: item.companies?.rating_indeed,
        is_customer: item.companies?.is_customer,
        location: item.location,
        platform: item.platforms?.regio_platform,
        source_name: item.job_sources?.name,
        status: item.status,
        review_status: item.review_status,
        scraped_at: item.scraped_at,
        job_type: item.job_type,
        salary: item.salary,
        url: item.url,
        country: item.country
      })) || []

      const formattedResult = {
        data: formattedData,
        count: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }

      jobPostingsCache[cacheKey] = formattedResult
      if (thisFetch === fetchRef.current) {
        setData(formattedResult)
        setLoading(false)
      }

    } catch (e: any) {
      if (thisFetch === fetchRef.current) {
        const errorMessage = e?.message || 'Unknown error'
        console.error('Error fetching job postings:', {
          message: errorMessage,
          params: params,
          error: e
        })
        setError(new Error(errorMessage))
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!jobPostingsCache[cacheKey]) {
      fetchJobPostings()
    } else {
      setData(jobPostingsCache[cacheKey])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const refetch = () => {
    fetchJobPostings()
  }

  return { data, loading, error, refetch }
} 