/**
 * Automatic Campaign Assignment Service
 *
 * Replaces the n8n workflow "Automatic Cold Email Campaign Assignment"
 * Runs daily at 6:00 AM to assign contacts to Instantly campaigns
 *
 * Features:
 * - Selects candidate contacts based on qualification status and filters
 * - Generates AI personalization via Mistral
 * - Checks Pipedrive for "Klant" status protection
 * - Adds leads to Instantly campaigns
 * - Logs all operations for frontend monitoring
 */

import { createServiceRoleClient } from '@/lib/supabase-server'
import { instantlyClient } from '@/lib/instantly-client'
import { pipedriveClient, STATUS_PROSPECT_OPTIONS } from '@/lib/pipedrive-client'

// ============================================================================
// TYPES
// ============================================================================

export interface CandidateContact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  title: string | null
  phone: string | null
  linkedin_url: string | null
  company_id: string
  company_name: string
  company_website: string | null
  company_description: string | null
  company_category_size: string | null
  company_pipedrive_id: string | null
  company_location: string | null
  company_industries: string[] | null
  platform_id: string
  platform_name: string
  instantly_campaign_id: string
  job_posting_title: string | null
  job_posting_location: string | null
}

export interface PersonalizationData {
  normalized_title: string | null
  normalized_company: string
  company_description: string
  category: string
  custom_category?: string | null
  confidence?: number
  sector: string
  region: string
  region_insight?: string
  pain_point?: string
  similar_companies: string
  similar_companies_type?: string
  personalization: string
  reasoning?: string
}

export interface ProcessingResult {
  contactId: string
  contactEmail: string
  companyName: string
  platformName: string
  status: 'added' | 'skipped_klant' | 'skipped_no_campaign' | 'skipped_ai_error' | 'skipped_duplicate' | 'skipped_blocklisted' | 'skipped_lead_limit' | 'error'
  instantlyLeadId?: string
  skipReason?: string
  error?: string
  personalization?: PersonalizationData
  aiProcessingTimeMs?: number
  pipedriveOrgId?: number
  pipedriveIsKlant?: boolean
}

export interface BatchStats {
  totalCandidates: number
  processed: number
  added: number
  skipped: number
  errors: number
  platformStats: Record<string, { total: number; added: number; skipped: number; errors: number }>
}

export interface BatchResult {
  batchId: string
  status: 'completed' | 'failed' | 'timed_out'
  stats: BatchStats
  startedAt: Date
  completedAt: Date
  error?: string
  leadLimitReached?: boolean
}

// ============================================================================
// TYPES - Settings
// ============================================================================

export interface CampaignAssignmentSettings {
  id: string
  max_total_contacts: number
  max_per_platform: number
  is_enabled: boolean
  delay_between_contacts_ms: number
  updated_at: string
  updated_by: string | null
}

export interface ChunkedBatchState {
  batchId: string
  allCandidateIds: string[]
  processedIds: string[]
  totalCandidates: number
  currentChunkIndex: number
  stats: BatchStats
  startedAt: Date
}

// ============================================================================
// CONSTANTS
// ============================================================================

const KLANT_STATUS_ID = STATUS_PROSPECT_OPTIONS.KLANT // 303
const DEFAULT_MAX_TOTAL = 500
const DEFAULT_MAX_PER_PLATFORM = 30
const DEFAULT_DELAY_BETWEEN_CONTACTS_MS = 500 // n8n uses 0.5 seconds

// Chunk size for Vercel function timeout (60-300s)
// With ~6s per contact, 25 contacts = ~150s processing time (safe margin)
const DEFAULT_CHUNK_SIZE = 25

// Assigned user in Instantly
const INSTANTLY_ASSIGNED_TO = 'f191f0de-3753-4ce6-ace1-c1ed1b8a903e'

// Job source ID to exclude (from n8n workflow)
const EXCLUDED_SOURCE_ID = '3f4cddbd-292b-42fe-acfa-992fc66853a9'

