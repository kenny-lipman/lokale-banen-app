import { describe, it, expect } from 'vitest'
import { pickSourceUrl } from '@/lib/services/company-description/source.service'
import type { DiscoveredUrl } from '@/lib/services/sales-leads/website/sitemap-discovery'

describe('pickSourceUrl', () => {
  it('kiest about boven home', () => {
    const discovered: DiscoveredUrl[] = [
      { url: 'https://x.nl/', role: 'home', priority: 0 },
      { url: 'https://x.nl/over-ons', role: 'about', priority: 1 },
    ]
    expect(pickSourceUrl(discovered, 'https://x.nl')).toBe('https://x.nl/over-ons')
  })

  it('valt terug op home als er geen about is', () => {
    const discovered: DiscoveredUrl[] = [{ url: 'https://x.nl/', role: 'home', priority: 0 }]
    expect(pickSourceUrl(discovered, 'https://x.nl')).toBe('https://x.nl/')
  })

  it('valt terug op de opgegeven website als er niets gevonden is', () => {
    expect(pickSourceUrl([], 'https://x.nl')).toBe('https://x.nl')
  })

  it('geeft null als er niets is en geen fallback', () => {
    expect(pickSourceUrl([], '')).toBeNull()
  })
})
