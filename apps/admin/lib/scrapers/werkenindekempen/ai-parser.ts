/**
 * Mistral AI-extractie voor werkenindekempen-scraper.
 *
 * Patroon: REST API direct (zoals debanensite), niet de SDK.
 *
 * Output → strict Zod-validated MistralResult schema.
 * Extra waarborgen:
 *  - regex double-check op email/phone (Mistral kan hallucineren)
 *  - empty contact (alles null) wordt genormaliseerd naar contact = null
 *  - bij Mistral API failure: return empty result, scraper continueert
 */

import {
  MistralResultSchema,
  type MistralResult,
} from "./types";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";

const SYSTEM_PROMPT = `Je extract gestructureerde data uit Nederlandse vacaturetekst.

Returnt UITSLUITEND geldige JSON volgens dit schema:
{
  "contact": {
    "first_name": string|null,
    "last_name": string|null,
    "email": string|null,
    "phone": string|null,
    "title": string|null
  } | null,
  "working_hours_min": number|null,
  "working_hours_max": number|null,
  "education_level": "MBO"|"HBO"|"WO"|"VMBO"|"HAVO"|"VWO"|"PhD"|"Geen"|"Onbekend"|null,
  "career_level": "Junior"|"Medior"|"Senior"|"Lead"|"Manager"|"Director"|"Stage"|"Onbekend"|null,
  "categories": string[]
}

Regels:
- contact: alleen invullen als een SPECIFIEKE persoon genoemd wordt (naam + functie/rol). Geen generieke "info@" of "HR-afdeling".
- email/phone: alleen als ze LETTERLIJK in de tekst staan. Niet gokken op basis van company-naam.
- phone: Nederlands format. Prefix +31 of 0. Strip spaces/dashes.
- working_hours: integer uren/week. Range "32-40" → min=32, max=40. Enkel "40 uur" → min=40, max=null.
- education_level: hoogste eis. "MBO niveau 3 of 4" → MBO. "Bachelor" → HBO. "Master" → WO. Onbekend als niets genoemd.
- career_level: leiderschapsniveau (niet jaren ervaring). "Senior" / "Manager" / "Junior" expliciet in tekst.
- categories: max 3 brede sector-tags zoals "Techniek", "Productie", "Zorg", "ICT", "Logistiek", "Horeca". NIET specifiek zoals "CNC-draaier".

Geef ALLEEN valid JSON terug, geen extra tekst, geen markdown code-blocks.`;

interface MistralResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function emptyMistralResult(): MistralResult {
  return {
    contact: null,
    working_hours_min: null,
    working_hours_max: null,
    education_level: null,
    career_level: null,
    categories: [],
  };
}

/**
 * Extract gestructureerde data uit vacature-description.
 *
 * @param plainText  Plain-text description (HTML stripped)
 */
export async function extractFromDescription(
  plainText: string
): Promise<MistralResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.warn("MISTRAL_API_KEY not set, skipping AI extraction");
    return emptyMistralResult();
  }

  if (!plainText || plainText.length < 50) return emptyMistralResult();

  const truncated = plainText.length > 8000 ? plainText.slice(0, 8000) + "..." : plainText;

  let response: Response;
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: truncated },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });
  } catch (err) {
    console.error("Mistral fetch failed:", err);
    return emptyMistralResult();
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`Mistral API ${response.status}:`, errBody.slice(0, 200));
    return emptyMistralResult();
  }

  let raw: string | undefined;
  try {
    const json = (await response.json()) as MistralResponse;
    raw = json.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("Mistral JSON parse failed:", err);
    return emptyMistralResult();
  }
  if (typeof raw !== "string") return emptyMistralResult();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Mistral output not valid JSON:", raw.slice(0, 200));
    return emptyMistralResult();
  }

  const validated = MistralResultSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn("Mistral output failed Zod-validation:", validated.error.issues);
    return emptyMistralResult();
  }

  return doubleCheck(validated.data);
}

/**
 * Regex double-check op email/phone + empty-contact normalisatie.
 * (Domain-match is informational only — laag confidence flag elders.)
 */
function doubleCheck(mr: MistralResult): MistralResult {
  if (!mr.contact) return mr;
  const c = { ...mr.contact };

  // Email regex
  if (c.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c.email)) {
    c.email = null;
  }

  // Phone regex + normalisatie
  if (c.phone) {
    const cleaned = c.phone.replace(/[\s\-()]/g, "");
    if (!/^(\+31|0)\d{8,10}$/.test(cleaned)) c.phone = null;
    else c.phone = cleaned;
  }

  // Empty contact (alles null) → contact: null
  if (!c.first_name && !c.last_name && !c.email && !c.phone && !c.title) {
    return { ...mr, contact: null };
  }

  return { ...mr, contact: c };
}
