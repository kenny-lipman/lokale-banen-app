import TurndownService from 'turndown'

let cached: TurndownService | null = null

function getService(): TurndownService {
  if (cached) return cached
  const svc = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  })
  svc.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer'])
  // svg is geen keyof HTMLElementTagNameMap → via filter-function wegwerken
  svc.remove((node) => node.nodeName === 'SVG' || node.nodeName === 'svg')
  svc.addRule('lineBreak', { filter: 'br', replacement: () => '\n' })
  cached = svc
  return svc
}

/**
 * Convert HTML → Markdown. Strip non-content tags (script/style/svg/iframe/nav/footer).
 * Returnt lege string bij falen.
 */
export function htmlToMarkdown(html: string): string {
  try {
    return getService().turndown(html)
  } catch {
    return ''
  }
}

/**
 * Truncate markdown op approximate token-count (4 chars ≈ 1 token).
 */
export function truncateForLLM(md: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (md.length <= maxChars) return md
  return md.slice(0, maxChars) + '\n\n[...TRUNCATED...]'
}

/**
 * Word-count voor pages_crawled.
 */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
