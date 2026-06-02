import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseStructuredDetail,
  extractVacancyDetailFromHtml,
} from '@/lib/services/sales-leads/vacancy-detail/extract'

const JSON_LD_HTML = `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Koeltechnisch Monteur',
  datePosted: '2026-05-20',
  validThrough: '2026-07-01',
  employmentType: ['FULL_TIME', 'PART_TIME'],
  description: '<p>Wij zoeken een ervaren koeltechnisch monteur met MBO-niveau.</p>',
  hiringOrganization: { '@type': 'Organization', name: 'Wehako' },
  jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Maasdijk' } },
  baseSalary: {
    '@type': 'MonetaryAmount',
    currency: 'EUR',
    value: { '@type': 'QuantitativeValue', minValue: 3000, maxValue: 4000, unitText: 'MONTH' },
  },
})}</script></head><body><h1>Vacature</h1></body></html>`

const PLAIN_HTML = `<!doctype html><html><head><title>Vacature</title></head><body>
<h1>Allround Medewerker</h1>
<p>Een veelzijdige functie binnen ons team. Geen JSON-LD aanwezig op deze pagina.</p>
</body></html>`

describe('parseStructuredDetail', () => {
  it('extraheert salaris/dienstverband/datum uit JSON-LD JobPosting', () => {
    const { fields, descriptionText } = parseStructuredDetail(JSON_LD_HTML, 'https://x.nl/vac/1')
    expect(fields.salary).toContain('3.000')
    expect(fields.salary).toContain('4.000')
    expect(fields.salary).toContain('per maand')
    expect(fields.employment).toBe('Fulltime/Parttime')
    expect(fields.job_type).toEqual(['Fulltime', 'Parttime'])
    expect(fields.published_at).toMatch(/^2026-05-20T00:00:00/)
    expect(fields.end_date).toBe('2026-07-01')
    expect(fields.description).toContain('koeltechnisch monteur')
    expect(descriptionText).toContain('koeltechnisch monteur')
  })

  it('valt terug op page-markdown als er geen JSON-LD is', () => {
    const { fields, descriptionText } = parseStructuredDetail(PLAIN_HTML, 'https://x.nl/vac/2')
    expect(fields.salary).toBeNull()
    expect(fields.employment).toBeNull()
    expect(fields.published_at).toBeNull()
    expect(fields.description).toContain('veelzijdige functie')
    expect(descriptionText).toContain('veelzijdige functie')
  })
})

describe('extractVacancyDetailFromHtml (zonder Mistral-key)', () => {
  beforeEach(() => {
    // Forceer het Mistral-pad om leeg terug te geven (geen netwerk in de test).
    process.env.MISTRAL_API_KEY = ''
  })

  it('vult de structurele velden, AI-velden blijven leeg', async () => {
    const fields = await extractVacancyDetailFromHtml(JSON_LD_HTML, 'https://x.nl/vac/1')
    expect(fields.salary).toContain('3.000')
    expect(fields.employment).toBe('Fulltime/Parttime')
    // Mistral uit -> geen AI-velden
    expect(fields.education_level).toBeNull()
    expect(fields.career_level).toBeNull()
    expect(fields.working_hours_min).toBeNull()
    expect(fields.categories).toBeNull()
  })
})
