import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_PREFERENCES,
  SOURCE_PREFERENCE_FIELDS,
  SOURCE_PREFERENCE_SOURCES,
  isResetSourcePreferencesRequest,
  mergeSourcePreferences,
  parseSourcePreferencePatch,
  rowsToSourcePreferenceOverrides,
} from '@/lib/services/sales-leads/source-preferences'

describe('source preferences helpers', () => {
  it('expose alleen configureerbare velden en toegestane bronnen', () => {
    expect(SOURCE_PREFERENCE_FIELDS).toEqual([
      'address',
      'industry',
      'employee_count',
      'phone',
      'email',
    ])
    expect(SOURCE_PREFERENCE_SOURCES).toEqual(['website', 'apollo', 'google_maps', 'kvk'])
  })

  it('merge overrides over defaults', () => {
    expect(mergeSourcePreferences({ phone: 'apollo' })).toEqual({
      ...DEFAULT_SOURCE_PREFERENCES,
      phone: 'apollo',
    })
  })

  it('parsed direct record patches met null als reset voor dat veld', () => {
    expect(parseSourcePreferencePatch({ address: 'google_maps', email: null })).toEqual({
      address: 'google_maps',
      email: null,
    })
  })

  it('parsed wrapped preferences object', () => {
    expect(parseSourcePreferencePatch({ preferences: { industry: 'kvk' } })).toEqual({
      industry: 'kvk',
    })
  })

  it('weigert protected en onbekende velden', () => {
    expect(() => parseSourcePreferencePatch({ company_name: 'apollo' })).toThrow(
      'Field is protected',
    )
    expect(() => parseSourcePreferencePatch({ founded_year: 'kvk' })).toThrow(
      'Unknown source preference field',
    )
  })

  it('weigert onbekende bronnen', () => {
    expect(() => parseSourcePreferencePatch({ phone: 'custom' })).toThrow('Invalid source')
  })

  it('herkent reset-all requests', () => {
    expect(isResetSourcePreferencesRequest({ reset: true })).toBe(true)
    expect(isResetSourcePreferencesRequest({ reset: false })).toBe(false)
  })

  it('negeert ongeldige db-rijen bij hydrate', () => {
    expect(
      rowsToSourcePreferenceOverrides([
        { field_name: 'address', source: 'kvk' },
        { field_name: 'company_name', source: 'apollo' },
        { field_name: 'phone', source: 'custom' },
      ]),
    ).toEqual({ address: 'kvk' })
  })
})
