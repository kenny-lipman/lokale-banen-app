import { headers } from 'next/headers'
import { createPublicClient } from './supabase'

export interface Tenant {
  id: string
  name: string
  domain: string | null
  preview_domain: string | null
  is_public: boolean
  tier: string | null
  logo_url: string | null
  primary_color: string
  hero_title: string | null
  hero_subtitle: string | null
  seo_description: string | null
  central_place: string | null
  indexnow_key: string | null
  about_text: string | null
  contact_email: string | null
  contact_phone: string | null
  social_linkedin: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_tiktok: string | null
  social_twitter: string | null
  favicon_url: string | null
  og_image_url: string | null
  privacy_text: string | null
  terms_text: string | null
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
    .select('id, regio_platform, central_place, domain, preview_domain, is_public, tier, logo_url, primary_color, hero_title, hero_subtitle, seo_description, indexnow_key, about_text, contact_email, contact_phone, social_linkedin, social_instagram, social_facebook, social_tiktok, social_twitter, favicon_url, og_image_url, privacy_text, terms_text')
    .or(`domain.eq.${host},preview_domain.eq.${host}`)
    .eq('is_public', true)
    .single()

  if (error || !data) return null

  // Map DB columns to Tenant interface
  return {
    id: data.id,
    name: data.regio_platform,
    domain: data.domain,
    preview_domain: data.preview_domain,
    is_public: data.is_public,
    tier: data.tier,
    logo_url: data.logo_url,
    primary_color: data.primary_color || '#0066cc',
    hero_title: data.hero_title,
    hero_subtitle: data.hero_subtitle,
    seo_description: data.seo_description,
    central_place: data.central_place,
    indexnow_key: data.indexnow_key,
    about_text: data.about_text ?? null,
    contact_email: data.contact_email ?? null,
    contact_phone: data.contact_phone ?? null,
    social_linkedin: data.social_linkedin ?? null,
    social_instagram: data.social_instagram ?? null,
    social_facebook: data.social_facebook ?? null,
    social_tiktok: data.social_tiktok ?? null,
    social_twitter: data.social_twitter ?? null,
    favicon_url: data.favicon_url ?? null,
    og_image_url: data.og_image_url ?? null,
    privacy_text: data.privacy_text ?? null,
    terms_text: data.terms_text ?? null,
  } satisfies Tenant
}
