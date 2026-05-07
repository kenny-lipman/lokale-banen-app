import { describe, it, expect } from 'vitest'
import { sbiToBrancheEnumId } from '@/lib/constants/sbi-mapping'

describe('sbiToBrancheEnumId', () => {
  it('mapt 4112 (bouw) → Bouw enum 54', () => {
    expect(sbiToBrancheEnumId('4112')).toBe(54)
  })
  it('mapt 4520 (autohandel) → Automotive 53', () => {
    expect(sbiToBrancheEnumId('4520')).toBe(53)
  })
  it('mapt 4711 (detailhandel) → 55', () => {
    expect(sbiToBrancheEnumId('4711')).toBe(55)
  })
  it('returns null voor onbekende prefix', () => {
    expect(sbiToBrancheEnumId('9999')).toBeNull()
  })
  it('returns null voor lege/null input', () => {
    expect(sbiToBrancheEnumId('')).toBeNull()
    expect(sbiToBrancheEnumId(null)).toBeNull()
    expect(sbiToBrancheEnumId(undefined)).toBeNull()
  })
  it('strip leading dots/spaces', () => {
    expect(sbiToBrancheEnumId(' 4112 ')).toBe(54)
  })
})
