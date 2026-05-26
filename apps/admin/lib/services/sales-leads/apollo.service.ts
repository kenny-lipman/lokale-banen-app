import { cachedFetch } from './cache'
import { Semaphore } from '@/lib/utils/semaphore'
import type { ColdContact, NormalizedFields, NormalizedContact, SourceHealth, NormalizedTechnology } from './types'

const APOLLO_BASE = process.env.APOLLO_API_BASE_URL ?? 'https://api.apollo.io/api/v1'

// Module-level semaphore: bij bulk-create draaien N orchestrators parallel
// binnen 1 Lambda-instance, elk vuurt ~3 Apollo-calls (enrichOrganization +
// searchContacts + matchPerson). Zonder cap = 25 URLs x 3 = 75 calls in
// burst -> 429-storm. Cap op 5 concurrent calls/instance.
const APOLLO_SEMAPHORE = new Semaphore(5)

// Apollo raw shapes — alleen wat we gebruiken.

type ApolloOrg = {
  id?: string
  name?: string
  website_url?: string
  primary_domain?: string
  linkedin_url?: string
  twitter_url?: string
  facebook_url?: string
  crunchbase_url?: string
  industry?: string
  industries?: string[]
  keywords?: string[]
  estimated_num_employees?: number
  founded_year?: number
  short_description?: string
  long_description?: string
  annual_revenue?: number
  total_funding?: number
  technology_names?: string[]
  current_technologies?: Array<{ name: string; category: string }>
  departmental_head_count?: Record<string, number>
  sanitized_phone?: string
  raw_address?: string
  street_address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
}

type ApolloOrgEnrichResponse = {
  organization?: ApolloOrg
  error_code?: string
}

type ApolloPerson = {
  id?: string
  first_name?: string
  last_name?: string
  name?: string
  title?: string
  seniority?: string
  departments?: string[]
  email?: string
  email_status?: string
  phone_numbers?: Array<{ raw_number?: string; type?: string }>
  linkedin_url?: string
  organization?: { name?: string }
}

type ApolloPeopleMatchResponse = {
  person?: ApolloPerson
  error_code?: string
}

type ApolloContactsSearchResponse = {
  contacts?: ApolloPerson[]
  pagination?: { total_entries?: number }
  error_code?: string
}

type ApolloMixedPerson = {
  id?: string
  first_name?: string
  last_name?: string
  last_name_obfuscated?: string
  name?: string
  title?: string
  seniority?: string
  departments?: string[]
  has_email?: boolean
  has_direct_phone?: string
  organization_id?: string
}

type ApolloMixedPeopleSearchResponse = {
  people?: ApolloMixedPerson[]
  total_entries?: number
  error_code?: string
}

type ApolloBulkMatchResponse = {
  status?: string
  matches?: Array<ApolloPerson | null>
  credits_consumed?: number
  error_code?: string
  error_message?: string
}

export type ApolloUsageMeta = {
  endpoint: string
  cost_credits?: number
  duration_ms: number
  from_cache: boolean
}

export class ApolloApiError extends Error {
  constructor(
    public httpStatus: number,
    public reason: 'not_found' | 'rate_limited' | 'inaccessible' | 'invalid_key' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'ApolloApiError'
  }
}

const SENIORITY_MAP: Record<string, NormalizedContact['seniority']> = {
  owner: 'owner',
  founder: 'founder',
  c_suite: 'c_suite',
  vp: 'vp',
  head: 'head',
  director: 'director',
  manager: 'manager',
  senior: 'senior',
  junior: 'junior',
  intern: 'intern',
}

function normalizeDirectPhone(value: string | undefined): ColdContact['has_direct_phone'] {
  if (!value) return 'no'
  const v = value.toLowerCase()
  if (v === 'yes') return 'yes'
  if (v.startsWith('maybe')) return 'maybe'
  return 'no'
}

const DEPT_MAP: Record<string, NormalizedContact['department']> = {
  c_suite: 'executive',
  master_executives: 'executive',
  human_resources: 'human_resources',
  operations: 'operations',
  sales: 'sales',
  marketing: 'marketing',
  finance: 'finance',
  engineering: 'engineering',
}

