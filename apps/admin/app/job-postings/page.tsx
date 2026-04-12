"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { JobPostingsTable } from "@/components/job-postings-table"
import { JobPostingDrawer } from "@/components/job-posting-drawer"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { authFetch } from "@/lib/authenticated-fetch"

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
  company_website?: string
  source_id: string
  region?: string
  source_name?: string
  regio_platform?: string
  platform_id?: string
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
}

function JobPostingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedJobForDrawer, setSelectedJobForDrawer] = useState<JobPosting | null>(null)
  const [loadingJobFromUrl, setLoadingJobFromUrl] = useState(false)

  // Handle URL query param for job ID
  useEffect(() => {
    const jobId = searchParams.get('id')
    if (jobId && selectedJobForDrawer?.id !== jobId && !loadingJobFromUrl) {
      setLoadingJobFromUrl(true)
      // Fetch job posting by ID
      authFetch(`/api/job-postings/${jobId}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setSelectedJobForDrawer(result.data)
          }
        })
        .catch(err => console.error('Error fetching job posting:', err))
        .finally(() => setLoadingJobFromUrl(false))
    }
    if (!jobId && selectedJobForDrawer) {
      setSelectedJobForDrawer(null)
    }
  }, [searchParams])

  const handleOpenJobDrawer = (job: JobPosting) => {
    setSelectedJobForDrawer(job)
    router.push(`/job-postings?id=${job.id}`, { scroll: false })
  }

  const handleCloseJobDrawer = () => {
    setSelectedJobForDrawer(null)
    router.push('/job-postings', { scroll: false })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Vacatures</h1>
        <p className="text-gray-600 mt-2">Beheer alle gescrapte vacatures</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <JobPostingsTable
            onJobSelect={handleOpenJobDrawer}
            selectedJobId={selectedJobForDrawer?.id}
          />
        </div>
      </div>

      {/* Job Posting Drawer controlled by URL */}
      <JobPostingDrawer
        job={selectedJobForDrawer}
        open={!!selectedJobForDrawer}
        onClose={handleCloseJobDrawer}
      />
    </div>
  )
}

export default function JobPostingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-6">Laden...</div>}>
        <JobPostingsContent />
      </Suspense>
    </ErrorBoundary>
  )
}
