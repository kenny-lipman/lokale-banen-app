"use client"

import { useEffect, useState } from 'react'
import { useRegionsForScraping } from '@/hooks/use-regions-for-scraping'

export default function TestRegionsPage() {
  const { regions, loading, error } = useRegionsForScraping()

  // Group regions by plaats to show the deduplication
  const groupedRegions = regions.reduce((acc, region) => {
    if (!acc[region.plaats]) {
      acc[region.plaats] = region
    }
    return acc
  }, {} as Record<string, typeof regions[0]>)

  const uniquePlaatsen = Object.values(groupedRegions).sort((a, b) => a.plaats.localeCompare(b.plaats))

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Regions API</h1>
      
      {loading && <p>Loading regions...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      
      {regions.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Raw Data: {regions.length} total regions</h2>
            <ul className="space-y-2">
              {regions.slice(0, 5).map((region) => (
                <li key={region.id} className="p-2 border rounded text-sm">
                  <strong>ID:</strong> {region.id} | 
                  <strong>Plaats:</strong> {region.plaats} | 
                  <strong>Regio Platform:</strong> {region.regio_platform || 'N/A'}
                </li>
              ))}
            </ul>
            {regions.length > 5 && <p className="mt-2 text-gray-600">... and {regions.length - 5} more</p>}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Deduplicated by Plaats: {uniquePlaatsen.length} unique places</h2>
            <ul className="space-y-2">
              {uniquePlaatsen.slice(0, 10).map((region) => (
                <li key={region.id} className="p-2 border rounded bg-blue-50">
                  <strong>ID:</strong> {region.id} | 
                  <strong>Plaats:</strong> {region.plaats} | 
                  <strong>Regio Platform:</strong> {region.regio_platform || 'N/A'}
                </li>
              ))}
            </ul>
            {uniquePlaatsen.length > 10 && <p className="mt-2 text-gray-600">... and {uniquePlaatsen.length - 10} more</p>}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Webhook Payload Preview</h2>
            <p className="text-sm text-gray-600 mb-2">When a region is selected, the webhook will receive:</p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-xs overflow-x-auto">
{`{
  "locatie": "regio_platform_value",
  "plaats": "plaats_value", 
  "functie": "job_title",
  "platform": "indeed",
  "session_id": "session_id",
  "region_id": "selected_region_id"
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 