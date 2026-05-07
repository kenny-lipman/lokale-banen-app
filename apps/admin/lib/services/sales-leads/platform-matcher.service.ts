import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase-server'

export type PlatformMatch = {
  platform_id: string
  regio_platform: string
}

export class PlatformMatcherService {
  private supabase: SupabaseClient

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? (createServiceRoleClient() as unknown as SupabaseClient)
  }

  private async resolvePlatformValue(platformId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('platforms')
      .select('regio_platform')
      .eq('id', platformId)
      .maybeSingle()
    if (error || !data?.regio_platform) return null
    return data.regio_platform as string
  }

  async matchByPostcode(postcode: string): Promise<PlatformMatch | null> {
    const prefix = postcode.match(/^\s*(\d{4})/)?.[1]
    if (!prefix) return null
    const { data, error } = await this.supabase
      .from('cities')
      .select('platform_id')
      .eq('postcode', prefix)
      .order('platform_id', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (error || !data?.platform_id) return null
    const value = await this.resolvePlatformValue(data.platform_id)
    if (!value) return null
    return { platform_id: data.platform_id, regio_platform: value }
  }

  async matchByCity(city: string): Promise<PlatformMatch | null> {
    const trimmed = city.trim()
    if (!trimmed) return null
    const { data, error } = await this.supabase
      .from('cities')
      .select('platform_id, postcode')
      .ilike('plaats', trimmed)
      .not('postcode', 'is', null)
      .order('platform_id', { ascending: true, nullsFirst: false })
      .order('postcode', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error || !data?.platform_id) return null
    const value = await this.resolvePlatformValue(data.platform_id)
    if (!value) return null
    return { platform_id: data.platform_id, regio_platform: value }
  }

  async matchByAddress(addr: { postcode?: string | null; city?: string | null }): Promise<PlatformMatch | null> {
    if (addr.postcode) {
      const r = await this.matchByPostcode(addr.postcode)
      if (r) return r
    }
    if (addr.city) {
      const r = await this.matchByCity(addr.city)
      if (r) return r
    }
    return null
  }
}
