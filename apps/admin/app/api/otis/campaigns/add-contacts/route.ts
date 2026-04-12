import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface AddContactsToCampaignRequest {
  contactIds: string[]
  campaignId?: string
  campaignName?: string
  templateId?: string
  dryRun?: boolean // For validation without actual addition
}

interface CampaignValidationResult {
  isValid: boolean
  contactsValidated: ContactValidation[]
  campaignDetails: any
  warnings: string[]
  errors: string[]
  summary: {
    totalContacts: number
    validContacts: number
    invalidContacts: number
    duplicateContacts: number
    verifiedEmails: number
    keyContacts: number
  }
}

interface ContactValidation {
  contactId: string
  name: string
  email: string
  companyName: string
  isValid: boolean
  isKeyContact: boolean
  isDuplicate: boolean
  emailVerified: boolean
  issues: string[]
}

// Mock function to check if contact already exists in campaign
async function checkDuplicateInCampaign(email: string, campaignId: string): Promise<boolean> {
  // In real implementation, this would call Instantly API to check for duplicates
  // For now, simulate some duplicates
  return Math.random() < 0.1 // 10% chance of duplicate
}

// Mock function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Mock function to get campaign details from Instantly
async function getCampaignDetails(campaignId: string) {
  // Mock campaign details - replace with actual Instantly API call
  return {
    id: campaignId,
    name: 'Logistics Outreach Q1',
    status: 'active',
    contactCount: 145,
    maxContacts: 1000,
    template: 'Logistics Cold Email Template',
    dailySendLimit: 50
  }
}

// Mock function to add contacts to Instantly campaign
async function addContactsToInstantly(contacts: any[], campaignId: string) {
  // Mock API call - replace with actual Instantly integration
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  await delay(1000) // Simulate API call
  
  // Simulate some failures
  const results = contacts.map(contact => ({
    contactId: contact.id,
    success: Math.random() > 0.05, // 95% success rate
    error: Math.random() <= 0.05 ? 'Email domain not accepted by Instantly' : null
  }))
  
  return results
}

