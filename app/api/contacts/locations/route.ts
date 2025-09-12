import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

// Initialize Supabase client with service role for server-side access
const supabase = createServiceRoleClient()

interface LocationCount {
  name: string
  count: number
}

interface LocationResponse {
  companyLocations: LocationCount[]
  jobLocations: LocationCount[]
  uniqueCompanyLocations: number
  totalJobPostings: number
  totalLocations: number
}

export async function POST(request: Request) {
  try {
    const { contactIds } = await request.json()
    
    // Validate input
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid contact IDs provided' },
        { status: 400 }
      )
    }
    
    // Get company locations from contacts
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select(`
        id,
        company_id,
        companies!inner(
          id,
          name,
          location
        )
      `)
      .in('id', contactIds)
    
    if (contactError) {
      console.error('Error fetching contact data:', contactError)
      return NextResponse.json(
        { error: 'Failed to fetch contact data' },
        { status: 500 }
      )
    }
    
    // Extract unique company IDs
    const companyIds = [...new Set(contactData?.map(c => c.company_id).filter(Boolean))]
    
    // Get job postings for these companies
    const { data: jobData, error: jobError } = await supabase
      .from('job_postings')
      .select('id, title, location, company_id')
      .in('company_id', companyIds)
      .not('location', 'is', null)
    
    if (jobError) {
      console.error('Error fetching job data:', jobError)
      return NextResponse.json(
        { error: 'Failed to fetch job posting data' },
        { status: 500 }
      )
    }
    
    // Aggregate company locations
    const companyLocations = aggregateLocations(
      contactData || [],
      (item) => item.companies?.location
    )
    
    // Aggregate job locations
    const jobLocations = aggregateLocations(
      jobData || [],
      (item) => item.location
    )
    
    // Calculate unique locations
    const allUniqueLocations = new Set([
      ...companyLocations.map(l => l.name),
      ...jobLocations.map(l => l.name)
    ])
    
    const response: LocationResponse = {
      companyLocations: companyLocations.slice(0, 10), // Top 10
      jobLocations: jobLocations.slice(0, 10), // Top 10
      uniqueCompanyLocations: companyLocations.length,
      totalJobPostings: jobData?.length || 0,
      totalLocations: allUniqueLocations.size
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error in location API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Aggregate locations and count occurrences
 */
function aggregateLocations<T>(
  data: T[],
  getLocation: (item: T) => string | null | undefined
): LocationCount[] {
  const locationMap = new Map<string, number>()
  
  data.forEach(item => {
    const location = getLocation(item)
    if (location) {
      const normalized = normalizeLocation(location)
      if (normalized) {
        locationMap.set(normalized, (locationMap.get(normalized) || 0) + 1)
      }
    }
  })
  
  // Convert to array and sort by count (descending)
  return Array.from(locationMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Normalize location string for consistency
 */
function normalizeLocation(location: string): string {
  if (!location || typeof location !== 'string') return ''
  
  // Remove extra whitespace and trim
  let normalized = location.trim().replace(/\s+/g, ' ')
  
  // Extract city name (before first comma if present)
  const parts = normalized.split(',')
  if (parts.length > 0) {
    normalized = parts[0].trim()
  }
  
  // Capitalize first letter of each word
  normalized = normalized
    .split(' ')
    .map(word => {
      if (word.length === 0) return ''
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
  
  return normalized
}