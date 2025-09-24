import { supabaseService } from '@/lib/supabase-service';
import { blocklistValidationService } from './blocklist-validation.service';

export interface ContactFilterResult {
  contact: any;
  is_blocked: boolean;
  block_reason?: string;
  blocked_by_entry?: string;
}

export interface BulkFilterResult {
  total_contacts: number;
  blocked_contacts: number;
  allowed_contacts: number;
  filtered_contacts: any[];
  blocked_details: Array<{
    contact: any;
    reason: string;
    entry_id: string;
  }>;
}

export interface FilterOptions {
  include_inactive?: boolean;
  check_domains?: boolean;
  return_blocked_details?: boolean;
}

export class ContactFilteringService {
  private supabase = supabaseService.serviceClient;

  async filterSingleContact(contact: any, options: FilterOptions = {}): Promise<ContactFilterResult> {
    try {
      const email = this.extractEmailFromContact(contact);

      if (!email) {
        return {
          contact,
          is_blocked: false
        };
      }

      const validation = await blocklistValidationService.isBlocked(email, {
        checkDomains: options.check_domains !== false,
        includeInactive: options.include_inactive || false
      });

      return {
        contact,
        is_blocked: validation.isBlocked,
        block_reason: validation.reason,
        blocked_by_entry: validation.entryId
      };
    } catch (error) {
      console.error('Contact filtering error:', error);
      return {
        contact,
        is_blocked: false
      };
    }
  }

  async filterContacts(contacts: any[], options: FilterOptions = {}): Promise<BulkFilterResult> {
    try {
      const emails = contacts
        .map(contact => ({
          contact,
          email: this.extractEmailFromContact(contact)
        }))
        .filter(item => item.email);

      const validationResults = await blocklistValidationService.bulkCheck(
        emails.map(item => item.email),
        {
          checkDomains: options.check_domains !== false,
          includeInactive: options.include_inactive || false
        }
      );

      const filteredContacts: any[] = [];
      const blockedDetails: Array<{ contact: any; reason: string; entry_id: string }> = [];

      for (let i = 0; i < emails.length; i++) {
        const item = emails[i];
        const validation = validationResults[i];

        if (!validation.isBlocked) {
          filteredContacts.push(item.contact);
        } else if (options.return_blocked_details) {
          blockedDetails.push({
            contact: item.contact,
            reason: validation.reason || 'Blocked by blocklist',
            entry_id: validation.entryId || ''
          });
        }
      }

      const contactsWithoutEmail = contacts.filter(contact => !this.extractEmailFromContact(contact));
      filteredContacts.push(...contactsWithoutEmail);

      return {
        total_contacts: contacts.length,
        blocked_contacts: blockedDetails.length,
        allowed_contacts: filteredContacts.length,
        filtered_contacts: filteredContacts,
        blocked_details: blockedDetails
      };
    } catch (error) {
      console.error('Bulk contact filtering error:', error);
      return {
        total_contacts: contacts.length,
        blocked_contacts: 0,
        allowed_contacts: contacts.length,
        filtered_contacts: contacts,
        blocked_details: []
      };
    }
  }

  async validateCampaignContacts(contacts: any[]): Promise<{
    valid_contacts: any[];
    blocked_contacts: Array<{ contact: any; reason: string }>;
    warnings: string[];
  }> {
    const filterResult = await this.filterContacts(contacts, {
      check_domains: true,
      return_blocked_details: true
    });

    const warnings: string[] = [];

    if (filterResult.blocked_contacts > 0) {
      warnings.push(
        `${filterResult.blocked_contacts} contact(s) are blocked and will be excluded from the campaign.`
      );
    }

    const blocked_contacts = filterResult.blocked_details.map(detail => ({
      contact: detail.contact,
      reason: detail.reason
    }));

    return {
      valid_contacts: filterResult.filtered_contacts,
      blocked_contacts,
      warnings
    };
  }

