import { NextRequest, NextResponse } from 'next/server';
import { validateSecretAuth } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { mailerliteSyncService } from '@/lib/services/mailerlite-sync.service';
import { pipedriveClient } from '@/lib/pipedrive-client';

/**
 * POST /api/mailerlite/backfill
 *
 * Backfill: sync existing positive-reply leads to MailerLite.
 * Starts from instantly_pipedrive_syncs (positive events only),
 * then enriches with company/contact data.
 * Auth: CRON_SECRET
 *
 * Query params:
 * - limit: max leads to process (default 50, max 200)
 * - platform: filter by specific platform (e.g. "AlkmaarseBanen")
 */

// Only positive events qualify for MailerLite sync (newsletter for interested leads)
const POSITIVE_EVENTS = [
  'lead_interested',
  'lead_meeting_booked',
  'custom_label_any_positive',
];

export async function POST(request: NextRequest) {
  // Auth check
  if (!validateSecretAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
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

    // 2. Start from positive leads in instantly_pipedrive_syncs (small set ~200)
    const { data: positiveLeads, error: leadsError } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('instantly_lead_email, pipedrive_org_id, pipedrive_person_id, event_type')
      .eq('sync_success', true)
      .in('event_type', POSITIVE_EVENTS)
      .order('synced_at', { ascending: false });

    if (leadsError) {
      throw new Error(`Positive leads query error: ${leadsError.message}`);
    }

    if (!positiveLeads?.length) {
      return NextResponse.json({
        success: true,
        message: 'No positive leads found in Pipedrive syncs',
        processed: 0,
      });
    }

    // Deduplicate by email (keep first = most recent)
    const positiveMap = new Map<string, { pipedrive_org_id: number | null; pipedrive_person_id: number | null; event_type: string }>();
    for (const lead of positiveLeads) {
      const email = lead.instantly_lead_email.toLowerCase().trim();
      if (!positiveMap.has(email)) {
        positiveMap.set(email, {
          pipedrive_org_id: lead.pipedrive_org_id,
          pipedrive_person_id: lead.pipedrive_person_id,
          event_type: lead.event_type,
        });
      }
    }

    // 3. Filter out already synced to MailerLite
    const positiveEmails = Array.from(positiveMap.keys());
    const alreadySyncedSet = new Set<string>();
    for (let i = 0; i < positiveEmails.length; i += 500) {
      const batch = positiveEmails.slice(i, i + 500);
      const { data: synced } = await supabase
        .from('mailerlite_syncs')
        .select('email')
        .in('email', batch);
      if (synced) {
        for (const s of synced) alreadySyncedSet.add(s.email.toLowerCase().trim());
      }
    }

    // 4. Get remaining candidates (positive + not yet in MailerLite)
    const candidateEmails = positiveEmails.filter(e => !alreadySyncedSet.has(e));

    if (candidateEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All positive leads already synced to MailerLite',
        processed: 0,
        stats: {
          totalPositiveLeads: positiveMap.size,
          alreadyInMailerLite: alreadySyncedSet.size,
        },
      });
    }

    // 5. Enrich with company/contact data from contacts table
    interface EnrichedCandidate {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      title?: string;
      companyName?: string;
      city?: string;
      postalCode?: string;
      website?: string;
      hoofddomein?: string;
      kvkNumber?: string;
      industries?: string[];
    }

    const enrichedMap = new Map<string, EnrichedCandidate>();

    // Batch lookup contacts by email
    for (let i = 0; i < candidateEmails.length; i += 100) {
      const batch = candidateEmails.slice(i, i + 100);
      const { data: contacts } = await supabase
        .from('contacts')
        .select(`
          email, first_name, last_name, name, phone, title,
          companies:company_id (name, website, city, postal_code, kvk, industries, hoofddomein)
        `)
        .in('email', batch);

      if (contacts) {
        for (const ct of contacts as any[]) {
          const email = ct.email.toLowerCase().trim();
          const company = ct.companies;
          // Only include if company is on a configured platform
          if (company?.hoofddomein && configuredPlatformNames.includes(company.hoofddomein)) {
            enrichedMap.set(email, {
              email,
              firstName: ct.first_name || ct.name || undefined,
              lastName: ct.last_name || undefined,
              phone: ct.phone || undefined,
              title: ct.title || undefined,
              companyName: company.name || undefined,
              city: company.city || undefined,
              postalCode: company.postal_code || undefined,
              website: company.website || undefined,
              hoofddomein: company.hoofddomein,
              kvkNumber: company.kvk || undefined,
              industries: company.industries || undefined,
            });
          }
        }
      }
    }

    // For candidates without contact record, still sync with minimal data
    const toSync: Array<{ enriched: EnrichedCandidate; pipedrive: { pipedrive_org_id: number | null; pipedrive_person_id: number | null; event_type: string } }> = [];
    for (const email of candidateEmails) {
      if (toSync.length >= limit) break;
      const pipedrive = positiveMap.get(email)!;
      const enriched = enrichedMap.get(email) || { email };
      // Skip if we have enrichment and it's not on a configured platform
      if (enriched.hoofddomein && !configuredPlatformNames.includes(enriched.hoofddomein)) continue;
      toSync.push({ enriched, pipedrive });
    }

    if (toSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates on configured platforms to backfill',
        processed: 0,
        configuredPlatforms: configuredPlatformNames,
        stats: {
          totalPositiveLeads: positiveMap.size,
          alreadyInMailerLite: alreadySyncedSet.size,
          candidatesBeforePlatformFilter: candidateEmails.length,
        },
      });
    }

    // 6. Sync each lead
    const results = {
      total: toSync.length,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ email: string; status: string; reason?: string; hoofddomein?: string }>,
    };

    for (const { enriched, pipedrive } of toSync) {
      const mlResult = await mailerliteSyncService.syncLeadToMailerLite(
        {
          email: enriched.email,
          firstName: enriched.firstName,
          lastName: enriched.lastName,
          companyName: enriched.companyName,
          phone: enriched.phone,
          city: enriched.city,
          postalCode: enriched.postalCode,
          website: enriched.website,
          hoofddomein: enriched.hoofddomein,
          kvkNumber: enriched.kvkNumber,
          industries: enriched.industries,
        },
        pipedrive.pipedrive_org_id || undefined,
        pipedrive.pipedrive_person_id || undefined,
        pipedrive.event_type,
        'backfill'
      );

      if (mlResult.success) {
        results.synced++;
        results.details.push({ email: enriched.email, status: 'success', hoofddomein: enriched.hoofddomein });

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
        results.details.push({ email: enriched.email, status: 'skipped', reason: mlResult.skipReason, hoofddomein: enriched.hoofddomein });
      } else {
        results.errors++;
        results.details.push({ email: enriched.email, status: 'error', reason: mlResult.error, hoofddomein: enriched.hoofddomein });
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
