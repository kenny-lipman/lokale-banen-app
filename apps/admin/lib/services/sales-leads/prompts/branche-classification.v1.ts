/**
 * Versioned prompt voor MistralService.classifyBranche → JSON-mode.
 * Classificeert een bedrijf in 1 van de actieve Pipedrive branche-opties
 * (uit `pipedrive_branche_options` table). Placeholders:
 * {company_name}, {industry}, {sbi_activities}, {description}, {vacancies},
 * {available_branches}.
 */
export const BRANCHE_CLASSIFICATION_PROMPT_V1 = `Je bent een B2B sales-analyst voor Nederlands jobmarketing-bureau WeTarget.

TAAK: classificeer het onderstaande bedrijf in EXACT 1 van de beschikbare branche-opties.

BEDRIJFSGEGEVENS:
- Naam: {company_name}
- Apollo industry-tag: {industry}
- KvK SBI-activiteiten: {sbi_activities}
- Beschrijving: {description}
- Vacatures (een hint voor de kernactiviteit): {vacancies}

BESCHIKBARE BRANCHE-OPTIES (kies enum_id uit deze lijst):
{available_branches}

REGELS:
1. Kies de branche die de KERNACTIVITEIT van het bedrijf het beste dekt.
2. Bij twijfel tussen 2 opties: kies de meest specifieke (Sierteelt boven Voedselbranche, Techniek boven Industrie).
3. Als geen optie echt past, kies de breedst-passende (vaak "Zakelijke en persoonlijke dienstverlening").
4. confidence is 0-100. Hoog (>=80) als het overduidelijk is, midden (40-79) als beredeneerd, laag (<40) bij giswerk.
5. reasoning is maximaal 1 zin met de doorslag-gevende factor.

Geef ALLEEN JSON terug:
{
  "enum_id": number,
  "confidence": 0-100,
  "reasoning": "1-zin reden"
}
`