// Pre-flight validation endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactIds = searchParams.get('contactIds')?.split(',') || []
    const campaignId = searchParams.get('campaignId')

    if (!contactIds.length) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get contact details
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        title,
        company_id,
        company_name,
        email_status,
        campaign_id,
        campaign_name,
        created_at
      `)
      .in('id', contactIds)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts found' },
        { status: 404 }
      )
    }

    // Get campaign details
    const campaignDetails = await getCampaignDetails(campaignId)

    // Validate each contact
    const validationResults: ContactValidation[] = []
    const warnings: string[] = []
    const errors: string[] = []

    for (const contact of contacts) {
      const issues: string[] = []
      
      // Check if email is valid
      const emailValid = isValidEmail(contact.email)
      if (!emailValid) {
        issues.push('Invalid email format')
      }

      // Check if email is verified
      const emailVerified = contact.email_status === 'verified'
      if (!emailVerified && emailValid) {
        issues.push('Email not verified')
      }

      // Check if already in a campaign
      const alreadyInCampaign = contact.campaign_id !== null
      if (alreadyInCampaign) {
        issues.push(`Already in campaign: ${contact.campaign_name}`)
      }

      // Check for duplicate in target campaign
      const isDuplicate = await checkDuplicateInCampaign(contact.email, campaignId)
      if (isDuplicate) {
        issues.push('Already exists in target campaign')
      }

      // Determine if key contact
      const isKeyContact = contact.title?.toLowerCase().includes('ceo') ||
                          contact.title?.toLowerCase().includes('founder') ||
                          contact.title?.toLowerCase().includes('owner') ||
                          contact.title?.toLowerCase().includes('director')

      validationResults.push({
        contactId: contact.id,
        name: contact.name,
        email: contact.email,
        companyName: contact.company_name,
        isValid: issues.length === 0 || (issues.length === 1 && issues[0] === 'Email not verified'),
        isKeyContact,
        isDuplicate,
        emailVerified,
        issues
      })
    }

    // Generate warnings and errors
    const invalidCount = validationResults.filter(r => !r.isValid).length
    const duplicateCount = validationResults.filter(r => r.isDuplicate).length
    const unverifiedCount = validationResults.filter(r => !r.emailVerified).length

    if (invalidCount > 0) {
      warnings.push(`${invalidCount} contacts have validation issues`)
    }

    if (duplicateCount > 0) {
      warnings.push(`${duplicateCount} contacts already exist in the campaign`)
    }

    if (unverifiedCount > 0) {
      warnings.push(`${unverifiedCount} contacts have unverified emails`)
    }

    // Check campaign capacity
    const validContactsCount = validationResults.filter(r => r.isValid).length
    const newTotalContacts = campaignDetails.contactCount + validContactsCount
    
    if (newTotalContacts > campaignDetails.maxContacts) {
      errors.push(`Campaign would exceed maximum contacts (${campaignDetails.maxContacts})`)
    }

    const validationResult: CampaignValidationResult = {
      isValid: errors.length === 0 && validContactsCount > 0,
      contactsValidated: validationResults,
      campaignDetails,
      warnings,
      errors,
      summary: {
        totalContacts: validationResults.length,
        validContacts: validationResults.filter(r => r.isValid).length,
        invalidContacts: validationResults.filter(r => !r.isValid).length,
        duplicateContacts: duplicateCount,
        verifiedEmails: validationResults.filter(r => r.emailVerified).length,
        keyContacts: validationResults.filter(r => r.isKeyContact).length
      }
    }

    return NextResponse.json({
      success: true,
      data: validationResult
    })

  } catch (error) {
    console.error('Error validating campaign contacts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Add contacts to campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: AddContactsToCampaignRequest = await request.json()
    const { contactIds, campaignId, campaignName, templateId, dryRun = false } = body

    // Validate input
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs array is required' },
        { status: 400 }
      )
    }

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Limit to prevent abuse
    if (contactIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 contacts can be added at once' },
        { status: 400 }
      )
    }

    // If dry run, just validate
    if (dryRun) {
      const validationUrl = new URL('/api/otis/campaigns/add-contacts', request.url)
      validationUrl.searchParams.set('contactIds', contactIds.join(','))
      validationUrl.searchParams.set('campaignId', campaignId)
      
      const validationResponse = await fetch(validationUrl.toString())
      const validationData = await validationResponse.json()
      
      return NextResponse.json(validationData)
    }

    // Get contacts to add
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        title,
        phone,
        linkedin_url,
        company_id,
        company_name,
        email_status
      `)
      .in('id', contactIds)
      .is('campaign_id', null) // Only get contacts not already in campaigns

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid contacts found (contacts may already be in campaigns)' },
        { status: 404 }
      )
    }

    // Filter to only valid contacts
    const validContacts = contacts.filter(contact => 
      isValidEmail(contact.email) && !contact.campaign_id
    )

    if (validContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts with valid emails found' },
        { status: 400 }
      )
    }

    try {
      // Add contacts to Instantly campaign
      const instantlyResults = await addContactsToInstantly(validContacts, campaignId)
      
      // Track successful additions
      const successfulContactIds = instantlyResults
        .filter(result => result.success)
        .map(result => result.contactId)

      const failedResults = instantlyResults
        .filter(result => !result.success)

      // Update successful contacts in database
      if (successfulContactIds.length > 0) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            campaign_id: campaignId,
            campaign_name: campaignName || `Campaign ${campaignId}`,
            updated_at: new Date().toISOString()
          })
          .in('id', successfulContactIds)

        if (updateError) {
          console.error('Error updating contacts with campaign info:', updateError)
          // Continue even if database update fails - contacts are in campaign
        }
      }

      // Log the campaign addition
      const { error: logError } = await supabase
        .from('campaign_additions')
        .insert({
          campaign_id: campaignId,
          campaign_name: campaignName,
          added_by: user.id,
          contacts_added: successfulContactIds.length,
          contacts_failed: failedResults.length,
          total_contacts: validContacts.length,
          results: instantlyResults,
          created_at: new Date().toISOString()
        })

      if (logError) {
        console.warn('Failed to log campaign addition:', logError)
        // Continue even if logging fails
      }

      return NextResponse.json({
        success: true,
        data: {
          campaign_id: campaignId,
          campaign_name: campaignName,
          contacts_processed: validContacts.length,
          contacts_added: successfulContactIds.length,
          contacts_failed: failedResults.length,
          successful_contacts: successfulContactIds,
          failed_contacts: failedResults,
          message: `Successfully added ${successfulContactIds.length} contacts to campaign${failedResults.length > 0 ? ` (${failedResults.length} failed)` : ''}`
        }
      })

    } catch (instantlyError: any) {
      console.error('Error adding contacts to Instantly:', instantlyError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to add contacts to campaign',
          details: instantlyError.message 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in add contacts to campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}