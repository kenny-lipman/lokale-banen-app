/**
 * Versioned prompt voor WebsiteService.crawlAndParse → Mistral JSON-mode.
 * Sectie 7.1 spec. Plek in `{markdown_per_page}` wordt vervangen door de
 * gecombineerde markdown van max 7 pagina's (truncated op 30k tokens).
 */
export const WEBSITE_EXTRACTION_PROMPT_V1 = `Je bent een data-extractor voor B2B sales lead-verrijking. Je krijgt de markdown-versie
van pagina's van een Nederlandse bedrijfswebsite. Extracteer feitelijke data.

Pagina's:
<<<
{markdown_per_page}
>>>

Geef ALLEEN geldig JSON terug, geen prose:
{
  "company_name": string|null,
  "description_short": string|null,
  "address": { "street": string|null, "number": string|null, "postcode": string|null, "city": string|null } | null,
  "phones": string[],
  "emails": string[],
  "kvk_number": string|null,
  "social_media": { "linkedin": string|null, "instagram": string|null, "tiktok": string|null, "facebook": string|null, "twitter": string|null } | null,
  "contacts": [{
    "name": string,
    "title": string|null,
    "email": string|null,
    "phone": string|null,
    "linkedin_url": string|null,
    "department_guess": "executive"|"human_resources"|"operations"|"sales"|"marketing"|"other"|null,
    "source_page": string
  }],
  "vacancies": [{ "title": string, "url": string|null, "location": string|null }],
  "blog_post_count": number|null,
  "blog_last_post_date": string|null,
  "career_page_urls": string[]
}

REGELS:
- Verzin niets — alleen wat letterlijk in de pagina's staat
- Voor /over-ons of /team: extract iedereen met naam+functie, ook stagiairs
- Voor /werkenbij of /vacatures: extract alle vacaturetitels + URLs
- Mobiele telefoon (06): zet in phone als duidelijk persoonlijk; anders bedrijfs-vast
- Emails: alleen geldige formaten, geen "info@example.com"-placeholders
- contacts: bij voorkeur records met een echte voor- en/of achternaam.
  Als de pagina ALLEEN generieke contactgegevens heeft (info@, algemeen
  telefoonnummer) zonder bijbehorende persoonsnaam, gebruik dan
  letterlijk name "Afdeling Personeelszaken" — NIET fabriceren met
  varianten als "Niet gespecificeerd", "Niet vermeld", "Niet expliciet
  genoemd", "Onbekend", "Info", "Contact". Behoud de email en telefoon
  bij het Afdeling Personeelszaken-record zodat user de naam later kan
  editen.

career_page_urls:
- ALLE absolute URLs (https://...) op de pagina's die linken naar een werken-bij/vacatures sectie
- Vooral checken: navigatie-menu's, footer-links, hero-CTAs, "join us"/"hiring"/"recruitment" buttons
- Inclusief externe ATS-platforms (recruitee.com, greenhouse.io, lever.co, workable.com, teamtailor.com, personio.com)
- Inclusief subdomain-careers (careers.x.com, werkenbij.x.nl, jobs.x.com)
- Lege array [] als er geen werken-bij/vacatures-link op de pagina's staat
`
