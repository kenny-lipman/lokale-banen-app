/**
 * Pipedrive webhook integration utility
 * Sends contact, company, and campaign data to Pipedrive webhook
 */

interface PipedriveWebhookPayload {
  contact: {
    id: string
    name: string
    email: string // required
    phone: string
    job_title: string
  }
  company: {
    id: string
    name: string // required
    website: string
    industry: string
    city: string
  }
  campaign: {
    name: string
  }
}

interface ContactData {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  company_id?: string | null
  companies?: {
    id?: string | null
    name: string | null
    website: string | null
    category_size: string | null
    city: string | null
  } | null
}

const PIPEDRIVE_WEBHOOK_URL = 'https://ba.grive-dev.com/webhook/pipedrive-sync'

/**
 * Sends contact data to Pipedrive webhook
 * Fails silently to not disrupt main campaign workflow
 */
export async function sendToPipedriveWebhook(
  contactData: ContactData,
  campaignName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate required fields
    if (!contactData.email || !contactData.companies?.name) {
      console.log('[Pipedrive] Skipping webhook - missing required fields (email or company name)')
      return { success: false, error: 'Missing required fields' }
    }

    // Build the payload according to specification
    const payload: PipedriveWebhookPayload = {
      contact: {
        id: contactData.id,
        name: `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() || 'Unknown',
        email: contactData.email,
        phone: contactData.phone || '',
        job_title: contactData.title || ''
      },
      company: {
        id: contactData.companies.id || contactData.company_id || '',
        name: contactData.companies.name,
        website: contactData.companies.website || '',
        industry: contactData.companies.category_size || '',
        city: contactData.companies.city || ''
      },
      campaign: {
        name: campaignName
      }
    }

    console.log('[Pipedrive] Sending webhook payload:', JSON.stringify(payload, null, 2))

    // Send to webhook (no authentication required)
    const response = await fetch(PIPEDRIVE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      // Add reasonable timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Pipedrive] Webhook failed:', response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    console.log('[Pipedrive] Webhook sent successfully')
    return { success: true }

  } catch (error) {
    console.error('[Pipedrive] Webhook error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}