/**
 * Helper functions for blocklist operations
 * Provides utilities for looking up companies, contacts, and their associated data
 */

import { createServiceRoleClient } from './supabase-server';

/**
 * Find a company by name (fuzzy matching)
 */
export async function findCompanyByName(name: string): Promise<{
  id: string;
  name: string;
  website?: string;
} | null> {
  const supabase = createServiceRoleClient();

  try {
    // First try exact match (case insensitive)
    const { data: exactMatch } = await supabase
      .from('companies')
      .select('id, name, website')
      .ilike('name', name)
      .single();

    if (exactMatch) {
      return exactMatch;
    }

    // Try fuzzy match
    const { data: fuzzyMatches } = await supabase
      .from('companies')
      .select('id, name, website')
      .ilike('name', `%${name}%`)
      .limit(1);

    return fuzzyMatches?.[0] || null;
  } catch (error) {
    console.error('Error finding company by name:', error);
    return null;
  }
}

/**
 * Get domain from company
 */
export async function getCompanyDomain(companyId: string): Promise<string> {
  const supabase = createServiceRoleClient();

  try {
    const { data } = await supabase
      .from('companies')
      .select('website, name')
      .eq('id', companyId)
      .single();

    if (data?.website) {
      // Extract domain from website URL
      try {
        const url = new URL(
          data.website.startsWith('http')
            ? data.website
            : `https://${data.website}`
        );
        return url.hostname.replace('www.', '');
      } catch {
        // If URL parsing fails, try to clean up the website value
        return data.website.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0];
      }
    }

    // Fallback: use company name as domain guess
    // e.g., "Company BV" -> "company.nl"
    return `${data?.name?.toLowerCase().replace(/\s+/g, '').replace(/bv$|nv$/i, '')}.nl`;
  } catch (error) {
    console.error('Error getting company domain:', error);
    return 'unknown.domain';
  }
}

/**
 * Get contact email
 */
export async function getContactEmail(contactId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();

  try {
    const { data } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', contactId)
      .single();

    return data?.email || null;
  } catch (error) {
    console.error('Error getting contact email:', error);
    return null;
  }
}

/**
 * Check if company exists by ID
 */
export async function companyExists(companyId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  try {
    const { count } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('id', companyId);

    return (count || 0) > 0;
  } catch (error) {
    console.error('Error checking company existence:', error);
    return false;
  }
}

/**
 * Check if contact exists by ID
 */
export async function contactExists(contactId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  try {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('id', contactId);

    return (count || 0) > 0;
  } catch (error) {
    console.error('Error checking contact existence:', error);
    return false;
  }
}

/**
 * Get all emails for a domain
 */
export async function getEmailsForDomain(domain: string): Promise<string[]> {
  const supabase = createServiceRoleClient();

  try {
    const { data } = await supabase
      .from('contacts')
      .select('email')
      .like('email', `%@${domain}`)
      .not('email', 'is', null);

    return (data || []).map(c => c.email).filter(Boolean);
  } catch (error) {
    console.error('Error getting emails for domain:', error);
    return [];
  }
}

/**
 * Create a blocklist entry for a company
 */
export async function createCompanyBlock(
  companyId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    const domain = await getCompanyDomain(companyId);

    const { error } = await supabase
      .from('blocklist_entries')
      .insert({
        type: 'domain',
        blocklist_level: 'organization',
        value: domain,
        company_id: companyId,
        reason,
        is_active: true
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a blocklist entry for a domain
 */
export async function createDomainBlock(
  domain: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    // Clean domain
    const cleanDomain = domain.replace('@', '').toLowerCase();

    const { error } = await supabase
      .from('blocklist_entries')
      .insert({
        type: 'domain',
        blocklist_level: 'domain',
        value: cleanDomain,
        reason,
        is_active: true
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a blocklist entry for an email
 */
export async function createEmailBlock(
  email: string,
  reason: string,
  contactId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    const { error } = await supabase
      .from('blocklist_entries')
      .insert({
        type: 'email',
        blocklist_level: 'contact',
        value: email.toLowerCase(),
        contact_id: contactId || null,
        reason,
        is_active: true
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}