export interface ContactUpdateRequest {
  first_name?: string
  last_name?: string
  qualification_status?: 'pending' | 'qualified' | 'disqualified' | 'review' | 'in_campaign'
  email?: string
  title?: string
  phone?: string
}

export interface ContactUpdateResponse {
  success: boolean
  data?: Contact
  error?: string
}

export interface Contact {
  id: string
  company_id: string | null
  first_name: string | null
  last_name: string | null
  name: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  campaign_id: string | null
  campaign_name: string | null
  qualification_status: string | null
  email_status: string | null
  source: string | null
  status: string | null
  company_status: string | null
  created_at: string | null
  found_at: string | null
  qualification_timestamp: string | null
  qualified_by_user: string | null
  qualification_notes: string | null
  is_key_contact: boolean | null
  contact_priority: number | null
  confidence_score_ai: number | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}