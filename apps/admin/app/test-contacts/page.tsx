"use client"

import { useEffect, useState } from "react"
import { supabaseService } from "@/lib/supabase-service"

export default function TestContactsPage() {
  const [stats, setStats] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testContacts() {
      try {
        setLoading(true)
        
        // Test 1: Get statistics
        console.log("Testing contact statistics...")
        const statsResult = await supabaseService.getContactStatsOptimized()
        setStats(statsResult)
        console.log("Statistics:", statsResult)
        
        // Test 2: Get contacts with pagination
        console.log("Testing contact search...")
        const contactsResult = await supabaseService.searchContactsOptimized(1, 5, {})
        setContacts(contactsResult.data || [])
        console.log("Contacts:", contactsResult)
        
        // Test 3: Test region filtering
        console.log("Testing region filtering...")
        const regionResult = await supabaseService.searchContactsOptimized(1, 5, {
          hoofddomein: ['AalsmeerseBanen']
        })
        console.log("AalsmeerseBanen contacts:", regionResult)
        
        // Test 4: Test campaign filtering
        console.log("Testing campaign filtering...")
        const campaignResult = await supabaseService.searchContactsOptimized(1, 5, {
          campaign: 'with'
        })
        console.log("Contacts with campaign:", campaignResult)
        
      } catch (err) {
        console.error("Test error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }
    
    testContacts()
  }, [])

  if (loading) {
    return <div className="p-8">Loading tests...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Contacts Test Results</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Statistics</h2>
          <pre className="bg-gray-100 p-4 rounded">
            {JSON.stringify(stats, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Sample Contacts (5)</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(contacts, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Test Summary</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>✅ Statistics loaded: {stats ? 'Yes' : 'No'}</li>
            <li>✅ Contacts loaded: {contacts.length > 0 ? 'Yes' : 'No'}</li>
            <li>✅ Total contacts: {stats?.totalContacts || 0}</li>
            <li>✅ Contacts with campaign: {stats?.contactsWithCampaign || 0}</li>
            <li>✅ Contacts without campaign: {stats?.contactsWithoutCampaign || 0}</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 