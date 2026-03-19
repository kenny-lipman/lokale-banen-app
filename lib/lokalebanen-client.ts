/**
 * Lokale Banen API Client
 * Handles company and vacancy creation on the Lokale Banen jobboard platform
 * Auth: Basic Auth, all endpoints require trailing slash
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LBCompanyCreate {
  domain: string
  companyname: string
  street: string
  streetnr: string
  streetadd?: string
  postalcode: string
  city: string
  email: string
  telephone?: string
}

export interface LBVacancyCreate {
  domain: string
  title: string
  city: string
  company_id: string
  start_at: string
  end_at: string
  sector: string
  employments: string
  educations: string
  weeklyhours: string
  function_description?: string
  company_profile?: string
  function_demands?: string
  interest_text?: string
}

export interface LBCreateResponse {
  status: string
  message: string
  id: string
}

export interface LBDomainsResponse {
  domains: string[]
}

export interface LBSectorsResponse {
  sectors: string[]
}

export interface LBEmploymentsResponse {
  employments: string[]
}

export interface LBEducationsResponse {
  educations: string[]
}

// ============================================================================
// CLIENT
// ============================================================================

export class LokaleBanenClient {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor() {
    const user = process.env.LOKALEBANEN_API_USER
    const password = process.env.LOKALEBANEN_API_PASSWORD

    if (!user || !password) {
      throw new Error('LOKALEBANEN_API_USER and LOKALEBANEN_API_PASSWORD must be set')
    }

    this.baseUrl = 'https://www.lokalebanen.nl/api/v1'
    this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
  }

  // --------------------------------------------------------------------------
  // Config endpoints
  // --------------------------------------------------------------------------

  async getDomains(): Promise<string[]> {
    const data = await this.makeRequest<LBDomainsResponse>('/companies/domains/')
    return data.domains
  }

  async getSectors(): Promise<string[]> {
    const data = await this.makeRequest<LBSectorsResponse>('/vacancies/sectors/')
    return data.sectors
  }

  async getEmployments(): Promise<string[]> {
    const data = await this.makeRequest<LBEmploymentsResponse>('/vacancies/employments/')
    return data.employments
  }

  async getEducations(): Promise<string[]> {
    const data = await this.makeRequest<LBEducationsResponse>('/vacancies/educations/')
    return data.educations
  }

  // --------------------------------------------------------------------------
  // Create endpoints
  // --------------------------------------------------------------------------

  async createCompany(data: LBCompanyCreate): Promise<LBCreateResponse> {
    return this.makeRequest<LBCreateResponse>('/companies/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async createVacancy(data: LBVacancyCreate): Promise<LBCreateResponse> {
    return this.makeRequest<LBCreateResponse>('/vacancies/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 1000
    const TIMEOUT_MS = 30000

    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      'Authorization': this.authHeader,
      ...options.headers,
    }

    if (options.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      // Rate limit retry
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ LB API rate limited, waiting ${delayMs}ms (retry ${retryCount + 1}/${MAX_RETRIES})`)
        await this.delay(delayMs)
        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      // Server error retry
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ LB API server error ${response.status}, waiting ${delayMs}ms (retry ${retryCount + 1}/${MAX_RETRIES})`)
        await this.delay(delayMs)
        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Lokale Banen API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError' && retryCount < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ LB API timeout, waiting ${delayMs}ms (retry ${retryCount + 1}/${MAX_RETRIES})`)
        await this.delay(delayMs)
        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      throw error
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton
let clientInstance: LokaleBanenClient | null = null

export function getLokaleBanenClient(): LokaleBanenClient {
  if (!clientInstance) {
    clientInstance = new LokaleBanenClient()
  }
  return clientInstance
}
