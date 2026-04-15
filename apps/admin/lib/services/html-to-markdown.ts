import TurndownService from "turndown"

/**
 * Detecteert of een string waarschijnlijk HTML bevat (tags zoals <br>, <p>, <strong>, ...).
 * Bewust simpel gehouden: als we een enkele HTML-tag vinden, behandelen we de string als HTML.
 */
export function looksLikeHtml(input: string | null | undefined): boolean {
  if (!input) return false
  return /<[a-z][a-z0-9]*\b[^>]*>/i.test(input)
}

let cachedService: TurndownService | null = null

/**
 * Lazy-instantiate een gedeelde TurndownService. Configured voor vacature-descriptions:
 * - ATX-style headings (# H1)
 * - `-` bullets (consistent met de help-tekst in de editor)
 * - Behoudt line breaks via de BR regel
 * - Strip inline <style>/<script> zodat scraped HTML netjes converteert
 */
function getService(): TurndownService {
  if (cachedService) return cachedService

  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  })

  // Verwijder script/style tags volledig.
  service.remove(["script", "style", "noscript"])

  // Vertaal <br> naar een harde line break zodat paragrafen leesbaar blijven.
  service.addRule("lineBreak", {
    filter: "br",
    replacement: () => "\n",
  })

  cachedService = service
  return service
}

/**
 * Converteer een (mogelijk) HTML-string naar markdown. Whitespace wordt genormaliseerd
 * zodat we geen trailing spaces of 3+ opeenvolgende nieuwe regels krijgen.
 *
 * Veilige defaults:
 * - null/undefined/leeg -> ""
 * - plain tekst zonder tags -> originele string (unchanged)
 */
export function htmlToMarkdown(input: string | null | undefined): string {
  if (!input) return ""
  if (!looksLikeHtml(input)) return input

  const md = getService().turndown(input)

  return md
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
