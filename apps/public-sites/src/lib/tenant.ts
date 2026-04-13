import { headers } from 'next/headers'
import { createPublicClient } from './supabase'

export interface Tenant {
  id: string
  name: string
  domain: string | null
  is_public: boolean
  tier: string | null
  logo_url: string | null
  primary_color: string
  hero_title: string | null
  hero_subtitle: string | null
  seo_description: string | null
  central_place: string | null
  indexnow_key: string | null
}

/**
 * Resolve the current tenant from the request's x-tenant-host header.
 * Falls back to lokalebanen.nl (master aggregator).
 */
export async function getTenant(): Promise<Tenant | null> {
  const headersList = await headers()
  let host = headersList.get('x-tenant-host') || 'lokalebanen.nl'

  // Development: localhost resolved naar WestlandseBanen
  if (host === 'localhost' || host.startsWith('localhost:') || host.endsWith('.local')) {
    host = 'westlandsebanen.nl'
  }

  return getTenantByHost(host)
}

async function getTenantByHost(host: string): Promise<Tenant | null> {
  // TODO: add 'use cache' + cacheLife after build verification

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('platforms')
    .select('id, regio_platform, central_place, domain, is_public, tier, logo_url, primary_color, hero_title, hero_subtitle, seo_description, indexnow_key')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  if (error || !data) return null

  // Map DB columns to Tenant interface
  return {
    id: data.id,
    name: data.regio_platform,
    domain: data.domain,
    is_public: data.is_public,
    tier: data.tier,
    logo_url: data.logo_url,
    primary_color: data.primary_color || '#0066cc',
    hero_title: data.hero_title,
    hero_subtitle: data.hero_subtitle,
    seo_description: data.seo_description,
    central_place: data.central_place,
    indexnow_key: data.indexnow_key,
  } satisfies Tenant
}
