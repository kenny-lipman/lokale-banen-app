/**
 * Lokale Banen Content Service
 * Uses Mistral AI to generate structured vacancy content for the Lokale Banen jobboard
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface LBContentSections {
  function_description: string
  function_demands: string
  company_profile: string
  interest_text: string
}

const SYSTEM_PROMPT = `Je bent een vacature content specialist voor een Nederlands jobboard. Je taak is om een vacaturetekst op te splitsen in vier secties.

Antwoord ALLEEN met valid JSON in dit format:
{
  "function_description": "Beschrijving van de functie, dagelijkse werkzaamheden en wat de rol inhoudt. Gebruik HTML opmaak met <p>, <ul>, <li> tags voor leesbaarheid.",
  "function_demands": "Functie-eisen, gevraagde competenties en kwalificaties. Gebruik <ul><li> bulletpoints.",
  "company_profile": "Korte beschrijving van het bedrijf, cultuur en werksfeer.",
  "interest_text": "Arbeidsvoorwaarden, wat het bedrijf biedt, en hoe te solliciteren. Gebruik <ul><li> bulletpoints voor voordelen."
}

Regels:
- Gebruik ALLEEN informatie uit de aangeleverde tekst, verzin niets bij
- Als een sectie niet afleidbaar is uit de tekst, geef een lege string ""
- Schrijf in professioneel Nederlands
- Gebruik HTML opmaak (<p>, <ul>, <li>, <strong>) voor goede leesbaarheid op het jobboard
- Houd elke sectie beknopt maar informatief
- De function_description is de belangrijkste sectie en mag het langst zijn`

interface MistralResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Generate structured vacancy content using Mistral AI
 */
export async function generateVacancyContent(
  title: string,
  description: string,
  companyName: string,
  companyDescription?: string | null
): Promise<LBContentSections> {
  const apiKey = process.env.MISTRAL_API_KEY

  if (!apiKey) {
    console.warn('MISTRAL_API_KEY not set, returning empty content sections')
    return getEmptyContent()
  }

  if (!description || description.length < 50) {
    console.warn('Description too short for AI content generation')
    return getEmptyContent()
  }

  // Truncate very long descriptions to avoid token limits
  const maxChars = 8000
  const truncatedDescription = description.length > maxChars
    ? description.substring(0, maxChars) + '...'
    : description

  const userPrompt = `Vacaturetitel: ${title}
Bedrijf: ${companyName}
${companyDescription ? `Bedrijfsbeschrijving: ${companyDescription}\n` : ''}
Vacaturetekst:
${truncatedDescription}`

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
      return getEmptyContent()
    }

    const data: MistralResponse = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('Empty response from Mistral API')
      return getEmptyContent()
    }

    const parsed = JSON.parse(content) as LBContentSections

    return {
      function_description: parsed.function_description || '',
      function_demands: parsed.function_demands || '',
      company_profile: parsed.company_profile || '',
      interest_text: parsed.interest_text || '',
    }
  } catch (error) {
    console.error('Error generating vacancy content:', error)
    return getEmptyContent()
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
