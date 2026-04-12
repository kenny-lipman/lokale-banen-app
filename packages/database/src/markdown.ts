import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

/**
 * Convert an HTML string to clean Markdown.
 * Used to transform scraped job descriptions into readable content.
 *
 * @example
 * htmlToMarkdown('<h2>Wat ga je doen?</h2><p>Je werkt als...</p>')
 * // => '## Wat ga je doen?\n\nJe werkt als...'
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return turndown.turndown(html).trim()
}
