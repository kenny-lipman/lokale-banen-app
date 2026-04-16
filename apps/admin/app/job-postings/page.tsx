"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { JobPostingsTable } from "@/components/job-postings-table"
import { JobPostingDrawer } from "@/components/job-posting-drawer"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { authFetch } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import Link from "next/link"

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

type ReviewStatusTab = "pending" | "approved" | "rejected" | "all"

const TAB_ORDER: ReviewStatusTab[] = ["pending", "approved", "rejected", "all"]
const TAB_LABELS: Record<ReviewStatusTab, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "Alle",
}

function isReviewStatusTab(value: string | null): value is ReviewStatusTab {
  return value === "pending" || value === "approved" || value === "rejected" || value === "all"
}

function JobPostingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedJobForDrawer, setSelectedJobForDrawer] = useState<JobPosting | null>(null)
  const [loadingJobFromUrl, setLoadingJobFromUrl] = useState(false)
  const [counts, setCounts] = useState<Record<ReviewStatusTab, number> | null>(null)
  const [countsLoading, setCountsLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)

  // Determine active tab from URL, default to 'pending' if missing or invalid
  const rawStatus = searchParams.get("status")
  const activeTab: ReviewStatusTab = isReviewStatusTab(rawStatus) ? rawStatus : "pending"

  // If the URL has no status param (or an invalid value), normalize to ?status=pending
  useEffect(() => {
    if (!isReviewStatusTab(rawStatus)) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("status", "pending")
      router.replace(`/job-postings?${params.toString()}`, { scroll: false })
    }
  }, [rawStatus, router, searchParams])

  // Fetch review counts (refetches when refreshTick bumps — e.g. after bulk action)
  const fetchCounts = useCallback(async () => {
    setCountsLoading(true)
    try {
      const res = await authFetch("/api/job-postings/review-counts")
      const result = await res.json()
      if (result.counts) {
        setCounts(result.counts)
      }
    } catch (err) {
      console.error("Failed to fetch review counts", err)
    } finally {
      setCountsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts, refreshTick])

  // Handle URL query param for job ID — always fetch full data from API
  // so the drawer gets platform domain, slug, published_at, header_image_url etc.
  const fetchJobIdRef = useRef<string | null>(null)
  useEffect(() => {
    const jobId = searchParams.get("id")
    if (jobId && fetchJobIdRef.current !== jobId && !loadingJobFromUrl) {
      fetchJobIdRef.current = jobId
      setLoadingJobFromUrl(true)
      authFetch(`/api/job-postings/${jobId}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            setSelectedJobForDrawer(result.data)
          }
        })
        .catch((err) => console.error("Error fetching job posting:", err))
        .finally(() => setLoadingJobFromUrl(false))
    }
    if (!jobId && selectedJobForDrawer) {
      setSelectedJobForDrawer(null)
      fetchJobIdRef.current = null
    }
  }, [searchParams])

  const handleOpenJobDrawer = (job: JobPosting) => {
    // Set table data as quick preview, then URL change triggers full API fetch
    setSelectedJobForDrawer(job as any)
    fetchJobIdRef.current = null // Reset so useEffect fetches full data
    const params = new URLSearchParams(searchParams.toString())
    params.set("id", job.id)
    router.push(`/job-postings?${params.toString()}`, { scroll: false })
  }

  const handleCloseJobDrawer = () => {
    setSelectedJobForDrawer(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("id")
    router.push(`/job-postings?${params.toString()}`, { scroll: false })
  }

  const handleTabChange = (value: string) => {
    if (!isReviewStatusTab(value)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("status", value)
    // Close drawer on tab switch
    params.delete("id")
    router.push(`/job-postings?${params.toString()}`, { scroll: false })
  }

  const renderCount = (tab: ReviewStatusTab) => {
    if (countsLoading || !counts) return ""
    const n = counts[tab] ?? 0
    // Backend caps at 10001 for pending tab when exact count is expensive;
    // show "10.000+" for any value at/above the cap.
    if (n >= 10001) return "10.000+"
    return n.toLocaleString("nl-NL")
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vacatures</h1>
          <p className="text-gray-600 mt-2">Beheer alle gescrapte vacatures</p>
        </div>
        <Link href="/vacatures/nieuw">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe vacature
          </Button>
        </Link>
      </div>

      {/* Review status tabs */}
      <div className="mb-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            {TAB_ORDER.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex items-center gap-2">
                {TAB_LABELS[tab]}
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {countsLoading ? "…" : renderCount(tab)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <JobPostingsTable
            onJobSelect={handleOpenJobDrawer}
            selectedJobId={selectedJobForDrawer?.id}
            reviewStatus={activeTab}
            onResetSelection={refreshTick}
            onBulkActionComplete={() => setRefreshTick((t) => t + 1)}
          />
        </div>
      </div>

      {/* Job Posting Drawer controlled by URL */}
      <JobPostingDrawer
        job={selectedJobForDrawer}
        open={!!selectedJobForDrawer}
        onClose={handleCloseJobDrawer}
        onJobChange={async () => {
          // Refetch full job data + update counts
          const jobId = selectedJobForDrawer?.id
          if (jobId) {
            const res = await authFetch(`/api/job-postings/${jobId}`)
            const result = await res.json()
            if (result.success && result.data) {
              setSelectedJobForDrawer(result.data)
            }
          }
          setRefreshTick((t) => t + 1)
        }}
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