  async enrichContactWithBlocklistStatus(contact: any): Promise<any> {
    const email = this.extractEmailFromContact(contact);

    if (!email) {
      return {
        ...contact,
        blocklist_status: {
          is_blocked: false,
          checked: false
        }
      };
    }

    try {
      const validation = await blocklistValidationService.isBlocked(email, {
        checkDomains: true,
        includeInactive: false
      });

      return {
        ...contact,
        blocklist_status: {
          is_blocked: validation.isBlocked,
          reason: validation.reason,
          entry_id: validation.entryId,
          blocked_at: validation.blockedAt,
          checked: true,
          checked_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to enrich contact with blocklist status:', error);
      return {
        ...contact,
        blocklist_status: {
          is_blocked: false,
          checked: false,
          error: 'Failed to check blocklist status'
        }
      };
    }
  }

  async bulkEnrichContacts(contacts: any[]): Promise<any[]> {
    const enrichedContacts: any[] = [];

    for (const contact of contacts) {
      try {
        const enriched = await this.enrichContactWithBlocklistStatus(contact);
        enrichedContacts.push(enriched);
      } catch (error) {
        console.error('Failed to enrich contact:', error);
        enrichedContacts.push({
          ...contact,
          blocklist_status: {
            is_blocked: false,
            checked: false,
            error: 'Enrichment failed'
          }
        });
      }
    }

    return enrichedContacts;
  }

  async checkContactByEmail(email: string): Promise<{
    is_blocked: boolean;
    reason?: string;
    entry?: any;
    suggestions?: string[];
  }> {
    try {
      const validation = await blocklistValidationService.isBlocked(email, {
        checkDomains: true,
        includeInactive: false
      });

      let entry = null;
      if (validation.isBlocked && validation.entryId) {
        const { data } = await this.supabase
          .from('blocklist_entries')
          .select('*')
          .eq('id', validation.entryId)
          .single();

        entry = data;
      }

      const suggestions = [];
      if (validation.isBlocked) {
        if (validation.reason?.includes('domain')) {
          suggestions.push('This email is blocked because the entire domain is on the blocklist.');
          suggestions.push('Consider using an alternative email address from a different domain.');
        } else {
          suggestions.push('This specific email address is on the blocklist.');
          suggestions.push('Check if this is intentional or consider removing from blocklist if appropriate.');
        }
      }

      return {
        is_blocked: validation.isBlocked,
        reason: validation.reason,
        entry,
        suggestions
      };
    } catch (error) {
      console.error('Failed to check contact by email:', error);
      return {
        is_blocked: false,
        suggestions: ['Failed to check blocklist status. Please try again.']
      };
    }
  }

  async getBlockedContactsFromList(contacts: any[]): Promise<{
    blocked_contacts: Array<{
      contact: any;
      email: string;
      reason: string;
      blocked_at: string;
    }>;
    count: number;
  }> {
    const filterResult = await this.filterContacts(contacts, {
      check_domains: true,
      return_blocked_details: true
    });

    const blocked_contacts = filterResult.blocked_details.map(detail => ({
      contact: detail.contact,
      email: this.extractEmailFromContact(detail.contact) || '',
      reason: detail.reason,
      blocked_at: new Date().toISOString()
    }));

    return {
      blocked_contacts,
      count: blocked_contacts.length
    };
  }

  private extractEmailFromContact(contact: any): string | null {
    if (typeof contact === 'string') {
      return this.isValidEmail(contact) ? contact : null;
    }

    if (typeof contact === 'object' && contact !== null) {
      const possibleEmailFields = [
        'email', 'email_address', 'emailAddress', 'primaryEmail', 'primary_email',
        'contactEmail', 'contact_email', 'mail', 'e_mail'
      ];

      for (const field of possibleEmailFields) {
        const value = contact[field];
        if (value && typeof value === 'string' && this.isValidEmail(value)) {
          return value.toLowerCase().trim();
        }
      }

      if (Array.isArray(contact.emails) && contact.emails.length > 0) {
        const primaryEmail = contact.emails.find((e: any) => e.primary || e.is_primary);
        if (primaryEmail && this.isValidEmail(primaryEmail.value || primaryEmail.email)) {
          return (primaryEmail.value || primaryEmail.email).toLowerCase().trim();
        }

        const firstEmail = contact.emails[0];
        if (firstEmail && this.isValidEmail(firstEmail.value || firstEmail.email || firstEmail)) {
          const email = firstEmail.value || firstEmail.email || firstEmail;
          return typeof email === 'string' ? email.toLowerCase().trim() : null;
        }
      }
    }

    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getFilteringStats(): Promise<{
    total_checks_today: number;
    blocked_today: number;
    allowed_today: number;
    most_blocked_domains: Array<{ domain: string; count: number }>;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: entries } = await this.supabase
        .from('blocklist_entries')
        .select('type, value')
        .eq('is_active', true);

      const domainEntries = entries?.filter(e => e.type === 'domain') || [];
      const emailEntries = entries?.filter(e => e.type === 'email') || [];

      const domainCounts = domainEntries.reduce((acc, entry) => {
        acc[entry.value] = (acc[entry.value] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const emailDomains = emailEntries.reduce((acc, entry) => {
        const domain = entry.value.split('@')[1];
        if (domain) {
          acc[domain] = (acc[domain] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const allDomains = { ...domainCounts };
      Object.entries(emailDomains).forEach(([domain, count]) => {
        allDomains[domain] = (allDomains[domain] || 0) + count;
      });

      const most_blocked_domains = Object.entries(allDomains)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        total_checks_today: 0,
        blocked_today: 0,
        allowed_today: 0,
        most_blocked_domains
      };
    } catch (error) {
      console.error('Failed to get filtering stats:', error);
      return {
        total_checks_today: 0,
        blocked_today: 0,
        allowed_today: 0,
        most_blocked_domains: []
      };
    }
  }
}

export const contactFilteringService = new ContactFilteringService();