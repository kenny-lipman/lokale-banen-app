import { describe, it, expect } from 'vitest'
import {
  looksUseful,
  looksLikeJsShell,
  isCloudflareChallenge,
} from '@/lib/services/sales-leads/website/tiered-fetch'

describe('looksUseful', () => {
  it('false op non-2xx', () => {
    expect(looksUseful('a'.repeat(2000), 403)).toBe(false)
    expect(looksUseful('a'.repeat(2000), 503)).toBe(false)
  })

  it('false op te korte body', () => {
    expect(looksUseful('<html></html>', 200)).toBe(false)
  })

  it('true op normale gerenderde pagina', () => {
    const html = `<html><head><title>Acme</title></head><body><h1>Welkom</h1>
      <p>${'lorem '.repeat(100)}</p>
      <main>${'<p>tekst</p>'.repeat(20)}</main>
    </body></html>`
    expect(looksUseful(html, 200)).toBe(true)
  })

  it('false op JS-shell met root-div', () => {
    const shell = `<html><head>${'<meta>'.repeat(40)}</head><body><div id="root"></div></body></html>`
    expect(looksUseful(shell, 200)).toBe(false)
  })

  it('false op cloudflare challenge', () => {
    const cf = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>${'x'.repeat(1000)}</body></html>`
    expect(looksUseful(cf, 503)).toBe(false)
  })
})

describe('looksLikeJsShell', () => {
  it('true op leeg <body><div id="root"></div>', () => {
    expect(looksLikeJsShell('<html><body><div id="root"></div></body></html>')).toBe(true)
  })

  it('true voor #__next (Next.js) en #app (Vue)', () => {
    expect(looksLikeJsShell('<html><body><div id="__next"></div></body></html>')).toBe(true)
    expect(looksLikeJsShell('<html><body><div id="app"></div></body></html>')).toBe(true)
  })

  it('false als body voldoende tekst bevat', () => {
    const html = `<html><body><div id="root">${'x'.repeat(500)}</div></body></html>`
    expect(looksLikeJsShell(html)).toBe(false)
  })

  it('false zonder root-div', () => {
    expect(looksLikeJsShell('<html><body><h1>Hi</h1></body></html>')).toBe(false)
  })
})

describe('isCloudflareChallenge', () => {
  it.each([
    'Just a moment...',
    'Attention Required! | Cloudflare',
    '<div class="cf-browser-verification">',
    'Cloudflare Ray ID: 1234567890',
    '__cf_chl_jschl_tk__',
  ])('detecteert variant: %s', (snippet) => {
    expect(isCloudflareChallenge(`<html>${snippet}</html>`)).toBe(true)
  })

  it('false voor normale page', () => {
    expect(isCloudflareChallenge('<html><body><h1>Welkom bij Acme</h1></body></html>')).toBe(false)
  })

  it('alleen first 6000 chars worden gescand', () => {
    const padding = ' '.repeat(7000)
    expect(isCloudflareChallenge(`<html>${padding}Just a moment...</html>`)).toBe(false)
  })
})