export class ApolloService {
  private readonly apiKey = process.env.APOLLO_API_KEY

  private headers() {
    if (!this.apiKey) throw new ApolloApiError(0, 'invalid_key', 'APOLLO_API_KEY ontbreekt')
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': this.apiKey,
      accept: 'application/json',
    }
  }

  private async apolloFetch<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    return APOLLO_SEMAPHORE.run(() => this.apolloFetchUnlimited<T>(method, path, body))
  }

  private async apolloFetchUnlimited<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${APOLLO_BASE}${path}`
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    if (res.status === 401) throw new ApolloApiError(401, 'invalid_key', 'Apollo 401 invalid key')
    if (res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { error_code?: string; error?: string }
      if (data.error_code === 'API_INACCESSIBLE') {
        throw new ApolloApiError(403, 'inaccessible', `Apollo API_INACCESSIBLE: ${path}`)
      }
      throw new ApolloApiError(403, 'inaccessible', `Apollo 403: ${data.error ?? 'forbidden'}`)
    }
    if (res.status === 422) throw new ApolloApiError(422, 'not_found', `Apollo 422 not found: ${path}`)
    if (res.status === 429) throw new ApolloApiError(429, 'rate_limited', `Apollo 429 rate-limit`)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApolloApiError(res.status, 'unknown', `Apollo ${res.status}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }

  private stripDomain(domain: string): string {
    return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }

  /**
   * Org enrich op domein. 1 credit per call. Cache 24u.
   */
  async enrichOrganization(domain: string): Promise<{ normalized: NormalizedFields; raw: ApolloOrg; usage: ApolloUsageMeta }> {
    const t0 = Date.now()
    const stripped = this.stripDomain(domain)
    const cacheResult = await cachedFetch('apollo_org', stripped, '24h', async () => {
      const data = await this.apolloFetch<ApolloOrgEnrichResponse>(
        'GET',
        `/organizations/enrich?domain=${encodeURIComponent(stripped)}`,
      )
      if (!data.organization) {
        if (data.error_code === 'NOT_FOUND') throw new ApolloApiError(422, 'not_found', `Apollo geen org voor ${stripped}`)
        throw new ApolloApiError(500, 'unknown', `Apollo lege response voor ${stripped}`)
      }
      return data.organization
    })
    const raw = cacheResult.value
    const fromCache = cacheResult.fromCache

    const normalized = this.mapOrgToNormalized(raw)
    return {
      normalized,
      raw,
      usage: {
        endpoint: '/organizations/enrich',
        cost_credits: fromCache ? 0 : 1,
        duration_ms: Date.now() - t0,
        from_cache: fromCache,
      },
    }
  }

  /**
   * People match op naam + organization_name (of domain). 1 credit/call (geen cache — namen veranderen).
   * Returnt null als 422 (geen match).
   */
  async matchPerson(opts: {
    name?: string
    first_name?: string
    last_name?: string
    organization_name?: string
    domain?: string
    linkedin_url?: string
    reveal_email?: boolean
  }): Promise<{ contact: NormalizedContact | null; raw: ApolloPerson | null; usage: ApolloUsageMeta }> {
    const t0 = Date.now()
    try {
      const data = await this.apolloFetch<ApolloPeopleMatchResponse>('POST', '/people/match', {
        name: opts.name,
        first_name: opts.first_name,
        last_name: opts.last_name,
        organization_name: opts.organization_name,
        domain: opts.domain,
        linkedin_url: opts.linkedin_url,
        reveal_personal_emails: false, // GDPR-NL: blocked
      })
      if (!data.person) {
        return {
          contact: null,
          raw: null,
          usage: {
            endpoint: '/people/match',
            cost_credits: 1,
            duration_ms: Date.now() - t0,
            from_cache: false,
          },
        }
      }
      return {
        contact: this.mapPersonToContact(data.person, ['apollo']),
        raw: data.person,
        usage: {
          endpoint: '/people/match',
          cost_credits: 1,
          duration_ms: Date.now() - t0,
          from_cache: false,
        },
      }
    } catch (e) {
      if (e instanceof ApolloApiError && e.reason === 'not_found') {
        return {
          contact: null,
          raw: null,
          usage: {
            endpoint: '/people/match',
            cost_credits: 1,
            duration_ms: Date.now() - t0,
            from_cache: false,
          },
        }
      }
      throw e
    }
  }

  /**
   * `/contacts/search` zoekt in onze EIGEN Apollo CRM-contactenlijst (warm leads).
   * 0 credits per call; gebruikt voor "is dit bedrijf al in onze pipeline?".
   */
  async searchContactsByDomain(domain: string): Promise<{ contacts: NormalizedContact[]; usage: ApolloUsageMeta }> {
    const t0 = Date.now()
    const stripped = this.stripDomain(domain)
    const data = await this.apolloFetch<ApolloContactsSearchResponse>('POST', '/contacts/search', {
      q_organization_domains_list: [stripped],
      per_page: 25,
    })
    const contacts = (data.contacts ?? []).map((p) => ({
      ...this.mapPersonToContact(p, ['apollo']),
      is_warm_lead: true,
    }))
    return {
      contacts,
      usage: {
        endpoint: '/contacts/search',
        cost_credits: 0,
        duration_ms: Date.now() - t0,
        from_cache: false,
      },
    }
  }

  /**
   * `/mixed_people/api_search` zoekt cold leads in de volledige Apollo database
   * voor een bedrijfsdomein. 0 credits per call. Achternaam, email en telefoon
   * zijn obfuscated — gebruik `bulkMatchPeople` om die te verrijken (1 credit
   * per persoon).
   */
  async searchPeopleByDomain(
    domain: string,
    opts: { perPage?: number; seniorities?: string[] } = {},
  ): Promise<{ candidates: ColdContact[]; total: number; usage: ApolloUsageMeta }> {
    const t0 = Date.now()
    const stripped = this.stripDomain(domain)
    const seniorities = opts.seniorities ?? [
      'owner',
      'founder',
      'c_suite',
      'vp',
      'head',
      'director',
      'manager',
    ]
    const data = await this.apolloFetch<ApolloMixedPeopleSearchResponse>(
      'POST',
      '/mixed_people/api_search',
      {
        q_organization_domains_list: [stripped],
        per_page: opts.perPage ?? 25,
        page: 1,
        person_seniorities: seniorities,
      },
    )
    const candidates: ColdContact[] = (data.people ?? [])
      .filter((p) => !!p.id && !!p.first_name)
      .map((p) => ({
        apollo_id: p.id!,
        first_name: p.first_name,
        last_name_obfuscated: p.last_name_obfuscated,
        title: p.title,
        seniority: p.seniority ? SENIORITY_MAP[p.seniority] : undefined,
        departments: p.departments,
        has_email: !!p.has_email,
        has_direct_phone: normalizeDirectPhone(p.has_direct_phone),
        organization_id: p.organization_id,
      }))
    return {
      candidates,
      total: data.total_entries ?? candidates.length,
      usage: {
        endpoint: '/mixed_people/api_search',
        cost_credits: 0,
        duration_ms: Date.now() - t0,
        from_cache: false,
      },
    }
  }

  /**
   * Bulk-match Apollo person-IDs → volledige naam, email, LinkedIn, etc.
   * 1 credit per match. Apollo accepteert max 10 IDs per call — chunkt
   * automatisch. `reveal_personal_emails: false` voor GDPR-NL.
   */
  async bulkMatchPeople(
    apolloIds: string[],
  ): Promise<{ contacts: NormalizedContact[]; usage: ApolloUsageMeta }> {
    const t0 = Date.now()
    if (apolloIds.length === 0) {
      return {
        contacts: [],
        usage: {
          endpoint: '/people/bulk_match',
          cost_credits: 0,
          duration_ms: Date.now() - t0,
          from_cache: false,
        },
      }
    }
    const chunks: string[][] = []
    for (let i = 0; i < apolloIds.length; i += 10) chunks.push(apolloIds.slice(i, i + 10))

    const all: NormalizedContact[] = []
    let totalCredits = 0
    for (const chunk of chunks) {
      const data = await this.apolloFetch<ApolloBulkMatchResponse>('POST', '/people/bulk_match', {
        reveal_personal_emails: false,
        reveal_phone_number: false,
        details: chunk.map((id) => ({ id })),
      })
      totalCredits += data.credits_consumed ?? 0
      for (const m of data.matches ?? []) {
        if (!m) continue
        all.push(this.mapPersonToContact(m, ['apollo']))
      }
    }
    return {
      contacts: all,
      usage: {
        endpoint: '/people/bulk_match',
        cost_credits: totalCredits || apolloIds.length,
        duration_ms: Date.now() - t0,
        from_cache: false,
      },
    }
  }

  private mapOrgToNormalized(o: ApolloOrg): NormalizedFields {
    const technologies: NormalizedTechnology[] | undefined = o.current_technologies?.length
      ? o.current_technologies.map((t) => ({ name: t.name, category: t.category }))
      : o.technology_names?.length
      ? o.technology_names.map((n) => ({ name: n, category: 'unknown' }))
      : undefined

    const employee_count = o.estimated_num_employees
    const employee_bucket: NormalizedFields['employee_bucket'] | undefined =
      employee_count == null
        ? undefined
        : employee_count < 10
        ? 'klein_<10'
        : employee_count < 100
        ? 'middel_<100'
        : 'groot_>100'

    return {
      apollo_org_id: o.id,
      company_name: o.name,
      website: o.website_url ?? (o.primary_domain ? `https://${o.primary_domain}` : undefined),
      linkedin_url: o.linkedin_url,
      twitter_url: o.twitter_url,
      facebook_url: o.facebook_url,
      crunchbase_url: o.crunchbase_url,
      industry: o.industry,
      industry_codes: o.industries,
      keywords: o.keywords,
      employee_count,
      employee_bucket,
      founded_year: o.founded_year,
      description_short: o.short_description,
      description_long: o.long_description,
      annual_revenue: o.annual_revenue,
      funding_total: o.total_funding,
      technologies,
      departmental_head_count: o.departmental_head_count,
      phone: o.sanitized_phone,
      phones_all: o.sanitized_phone ? [o.sanitized_phone] : undefined,
      address:
        o.street_address || o.city || o.raw_address
          ? {
              street: o.street_address,
              postcode: o.postal_code,
              city: o.city,
              country: o.country,
              full: o.raw_address,
            }
          : undefined,
      source: 'apollo',
    }
  }

  private mapPersonToContact(p: ApolloPerson, origin: NormalizedContact['source_origin']): NormalizedContact {
    const phoneMobile = p.phone_numbers?.find((pn) => pn.type === 'mobile')?.raw_number
    const phoneOther = p.phone_numbers?.find((pn) => pn.type !== 'mobile')?.raw_number
    const dept = p.departments?.[0]
    return {
      name: p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      seniority: p.seniority ? SENIORITY_MAP[p.seniority] : undefined,
      department: dept ? DEPT_MAP[dept] : undefined,
      email: p.email,
      email_verified: p.email_status === 'verified',
      phone_mobile: phoneMobile,
      phone_other: phoneOther,
      linkedin_url: p.linkedin_url,
      source_origin: origin,
    }
  }

  async health(): Promise<SourceHealth> {
    if (!this.apiKey) return { ok: false, latency_ms: 0, message: 'APOLLO_API_KEY ontbreekt' }
    const t0 = Date.now()
    try {
      const data = await this.apolloFetch<ApolloOrgEnrichResponse>('GET', '/organizations/enrich?domain=apollo.io')
      return {
        ok: !!data.organization,
        latency_ms: Date.now() - t0,
        message: data.organization ? undefined : 'Geen org-data',
      }
    } catch (e) {
      const msg = e instanceof ApolloApiError ? `${e.reason} (${e.httpStatus})` : String(e)
      return { ok: false, latency_ms: Date.now() - t0, message: msg }
    }
  }
}
