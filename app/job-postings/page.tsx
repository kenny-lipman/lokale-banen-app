"use client"

import { JobPostingsTable } from "@/components/job-postings-table"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export default function JobPostingsPage() {
  return (
    <ErrorBoundary>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vacatures</h1>
          <p className="text-gray-600 mt-2">Beheer alle gescrapte vacatures</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <JobPostingsTable />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
