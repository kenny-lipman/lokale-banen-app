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

═══════════════════════════════════════════════════════════════
KRITIEKE REGEL — GEEN HALLUCINATIE
═══════════════════════════════════════════════════════════════

Je mag UITSLUITEND informatie gebruiken die LETTERLIJK in de aangeleverde brontekst staat. Dit is absoluut en non-negotiable:

- VERBODEN: generieke uitspraken zoals "wereldwijd inzetbaar", "toonaangevend", "marktleider", "hoogwaardig", "innovatief", "state-of-the-art" — tenzij deze woorden letterlijk in de brontekst voorkomen
- VERBODEN: invullen wat je denkt dat het bedrijf doet op basis van de naam of branche
- VERBODEN: aannames over bedrijfsgrootte, marktpositie, internationale aanwezigheid, technologie, klanten
- VERBODEN: eigenschappen of USP's die je niet letterlijk kunt citeren uit de brontekst
- VERBODEN: kleuren, emoties of marketing-taal toevoegen die niet in de bron staat

Als iets niet in de brontekst staat, vermeld je het niet. Beter een korte eerlijke vacature dan een langere met verzinsels.

═══════════════════════════════════════════════════════════════
BEHOUD VAN SPECIFIEKE DETAILS
═══════════════════════════════════════════════════════════════

Neem letterlijk over wat er specifiek is:
- **Merknamen en producten** (bv. "KINETIC", "ProductX v3") — NOOIT wegmoffelen of generiek maken
- **Concrete getallen** (bv. "team van maximaal tien personen", "3 jaar ervaring", "€3.200 bruto") — niet afronden of vervagen
- **Bedrijfscultuur/USP's** zoals bron ze beschrijft (bv. "warm familiebedrijf", "hecht team") — gebruik de exacte woorden waar mogelijk
- **Locatie-specifieke info** (stad, regio, werklocatie) — letterlijk overnemen
- **Certificaten en opleidingen** (bv. "VCA-Basis", "heftruckcertificaat", "Code 95") — exact overnemen, geen afkortingen veranderen

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (VERPLICHT)
═══════════════════════════════════════════════════════════════

Begin met een korte, feitelijke introductie (2-3 zinnen) die BENOEMT:
- De exacte functietitel uit de brontekst
- De bedrijfsnaam
- De locatie
- Eventueel het specifieke product/merk of de kernactiviteit (als dat in de brontekst staat)

Schrijf daarna EXACT deze drie secties met H2-headings:

## Wat ga je doen?

TAKEN EN ACTIVITEITEN van de functie. Bullet list (- item).
- Alleen werkzaamheden en verantwoordelijkheden — wat de kandidaat DOET
- GEEN eigenschappen van de kandidaat (die horen bij "Wie zoeken we?")
- GEEN info over arbeidsvoorwaarden
- GEEN info over het sollicitatieproces

## Wie zoeken we?

EIGENSCHAPPEN EN EISEN van de kandidaat. Bullet list.
- Opleiding, ervaring, vaardigheden, certificaten, persoonlijke eigenschappen
- Formuleringen zoals "Je bent flexibel" of "Je hebt ervaring met..." horen HIER
- GEEN taakomschrijvingen

## Wat bieden we?

ARBEIDSVOORWAARDEN en WAT HET BEDRIJF BIEDT. Bullet list.
- Salaris (als bekend), dienstverband, uren, vakantiedagen, pensioen, bonussen
- Secundaire arbeidsvoorwaarden (opleidingen, doorgroei, auto, laptop)
- Bedrijfscultuur-USP's die écht iets bieden aan de kandidaat (bv. "klein team van maximaal tien personen" mag hier als bron dat biedt als USP)
- VERBODEN: sollicitatieproces, kennismakingsgesprekken, contactpersonen — die horen nergens in deze secties

═══════════════════════════════════════════════════════════════
STIJL
═══════════════════════════════════════════════════════════════

- Behoud de tone-of-voice uit de brontekst (warm, zakelijk, formeel, informeel — spiegel dit)
- Schrijf in professioneel Nederlands, spreek kandidaat aan met "je/jij"
- Geen bedrijfsnaam in de heading-titels (dus niet "## Wat ga je doen bij Lacom?")
- Geen markdown H1 (#) — begin direct met de introductie
- Bullet points met "- " (dash + spatie)
- Let op spelling — controleer termen als "heftruckcertificaat", "Code 95", "VCA-Basis"

═══════════════════════════════════════════════════════════════
EXTRACTIE-VELDEN (JSON)
═══════════════════════════════════════════════════════════════
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

  // 30s timeout to avoid hanging on Mistral downtime
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let response: Response
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Mistral API timeout (30s) — probeer het later opnieuw')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mistral API fout (${response.status}): ${errorText}`)
  }

  const data: MistralResponse = await response.json()
  const rawContent = data.choices?.[0]?.message?.content

  if (!rawContent) {
    throw new Error('Leeg antwoord van Mistral API')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error(`Mistral gaf geen valide JSON: ${rawContent.substring(0, 200)}`)
  }

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
