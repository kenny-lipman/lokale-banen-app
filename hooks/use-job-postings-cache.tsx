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
      const page = params.page || 1
      const limit = params.limit || 10

      // Use the PostgreSQL function for searching
      const { data, error } = await supabase.rpc('search_job_postings', {
        search_term: params.search || null,
        status_filter: params.status || null,
        source_filter: params.source_id || null,
        platform_filter: params.platform_id === 'null' ? null : (params.platform_id || null),
        page_number: page,
        page_size: limit
      })

      if (error) {
        throw new Error(error.message)
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
        country: item.country
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