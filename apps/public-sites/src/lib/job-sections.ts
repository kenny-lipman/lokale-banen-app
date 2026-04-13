export interface JobSections {
  watGaJeDoen: string | null
  wieZoekenWe: string | null
  watBiedenWe: string | null
}

export function parseJobSections(html: string): JobSections {
  const sections: JobSections = {
    watGaJeDoen: null,
    wieZoekenWe: null,
    watBiedenWe: null,
  }

  if (!html) return sections

  const taskPatterns = [
    /wat ga je doen/i, /jouw taken/i, /functieomschrijving/i,
    /werkzaamheden/i, /jouw rol/i, /de functie/i,
  ]
  const profilePatterns = [
    /wie zoeken we/i, /jouw profiel/i, /functie-eisen/i,
    /wat vragen we/i, /jij beschikt over/i, /profiel/i,
  ]
  const offerPatterns = [
    /wat bieden we/i, /wij bieden/i, /arbeidsvoorwaarden/i,
    /wat krijg je/i, /ons aanbod/i,
  ]

  const headingRegex = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi
  const headings: { index: number; text: string }[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ index: match.index, text: match[1] })
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index
    const headingEnd = html.indexOf('>', start) + 1
    const closingTag = html.indexOf('</', headingEnd)
    const sectionStart = html.indexOf('>', closingTag) + 1
    const sectionEnd = i + 1 < headings.length ? headings[i + 1].index : html.length
    const content = html.slice(sectionStart, sectionEnd).trim()
    const headingText = headings[i].text

    if (taskPatterns.some((p) => p.test(headingText))) {
      sections.watGaJeDoen = content
    } else if (profilePatterns.some((p) => p.test(headingText))) {
      sections.wieZoekenWe = content
    } else if (offerPatterns.some((p) => p.test(headingText))) {
      sections.watBiedenWe = content
    }
  }

  return sections
}
