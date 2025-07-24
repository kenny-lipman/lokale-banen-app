"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestApifyDataPage() {
  const [apifyRunId, setApifyRunId] = useState('wn665tHoZ2SO6WdYm')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!apifyRunId) return
    
    setLoading(true)
    setError(null)
    setData(null)
    
    try {
      const response = await fetch(`/api/otis/scraping-results/${apifyRunId}`)
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
        console.log('API Response:', result.data)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Apify Data API</h1>
      
      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="apifyRunId">Apify Run ID</Label>
          <Input
            id="apifyRunId"
            value={apifyRunId}
            onChange={(e) => setApifyRunId(e.target.value)}
            placeholder="Enter apify_run_id"
            className="mt-1"
          />
        </div>
        
        <Button onClick={fetchData} disabled={loading || !apifyRunId}>
          {loading ? 'Fetching...' : 'Fetch Data'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-green-800 font-medium">Success!</h3>
            <p className="text-green-600">
              Found {data.companies?.length || 0} companies with {data.job_count || 0} job postings
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Summary</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p><strong>Apify Run ID:</strong> {data.apify_run_id}</p>
              <p><strong>Status:</strong> {data.status}</p>
              <p><strong>Job Count:</strong> {data.job_count}</p>
              <p><strong>Companies:</strong> {data.companies?.length || 0}</p>
              <p><strong>Created:</strong> {data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
              <p><strong>Completed:</strong> {data.completed_at ? new Date(data.completed_at).toLocaleString() : 'N/A'}</p>
            </div>
          </div>

          {data.companies && data.companies.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Companies ({data.companies.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.companies.slice(0, 10).map((company: any) => (
                  <div key={company.id} className="bg-white border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{company.name}</h4>
                        <p className="text-sm text-gray-600">{company.website || 'No website'}</p>
                        <p className="text-sm text-gray-500">{company.location || 'No location'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">{company.job_count} jobs</span>
                        <br />
                        <span className="text-xs text-gray-500">{company.enrichment_status}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {data.companies.length > 10 && (
                  <p className="text-sm text-gray-500 text-center">
                    ... and {data.companies.length - 10} more companies
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 