/**
 * AI-powered field extraction using Mistral REST API
 * Extracts contact info, salary, requirements from job descriptions
 */

import type { AiExtractedData } from "./types";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Je bent een vacature parser. Extract de volgende velden uit de vacaturetekst.

BELANGRIJK: De functietitel en bedrijfsnaam heb ik al - jij hoeft ALLEEN deze extra velden te extracten.

Antwoord ALLEEN met valid JSON in dit exacte format:
{
  "salary": "Salaris of salarisrange indien genoemd (bijv. '€3.000 - €4.000' of 'marktconform'), anders null",
  "working_hours": "Aantal uren per week indien genoemd (bijv. '40' of '32-40'), anders null",
  "requirements": ["Eis 1", "Eis 2", "Eis 3"] of null indien niet duidelijk,

  "company_website": "Website URL van het bedrijf indien genoemd (bijv. 'www.bedrijf.nl'), anders null",
  "company_phone": "Algemeen telefoonnummer van het bedrijf indien genoemd, anders null",
  "company_email": "Algemeen emailadres van het bedrijf (bijv. 'info@bedrijf.nl'), anders null",

  "contact_name": "Naam van de contactpersoon indien genoemd, anders null",
  "contact_email": "Email van de contactpersoon (indien specifiek genoemd), anders null",
  "contact_phone": "Direct telefoonnummer contactpersoon (bijv. 06-nummer), anders null",
  "contact_title": "Functie van contactpersoon (bijv. 'HR Manager', 'Recruiter'), anders null"
}

Regels:
- Geef ALLEEN valid JSON terug, geen extra tekst of uitleg
- Als een veld niet duidelijk of niet genoemd is, gebruik null
- Bij requirements: neem maximaal 5 belangrijkste eisen
- Salaris kan zijn: exact bedrag, range, of beschrijving (bijv. "marktconform", "CAO")

BELANGRIJK voor contactgegevens:
- Zoek naar telefoonnummers in formaten: 06-12345678, 071-1234567, +31 71 123 4567, 0800-1234
- Zoek naar emailadressen: info@, vacatures@, hr@, sollicitaties@, werken@, of persoonlijke emails
- Zoek naar websites: www., .nl, .com, werkenbij., /vacatures, /werken-bij
- Als een naam staat bij "Contact:", "Meer info:", "Solliciteren bij:", extract die als contact_name
- Als er een functie staat bij de contactpersoon (bijv. "Jan de Vries, HR Manager"), extract beide velden
- Let op zinnen als "bel naar", "neem contact op met", "solliciteer via"`;

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
function getEmptyResult(): AiExtractedData {
  return {
    salary: null,
    working_hours: null,
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
