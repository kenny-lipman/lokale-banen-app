/**
 * Vacancy AI Rewrite Service
 *
 * Herschrijft rauwe gescrapete vacature-descriptions naar gestructureerde
 * markdown in het format van de Lokale Banen public sites:
 *
 *   ## Wat ga je doen?
 *   ## Wie zoeken we?
 *   ## Wat bieden we?
 *
 * Extraheert ook ontbrekende metadata (salary, employment, education, hours).
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface RewriteExtractedFields {
  employment: string | null
  education_level: string | null
  categories: string | null
  salary: string | null
  working_hours_min: number | null
  working_hours_max: number | null
  seo_title: string | null
  seo_description: string | null
}

export interface AIRewriteResult {
  content_md: string
  extracted: RewriteExtractedFields
}

const SYSTEM_PROMPT = `Je bent een vacature-redacteur voor Nederlandse regionale jobboards (Lokale Banen netwerk).

**Jouw taak:** Herschrijf de aangeleverde vacaturetekst naar een professionele, gestructureerde vacature in Markdown.

**Output format (verplicht):**

Begin met een korte, wervende introductie (2-3 zinnen) over de functie bij het bedrijf en de locatie.

Schrijf daarna EXACT deze drie secties met H2-headings:

## Wat ga je doen?

Beschrijf de taken en verantwoordelijkheden. Gebruik een bullet list (- item).

## Wie zoeken we?

Beschrijf het gevraagde profiel, eisen en competenties. Gebruik een bullet list.

## Wat bieden we?

Beschrijf de arbeidsvoorwaarden en wat het bedrijf biedt. Gebruik een bullet list. Noem salaris als dat bekend is.

**Regels:**
- Gebruik ALLEEN informatie uit de aangeleverde tekst — verzin NIETS bij
- Als er weinig info is voor een sectie, schrijf dan wat er beschikbaar is (minimaal 2 bullets)
- Schrijf in professioneel, wervend Nederlands — spreek de kandidaat aan met "je/jij"
- Geen bedrijfsnaam in de heading-titels
- Geen markdown H1 (#) gebruiken — begin direct met de introductie
- Bullet points met "- " (dash + spatie)

**Extractie-velden (JSON):**
Naast de markdown, extraheer ook deze gestructureerde velden uit de tekst. Geef null als niet afleidbaar.

- employment: Eén van: Vast, Tijdelijk, Parttime, Stage, Bijbaan, Freelance, Vrijwilliger. "fulltime" of "36-40 uur" → Vast.
- education_level: Eén van: VMBO/MAVO, MBO, HBO, WO, HAVO, VWO.
- categories: Eén van: Medisch/Zorg, Techniek, Inkoop/Logistiek/Transport, Productie/Uitvoerend, Financieel/Accounting, Commercieel/Verkoop, Administratief/Secretarieel, Horeca/Detailhandel, Automatisering/Internet, Onderwijs/Onderzoek/Wetenschap, Beveiliging/Defensie/Politie, HR/Training/Opleiding, Marketing/PR/Communicatie, Bouw, Juridisch, Design/Creatie/Journalistiek, Klantenservice/Callcenter/Receptie, Directie/Management, Consultancy/Advies, Overig.
- salary: Exact salaris of range als tekst (bijv. "€3.000 – €4.000 per maand"). null als niet genoemd.
- working_hours_min: Minimum uren per week als getal. null als niet genoemd.
- working_hours_max: Maximum uren per week als getal. null als niet genoemd.
- seo_title: SEO-titel max 60 tekens: "{Functietitel} bij {Bedrijf} in {Stad}".
- seo_description: SEO-beschrijving max 155 tekens, wervend, met kerninfo.

**Antwoord ALLEEN met valid JSON:**
{
  "content_md": "De volledige markdown tekst hier...",
  "employment": "...",
  "education_level": "...",
  "categories": "...",
  "salary": "...",
  "working_hours_min": null,
  "working_hours_max": null,
  "seo_title": "...",
  "seo_description": "..."
}`

interface MistralResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Herschrijf een vacature naar gestructureerde markdown + extraheer metadata.
 */
export async function rewriteVacancy(params: {
  title: string
  description: string
  companyName: string
  city?: string | null
  salary?: string | null
  employment?: string | null
  education_level?: string | null
  working_hours_min?: number | null
  working_hours_max?: number | null
}): Promise<AIRewriteResult> {
  const apiKey = process.env.MISTRAL_API_KEY

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is niet geconfigureerd')
  }

  if (!params.description || params.description.length < 30) {
    throw new Error('Vacaturetekst is te kort om te herschrijven (minimaal 30 tekens)')
  }

  // Strip HTML tags for cleaner AI input
  const cleanDescription = params.description
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate to avoid token limits
  const maxChars = 8000
  const truncated = cleanDescription.length > maxChars
    ? cleanDescription.substring(0, maxChars) + '...'
    : cleanDescription

  // Build context hints for AI
  const contextParts: string[] = []
  if (params.city) contextParts.push(`Locatie: ${params.city}`)
  if (params.salary) contextParts.push(`Salaris: ${params.salary}`)
  if (params.employment) contextParts.push(`Dienstverband: ${params.employment}`)
  if (params.education_level) contextParts.push(`Opleidingsniveau: ${params.education_level}`)
  if (params.working_hours_min || params.working_hours_max) {
    const hours = [params.working_hours_min, params.working_hours_max].filter(Boolean).join('-')
    contextParts.push(`Uren: ${hours} per week`)
  }

  const contextBlock = contextParts.length > 0
    ? `\n\nBekende metadata:\n${contextParts.join('\n')}`
    : ''

  const userPrompt = `Vacaturetitel: ${params.title}
Bedrijf: ${params.companyName}
${contextBlock}

Vacaturetekst:
${truncated}`

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
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mistral API fout (${response.status}): ${errorText}`)
  }

  const data: MistralResponse = await response.json()
  const rawContent = data.choices?.[0]?.message?.content

  if (!rawContent) {
    throw new Error('Leeg antwoord van Mistral API')
  }

  const parsed = JSON.parse(rawContent)

  if (!parsed.content_md || typeof parsed.content_md !== 'string') {
    throw new Error('AI response bevat geen content_md veld')
  }

  return {
    content_md: parsed.content_md.trim(),
    extracted: {
      employment: parsed.employment || null,
      education_level: parsed.education_level || null,
      categories: parsed.categories || null,
      salary: parsed.salary || null,
      working_hours_min: parsed.working_hours_min != null ? Number(parsed.working_hours_min) : null,
      working_hours_max: parsed.working_hours_max != null ? Number(parsed.working_hours_max) : null,
      seo_title: parsed.seo_title || null,
      seo_description: parsed.seo_description || null,
    },
  }
}
