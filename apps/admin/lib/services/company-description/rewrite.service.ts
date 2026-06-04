/**
 * Company Description AI Rewrite Service
 *
 * Schrijft een korte, feitelijke "over ons"-omschrijving van een BEDRIJF op basis
 * van aangeleverde bron-tekst (website-content + vacaturetitels). Strikt anti-
 * hallucinatie: gebruikt alleen wat letterlijk in de bron staat.
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface CompanyRewriteResult {
  description: string
}

const SYSTEM_PROMPT = `Je bent een redacteur voor Nederlandse regionale jobboards (Lokale Banen netwerk).

Jouw taak: schrijf een korte, feitelijke "over ons"-omschrijving van het BEDRIJF op basis van de aangeleverde bron.

KRITIEKE REGEL - GEEN HALLUCINATIE
Gebruik UITSLUITEND informatie die letterlijk in de aangeleverde bron staat.
- VERBODEN: superlatieven zoals "toonaangevend", "marktleider", "innovatief", "hoogwaardig" tenzij ze letterlijk in de bron staan
- VERBODEN: aannames over bedrijfsgrootte, marktpositie of internationale aanwezigheid
- VERBODEN: invullen op basis van de bedrijfsnaam of de branche
Als de bron te weinig feitelijke bedrijfsinfo bevat, schrijf dan een korte eerlijke omschrijving in plaats van verzinsels.

ONDERWERP
Beschrijf het BEDRIJF (wat het doet, waar het zit, voor wie), NIET een specifieke vacature. Neem geen vacature-eisen, salarissen of sollicitatieprocedures over.

OUTPUT
- 2 tot 4 zinnen, maximaal ongeveer 600 tekens
- Platte tekst, geen koppen, geen bullet-lists
- Professioneel Nederlands, derde persoon (het bedrijf), niet "jij/je"

Antwoord ALLEEN met valid JSON:
{ "description": "..." }`

interface MistralResponse {
  choices: Array<{ message: { content: string } }>
}

export async function rewriteCompanyDescription(params: {
  name: string
  city: string | null
  sourceText: string
}): Promise<CompanyRewriteResult> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is niet geconfigureerd')
  }

  const source = (params.sourceText ?? '').trim()
  if (source.length < 30) {
    throw new Error('Brontekst is te kort om te herschrijven (minimaal 30 tekens)')
  }

  // Truncate om token-limieten te vermijden
  const maxChars = 8000
  const truncated = source.length > maxChars ? source.substring(0, maxChars) + '...' : source

  const userPrompt = `Bedrijf: ${params.name}${params.city ? `\nLocatie: ${params.city}` : ''}

Bron:
${truncated}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let response: Response
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Mistral API timeout (30s) - probeer het later opnieuw')
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

  if (!parsed.description || typeof parsed.description !== 'string') {
    throw new Error('AI response bevat geen description veld')
  }

  return { description: (parsed.description as string).trim() }
}
