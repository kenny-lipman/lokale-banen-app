import { NextRequest, NextResponse } from 'next/server';
import { validateSecretAuth } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { mailerliteSyncService } from '@/lib/services/mailerlite-sync.service';
import { pipedriveClient } from '@/lib/pipedrive-client';

/**
 * POST /api/mailerlite/backfill
 *
 * Backfill: sync existing Pipedrive-synced leads to MailerLite.
 * Finds contacts from configured platforms that are in Pipedrive but not yet in MailerLite.
 * Auth: CRON_SECRET
 *
 * Query params:
 * - limit: max leads to process (default 50, max 100)
 * - platform: filter by specific platform (e.g. "AlkmaarseBanen")
 */

// Events excluded from MailerLite sync
const EXCLUDED_EVENTS = [
  'lead_not_interested',
  'email_bounced',
  'lead_unsubscribed',
  'lead_wrong_person',
  'account_error',
];

export async function POST(request: NextRequest) {
  // Auth check
  if (!validateSecretAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const platformFilter = searchParams.get('platform');

    // 1. Get platforms with configured MailerLite groups
    let platformQuery = supabase
      .from('platforms')
      .select('regio_platform, mailerlite_group_id')
      .not('mailerlite_group_id', 'is', null);

    if (platformFilter) {
      platformQuery = platformQuery.eq('regio_platform', platformFilter);
    }

    const { data: configuredPlatforms } = await platformQuery;

    if (!configuredPlatforms?.length) {
      return NextResponse.json({
        success: true,
        message: platformFilter
          ? `Platform "${platformFilter}" has no MailerLite group configured`
          : 'No platforms with MailerLite groups configured',
        processed: 0,
      });
    }

    const configuredPlatformNames = configuredPlatforms.map(p => p.regio_platform);

    // 2. Get contacts from configured platforms with company data
    const { data: platformContacts, error: contactError } = await supabase
      .from('companies')
      .select(`
        id, name, website, city, postal_code, kvk,
        industries, hoofddomein,
        contacts (email, name, phone, title)
      `)
      .in('hoofddomein', configuredPlatformNames);

    if (contactError) {
      throw new Error(`Contact query error: ${contactError.message}`);
    }

    // Flatten: company + contact pairs
    interface EnrichedLead {
      email: string;
      contactName: string | null;
      phone: string | null;
      title: string | null;
      company: {
        name: string | null;
        website: string | null;
        city: string | null;
        postal_code: string | null;
        kvk: string | null;
        industries: string[] | null;
        hoofddomein: string;
      };
    }

    const leadsByEmail = new Map<string, EnrichedLead>();
    for (const company of (platformContacts || []) as any[]) {
      const contacts = company.contacts || [];
      for (const contact of contacts) {
        if (contact.email) {
          const email = contact.email.toLowerCase().trim();
          leadsByEmail.set(email, {
            email,
            contactName: contact.name,
            phone: contact.phone,
            title: contact.title,
            company: {
              name: company.name,
              website: company.website,
              city: company.city,
              postal_code: company.postal_code,
              kvk: company.kvk,
              industries: company.industries,
              hoofddomein: company.hoofddomein,
            },
          });
        }
      }
    }

    if (leadsByEmail.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts found for configured platforms',
        processed: 0,
        configuredPlatforms: configuredPlatformNames,
      });
    }

    // 3. Filter: must be in instantly_pipedrive_syncs (Pipedrive synced) and not in mailerlite_syncs
    const platformEmails = Array.from(leadsByEmail.keys());

    // Check which are already in MailerLite
    const alreadySyncedSet = new Set<string>();
    for (let i = 0; i < platformEmails.length; i += 500) {
      const batch = platformEmails.slice(i, i + 500);
      const { data: synced } = await supabase
        .from('mailerlite_syncs')
        .select('email')
        .in('email', batch);
      if (synced) {
        for (const s of synced) alreadySyncedSet.add(s.email);
      }
    }

    // Check which are in Pipedrive syncs (successful, non-excluded events)
    const pipedriveMap = new Map<string, { pipedrive_org_id: number | null; pipedrive_person_id: number | null }>();
    for (let i = 0; i < platformEmails.length; i += 500) {
      const batch = platformEmails.slice(i, i + 500);
      const { data: syncs } = await supabase
        .from('instantly_pipedrive_syncs')
        .select('instantly_lead_email, pipedrive_org_id, pipedrive_person_id')
        .in('instantly_lead_email', batch)
        .eq('sync_success', true)
        .not('event_type', 'in', `(${EXCLUDED_EVENTS.join(',')})`);

      if (syncs) {
        for (const s of syncs) {
          const email = s.instantly_lead_email.toLowerCase().trim();
          if (!pipedriveMap.has(email)) {
            pipedriveMap.set(email, {
              pipedrive_org_id: s.pipedrive_org_id,
              pipedrive_person_id: s.pipedrive_person_id,
            });
          }
        }
      }
    }

    // Combine: in Pipedrive + not in MailerLite
    const toSync: EnrichedLead[] = [];
    for (const [email, lead] of leadsByEmail) {
      if (pipedriveMap.has(email) && !alreadySyncedSet.has(email)) {
        toSync.push(lead);
        if (toSync.length >= limit) break;
      }
    }

    if (toSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates to backfill',
        processed: 0,
        configuredPlatforms: configuredPlatformNames,
        stats: {
          platformContacts: leadsByEmail.size,
          alreadyInMailerLite: alreadySyncedSet.size,
          inPipedrive: pipedriveMap.size,
        },
      });
    }

    // 4. Sync each lead
    const results = {
      total: toSync.length,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ email: string; status: string; reason?: string; hoofddomein?: string }>,
    };

    for (const lead of toSync) {
      const pipedrive = pipedriveMap.get(lead.email)!;
      const nameParts = (lead.contactName || '').split(' ');

      const mlResult = await mailerliteSyncService.syncLeadToMailerLite(
        {
          email: lead.email,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          companyName: lead.company.name || undefined,
          phone: lead.phone || undefined,
          city: lead.company.city || undefined,
          postalCode: lead.company.postal_code || undefined,
          website: lead.company.website || undefined,
          hoofddomein: lead.company.hoofddomein,
          kvkNumber: lead.company.kvk || undefined,
          industries: lead.company.industries || undefined,
          title: lead.title || undefined,
        },
        pipedrive.pipedrive_org_id || undefined,
        pipedrive.pipedrive_person_id || undefined,
        'backfill',
        'backfill'
      );

      if (mlResult.success) {
        results.synced++;
        results.details.push({ email: lead.email, status: 'success', hoofddomein: lead.company.hoofddomein });

        // Update Pipedrive "Nieuwsbrief Status" to "Aangemeld"
        if (pipedrive.pipedrive_org_id) {
          try {
            await pipedriveClient.setNieuwsbriefStatus(pipedrive.pipedrive_org_id, 'Aangemeld');
          } catch (error) {
            console.error(`⚠️ Failed to set Nieuwsbrief Status for org ${pipedrive.pipedrive_org_id}:`, error);
          }
        }
      } else if (mlResult.skipped) {
        results.skipped++;
        results.details.push({ email: lead.email, status: 'skipped', reason: mlResult.skipReason, hoofddomein: lead.company.hoofddomein });
      } else {
        results.errors++;
        results.details.push({ email: lead.email, status: 'error', reason: mlResult.error, hoofddomein: lead.company.hoofddomein });
      }
    }

    console.log(`📬 MailerLite backfill: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors out of ${results.total}`);

    return NextResponse.json({
      success: true,
      platforms: configuredPlatformNames,
      ...results,
    });
  } catch (error: any) {
    console.error('❌ MailerLite backfill error:', error);
    return NextResponse.json(
      { error: error.message || 'Backfill failed' },
      { status: 500 }
    );
  }
}
