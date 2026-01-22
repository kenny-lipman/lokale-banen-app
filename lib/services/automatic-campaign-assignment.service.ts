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
  status: 'added' | 'skipped_klant' | 'skipped_no_campaign' | 'skipped_ai_error' | 'skipped_duplicate' | 'error'
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
  status: 'completed' | 'failed'
  stats: BatchStats
  startedAt: Date
  completedAt: Date
  error?: string
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

// ============================================================================
// CONSTANTS
// ============================================================================

const KLANT_STATUS_ID = STATUS_PROSPECT_OPTIONS.KLANT // 303
const DEFAULT_MAX_TOTAL = 500
const DEFAULT_MAX_PER_PLATFORM = 30
const DEFAULT_DELAY_BETWEEN_CONTACTS_MS = 500 // n8n uses 0.5 seconds

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
   */
  async getCandidateContacts(
    maxTotal: number = DEFAULT_MAX_TOTAL,
    maxPerPlatform: number = DEFAULT_MAX_PER_PLATFORM
  ): Promise<CandidateContact[]> {
    console.log(`📋 Fetching candidate contacts (max ${maxTotal} total, ${maxPerPlatform} per platform)...`)

    // Use raw SQL for complex query with window functions
    const { data, error } = await (this.supabase as any).rpc('get_campaign_assignment_candidates', {
      p_max_total: maxTotal,
      p_max_per_platform: maxPerPlatform
    })

    if (error) {
      // If RPC doesn't exist, fall back to direct query
      console.log('⚠️ RPC not found, using direct query...')
      return this.getCandidateContactsDirect(maxTotal, maxPerPlatform)
    }

    console.log(`✅ Found ${data?.length || 0} candidate contacts`)
    return data || []
  }

  /**
   * Direct SQL query for candidate contacts (EXACT n8n query)
   *
   * This matches the "AllBanen" node SQL query from n8n exactly.
   */
  private async getCandidateContactsDirect(
    maxTotal: number,
    maxPerPlatform: number
  ): Promise<CandidateContact[]> {
    // Execute the EXACT SQL query from n8n workflow
    const { data, error } = await (this.supabase as any).rpc('exec_sql', {
      query: `
        WITH distinct_contacts AS (
          SELECT DISTINCT ON (c.id, jp.platform_id)
            c.email,
            c.id AS contact_id,
            c.first_name,
            c.last_name,
            c.title AS job_title,
            c.linkedin_url AS linkedin,
            co.category_size AS company_size,
            co.pipedrive_id AS company_pipedrive_id,
            c.phone,
            co.location AS company_location,
            co.industries AS sector,
            jp.title AS job_posting_title,
            jp.location AS job_posting_location,
            co.name AS company_name,
            co.id AS company_id,
            co.description AS company_description,
            co.website,
            p.instantly_campaign_id,
            p.id AS platform_id,
            p.regio_platform AS platform_name,
            js.name AS job_source_name,
            jp.created_at
          FROM
            contacts c
            INNER JOIN companies co ON c.company_id = co.id
            INNER JOIN job_postings jp ON co.id = jp.company_id
            LEFT JOIN platforms p ON jp.platform_id = p.id
            LEFT JOIN job_sources js ON jp.source_id = js.id
          WHERE
            jp.platform_id IS NOT NULL
            AND p.instantly_campaign_id IS NOT NULL
            AND co.pipedrive_id IS NULL
            AND c.email IS NOT NULL
            AND c.qualification_status IN ('qualified', 'pending')
            AND c.email LIKE '%@%.%'
            AND c.email NOT ILIKE '%nationalevacaturebank%'
            AND c.email NOT ILIKE '%nationale.vacaturebank%'
            AND LENGTH(c.email) > 5
            AND c.email NOT LIKE '%@%@%'
            AND (co.category_size IS NULL OR co.category_size != 'Groot')
            AND co.status = 'Prospect'
            AND c.campaign_id IS NULL
            AND c.campaign_name IS NULL
            AND jp.source_id != '${EXCLUDED_SOURCE_ID}'
            AND co.id IN (
              SELECT company_id
              FROM job_postings
              WHERE platform_id IS NOT NULL
              GROUP BY company_id
              HAVING COUNT(*) <= 20
            )
            AND co.id NOT IN (
              SELECT company_id
              FROM contacts
              WHERE company_id IS NOT NULL
              GROUP BY company_id
              HAVING COUNT(*) >= 5
            )
          ORDER BY c.id, jp.platform_id, jp.created_at DESC
        ),
        ranked_contacts AS (
          SELECT
            *,
            ROW_NUMBER() OVER (PARTITION BY platform_id ORDER BY contact_id) as rn
          FROM distinct_contacts
        )
        SELECT
          email,
          contact_id AS id,
          first_name,
          last_name,
          job_title AS title,
          linkedin AS linkedin_url,
          company_size AS company_category_size,
          company_pipedrive_id,
          phone,
          company_location,
          sector AS company_industries,
          job_posting_title,
          job_posting_location,
          company_name,
          company_id,
          company_description,
          website AS company_website,
          instantly_campaign_id,
          platform_id,
          platform_name
        FROM ranked_contacts
        WHERE rn <= ${maxPerPlatform}
        ORDER BY platform_id, rn
        LIMIT ${maxTotal}
      `
    })

    if (error) {
      console.log('⚠️ exec_sql RPC not available, using fallback query...')
      return this.getCandidateContactsFallback(maxTotal, maxPerPlatform)
    }

    // Map the result to CandidateContact interface
    return (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      title: row.title,
      phone: row.phone,
      linkedin_url: row.linkedin_url,
      company_id: row.company_id,
      company_name: row.company_name,
      company_website: row.company_website,
      company_description: row.company_description,
      company_category_size: row.company_category_size,
      company_pipedrive_id: row.company_pipedrive_id,
      company_location: row.company_location,
      company_industries: row.company_industries,
      platform_id: row.platform_id,
      platform_name: row.platform_name,
      instantly_campaign_id: row.instantly_campaign_id,
      job_posting_title: row.job_posting_title,
      job_posting_location: row.job_posting_location
    }))
  }

  /**
   * Fallback query using Supabase client (simplified version)
   */
  private async getCandidateContactsFallback(
    maxTotal: number,
    maxPerPlatform: number
  ): Promise<CandidateContact[]> {
    // First, get contacts with all required joins
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
          status
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

    // Filter contacts according to n8n rules
    const filteredContacts = rawContacts.filter((c: any) => {
      const email = c.email?.toLowerCase() || ''
      const company = c.companies

      // Email validation (from n8n)
      if (email.length <= 5) return false
      if (!email.includes('@') || !email.includes('.')) return false
      if (email.includes('@@')) return false
      if (email.includes('nationalevacaturebank')) return false
      if (email.includes('nationale.vacaturebank')) return false

      // Company filters (from n8n)
      if (!company) return false
      if (company.pipedrive_id) return false // Must NOT be in Pipedrive
      if (company.category_size === 'Groot') return false
      if (company.status !== 'Prospect') return false

      return true
    })

    // Get platform info for each contact via job_postings
    const contactsWithPlatforms: CandidateContact[] = []
    const platformCounts: Record<string, number> = {}

    for (const contact of filteredContacts) {
      if (contactsWithPlatforms.length >= maxTotal) break

      // Get platform from job_postings with n8n filters
      const { data: jobPostings } = await this.supabase
        .from('job_postings')
        .select(`
          title,
          location,
          zipcode,
          platform_id,
          source_id,
          platforms!inner (
            id,
            regio_platform,
            instantly_campaign_id
          )
        `)
        .eq('company_id', contact.company_id as string)
        .not('platform_id', 'is', null)
        .neq('source_id', EXCLUDED_SOURCE_ID)
        .limit(1)

      if (!jobPostings || jobPostings.length === 0) continue

      const jp = jobPostings[0] as any
      const platform = jp.platforms

      if (!platform?.instantly_campaign_id) continue

      // Check platform limit (max 30 per platform like n8n)
      const platformKey = platform.id
      if (!platformCounts[platformKey]) platformCounts[platformKey] = 0
      if (platformCounts[platformKey] >= maxPerPlatform) continue

      platformCounts[platformKey]++

      contactsWithPlatforms.push({
        id: contact.id as string,
        email: contact.email as string,
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        company_id: contact.company_id as string,
        company_name: contact.companies.name,
        company_website: contact.companies.website,
        company_description: contact.companies.description,
        company_category_size: contact.companies.category_size,
        company_pipedrive_id: contact.companies.pipedrive_id,
        company_location: contact.companies.location,
        company_industries: contact.companies.industries,
        platform_id: platform.id,
        platform_name: platform.regio_platform,
        instantly_campaign_id: platform.instantly_campaign_id,
        job_posting_title: jp.title,
        job_posting_location: jp.location
      })
    }

    return contactsWithPlatforms
  }

  /**
   * Generate AI personalization using Mistral
   */
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

      // 2. Generate AI personalization FIRST (like n8n)
      const aiStartTime = Date.now()
      const personalization = await this.generatePersonalization(contact)
      result.aiProcessingTimeMs = Date.now() - aiStartTime

      if (!personalization) {
        result.status = 'skipped_ai_error'
        result.skipReason = 'Failed to generate AI personalization'
        // n8n continues to next item on AI error, doesn't disqualify
        return result
      }

      result.personalization = personalization

      // 3. Search Pipedrive by company NAME (n8n logic)
      // This is different from just checking if pipedrive_id exists
      const pipedriveResult = await this.searchPipedriveByName(contact.company_name)

      if (pipedriveResult.found && pipedriveResult.orgId) {
        result.pipedriveOrgId = pipedriveResult.orgId
        result.pipedriveIsKlant = pipedriveResult.isKlant

        // Update company with pipedrive_id (like n8n "Update a row" node)
        await this.updateCompanyWithPipedrive(contact.company_name, pipedriveResult.orgId)
        console.log(`📝 Updated company "${contact.company_name}" with Pipedrive ID: ${pipedriveResult.orgId}`)

        // 4. If Klant status -> skip (like n8n filter)
        if (pipedriveResult.isKlant) {
          result.status = 'skipped_klant'
          result.skipReason = 'Company has "Klant" status in Pipedrive'
          console.log(`⏭️ Skipping ${contact.email} - company is Klant in Pipedrive`)
          return result
        }
      }

      // 5. Add to Instantly
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
   * Main entry point - run daily campaign assignment
   */
  async runDailyAssignment(options: {
    maxTotal?: number
    maxPerPlatform?: number
    delayBetweenContactsMs?: number
    dryRun?: boolean
  } = {}): Promise<BatchResult> {
    const batchId = this.generateBatchId()
    const startedAt = new Date()
    const maxTotal = options.maxTotal || DEFAULT_MAX_TOTAL
    const maxPerPlatform = options.maxPerPlatform || DEFAULT_MAX_PER_PLATFORM
    const delayMs = options.delayBetweenContactsMs || DEFAULT_DELAY_BETWEEN_CONTACTS_MS

    console.log(`\n🚀 Starting campaign assignment batch: ${batchId}`)
    console.log(`📊 Config: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayMs}ms, dryRun=${options.dryRun || false}`)

    const stats: BatchStats = {
      totalCandidates: 0,
      processed: 0,
      added: 0,
      skipped: 0,
      errors: 0,
      platformStats: {}
    }

    try {
      // 1. Get candidate contacts
      const candidates = await this.getCandidateContacts(maxTotal, maxPerPlatform)
      stats.totalCandidates = candidates.length

      console.log(`📋 Found ${candidates.length} candidate contacts`)

      // Initialize batch record
      await this.updateBatch(batchId, 'processing', stats, startedAt)

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

      // 2. Process each contact
      for (const contact of candidates) {
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
          continue
        }

        // Process contact
        const result = await this.processContact(contact, batchId)

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

      // 3. Finalize batch
      const completedAt = new Date()
      await this.updateBatch(batchId, 'completed', stats, startedAt, completedAt)

      console.log(`\n✅ Batch ${batchId} completed!`)
      console.log(`📊 Results: ${stats.added} added, ${stats.skipped} skipped, ${stats.errors} errors`)
      console.log(`⏱️ Duration: ${Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)}s`)

      return {
        batchId,
        status: 'completed',
        stats,
        startedAt,
        completedAt
      }
    } catch (error) {
      const completedAt = new Date()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`\n❌ Batch ${batchId} failed:`, error)
      await this.updateBatch(batchId, 'failed', stats, startedAt, completedAt, errorMessage)

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
