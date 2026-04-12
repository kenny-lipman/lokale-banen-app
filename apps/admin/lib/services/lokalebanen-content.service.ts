/**
 * Lokale Banen Content Service
 * Uses Mistral AI to generate structured vacancy content for the Lokale Banen jobboard
 * AND extract missing structured fields from the description
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface LBContentSections {
  function_description: string
  function_demands: string
  company_profile: string
  interest_text: string
}

export interface ExtractedFields {
  employment: string | null
  education_level: string | null
  categories: string | null
  salary: string | null
  working_hours_min: number | null
  working_hours_max: number | null
  city: string | null
}

export interface AIGenerationResult {
  content: LBContentSections
  extracted: ExtractedFields
}

const SYSTEM_PROMPT = `Je bent een vacature content specialist voor een Nederlands jobboard. Je hebt twee taken:

**Taak 1**: Splits de vacaturetekst op in vier secties voor het jobboard.
**Taak 2**: Extraheer gestructureerde data uit de vacaturetekst.

Antwoord ALLEEN met valid JSON in dit format:
{
  "function_description": "Beschrijving van de functie en dagelijkse werkzaamheden. Gebruik HTML: <p>, <ul>, <li>.",
  "function_demands": "Functie-eisen en gevraagde competenties. Gebruik <ul><li> bulletpoints.",
  "company_profile": "Korte beschrijving van het bedrijf, cultuur en werksfeer.",
  "interest_text": "Arbeidsvoorwaarden en wat het bedrijf biedt. Gebruik <ul><li> bulletpoints.",
  "employment": "Eén van: Vast, Tijdelijk, Stage, Bijbaan, Freelance, ZZP, Vrijwilliger, Fulltime, Parttime, Interim. null als niet te bepalen.",
  "education_level": "Eén van: MBO, HBO, WO, VMBO/MAVO, HAVO, VWO, Lagere school. null als niet te bepalen.",
  "categories": "Eén van: Medisch/Zorg, Techniek, Inkoop/Logistiek/Transport, Productie/Uitvoerend, Financieel/Accounting, Commercieel/Verkoop, Administratief/Secretarieel, Horeca/Detailhandel, Automatisering/Internet, Onderwijs/Onderzoek/Wetenschap, Beveiliging/Defensie/Politie, HR/Training/Opleiding, Marketing/PR/Communicatie, Bouw, Juridisch, Design/Creatie/Journalistiek, Klantenservice/Callcenter/Receptie, Directie/Management algemeen, Consultancy/Advies, Overig. null als niet te bepalen.",
  "salary": "Exact salaris of range (bijv. '€3.000 - €4.000 per maand', 'marktconform'). null als niet genoemd.",
  "working_hours_min": "Minimum uren per week als getal (bijv. 32). null als niet genoemd.",
  "working_hours_max": "Maximum uren per week als getal (bijv. 40). null als niet genoemd of zelfde als min.",
  "city": "Standplaats/werklocatie (bijv. 'Amsterdam'). null als niet te bepalen."
}

Regels:
- Gebruik ALLEEN informatie uit de aangeleverde tekst, verzin niets bij
- Als een veld niet afleidbaar is uit de tekst, gebruik null voor extractie-velden en "" voor content-secties
- Schrijf content in professioneel Nederlands met HTML opmaak
- Bij "32-40 uur": working_hours_min=32, working_hours_max=40
- Bij "40 uur": working_hours_min=40, working_hours_max=null
- Bij dienstverband: "fulltime" of "36-40 uur" → Vast, "parttime" → Parttime, "bepaalde tijd" → Tijdelijk`

interface MistralResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Generate structured vacancy content AND extract missing fields using Mistral AI
 */
export async function generateVacancyContent(
  title: string,
  description: string,
  companyName: string,
  companyDescription?: string | null,
  missingFields?: Partial<Record<keyof ExtractedFields, boolean>>
): Promise<AIGenerationResult> {
  const apiKey = process.env.MISTRAL_API_KEY

  if (!apiKey) {
    console.warn('MISTRAL_API_KEY not set, returning empty results')
    return { content: getEmptyContent(), extracted: getEmptyExtracted() }
  }

  if (!description || description.length < 50) {
    console.warn('Description too short for AI content generation')
    return { content: getEmptyContent(), extracted: getEmptyExtracted() }
  }

  // Truncate very long descriptions to avoid token limits
  const maxChars = 8000
  const truncatedDescription = description.length > maxChars
    ? description.substring(0, maxChars) + '...'
    : description

  // Tell AI which fields to focus on extracting
  const missingHint = missingFields
    ? `\n\nLet extra op het extraheren van deze ontbrekende velden: ${Object.entries(missingFields).filter(([, v]) => v).map(([k]) => k).join(', ')}`
    : ''

  const userPrompt = `Vacaturetitel: ${title}
Bedrijf: ${companyName}
${companyDescription ? `Bedrijfsbeschrijving: ${companyDescription}\n` : ''}
Vacaturetekst:
${truncatedDescription}${missingHint}`

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Mistral API error: ${response.status} - ${errorText}`)
      return { content: getEmptyContent(), extracted: getEmptyExtracted() }
    }

    const data: MistralResponse = await response.json()
    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      console.error('Empty response from Mistral API')
      return { content: getEmptyContent(), extracted: getEmptyExtracted() }
    }

    const parsed = JSON.parse(rawContent)

    return {
      content: {
        function_description: parsed.function_description || '',
        function_demands: parsed.function_demands || '',
        company_profile: parsed.company_profile || '',
        interest_text: parsed.interest_text || '',
      },
      extracted: {
        employment: parsed.employment || null,
        education_level: parsed.education_level || null,
        categories: parsed.categories || null,
        salary: parsed.salary || null,
        working_hours_min: parsed.working_hours_min != null ? Number(parsed.working_hours_min) : null,
        working_hours_max: parsed.working_hours_max != null ? Number(parsed.working_hours_max) : null,
        city: parsed.city || null,
      },
    }
  } catch (error) {
    console.error('Error generating vacancy content:', error)
    return { content: getEmptyContent(), extracted: getEmptyExtracted() }
  }
}

function getEmptyContent(): LBContentSections {
  return {
    function_description: '',
    function_demands: '',
    company_profile: '',
    interest_text: '',
  }
}

function getEmptyExtracted(): ExtractedFields {
  return {
    employment: null,
    education_level: null,
    categories: null,
    salary: null,
    working_hours_min: null,
    working_hours_max: null,
    city: null,
  }
}
