/**
 * AI-powered field extraction using Mistral REST API
 * Extracts contact info, salary, requirements from job descriptions
 */

import type { AiExtractedData } from "./types";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Je bent een vacature data extractor. Extract contact- en bedrijfsinformatie.

BELANGRIJK: Titel en bedrijfsnaam heb ik al. Jij extract ALLEEN:

{
  "salary": "Exact salaris of range (bijv. '€3.000 - €4.000', 'marktconform'), null als niet genoemd",
  "working_hours": "Minimum uren per week als getal (bijv. 32), null als niet genoemd",
  "working_hours_max": "Maximum uren per week als getal (bijv. 40), null als niet genoemd of zelfde als min",
  "requirements": ["Eis 1", "Eis 2"] of null (max 5 eisen),

  "company_website": "Website URL (bijv. 'www.bedrijf.nl'), null als niet genoemd",
  "company_phone": "Algemeen telefoonnummer bedrijf, null als niet genoemd",
  "company_email": "Algemeen email (info@, sollicitaties@), null als niet genoemd",

  "contact_name": "Volledige naam contactpersoon, null als niet genoemd",
  "contact_email": "Persoonlijk email contactpersoon, null als niet genoemd",
  "contact_phone": "Direct telefoon contactpersoon (vaak 06-nummer), null als niet genoemd",
  "contact_title": "Functietitel contactpersoon (HR Manager, Recruiter), null als niet genoemd"
}

Regels:
- ALLEEN valid JSON teruggeven, geen extra tekst
- null gebruiken als niet duidelijk of niet genoemd
- Telefoonnummers: 06-12345678, 088-1234567, +31 6 12345678, 0800-1234
- Emails: zoek naar @ symbool
- Websites: www., .nl, .com, werkenbij., /vacatures
- Bij "32-40 uur": working_hours=32, working_hours_max=40
- Bij "40 uur": working_hours=40, working_hours_max=null
- Bij contact zinnen als "bel naar", "neem contact op met", extract de gegevens`;

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Default empty result when AI parsing fails or is skipped
 */
export function getEmptyResult(): AiExtractedData {
  return {
    salary: null,
    working_hours: null,
    working_hours_max: null,
    requirements: null,
    company_website: null,
    company_phone: null,
    company_email: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    contact_title: null,
  };
}

/**
 * Parse job description using Mistral AI REST API
 */
export async function extractDataWithAI(descriptionText: string): Promise<AiExtractedData> {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    console.warn("MISTRAL_API_KEY not set, skipping AI extraction");
    return getEmptyResult();
  }

  // Skip if description is too short
  if (!descriptionText || descriptionText.length < 50) {
    return getEmptyResult();
  }

  // Truncate very long descriptions to save tokens
  const truncatedText =
    descriptionText.length > 4000 ? descriptionText.substring(0, 4000) + "..." : descriptionText;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: truncatedText },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mistral API error: ${response.status} - ${errorText}`);
      return getEmptyResult();
    }

    const data = (await response.json()) as MistralResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No valid response from Mistral");
      return getEmptyResult();
    }

    const parsed = JSON.parse(content) as AiExtractedData;

    // Validate and clean the result
    return {
      salary: parsed.salary || null,
      working_hours: parsed.working_hours || null,
      working_hours_max: parsed.working_hours_max || null,
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : null,
      company_website: parsed.company_website || null,
      company_phone: parsed.company_phone || null,
      company_email: parsed.company_email || null,
      contact_name: parsed.contact_name || null,
      contact_email: parsed.contact_email || null,
      contact_phone: parsed.contact_phone || null,
      contact_title: parsed.contact_title || null,
    };
  } catch (error) {
    console.error("Error extracting data with AI:", error);
    return getEmptyResult();
  }
}
