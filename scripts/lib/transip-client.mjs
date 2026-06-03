/**
 * Minimale TransIP REST API v6 client.
 *
 * Auth: TransIP geeft geen kant-en-klare API-key. Je genereert in het
 * controlepaneel (Account > API) een sleutelpaar; de private key onderteken je
 * per token-request met SHA512. De ondertekende request levert een JWT op dat
 * je daarna als Bearer-token meestuurt.
 *
 * Env:
 *   TRANSIP_LOGIN            - je TransIP-gebruikersnaam
 *   TRANSIP_PRIVATE_KEY      - de PEM private key (incl. -----BEGIN...-----), of
 *   TRANSIP_PRIVATE_KEY_FILE - pad naar een bestand met die PEM private key
 *
 * Docs: https://api.transip.nl/rest/docs.html
 */

import { createSign, randomBytes } from 'crypto'
import { readFileSync } from 'fs'

const API_BASE = 'https://api.transip.nl/v6'

function loadPrivateKey() {
  const inline = process.env.TRANSIP_PRIVATE_KEY
  if (inline && inline.includes('BEGIN')) return inline.replace(/\\n/g, '\n')
  const file = process.env.TRANSIP_PRIVATE_KEY_FILE
  if (file) return readFileSync(file, 'utf-8')
  throw new Error('Geen TransIP private key: zet TRANSIP_PRIVATE_KEY of TRANSIP_PRIVATE_KEY_FILE')
}

/**
 * Vraag een tijdelijk JWT-token op door de request-body te ondertekenen.
 * global_key=true => token werkt vanaf elk IP (geen whitelisting nodig).
 */
export async function getAccessToken({ readOnly = false, label } = {}) {
  const login = process.env.TRANSIP_LOGIN
  if (!login) throw new Error('Geen TRANSIP_LOGIN gezet')

  const body = JSON.stringify({
    login,
    nonce: randomBytes(16).toString('hex'),
    read_only: readOnly,
    expiration_time: '30 minutes',
    label: label || `lokale-banen-domains-${randomBytes(4).toString('hex')}`,
    global_key: true,
  })

  // De signature moet exact de bytes van `body` dekken die we ook versturen.
  const signer = createSign('SHA512')
  signer.update(body)
  signer.end()
  const signature = signer.sign(loadPrivateKey(), 'base64')

  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Signature: signature },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`TransIP auth ${res.status}: ${text}`)
  const json = JSON.parse(text)
  if (!json.token) throw new Error(`TransIP auth: geen token in response (${text})`)
  return json.token
}

export function createTransipClient(token) {
  async function request(path, init = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })
    const text = await res.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    return { status: res.status, ok: res.ok, body }
  }

  return {
    request,

    /** Alle domeinen in het account (gepagineerd, max 100 per pagina). */
    async listDomains() {
      const all = []
      let page = 1
      for (;;) {
        const r = await request(`/domains?pageSize=100&page=${page}`)
        if (!r.ok) throw new Error(`listDomains ${r.status}: ${JSON.stringify(r.body)}`)
        const domains = r.body?.domains || []
        all.push(...domains)
        if (domains.length < 100) break
        page++
      }
      return all
    },

    /** Huidige DNS-entries voor een domein. */
    async getDnsEntries(domain) {
      const r = await request(`/domains/${encodeURIComponent(domain)}/dns`)
      if (!r.ok) throw new Error(`getDnsEntries(${domain}) ${r.status}: ${JSON.stringify(r.body)}`)
      return r.body?.dnsEntries || []
    },

    async addDnsEntry(domain, entry) {
      return request(`/domains/${encodeURIComponent(domain)}/dns`, {
        method: 'POST',
        body: JSON.stringify({ dnsEntry: entry }),
      })
    },

    async deleteDnsEntry(domain, entry) {
      return request(`/domains/${encodeURIComponent(domain)}/dns`, {
        method: 'DELETE',
        body: JSON.stringify({ dnsEntry: entry }),
      })
    },
  }
}

/** CNAME-content vergelijken zonder dat een trailing dot ruis geeft. */
export function normalizeContent(s) {
  return String(s || '').replace(/\.$/, '').toLowerCase()
}