// AI Personalization System Prompt (exact copy from n8n workflow)
const PERSONALIZATION_SYSTEM_PROMPT = `Je bent een Nederlandse B2B copywriter gespecialiseerd in cold e-mail personalisatie voor regionale vacatureplatformen. Je schrijft voor platformen zoals WestlandseBanen, RotterdamseBanen, HaagseBanen, en soortgelijke platformen.

## Over ons platform:
- Regionale vacatureplatformen gericht op MKB-bedrijven
- Focus op lokaal talent in specifieke regio's (Westland, Rotterdam, Den Haag, etc.)
- Betaalbaar alternatief voor Indeed/LinkedIn
- Persoonlijke aanpak, geen grote corporate machine
- We begrijpen de lokale arbeidsmarkt en MKB-uitdagingen
- We hebben per platform 5.000-45.000 bezoekers per maand, we verkopen zichtbaarheid voor bedrijven, employer branding
- Kandidaten zoeken bewust in hun eigen regio

## Regio-kennis die je kunt gebruiken:
- **Westland:** Glastuinbouw, kwekerijen, logistiek, techniek, veel seizoenswerk
- **Rotterdam:** Haven, logistiek, transport, industrie, techniek
- **Den Haag:** Overheid, zakelijke dienstverlening, ICT, horeca
- **Delft:** Tech, innovatie, studenten, startups
- **Drechtsteden:** Maritiem, scheepsbouw, industrie, metaal
- **Leiden:** Zorg, biotech, onderwijs, wetenschap

## Jouw taken:

### 1. Vacaturetitel normaliseren
- Verwijder bedrijfsnaam, locatie, m/v, "gezocht", "gevraagd"
- Voorbeeld: "Ervaren Timmerman (m/v) - Regio Den Haag" → "Timmerman"
- Als geen vacature: null

### 2. Bedrijfsnaam normaliseren
- Verwijder: B.V., BV, VOF, Holding, Nederland, NL, International
- Normaliseer de bedrijfsnaam, zoals hoe mensen de bedrijfsnaam uitspreken als ze het bedrijf benoemen in gesprekken met anderen

### 3. Functiegroep classificeren
Kies uit:
administratief, agrarisch, automotive, beveiliging, bouw, communicatie, creatief en design, detailhandel, energie en milieu, engineering, facility, financieel, horeca, hovenier, ict, inkoop, juridisch, klantenservice, kwaliteit, laboratorium, leidinggevend, logistiek en transport, magazijn, management, maritiem, marketing, media en journalistiek, montage en installatie, onderwijs, onderhoud en schoonmaak, personeelszaken, productie, sales en commercie, sport en recreatie, techniek, tuinbouw, uitzend en flex, vastgoed, verzorging en welzijn, zorg

Confidence < 95%? Gebruik een passende categorie en vul custom_category in.

**VERPLICHT:**
Als company_description leeg is of alleen "Niet beschikbaar" bevat:
→ Zoek EERST naar "[bedrijfsnaam] [locatie]" voordat je iets schrijft
→ Gebruik de gevonden informatie in je personalisatie
→ Geen zoekresultaten? Schrijf dan een korte, veilige tekst gebaseerd op alleen de vacaturetitel + regio

### 4. Vergelijkbare MKB-bedrijven
Noem 2-3 vergelijkbare **MKB-bedrijven** (max ~200 medewerkers):
- Zelfde sector EN bij voorkeur zelfde regio
- GEEN multinationals of Big Four
- Kent geen specifieke namen? Beschrijf het type: "Installatiebedrijven in de regio Westland"
- Wanneer je geen specifieke naam hebt, benoem dan maar 1 type similar_company.

### 5. Regio-analyse
- Identificeer de regio op basis van company_location en job_posting_location
- Bepaal wat typerend is voor deze regio qua arbeidsmarkt
- Gebruik dit in de personalisatie

### 6. Personalisatie-alinea voor cold e-mail (BELANGRIJK)

**Doel:** Een kort, pakkend stukje tekst dat:
1. Direct herkenning creëert ("dit gaat over mij/mijn bedrijf")
2. Laat zien dat we hun markt, regio EN uitdaging snappen
3. Subtiel sociale bewijskracht geeft (vergelijkbare bedrijven in de regio)
4. Nieuwsgierigheid wekt naar onze oplossing

**Regels:**
- MAX 80 woorden (maak het persoonlijk, gebaseerd op de regio + bedrijf + vacature.
- Laat het lijken alsof je precies weet wat er speelt voor het bedrijf die je contacteert.
- Noem de REGIO als het relevant is (niet altijd forceren)
- Nederlands, informeel-professioneel (je/jullie)
- Geen vragen stellen
- Geen "Ik zag dat...", "Ik kwam jullie tegen...", "Ik wilde even..."
- Geen superlatieven (beste, geweldig, fantastisch)
- Geen CTA of verkooppraatje
- Specifiek > generiek

**TOP voorbeelden met regio:**
- "Glastuinbouwbedrijven in het Westland weten: technisch personeel groeit niet aan de bomen. Kwekerijen zoals Koppert en Priva kennen die uitdaging."
- "In de Rotterdamse haven draait alles om logistiek talent dat vroeg wil beginnen. Bedrijven als Broekman en Van der Helm snappen dat."
- "MKB-accountantskantoren in Zuid-Holland merken het: jong talent trekt naar de Randstad. Kantoren in Delft en Westland zoeken lokaler."
- "Technische bedrijven rond Drechtsteden vissen in dezelfde vijver. Bij maritieme MKB'ers zoals Heerema en IHC zien we dezelfde schaarste."

**Als je weinig info hebt:**
- Zoek ALTIJD eerst wat het bedrijf doet
- Geen info gevonden? Schrijf dan op basis van de vacature + regio, maar wees eerlijk kort
- Liever 2 zinnen die kloppen dan 4 zinnen die vaag zijn

**Voorbeeld met weinig input (alleen vacature + locatie):**
Input: Klantenservice vacature, Oosterhout
"Klantenservicemedewerkers die écht met klanten kunnen praten zijn schaars in Brabant. Zeker voor bedrijven buiten de grote steden is lokaal werven vaak effectiever dan de grote jobboards."

**Voorbeeld MET bedrijfscontext:**
Input: Albyco, Klantenservice, Oosterhout (+ kennis: B2B kantoorapparatuur)
"In de nichemarkt van kantoorapparatuur draait klantenservice om productkennis én geduld. B2B-bedrijven zoals Albyco in Oosterhout zoeken mensen die technische vragen kunnen beantwoorden zonder script."

**Kwaliteitsregel:**
- Heb je concrete bedrijfsinfo? → Personaliseer op bedrijf + sector + regio
- Alleen vacature + locatie? → Personaliseer op functiegroep + regio (korter, maar kloppend)
- Twijfel? → Korter is beter dan fake-specifiek

**BELANGRIJKE REGEL:**
Als je geen concrete bedrijfsinformatie hebt, MOET je eerst zoeken voordat je schrijft.
Schrijf NOOIT een personalisatie gebaseerd op aannames over wat een bedrijf doet.
Liever een korte, eerlijke tekst dan een langere tekst vol giswerk.

**SLECHTE voorbeelden:**
- "Ik zag dat jullie in Rotterdam zitten..." (slaapverwekkend)
- "Bedrijven in Nederland zoeken personeel..." (te generiek, geen regio)
- "Wij zijn actief in uw regio..." (over ons, niet over hen)

**OUTPUT FORMAT (JSON):**
{
  "normalized_title": "string or null - Genormaliseerde vacaturetitel",
  "normalized_company": "string - Genormaliseerde bedrijfsnaam zonder rechtsvorm",
  "company_description": "string - Wat doet dit bedrijf, max 50 woorden",
  "category": "string - Functiegroep uit de lijst hierboven",
  "custom_category": "string or null - Eigen categorie als confidence < 95%",
  "confidence": "number 0-100 - Zekerheid over classificatie",
  "similar_companies": "string - 2-3 vergelijkbare MKB-bedrijven, comma-separated",
  "similar_companies_type": "string - Type MKB-bedrijf omschrijving inclusief regio",
  "sector": "string - Genormaliseerde sector/branche",
  "region": "string - Geïdentificeerde regio (bijv. Westland, Rotterdam). Alleen regio naam, geen provincie",
  "region_insight": "string - Korte observatie over arbeidsmarkt in deze regio, max 25 woorden",
  "pain_point": "string - Belangrijkste recruitment-uitdaging in deze sector/regio, max 25 woorden",
  "personalization": "string - Cold e-mail personalisatie-alinea, max 80 woorden, geen vragen, geen CTA. GEEN similar_companies noemen!",
  "reasoning": "string - Korte uitleg classificatie"
}`

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AutomaticCampaignAssignmentService {
  private supabase = createServiceRoleClient()

  /**
   * Fetch settings from database (with fallback to defaults)
   * Note: Using 'as any' because table types will be generated after migration runs
   */
  async getSettings(): Promise<CampaignAssignmentSettings> {
    try {
      const { data, error } = await (this.supabase as any)
        .from('campaign_assignment_settings')
        .select('*')
        .limit(1)
        .single()

      if (error || !data) {
        console.log('⚠️ Using default settings (table may not exist)')
        return {
          id: 'default',
          max_total_contacts: DEFAULT_MAX_TOTAL,
          max_per_platform: DEFAULT_MAX_PER_PLATFORM,
          is_enabled: true,
          delay_between_contacts_ms: DEFAULT_DELAY_BETWEEN_CONTACTS_MS,
          updated_at: new Date().toISOString(),
          updated_by: null
        }
      }

      return data as CampaignAssignmentSettings
    } catch (error) {
      console.error('Error fetching settings:', error)
      return {
        id: 'default',
        max_total_contacts: DEFAULT_MAX_TOTAL,
        max_per_platform: DEFAULT_MAX_PER_PLATFORM,
        is_enabled: true,
        delay_between_contacts_ms: DEFAULT_DELAY_BETWEEN_CONTACTS_MS,
        updated_at: new Date().toISOString(),
        updated_by: null
      }
    }
  }

  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '')
    return `batch_${dateStr}_${timeStr}_${Math.random().toString(36).substring(2, 8)}`
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get candidate contacts for campaign assignment
   *
   * Uses an optimized RPC function that leverages:
   * 1. A materialized view (mv_campaign_eligible_companies) for pre-filtered companies
   * 2. Composite indexes for fast lookups
   * 3. A 60-second statement timeout to prevent runaway queries
   */
  async getCandidateContacts(
    maxTotal: number = DEFAULT_MAX_TOTAL,
    maxPerPlatform: number = DEFAULT_MAX_PER_PLATFORM
  ): Promise<CandidateContact[]> {
    console.log(`📋 Fetching candidate contacts (max ${maxTotal} total, ${maxPerPlatform} per platform)...`)

    try {
      // Use the optimized RPC function with materialized view
      const { data, error } = await (this.supabase as any).rpc('get_campaign_assignment_candidates', {
        p_max_total: maxTotal,
        p_max_per_platform: maxPerPlatform
      })

      if (error) {
        console.error('❌ RPC error:', error.message)

        // Check if it's a "function does not exist" error
        if (error.message?.includes('does not exist') || error.code === '42883') {
          console.log('⚠️ RPC function not found, using fallback query...')
          return this.getCandidateContactsFallback(maxTotal, maxPerPlatform)
        }

        // For other errors (timeout, etc.), try the fallback
        console.log('⚠️ RPC failed, using fallback query...')
        return this.getCandidateContactsFallback(maxTotal, maxPerPlatform)
      }

      const candidates = data || []
      console.log(`✅ Found ${candidates.length} candidate contacts via optimized RPC`)

      // Log platform distribution
      const platformCounts: Record<string, number> = {}
      for (const c of candidates) {
        platformCounts[c.platform_name] = (platformCounts[c.platform_name] || 0) + 1
      }
      console.log('📊 Platform distribution:', platformCounts)

      return candidates
    } catch (err) {
      console.error('❌ Unexpected error in getCandidateContacts:', err)
      console.log('⚠️ Falling back to direct query...')
      return this.getCandidateContactsFallback(maxTotal, maxPerPlatform)
    }
  }

  /**
   * Fallback query using Supabase client (simplified version)
   * Used when the RPC function is not available
   */
  private async getCandidateContactsFallback(
    maxTotal: number,
    maxPerPlatform: number
  ): Promise<CandidateContact[]> {
    // Get contacts whose company has a hoofddomein (single source of truth for platform assignment)
    const { data: rawContacts, error } = await this.supabase
      .from('contacts')
      .select(`
        id,
        email,
        first_name,
        last_name,
        title,
        phone,
        linkedin_url,
        company_id,
        qualification_status,
        campaign_id,
        campaign_name,
        companies!inner (
          id,
          name,
          website,
          description,
          category_size,
          pipedrive_id,
          location,
          industries,
          status,
          hoofddomein
        )
      `)
      .in('qualification_status', ['qualified', 'pending'])
      .is('campaign_id', null)
      .is('campaign_name', null)
      .not('email', 'is', null)
      .limit(maxTotal * 3) // Fetch extra to filter

    if (error) {
      console.error('❌ Error fetching contacts:', error)
      throw error
    }

    if (!rawContacts || rawContacts.length === 0) {
      return []
    }

    // Filter contacts according to rules
    const filteredContacts = rawContacts.filter((c: any) => {
      const email = c.email?.toLowerCase() || ''
      const company = c.companies

      // Email validation
      if (email.length <= 5) return false
      if (!email.includes('@') || !email.includes('.')) return false
      if (email.includes('@@')) return false
      if (email.includes('nationalevacaturebank')) return false
      if (email.includes('nationale.vacaturebank')) return false

      // Company filters
      if (!company) return false
      if (company.pipedrive_id) return false // Must NOT be in Pipedrive
      if (company.category_size === 'Groot') return false
      if (company.status !== 'Prospect') return false
      if (!company.hoofddomein) return false // Must have hoofddomein (postal code based)

      return true
    })

    // Collect unique hoofddomeinen to look up platforms in one query
    const uniqueHoofddomeinen = [...new Set(
      filteredContacts.map((c: any) => c.companies.hoofddomein).filter(Boolean)
    )]

    // Look up platforms for all hoofddomeinen at once
    const { data: platforms } = await this.supabase
      .from('platforms')
      .select('id, regio_platform, instantly_campaign_id')
      .in('regio_platform', uniqueHoofddomeinen)
      .not('instantly_campaign_id', 'is', null)

    if (!platforms || platforms.length === 0) {
      console.log('📋 No platforms with instantly_campaign_id found for hoofddomeinen')
      return []
    }

    // Create lookup map: hoofddomein → platform
    const platformMap = new Map<string, { id: string; regio_platform: string; instantly_campaign_id: string }>()
    for (const p of platforms) {
      platformMap.set(p.regio_platform, p as any)
    }

    // Build candidate list using hoofddomein → platform mapping
    const contactsWithPlatforms: CandidateContact[] = []
    const platformCounts: Record<string, number> = {}

    for (const contact of filteredContacts) {
      if (contactsWithPlatforms.length >= maxTotal) break

      const company = (contact as any).companies
      const platform = platformMap.get(company.hoofddomein)
      if (!platform) continue

      // Check platform limit
      const platformKey = platform.id
      if (!platformCounts[platformKey]) platformCounts[platformKey] = 0
      if (platformCounts[platformKey] >= maxPerPlatform) continue

      platformCounts[platformKey]++

      // Get a representative job posting for context (optional)
      let jobTitle: string | null = null
      let jobLocation: string | null = null
      if (contact.company_id) {
        const { data: jp } = await this.supabase
          .from('job_postings')
          .select('title, location')
          .eq('company_id', contact.company_id as string)
          .limit(1)
          .single()
        if (jp) {
          jobTitle = jp.title
          jobLocation = jp.location
        }
      }

      contactsWithPlatforms.push({
        id: contact.id as string,
        email: contact.email as string,
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        company_id: contact.company_id as string,
        company_name: company.name,
        company_website: company.website,
        company_description: company.description,
        company_category_size: company.category_size,
        company_pipedrive_id: company.pipedrive_id,
        company_location: company.location,
        company_industries: company.industries,
        platform_id: platform.id,
        platform_name: platform.regio_platform,
        instantly_campaign_id: platform.instantly_campaign_id,
        job_posting_title: jobTitle,
        job_posting_location: jobLocation
      })
    }

    return contactsWithPlatforms
  }

  /**
   * Get candidates grouped by platform (for orchestrator)
   */
  async getGroupedCandidatesByPlatform(
    maxTotal: number = DEFAULT_MAX_TOTAL,
    maxPerPlatform: number = DEFAULT_MAX_PER_PLATFORM
  ): Promise<Array<{ platformId: string; platformName: string; candidateCount: number }>> {
    const candidates = await this.getCandidateContacts(maxTotal, maxPerPlatform)

    const grouped = new Map<string, { platformName: string; count: number }>()
    for (const c of candidates) {
      const existing = grouped.get(c.platform_id)
      if (existing) {
        existing.count++
      } else {
        grouped.set(c.platform_id, { platformName: c.platform_name, count: 1 })
      }
    }

    return Array.from(grouped.entries()).map(([platformId, data]) => ({
      platformId,
      platformName: data.platformName,
      candidateCount: data.count
    }))
  }

  /**
   * Fetch with retry and exponential backoff
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)

        // Retry on rate limit or server errors
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          const delayMs = baseDelayMs * Math.pow(2, attempt) // Exponential backoff
          console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms (status: ${response.status})`)
          await this.delay(delayMs)
          continue
        }

        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const delayMs = baseDelayMs * Math.pow(2, attempt)
        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms (error: ${lastError.message})`)
        await this.delay(delayMs)
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  async generatePersonalization(contact: CandidateContact): Promise<PersonalizationData | null> {
    const startTime = Date.now()

    try {
      const userPrompt = `Analyseer en verrijk dit bedrijf voor onze cold e-mail campagne:

**Bedrijf:** ${contact.company_name}
**Vacature:** ${contact.job_posting_title || 'Geen specifieke vacature'}
**Website:** ${contact.company_website || 'Niet beschikbaar'}
**Bedrijfslocatie:** ${contact.company_location || 'Onbekend'}
**Vacaturelocatie:** ${contact.job_posting_location || contact.company_location || 'Onbekend'}
**Platform/Regio:** ${contact.platform_name || 'Regionaal platform'}
**Industries:** ${contact.company_industries?.join(', ') || 'Onbekend'}

Genereer de personalisatie data in JSON format.`

      const response = await this.fetchWithRetry(
        'https://api.mistral.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'mistral-medium-latest',
            messages: [
              { role: 'system', content: PERSONALIZATION_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1000,
            temperature: 0.7,
          }),
        },
        3, // maxRetries
        1000 // baseDelayMs
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Mistral API error after retries: ${response.status} - ${errorText}`)
        return null
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('❌ No content in Mistral response')
        return null
      }

      const parsed = JSON.parse(content) as PersonalizationData
      const processingTime = Date.now() - startTime

      console.log(`🤖 AI personalization generated in ${processingTime}ms for ${contact.company_name}`)

      return {
        ...parsed,
        // Ensure we have defaults for required fields
        normalized_company: parsed.normalized_company || contact.company_name,
        company_description: parsed.company_description || '',
        category: parsed.category || 'overig',
        sector: parsed.sector || 'overig',
        region: parsed.region || contact.platform_name || '',
        similar_companies: parsed.similar_companies || '',
        personalization: parsed.personalization || ''
      }
    } catch (error) {
      console.error(`❌ Error generating personalization for ${contact.company_name}:`, error)
      return null
    }
  }

  /**
   * Check if a company has "Klant" status in Pipedrive
   */
  async checkPipedriveKlantStatus(pipedriveOrgId: number): Promise<boolean> {
    try {
      const status = await pipedriveClient.getOrganizationStatusProspect(pipedriveOrgId)
      return status === KLANT_STATUS_ID
    } catch (error) {
      console.error(`❌ Error checking Pipedrive status for org ${pipedriveOrgId}:`, error)
      // On error, don't block - return false
      return false
    }
  }

  /**
   * Check if an email is blocklisted in our database or Instantly
   */
  async isEmailBlocklisted(email: string): Promise<{
    isBlocked: boolean
    source: 'database' | 'instantly' | null
    reason?: string
  }> {
    const cleanEmail = email.toLowerCase().trim()
    const supabase = createServiceRoleClient()

    try {
      // 1. Check our database first (faster)
      const { data: dbEntry } = await supabase
        .from('blocklist_entries')
        .select('id, reason, value')
        .eq('value', cleanEmail)
        .eq('type', 'email')
        .eq('is_active', true)
        .single()

      if (dbEntry) {
        return { isBlocked: true, source: 'database', reason: dbEntry.reason || undefined }
      }

      // 2. Also check the domain in our blocklist
      const domain = cleanEmail.split('@')[1]
      if (domain) {
        const { data: domainEntry } = await supabase
          .from('blocklist_entries')
          .select('id, reason, value')
          .eq('value', domain)
          .eq('type', 'domain')
          .eq('is_active', true)
          .single()

        if (domainEntry) {
          return { isBlocked: true, source: 'database', reason: domainEntry.reason || undefined }
        }
      }

      // 3. Check Instantly blocklist
      const isBlockedInInstantly = await instantlyClient.isBlocked(cleanEmail)
      if (isBlockedInInstantly) {
        return { isBlocked: true, source: 'instantly', reason: 'Found in Instantly blocklist' }
      }

      return { isBlocked: false, source: null }
    } catch (error) {
      console.warn(`⚠️ Error checking blocklist for ${cleanEmail}:`, error)
      // In case of error, don't block the process but log it
      return { isBlocked: false, source: null }
    }
  }

  /**
   * Add lead to Instantly campaign
   */
  async addToInstantly(
    contact: CandidateContact,
    personalization: PersonalizationData
  ): Promise<{ success: boolean; leadId?: string; error?: string; skipped?: boolean }> {
    try {
      const result = await instantlyClient.createLead({
        campaign: contact.instantly_campaign_id,
        email: contact.email,
        first_name: contact.first_name || undefined,
        last_name: contact.last_name || undefined,
        company_name: contact.company_name,
        website: contact.company_website || undefined,
        phone: contact.phone || undefined,
        linkedIn: contact.linkedin_url || undefined,
        company_size: contact.company_category_size || undefined,
        jobTitle: contact.title || undefined,
        personalization: personalization.personalization,
        // Geen lt_interest_status - dit wordt pas gezet na daadwerkelijke reply
        assigned_to: INSTANTLY_ASSIGNED_TO,
        skip_if_in_workspace: true,
        skip_if_in_campaign: true,
        skip_if_in_list: true,
        custom_variables: {
          company_sector: personalization.sector?.toLowerCase() || '',
          normalized_company_name: personalization.normalized_company || '',
          similar_companies: personalization.similar_companies || '',
          job_category: personalization.category?.toLowerCase() || '',
          custom_region: personalization.region || '',
          normalized_title: personalization.normalized_title || '',
          company_description: personalization.company_description || ''
        }
      })

      return result
    } catch (error) {
      console.error(`❌ Error adding ${contact.email} to Instantly:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update contact in Supabase after successful addition to Instantly
   */
  async updateContactAfterAddition(
    contactId: string,
    instantlyLeadId: string,
    campaignId: string,
    campaignName: string
  ): Promise<void> {
    await this.supabase
      .from('contacts')
      .update({
        instantly_id: instantlyLeadId,
        campaign_id: campaignId,
        campaign_name: campaignName,
        qualification_status: 'in_campaign',
        last_touch: new Date().toISOString()
      })
      .eq('id', contactId)
  }

  /**
   * Log processing result to database
   */
  async logResult(batchId: string, contact: CandidateContact, result: ProcessingResult): Promise<void> {
    await (this.supabase as any)
      .from('campaign_assignment_logs')
      .insert({
        batch_id: batchId,
        contact_id: contact.id,
        contact_email: contact.email,
        contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null,
        company_id: contact.company_id,
        company_name: contact.company_name,
        platform_id: contact.platform_id,
        platform_name: contact.platform_name,
        instantly_campaign_id: contact.instantly_campaign_id,
        status: result.status,
        skip_reason: result.skipReason || null,
        error_message: result.error || null,
        ai_personalization: result.personalization || null,
        ai_processing_time_ms: result.aiProcessingTimeMs || null,
        instantly_lead_id: result.instantlyLeadId || null,
        pipedrive_org_id: result.pipedriveOrgId || null,
        pipedrive_is_klant: result.pipedriveIsKlant || false
      })
  }

  /**
   * Create or update batch record
   */
  async updateBatch(
    batchId: string,
    status: string,
    stats: BatchStats,
    startedAt?: Date,
    completedAt?: Date,
    error?: string
  ): Promise<void> {
    const { error: upsertError } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .upsert({
        batch_id: batchId,
        status,
        total_candidates: stats.totalCandidates,
        processed: stats.processed,
        added: stats.added,
        skipped: stats.skipped,
        errors: stats.errors,
        platform_stats: stats.platformStats,
        started_at: startedAt?.toISOString(),
        completed_at: completedAt?.toISOString(),
        last_error: error || null
      }, { onConflict: 'batch_id' })

    if (upsertError) {
      console.error('❌ Error updating batch:', upsertError)
    }
  }

  /**
   * Search Pipedrive for organization by company name (exact n8n logic)
   */
  async searchPipedriveByName(companyName: string): Promise<{ found: boolean; orgId?: number; isKlant?: boolean }> {
    try {
      const results = await pipedriveClient.searchOrganization(companyName)

      if (!results || results.length === 0) {
        return { found: false }
      }

      // Get the first matching organization
      const org = results[0]
      const orgId = org.id || org.item?.id

      if (!orgId) {
        return { found: false }
      }

      // Check if this organization has "Klant" status
      const isKlant = await this.checkPipedriveKlantStatus(orgId)

      return { found: true, orgId, isKlant }
    } catch (error) {
      console.error(`❌ Error searching Pipedrive for "${companyName}":`, error)
      return { found: false }
    }
  }

  /**
   * Update company with Pipedrive info (when found via search)
   */
  async updateCompanyWithPipedrive(companyName: string, pipedriveOrgId: number): Promise<void> {
    await this.supabase
      .from('companies')
      .update({
        pipedrive_id: pipedriveOrgId.toString(),
        pipedrive_synced: true,
        pipedrive_synced_at: new Date().toISOString()
      })
      .eq('name', companyName)
  }

  /**
   * Disqualify contact on permanent error (n8n behavior)
   */
  async disqualifyContact(contactId: string): Promise<void> {
    await this.supabase
      .from('contacts')
      .update({
        qualification_status: 'disqualified'
      })
      .eq('id', contactId)
  }

  /**
   * Mark contact as already in Instantly (for duplicates)
   * This prevents re-selection in future runs
   */
  async markContactAsInInstantly(
    contactId: string,
    campaignId: string,
    platformName: string
  ): Promise<void> {
    await this.supabase
      .from('contacts')
      .update({
        campaign_id: campaignId,
        campaign_name: platformName,
        qualification_status: 'in_campaign',
        last_touch: new Date().toISOString()
      })
      .eq('id', contactId)
  }

  /**
   * Mark contact for retry on transient error (soft fail)
   * Unlike disqualification, this allows retry in future runs
   * Uses existing retry_count and processing_notes columns
   * Note: Using 'as any' because TypeScript types may be out of sync with DB schema
   */
  async markContactForRetry(contactId: string, errorMessage: string): Promise<void> {
    // Get current retry count
    const { data: contact } = await (this.supabase as any)
      .from('contacts')
      .select('retry_count, processing_notes')
      .eq('id', contactId)
      .single()

    const currentRetryCount = (contact?.retry_count as number) || 0
    const currentNotes = (contact?.processing_notes as string) || ''
    const newRetryCount = currentRetryCount + 1
    const timestamp = new Date().toISOString()

    if (newRetryCount >= 3) {
      // After 3 failures, disqualify permanently
      await (this.supabase as any)
        .from('contacts')
        .update({
          qualification_status: 'disqualified',
          retry_count: newRetryCount,
          processing_notes: `${currentNotes}\n[${timestamp}] Disqualified after ${newRetryCount} campaign failures: ${errorMessage}`.trim()
        })
        .eq('id', contactId)
      console.log(`❌ Contact disqualified after ${newRetryCount} failures`)
    } else {
      // Update retry count, keep eligible for retry
      await (this.supabase as any)
        .from('contacts')
        .update({
          retry_count: newRetryCount,
          processing_notes: `${currentNotes}\n[${timestamp}] Campaign error (${newRetryCount}/3): ${errorMessage}`.trim()
        })
        .eq('id', contactId)
      console.log(`⚠️ Contact marked for retry (attempt ${newRetryCount}/3)`)
    }
  }

  /**
   * Check if error is transient (should retry) or permanent (should disqualify)
   */
  isTransientError(error: string): boolean {
    const transientPatterns = [
      /timeout/i,
      /rate.?limit/i,
      /too.?many.?requests/i,
      /503/,
      /502/,
      /504/,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /network/i,
      /temporarily/i
    ]
    return transientPatterns.some(pattern => pattern.test(error))
  }

  /**
   * Check if error is an Instantly lead limit error (account-level limit reached)
   */
  private isLeadLimitError(errorMsg: string): boolean {
    return errorMsg.toLowerCase().includes('lead limit reached')
  }

  /**
   * Get the most recent batch that hit the lead limit (for circuit breaker)
   */
  private async getLastLeadLimitBatch(): Promise<{ batch_id: string; status: string; updated_at: string } | null> {
    const { data } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('batch_id, status, updated_at')
      .eq('status', 'lead_limit_reached')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }

  /**
   * Process a single contact (EXACT n8n workflow logic)
   *
   * n8n Flow:
   * 1. Generate AI personalization
   * 2. Search Pipedrive by company NAME
   * 3. If found: update company with pipedrive_id, check Klant status
   * 4. If Klant -> skip
   * 5. Add to Instantly
   * 6. On success: get campaign name, update contact
   * 7. On error: disqualify contact
   */
  async processContact(contact: CandidateContact, batchId: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      contactId: contact.id,
      contactEmail: contact.email,
      companyName: contact.company_name,
      platformName: contact.platform_name,
      status: 'error'
    }

    try {
      // 1. Check if campaign ID is valid
      if (!contact.instantly_campaign_id) {
        result.status = 'skipped_no_campaign'
        result.skipReason = 'No Instantly campaign ID configured for platform'
        return result
      }

      // 2. Search Pipedrive by company NAME (cheap check before AI)
      const pipedriveResult = await this.searchPipedriveByName(contact.company_name)

      if (pipedriveResult.found && pipedriveResult.orgId) {
        result.pipedriveOrgId = pipedriveResult.orgId
        result.pipedriveIsKlant = pipedriveResult.isKlant

        // Update company with pipedrive_id (like n8n "Update a row" node)
        await this.updateCompanyWithPipedrive(contact.company_name, pipedriveResult.orgId)
        console.log(`📝 Updated company "${contact.company_name}" with Pipedrive ID: ${pipedriveResult.orgId}`)

        // 3. If Klant status -> skip (like n8n filter)
        if (pipedriveResult.isKlant) {
          result.status = 'skipped_klant'
          result.skipReason = 'Company has "Klant" status in Pipedrive'
          console.log(`⏭️ Skipping ${contact.email} - company is Klant in Pipedrive`)
          return result
        }
      }

      // 4. Check if email is blocklisted (cheap check before AI)
      const blocklistCheck = await this.isEmailBlocklisted(contact.email)
      if (blocklistCheck.isBlocked) {
        result.status = 'skipped_blocklisted'
        result.skipReason = `Email is blocklisted (${blocklistCheck.source}: ${blocklistCheck.reason})`
        console.log(`🚫 Skipping ${contact.email} - blocklisted (${blocklistCheck.source})`)
        return result
      }

      // 5. Generate AI personalization (after all cheap checks pass)
      const aiStartTime = Date.now()
      const personalization = await this.generatePersonalization(contact)
      result.aiProcessingTimeMs = Date.now() - aiStartTime

      if (!personalization) {
        result.status = 'skipped_ai_error'
        result.skipReason = 'Failed to generate AI personalization'
        return result
      }

      result.personalization = personalization

      // 6. Add to Instantly
      const instantlyResult = await this.addToInstantly(contact, personalization)

      if (!instantlyResult.success) {
        result.status = 'error'
        result.error = instantlyResult.error

        // Check if error is transient (retry later) or permanent (disqualify)
        const errorMsg = instantlyResult.error || 'Unknown Instantly error'
        if (this.isTransientError(errorMsg)) {
          await this.markContactForRetry(contact.id, errorMsg)
          console.log(`⚠️ Transient error for ${contact.email}, marked for retry`)
        } else {
          await this.disqualifyContact(contact.id)
          console.log(`❌ Disqualified ${contact.email} due to permanent Instantly error`)
        }

        return result
      }

      if (instantlyResult.skipped) {
        result.status = 'skipped_duplicate'
        result.skipReason = 'Lead already exists in Instantly workspace/campaign/list'
        result.instantlyLeadId = instantlyResult.leadId

        // Mark contact as already in Instantly to prevent re-selection
        await this.markContactAsInInstantly(contact.id, contact.instantly_campaign_id, contact.platform_name)
        console.log(`⏭️ Marked ${contact.email} as already in Instantly`)

        return result
      }

      // 6. Update contact in Supabase (like n8n "Update Supabase" node)
      if (instantlyResult.leadId) {
        await this.updateContactAfterAddition(
          contact.id,
          instantlyResult.leadId,
          contact.instantly_campaign_id,
          contact.platform_name
        )
      }

      result.status = 'added'
      result.instantlyLeadId = instantlyResult.leadId
      console.log(`✅ Added ${contact.email} to ${contact.platform_name} campaign`)

      return result
    } catch (error) {
      result.status = 'error'
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      result.error = errorMsg
      console.error(`❌ Error processing ${contact.email}:`, error)

      // Check if error is transient (retry later) or permanent (disqualify)
      try {
        if (this.isTransientError(errorMsg)) {
          await this.markContactForRetry(contact.id, errorMsg)
          console.log(`⚠️ Transient error for ${contact.email}, marked for retry`)
        } else {
          await this.disqualifyContact(contact.id)
          console.log(`❌ Disqualified ${contact.email} due to permanent error`)
        }
      } catch (updateError) {
        console.error(`❌ Failed to update contact status:`, updateError)
      }

      return result
    }
  }

  /**
   * Store candidate IDs in batch for resumability
   */
  private async storeBatchCandidates(batchId: string, candidateIds: string[]): Promise<void> {
    await (this.supabase as any)
      .from('campaign_assignment_batches')
      .update({
        candidate_ids: candidateIds,
        processed_ids: []
      })
      .eq('batch_id', batchId)
  }

  /**
   * Update batch with orchestration ID (for parallel run grouping)
   */
  private async updateBatchOrchestrationId(batchId: string, orchestrationId: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .update({ orchestration_id: orchestrationId })
      .eq('batch_id', batchId)

    if (error) {
      console.error(`❌ Failed to set orchestration_id on batch ${batchId}:`, error)
    }
  }

  /**
   * Get processed IDs from batch
   */
  private async getProcessedIds(batchId: string): Promise<string[]> {
    const { data } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('processed_ids')
      .eq('batch_id', batchId)
      .single()
    return data?.processed_ids || []
  }

  /**
   * Add processed ID to batch
   */
  private async addProcessedId(batchId: string, contactId: string): Promise<void> {
    try {
      // Use Postgres array append for atomic update
      const { error } = await (this.supabase as any).rpc('append_processed_id', {
        p_batch_id: batchId,
        p_contact_id: contactId
      })

      if (error) {
        throw error
      }
    } catch {
      // Fallback if RPC doesn't exist or fails: fetch and update
      const processed = await this.getProcessedIds(batchId)
      processed.push(contactId)
      await (this.supabase as any)
        .from('campaign_assignment_batches')
        .update({ processed_ids: processed })
        .eq('batch_id', batchId)
    }
  }

  /**
   * Find an active (incomplete) batch to resume
   */
  async findActiveBatch(): Promise<{ batchId: string; candidateIds: string[]; processedIds: string[]; stats: BatchStats; startedAt: Date } | null> {
    // Only resume non-orchestrated (sequential) batches — orchestrated batches
    // belong to parallel workers and should not be resumed by the sequential cron
    const { data } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('*')
      .eq('status', 'processing')
      .is('orchestration_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data || !data.candidate_ids || data.candidate_ids.length === 0) {
      return null
    }

    return {
      batchId: data.batch_id,
      candidateIds: data.candidate_ids || [],
      processedIds: data.processed_ids || [],
      stats: {
        totalCandidates: data.total_candidates || 0,
        processed: data.processed || 0,
        added: data.added || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
        platformStats: data.platform_stats || {}
      },
      startedAt: new Date(data.started_at)
    }
  }

  /**
   * Main entry point - run daily campaign assignment
   *
   * Now supports chunked processing:
   * - If resumeBatchId is provided, continues an existing batch
   * - If an active batch exists, resumes it automatically
   * - Otherwise, starts a new batch
   * - Processes only chunkSize contacts per run (default 25)
   * - Updates batch status to 'chunk_complete' when chunk is done but more remain
   */
  async runDailyAssignment(options: {
    maxTotal?: number
    maxPerPlatform?: number
    delayBetweenContactsMs?: number
    dryRun?: boolean
    chunkSize?: number
    resumeBatchId?: string
    platformId?: string
    orchestrationId?: string
  } = {}): Promise<BatchResult> {
    const maxTotal = options.maxTotal || DEFAULT_MAX_TOTAL
    const maxPerPlatform = options.maxPerPlatform || DEFAULT_MAX_PER_PLATFORM
    const delayMs = options.delayBetweenContactsMs || DEFAULT_DELAY_BETWEEN_CONTACTS_MS
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE

    // Circuit breaker: skip run if lead limit was hit recently
    const LEAD_LIMIT_COOLDOWN_HOURS = 4
    const lastLeadLimitBatch = await this.getLastLeadLimitBatch()
    if (lastLeadLimitBatch) {
      const hoursSince = (Date.now() - new Date(lastLeadLimitBatch.updated_at).getTime()) / (1000 * 60 * 60)
      if (hoursSince < LEAD_LIMIT_COOLDOWN_HOURS) {
        console.log(`⚡ Circuit breaker: lead limit hit ${hoursSince.toFixed(1)}h ago, skipping run`)
        const now = new Date()
        return {
          batchId: `skipped_circuit_breaker_${now.toISOString()}`,
          status: 'completed',
          stats: { totalCandidates: 0, processed: 0, added: 0, skipped: 0, errors: 0, platformStats: {} },
          startedAt: now,
          completedAt: now,
          leadLimitReached: true
        }
      }
      console.log(`🔄 Circuit breaker half-open: retrying after ${hoursSince.toFixed(1)}h`)
    }

    // Check for active batch to resume (unless explicitly starting fresh)
    let batchId: string
    let stats: BatchStats
    let startedAt: Date
    let candidates: CandidateContact[] = []
    let processedIds: string[] = []
    let isResume = false

    // When platformId is set (parallel worker mode), always start a fresh batch
    // — 30 contacts fits in 300s, no need for resume complexity
    const skipResume = !!options.platformId

    // Try to find and resume an active batch
    const activeBatch = skipResume ? null : (options.resumeBatchId
      ? await this.getBatchStatus(options.resumeBatchId)
      : await this.findActiveBatch())

    if (activeBatch && activeBatch.status === 'processing' && activeBatch.candidate_ids?.length > 0) {
      // Resume existing batch
      batchId = activeBatch.batch_id || activeBatch.batchId
      stats = {
        totalCandidates: activeBatch.total_candidates || activeBatch.stats?.totalCandidates || 0,
        processed: activeBatch.processed || activeBatch.stats?.processed || 0,
        added: activeBatch.added || activeBatch.stats?.added || 0,
        skipped: activeBatch.skipped || activeBatch.stats?.skipped || 0,
        errors: activeBatch.errors || activeBatch.stats?.errors || 0,
        platformStats: activeBatch.platform_stats || activeBatch.stats?.platformStats || {}
      }
      startedAt = new Date(activeBatch.started_at || activeBatch.startedAt)
      processedIds = activeBatch.processed_ids || activeBatch.processedIds || []
      isResume = true

      console.log(`\n🔄 Resuming batch: ${batchId}`)
      console.log(`📊 Progress: ${stats.processed}/${stats.totalCandidates} processed`)

      // Get remaining candidates by fetching full candidate list and filtering
      const allCandidates = await this.getCandidateContacts(maxTotal, maxPerPlatform)
      const candidateIdSet = new Set(activeBatch.candidate_ids || [])
      const processedIdSet = new Set(processedIds)

      // Filter to only candidates in the batch that haven't been processed
      candidates = allCandidates.filter(c =>
        candidateIdSet.has(c.id) && !processedIdSet.has(c.id)
      )

      console.log(`📋 ${candidates.length} candidates remaining in this batch`)
    } else {
      // Start new batch
      batchId = this.generateBatchId()
      startedAt = new Date()
      stats = {
        totalCandidates: 0,
        processed: 0,
        added: 0,
        skipped: 0,
        errors: 0,
        platformStats: {}
      }

      console.log(`\n🚀 Starting NEW campaign assignment batch: ${batchId}`)
      console.log(`📊 Config: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayMs}ms, chunkSize=${chunkSize}, dryRun=${options.dryRun || false}`)

      // Get all candidate contacts
      candidates = await this.getCandidateContacts(maxTotal, maxPerPlatform)

      // Filter on platformId when running as parallel worker
      if (options.platformId) {
        candidates = candidates.filter(c => c.platform_id === options.platformId)
        console.log(`🎯 Filtered to platform ${options.platformId}: ${candidates.length} candidates`)
        if (candidates.length > 35) {
          console.warn(`⚠️ Platform has ${candidates.length} candidates (>35), may risk timeout`)
        }
      }

      stats.totalCandidates = candidates.length

      console.log(`📋 Found ${candidates.length} candidate contacts`)

      // Initialize batch record with all candidate IDs and optional orchestration_id
      await this.updateBatch(batchId, 'processing', stats, startedAt)
      await this.storeBatchCandidates(batchId, candidates.map(c => c.id))
      if (options.orchestrationId) {
        await this.updateBatchOrchestrationId(batchId, options.orchestrationId)
      }
    }

    // Handle empty batch
    if (candidates.length === 0) {
      console.log('ℹ️ No candidates to process')
      await this.updateBatch(batchId, 'completed', stats, startedAt, new Date())
      return {
        batchId,
        status: 'completed',
        stats,
        startedAt,
        completedAt: new Date()
      }
    }

    // When platformId is set, process all candidates in one go (max ~30, fits in 300s)
    const effectiveChunkSize = options.platformId ? candidates.length : chunkSize

    // Process only a chunk of contacts
    const chunk = candidates.slice(0, effectiveChunkSize)
    const remainingAfterChunk = candidates.length - chunk.length

    console.log(`📦 Processing chunk of ${chunk.length} contacts (${remainingAfterChunk} remaining after)`)

    try {
      // Process each contact in the chunk
      for (let i = 0; i < chunk.length; i++) {
        const contact = chunk[i]

        // Initialize platform stats
        if (!stats.platformStats[contact.platform_name]) {
          stats.platformStats[contact.platform_name] = { total: 0, added: 0, skipped: 0, errors: 0 }
        }
        stats.platformStats[contact.platform_name].total++

        if (options.dryRun) {
          console.log(`[DRY RUN] Would process: ${contact.email} (${contact.platform_name})`)
          stats.processed++
          stats.skipped++
          stats.platformStats[contact.platform_name].skipped++
          await this.addProcessedId(batchId, contact.id)
          continue
        }

        // Process contact
        const result = await this.processContact(contact, batchId)

        // Fast-fail on lead limit — stop entire batch immediately
        if (result.error && this.isLeadLimitError(result.error)) {
          const skippedCount = chunk.length - i - 1
          console.log(`⚡ Lead limit reached! Stopping batch, ${skippedCount} contacts skipped`)
          stats.processed++
          stats.errors++
          stats.platformStats[contact.platform_name].errors++
          await this.logResult(batchId, contact, result)
          await this.addProcessedId(batchId, contact.id)
          await this.updateBatch(batchId, 'lead_limit_reached', stats, startedAt, new Date(),
            'Instantly lead limit reached')
          return {
            batchId,
            status: 'completed',
            stats,
            startedAt,
            completedAt: new Date(),
            leadLimitReached: true
          }
        }

        // Update stats
        stats.processed++
        if (result.status === 'added') {
          stats.added++
          stats.platformStats[contact.platform_name].added++
        } else if (result.status === 'error') {
          stats.errors++
          stats.platformStats[contact.platform_name].errors++
        } else {
          stats.skipped++
          stats.platformStats[contact.platform_name].skipped++
        }

        // Log result
        await this.logResult(batchId, contact, result)

        // Mark contact as processed for resumability
        await this.addProcessedId(batchId, contact.id)

        // Update batch progress after EVERY contact (for live frontend updates)
        await this.updateBatch(batchId, 'processing', stats, startedAt)

        // Check if batch was cancelled
        const currentBatch = await this.getBatchStatus(batchId)
        if (currentBatch?.status === 'cancelled') {
          console.log(`⏹️ Batch ${batchId} was cancelled by user`)
          return {
            batchId,
            status: 'completed',
            stats,
            startedAt,
            completedAt: new Date()
          }
        }

        // Rate limiting
        await this.delay(delayMs)
      }

      // Determine final status
      const completedAt = new Date()
      const hasMoreToProcess = remainingAfterChunk > 0

      if (hasMoreToProcess) {
        // More contacts remain - mark as chunk_complete so it can be resumed
        await this.updateBatch(batchId, 'processing', stats, startedAt, undefined, undefined)
        console.log(`\n⏳ Chunk complete! ${stats.processed}/${stats.totalCandidates} processed, ${remainingAfterChunk} remaining`)
        console.log(`📊 Chunk results: ${stats.added} added, ${stats.skipped} skipped, ${stats.errors} errors`)
        console.log(`🔄 Batch will continue on next cron run or manual trigger`)
      } else {
        // All done
        await this.updateBatch(batchId, 'completed', stats, startedAt, completedAt)
        console.log(`\n✅ Batch ${batchId} completed!`)
        console.log(`📊 Results: ${stats.added} added, ${stats.skipped} skipped, ${stats.errors} errors`)
      }

      console.log(`⏱️ Chunk duration: ${Math.round((completedAt.getTime() - (isResume ? Date.now() - 1000 : startedAt.getTime())) / 1000)}s`)

      return {
        batchId,
        status: hasMoreToProcess ? 'completed' : 'completed', // Return completed so API returns success
        stats,
        startedAt,
        completedAt
      }
    } catch (error) {
      const completedAt = new Date()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`\n❌ Batch ${batchId} chunk failed:`, error)

      // Update batch with error but keep status as 'processing' if it was a timeout
      // so the batch can be resumed
      const isTimeout = errorMessage.toLowerCase().includes('timeout') ||
                        errorMessage.toLowerCase().includes('504') ||
                        errorMessage.toLowerCase().includes('function invocation')

      if (isTimeout) {
        // Keep processing status so batch can resume, but log the error
        await this.updateBatch(batchId, 'processing', stats, startedAt, undefined, `Chunk timeout at ${stats.processed}/${stats.totalCandidates}: ${errorMessage}`)
        console.log(`⏱️ Timeout detected - batch will resume on next run`)
      } else {
        // Real error - mark as failed
        await this.updateBatch(batchId, 'failed', stats, startedAt, completedAt, errorMessage)
      }

      return {
        batchId,
        status: 'failed',
        stats,
        startedAt,
        completedAt,
        error: errorMessage
      }
    }
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<any> {
    const { data, error } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single()

    if (error) {
      throw error
    }

    return data
  }

  /**
   * Get logs for a batch
   */
  async getBatchLogs(batchId: string): Promise<any[]> {
    const { data, error } = await (this.supabase as any)
      .from('campaign_assignment_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  }

  /**
   * Get recent batches
   */
  async getRecentBatches(limit: number = 10): Promise<any[]> {
    const { data, error } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return data || []
  }

  /**
   * Get stats for today
   */
  async getTodayStats(): Promise<{
    added: number
    skipped: number
    errors: number
    batches: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await (this.supabase as any)
      .from('campaign_assignment_batches')
      .select('added, skipped, errors')
      .gte('created_at', today.toISOString())

    if (error) {
      throw error
    }

    return {
      added: data?.reduce((sum: number, b: any) => sum + (b.added || 0), 0) || 0,
      skipped: data?.reduce((sum: number, b: any) => sum + (b.skipped || 0), 0) || 0,
      errors: data?.reduce((sum: number, b: any) => sum + (b.errors || 0), 0) || 0,
      batches: data?.length || 0
    }
  }
}

// Export singleton instance
export const automaticCampaignAssignmentService = new AutomaticCampaignAssignmentService()
