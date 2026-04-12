import { headers } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from './supabase'

export interface Tenant {
  id: string
  name: string
  slug: string
  domain: string | null
  is_public: boolean
  tier: 'free' | 'paid' | 'master'
  logo_url: string | null
  primary_color: string
  hero_title: string | null
  hero_subtitle: string | null
  seo_description: string | null
  published_at: string | null
  region: string | null
  city: string | null
}

/**
 * Resolve the current tenant from the request's x-tenant-host header.
 * Falls back to lokalebanen.nl (master aggregator).
 */
export async function getTenant(): Promise<Tenant | null> {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  return getTenantByHost(host)
}

async function getTenantByHost(host: string): Promise<Tenant | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`tenant:${host}`)

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('platforms')
    .select('*')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  return data as Tenant | null
}
