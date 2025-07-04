import { JobPostingsTable } from "@/components/job-postings-table"

export default function JobPostingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Postings</h1>
        <p className="text-gray-600 mt-2">Beheer alle gescrapte vacatures</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <JobPostingsTable />
        </div>
      </div>
    </div>
  )
}
