/**
 * AI-powered field extraction using Mistral REST API
 */

import type { VacatureData } from "./types";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Je bent een vacature parser. Extract de volgende velden uit de PDF tekst van een Nederlandse vacature of wervingsflyer.

Antwoord ALLEEN met valid JSON in dit exacte format:
{
  "title": "De functietitel",
  "company_name": "Naam van het bedrijf",
  "location": "Volledig adres indien beschikbaar, anders null",
  "city": "Plaatsnaam",
  "salary": "Salaris of salarisrange indien genoemd, anders null",
  "description": "Korte samenvatting van de functie (max 500 karakters)",
  "requirements": ["Eis 1", "Eis 2"] of null indien niet duidelijk,
  "working_hours": "Uren per week indien genoemd, anders null",

  "company_website": "Website URL van het bedrijf (bijv. www.bedrijf.nl), null indien niet gevonden",
  "company_phone": "Telefoonnummer van het bedrijf, null indien niet gevonden",
  "company_email": "Algemeen emailadres (bijv. info@bedrijf.nl), null indien niet gevonden",

  "contact_name": "Naam van de contactpersoon indien genoemd, anders null",
  "contact_email": "Email van de contactpersoon (indien anders dan company_email), anders null",
  "contact_phone": "Direct telefoonnummer contactpersoon (indien anders dan company_phone), anders null",
  "contact_title": "Functie van contactpersoon (bijv. HR Manager, Recruiter), anders null"
}

Regels:
- Geef ALLEEN valid JSON terug, geen extra tekst
- Als een veld niet duidelijk is, gebruik null
- Bij meerdere functies in één PDF, neem de hoofdfunctie of combineer ze (bijv. "Diverse functies")
- Salaris kan zijn: exact bedrag, range (bijv. "€3.000 - €4.000"), of beschrijving (bijv. "marktconform")
- City moet een Nederlandse plaatsnaam zijn

BELANGRIJK voor wervingsflyers zonder specifieke vacature:
- Als er geen specifieke functietitel is maar wel een oproep om te solliciteren, gebruik "Diverse vacatures" of "Vacatures beschikbaar" als title
- Extract bedrijfsnaam uit: website URL (bijv. dsvleven.nl → "DSV Leven"), email domein, of genoemde organisatienaam
- Als er een website staat zoals "werkenbij.bedrijf.nl" of "bedrijf.nl/vacatures", haal de bedrijfsnaam daaruit
- Bij een algemene wervingsflyer, gebruik de slogan of kernboodschap als description
- Er moet ALTIJD een title en company_name zijn - wees creatief maar accuraat

BELANGRIJK voor bedrijfs- en contactgegevens:
- Zoek naar telefoonnummers in formaten: 071-1234567, 06-12345678, +31 71 123 4567, etc.
- Zoek naar emailadressen: info@, vacatures@, hr@, sollicitaties@, of persoonlijke emails
- Zoek naar websites: www., .nl, .com, werkenbij., /vacatures, /werken-bij
- Als een naam staat bij "Contact:", "Meer info:", "Solliciteren via:", extract die als contact_name
- Als er een functie staat bij de contactpersoon (bijv. "Jan de Vries, HR Manager"), extract beide velden`;

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Parse vacature text using Mistral AI REST API
 */
export async function parseVacatureWithAI(pdfText: string): Promise<VacatureData> {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY environment variable is not set");
  }

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
          { role: "user", content: pdfText },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as MistralResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No valid response from Mistral");
    }

    const parsed = JSON.parse(content) as VacatureData;

    // Validate required fields
    if (!parsed.title || !parsed.company_name) {
      throw new Error("Missing required fields: title or company_name");
    }

    return parsed;
  } catch (error) {
    console.error("Error parsing vacature with AI:", error);
    throw new Error(
      `AI parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
