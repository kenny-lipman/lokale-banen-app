import { describe, it, expect } from 'vitest'
import { extractPostcodePrefix } from '@/lib/automations/fix-job-postings-geocoding/platform-lookup'

describe('extractPostcodePrefix', () => {
  it('returns first 4 digits from "1011 AB"', () => {
    expect(extractPostcodePrefix('1011 AB')).toBe('1011')
  })
  it('returns first 4 digits from "1011AB"', () => {
    expect(extractPostcodePrefix('1011AB')).toBe('1011')
  })
  it('returns null for null input', () => {
    expect(extractPostcodePrefix(null)).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(extractPostcodePrefix('')).toBeNull()
  })
  it('returns null for postcode without 4-digit prefix', () => {
    expect(extractPostcodePrefix('AB12')).toBeNull()
  })
  it('handles "1011" alone', () => {
    expect(extractPostcodePrefix('1011')).toBe('1011')
  })
})
