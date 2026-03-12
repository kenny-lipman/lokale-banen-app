import { NextRequest, NextResponse } from 'next/server';
import { validateSecretAuth } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { mailerliteSyncService } from '@/lib/services/mailerlite-sync.service';

/**
 * POST /api/mailerlite/backfill
 *
 * Backfill: sync existing Pipedrive-synced leads to MailerLite.
 * Picks leads from instantly_pipedrive_syncs that haven't been synced yet.
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

    // Get platforms with configured MailerLite groups
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

    // Find leads synced to Pipedrive but not yet to MailerLite
    const { data: filteredCandidates, error: filterError } = await supabase
      .from('instantly_pipedrive_syncs')
      .select(`
        instantly_lead_email,
        pipedrive_org_id,
        pipedrive_person_id,
        event_type,
        synced_at
      `)
      .eq('sync_success', true)
      .not('event_type', 'in', `(${EXCLUDED_EVENTS.join(',')})`)
      .order('synced_at', { ascending: false });

    if (filterError) {
      throw new Error(`Query error: ${filterError.message}`);
    }

    if (!filteredCandidates?.length) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found for backfill',
        processed: 0,
      });
    }

    // Deduplicate by email (take latest sync per email)
    const emailMap = new Map<string, typeof filteredCandidates[0]>();
    for (const c of filteredCandidates) {
      const email = c.instantly_lead_email.toLowerCase().trim();
      if (!emailMap.has(email)) {
        emailMap.set(email, c);
      }
    }

    // Filter out emails already in mailerlite_syncs
    const allEmails = Array.from(emailMap.keys());
    const { data: alreadySynced } = await supabase
      .from('mailerlite_syncs')
      .select('email')
      .in('email', allEmails);

    const alreadySyncedSet = new Set((alreadySynced || []).map(s => s.email));
    const notYetSynced = allEmails.filter(email => !alreadySyncedSet.has(email));

    // Filter by platform: fetch contacts with their company data
    // Use two separate queries to avoid join issues
    const emailBatches: string[][] = [];
    for (let i = 0; i < notYetSynced.length; i += 500) {
      emailBatches.push(notYetSynced.slice(i, i + 500));
    }

    interface ContactWithCompany {
      email: string;
      name: string | null;
      phone: string | null;
      title: string | null;
      company_id: string | null;
    }

    // Step 1: Get contacts
    const matchedContacts: ContactWithCompany[] = [];
    for (const batch of emailBatches) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('email, name, phone, title, company_id')
        .in('email', batch)
        .not('company_id', 'is', null);

      if (contacts) {
        matchedContacts.push(...contacts);
      }
      if (matchedContacts.length >= limit * 5) break; // Get enough to filter
    }

    // Step 2: Get company data for those contacts
    const companyIds = [...new Set(matchedContacts.map(c => c.company_id).filter(Boolean))] as string[];
    const companyMap = new Map<string, any>();

    for (let i = 0; i < companyIds.length; i += 500) {
      const batch = companyIds.slice(i, i + 500);
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, website, city, postal_code, kvk_number, employee_count, industry, hoofddomein')
        .in('id', batch)
        .in('hoofddomein', configuredPlatformNames);

      if (companies) {
        for (const comp of companies) {
          companyMap.set(comp.id, comp);
        }
      }
    }

    // Step 3: Combine and filter
    interface EnrichedContact {
      email: string;
      name: string | null;
      phone: string | null;
      title: string | null;
      company: any;
    }

    const enrichedContacts: EnrichedContact[] = [];
    for (const contact of matchedContacts) {
      const company = companyMap.get(contact.company_id!);
      if (company) {
        enrichedContacts.push({
          email: contact.email,
          name: contact.name,
          phone: contact.phone,
          title: contact.title,
          company,
        });
      }
    }

    const toSync = enrichedContacts.slice(0, limit);

    if (toSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found for configured platforms',
        processed: 0,
        totalCandidates: allEmails.length,
        alreadySynced: alreadySyncedSet.size,
        configuredPlatforms: configuredPlatformNames,
        debug: {
          contactsFound: matchedContacts.length,
          companiesMatched: companyMap.size,
        },
      });
    }

    // Sync each lead
    const results = {
      total: toSync.length,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ email: string; status: string; reason?: string; hoofddomein?: string }>,
    };

    for (const enriched of toSync) {
      const email = enriched.email.toLowerCase().trim();
      const candidate = emailMap.get(email)!;
      const nameParts = (enriched.name || '').split(' ');

      const mlResult = await mailerliteSyncService.syncLeadToMailerLite(
        {
          email,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          companyName: enriched.company?.name || undefined,
          phone: enriched.phone || undefined,
          city: enriched.company?.city || undefined,
          postalCode: enriched.company?.postal_code || undefined,
          website: enriched.company?.website || undefined,
          hoofddomein: enriched.company?.hoofddomein || undefined,
          kvkNumber: enriched.company?.kvk_number || undefined,
          employeeCount: enriched.company?.employee_count || undefined,
          industries: enriched.company?.industry ? [enriched.company.industry] : undefined,
          title: enriched.title || undefined,
        },
        candidate.pipedrive_org_id || undefined,
        candidate.pipedrive_person_id || undefined,
        'backfill',
        'backfill'
      );

      if (mlResult.success) {
        results.synced++;
        results.details.push({ email, status: 'success', hoofddomein: enriched.company?.hoofddomein });
      } else if (mlResult.skipped) {
        results.skipped++;
        results.details.push({ email, status: 'skipped', reason: mlResult.skipReason, hoofddomein: enriched.company?.hoofddomein });
      } else {
        results.errors++;
        results.details.push({ email, status: 'error', reason: mlResult.error, hoofddomein: enriched.company?.hoofddomein });
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
