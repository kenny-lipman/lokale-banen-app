import { describe, it, expect } from 'vitest'
import {
  payloadToNormalizedVacancy,
  normalizeManualVacancies,
  type VacaturePayload,
} from '@/lib/services/sales-leads/manual-vacancy'

describe('payloadToNormalizedVacancy', () => {
  it('mapt titel/url/locatie en zet source op manual', () => {
    const payload: VacaturePayload = {
      title: '  Senior Monteur ',
      url: 'https://werkgever.nl/vac',
      city: 'Amsterdam',
      review_status: 'pending',
    }
    const v = payloadToNormalizedVacancy(payload)
    expect(v.title).toBe('Senior Monteur')
    expect(v.url).toBe('https://werkgever.nl/vac')
    expect(v.location).toBe('Amsterdam')
    expect(v.source).toBe('manual')
  })

  it('vult detail-velden en parset uren naar number', () => {
    const payload: VacaturePayload = {
      title: 'Werkvoorbereider',
      salary: '2800 - 3500',
      employment: 'Vast',
      working_hours_min: '32',
      working_hours_max: '40',
      education_level: 'MBO',
      categories: 'Techniek',
      end_date: '2026-12-31',
      description: 'Mooie baan',
      review_status: 'pending',
    }
    const v = payloadToNormalizedVacancy(payload)
    expect(v.detail).toBeDefined()
    expect(v.detail?.salary).toBe('2800 - 3500')
    expect(v.detail?.employment).toBe('Vast')
    expect(v.detail?.working_hours_min).toBe(32)
    expect(v.detail?.working_hours_max).toBe(40)
    expect(v.detail?.education_level).toBe('MBO')
    expect(v.detail?.categories).toBe('Techniek')
    expect(v.detail?.end_date).toBe('2026-12-31')
    expect(v.detail?.description).toBe('Mooie baan')
  })

  it('laat detail weg als er geen detail-velden zijn', () => {
    const v = payloadToNormalizedVacancy({ title: 'Alleen titel', review_status: 'pending' })
    expect(v.detail).toBeUndefined()
  })
})

describe('normalizeManualVacancies', () => {
  it('negeert non-arrays en items zonder titel', () => {
    expect(normalizeManualVacancies(null)).toEqual([])
    expect(normalizeManualVacancies([{ url: 'x' }, { title: '   ' }])).toEqual([])
  })

  it('behoudt title/url/location en zet source op manual', () => {
    const out = normalizeManualVacancies([
      { title: 'Monteur', url: 'https://a.nl', location: 'Utrecht' },
    ])
    expect(out).toEqual([
      { title: 'Monteur', url: 'https://a.nl', location: 'Utrecht', source: 'manual' },
    ])
  })

  it('behoudt detail als die aanwezig is', () => {
    const out = normalizeManualVacancies([
      { title: 'Monteur', detail: { salary: '3000', working_hours_min: 32 } },
    ])
    expect(out[0].detail?.salary).toBe('3000')
    expect(out[0].detail?.working_hours_min).toBe(32)
  })
})
