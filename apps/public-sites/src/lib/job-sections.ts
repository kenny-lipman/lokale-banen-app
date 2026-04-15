export interface JobSections {
  watGaJeDoen: string | null
  wieZoekenWe: string | null
  watBiedenWe: string | null
  /**
   * Any content before the first recognized heading OR under a heading that
   * doesn't match the 3 known buckets. null when everything was bucketed or
   * there is no content.
   */
  overige: string | null
}

type SectionKey = keyof JobSections

const TASK_PATTERNS = [
  /wat ga je doen/i, /jouw taken/i, /functieomschrijving/i,
  /werkzaamheden/i, /jouw rol/i, /de functie/i,
]
const PROFILE_PATTERNS = [
  /wie zoeken we/i, /jouw profiel/i, /functie-eisen/i,
  /wat vragen we/i, /jij beschikt over/i, /profiel/i,
]
const OFFER_PATTERNS = [
  /wat bieden we/i, /wij bieden/i, /arbeidsvoorwaarden/i,
  /wat krijg je/i, /ons aanbod/i,
]

function classify(heading: string): SectionKey | null {
  if (TASK_PATTERNS.some((p) => p.test(heading))) return 'watGaJeDoen'
  if (PROFILE_PATTERNS.some((p) => p.test(heading))) return 'wieZoekenWe'
  if (OFFER_PATTERNS.some((p) => p.test(heading))) return 'watBiedenWe'
  return null
}

interface Heading {
  start: number    // start of the heading match (including markers)
  end: number      // end of the heading match (exclusive)
  text: string
  key: SectionKey | null
}

/**
 * Parse a job description (HTML or markdown or mixed) into the 3 well-known
 * Dutch sections. Returns null for a section if no heading matched its
 * classifier. `overige` captures any remaining content (before the first
 * classified heading, or under unclassified headings).
 */
export function parseJobSections(content: string): JobSections {
  const sections: JobSections = {
    watGaJeDoen: null,
    wieZoekenWe: null,
    watBiedenWe: null,
    overige: null,
  }

  if (!content) return sections

  // Collect both HTML h1-h4 headings and markdown ATX headings (# .. ####)
  // with their positions in the source string.
  const headings: Heading[] = []

  const htmlHeadingRegex = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi
  let htmlMatch: RegExpExecArray | null
  while ((htmlMatch = htmlHeadingRegex.exec(content)) !== null) {
    const rawText = htmlMatch[1].replace(/<[^>]+>/g, '').trim()
    headings.push({
      start: htmlMatch.index,
      end: htmlMatch.index + htmlMatch[0].length,
      text: rawText,
      key: classify(rawText),
    })
  }

  // Markdown ATX: ^#{1,4} + space + heading text (up to newline)
  // Trailing '#' characters are allowed and stripped.
  const mdHeadingRegex = /^[ \t]{0,3}(#{1,4})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm
  let mdMatch: RegExpExecArray | null
  while ((mdMatch = mdHeadingRegex.exec(content)) !== null) {
    const rawText = mdMatch[2].trim()
    headings.push({
      start: mdMatch.index,
      end: mdMatch.index + mdMatch[0].length,
      text: rawText,
      key: classify(rawText),
    })
  }

  if (headings.length === 0) {
    sections.overige = content.trim() || null
    return sections
  }

  // Sort by position in the original string so section slicing works.
  headings.sort((a, b) => a.start - b.start)

  // Everything before the first heading → overige (if non-empty).
  const preamble = content.slice(0, headings[0].start).trim()
  if (preamble) {
    sections.overige = preamble
  }

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i]
    const next = headings[i + 1]
    const sliceStart = current.end
    const sliceEnd = next ? next.start : content.length
    const body = content.slice(sliceStart, sliceEnd).trim()
    if (!body) continue

    if (current.key) {
      sections[current.key] = body
    } else {
      // Unclassified heading → append to overige with the heading preserved.
      const addition = `${content.slice(current.start, current.end).trim()}\n\n${body}`
      sections.overige = sections.overige
        ? `${sections.overige}\n\n${addition}`
        : addition
    }
  }

  return sections
}
