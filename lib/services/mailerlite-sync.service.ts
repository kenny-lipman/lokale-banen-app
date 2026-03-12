/**
 * MailerLite Sync Service
 *
 * Syncs leads to MailerLite for newsletter subscription.
 * Called after successful Pipedrive sync (between step 12 and 13).
 */

import { createServiceRoleClient } from '../supabase-server';
import { getMailerLiteClient, type CreateSubscriberParams } from '../mailerlite-client';

// ============================================================================
// TYPES
// ============================================================================

export interface MailerLiteSyncResult {
  success: boolean;
  email: string;
  subscriberId?: string;
  groupId?: string;
  groupName?: string;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface MailerLiteSyncLeadData {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  website?: string;
  hoofddomein?: string;
  subdomeinen?: string[];
  kvkNumber?: string;
  industries?: string[];
  employeeCount?: number;
  title?: string;
}

// Events that should NOT trigger MailerLite sync
const EXCLUDED_EVENTS = new Set([
  'lead_not_interested',
  'email_bounced',
  'lead_unsubscribed',
  'lead_wrong_person',
  'account_error',
]);

// ============================================================================
// SERVICE
// ============================================================================

export class MailerLiteSyncService {
  private supabase = createServiceRoleClient();

  /**
   * Sync a lead to MailerLite after Pipedrive sync.
   * Non-blocking — returns result, never throws.
   */
  async syncLeadToMailerLite(
    lead: MailerLiteSyncLeadData,
    pipedriveOrgId: number | undefined,
    pipedrivePersonId: number | undefined,
    eventType: string,
    syncSource: string = 'webhook'
  ): Promise<MailerLiteSyncResult> {
    const email = lead.email.toLowerCase().trim();

    const result: MailerLiteSyncResult = {
      success: false,
      email,
      skipped: false,
    };

    try {
      // 1. Check excluded events
      if (EXCLUDED_EVENTS.has(eventType)) {
        result.skipped = true;
        result.skipReason = `Event type "${eventType}" excluded from MailerLite sync`;
        return result;
      }

      // 2. Check deduplication — skip if already synced
      const { data: existingSync } = await this.supabase
        .from('mailerlite_syncs')
        .select('id')
        .eq('email', email)
        .single();

      if (existingSync) {
        result.skipped = true;
        result.skipReason = 'Already synced to MailerLite';
        return result;
      }

      // 3. Look up MailerLite group for this platform
      const groupInfo = await this.getGroupForPlatform(lead.hoofddomein);
      if (!groupInfo) {
        result.skipped = true;
        result.skipReason = `No MailerLite group configured for platform "${lead.hoofddomein || 'unknown'}"`;
        return result;
      }

      result.groupId = groupInfo.groupId;
      result.groupName = groupInfo.groupName;

      // 4. Get MailerLite client
      let client;
      try {
        client = getMailerLiteClient();
      } catch {
        result.skipped = true;
        result.skipReason = 'MAILER_LITE_API_KEY not configured';
        return result;
      }

      // 5. Build subscriber data with all available fields
      const fields: Record<string, string | number | null> = {};

      if (lead.lastName) fields.last_name = lead.lastName;
      if (lead.phone) fields.phone = lead.phone;
      if (lead.companyName) fields.company = lead.companyName;
      if (lead.city) fields.city = lead.city;
      if (lead.postalCode) fields.z_i_p = lead.postalCode;
      fields.country = 'Netherlands';
      // Custom fields (created via setup endpoint)
      if (lead.hoofddomein) fields.hoofddomein = lead.hoofddomein;
      if (lead.subdomeinen?.length) fields.subdomeinen = lead.subdomeinen.join(', ');
      if (lead.industries?.length) fields.branche = lead.industries.join(', ');
      if (lead.employeeCount) fields.bedrijfsgrootte = String(lead.employeeCount);
      if (lead.website) fields.website = lead.website;
      if (lead.kvkNumber) fields.kvk_nummer = lead.kvkNumber;
      if (lead.title) fields.functietitel = lead.title;
      if (pipedriveOrgId) fields.pipedrive_org_id = String(pipedriveOrgId);
      if (pipedrivePersonId) fields.pipedrive_person_id = String(pipedrivePersonId);

      const subscriberParams: CreateSubscriberParams = {
        email,
        fields,
        groups: [groupInfo.groupId],
        status: 'active',
      };

      // Set name field (first_name + last_name combined)
      const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
      if (fullName) {
        subscriberParams.fields!.name = fullName;
      }

      // 6. Create/update subscriber in MailerLite
      const response = await client.createOrUpdateSubscriber(subscriberParams);
      result.subscriberId = response.data?.id;
      result.success = true;

      // 7. Log to mailerlite_syncs table
      await this.logSync(result, pipedriveOrgId, pipedrivePersonId, lead.hoofddomein, syncSource);

      console.log(`✅ Synced ${email} to MailerLite group "${groupInfo.groupName}"`);
      return result;
    } catch (error: any) {
      result.error = error.message || 'Unknown MailerLite sync error';
      console.error(`❌ MailerLite sync error for ${email}:`, error.message);

      // Log failed sync too
      await this.logSync(result, pipedriveOrgId, pipedrivePersonId, lead.hoofddomein, syncSource);

      return result;
    }
  }

  /**
   * Look up MailerLite group ID for a platform via platforms table
   */
  private async getGroupForPlatform(
    hoofddomein: string | undefined
  ): Promise<{ groupId: string; groupName: string } | null> {
    if (!hoofddomein) return null;

    const { data: platform } = await this.supabase
      .from('platforms')
      .select('mailerlite_group_id')
      .eq('regio_platform', hoofddomein)
      .single();

    if (!platform?.mailerlite_group_id) return null;

    return {
      groupId: platform.mailerlite_group_id,
      groupName: hoofddomein, // We store the platform name as group name for logging
    };
  }

  /**
   * Log sync result to mailerlite_syncs table
   */
  private async logSync(
    result: MailerLiteSyncResult,
    pipedriveOrgId: number | undefined,
    pipedrivePersonId: number | undefined,
    hoofddomein: string | undefined,
    syncSource: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('mailerlite_syncs')
        .upsert({
          email: result.email,
          mailerlite_subscriber_id: result.subscriberId || null,
          mailerlite_group_id: result.groupId || null,
          mailerlite_group_name: result.groupName || null,
          pipedrive_org_id: pipedriveOrgId || null,
          pipedrive_person_id: pipedrivePersonId || null,
          hoofddomein: hoofddomein || null,
          sync_source: syncSource,
          sync_success: result.success,
          sync_error: result.error || null,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'email',
        });
    } catch (error) {
      console.error('Error logging MailerLite sync:', error);
    }
  }
}

// Singleton
export const mailerliteSyncService = new MailerLiteSyncService();
