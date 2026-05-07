import useSWR from "swr"
import { createClient } from "@/lib/supabase"
import { swrKeys, type JobPostingsFilterParams } from "@/lib/swr-keys"

export type { JobPostingsFilterParams } from "@/lib/swr-keys"

async function fetchJobPostings(params: JobPostingsFilterParams) {
  const supabase = createClient()
  const page = params.page || 1
  const limit = params.limit || 10

  const platformFilterArray =
    params.platform_id && params.platform_id.length > 0
      ? params.platform_id.includes("null")
        ? null
        : params.platform_id
      : null

  const rpcParams: any = {
    search_term: params.search || null,
    status_filter: params.status || null,
    review_status_filter: params.review_status || null,
    source_filter: params.source_id && params.source_id.length > 0 ? params.source_id : null,
    platform_filter: platformFilterArray,
    page_number: page,
    page_size: limit,
    date_from: params.date_from || null,
    date_to: params.date_to || null,
    employment_filter: params.employment && params.employment.length > 0 ? params.employment : null,
    salary_min: params.salary_min ?? null,
    salary_max: params.salary_max ?? null,
    career_level_filter:
      params.career_level && params.career_level.length > 0 ? params.career_level : null,
    education_level_filter:
      params.education_level && params.education_level.length > 0 ? params.education_level : null,
    hours_min: params.hours_min ?? null,
    hours_max: params.hours_max ?? null,
    archived_filter: params.archived_filter ?? "active",
  }

  const { data, error } = await supabase.rpc("search_job_postings", rpcParams)

  if (error) {
    console.error("Supabase RPC error:", error.message)
    throw new Error(error.message || "Database error")
  }

  const totalCount = data && data.length > 0 ? data[0].total_count : 0
  const isCapped = data && data.length > 0 ? !!data[0].is_capped : false

  const formattedData =
    data?.map((item: any) => ({
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
      created_at: item.created_at,
    })) || []

  return {
    data: formattedData,
    count: totalCount,
    isCapped,
    totalPages: Math.ceil(totalCount / limit),
  }
}

export function useJobPostingsCache(params: JobPostingsFilterParams) {
  const shouldFetch = !params.skipFetch
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    shouldFetch ? swrKeys.jobPostings(params) : null,
    () => fetchJobPostings(params),
  )

  return {
    data: data ?? null,
    loading: isLoading,
    isValidating,
    error,
    refetch: () => mutate(),
    mutate,
  }
}
