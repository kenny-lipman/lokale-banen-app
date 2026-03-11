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

    // Find leads synced to Pipedrive but not yet to MailerLite
    // Group by email (a lead can have multiple sync records)
    const { data: candidates, error: queryError } = await supabase
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

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!candidates?.length) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found for backfill',
        processed: 0,
      });
    }

    // Deduplicate by email (take latest sync per email)
    const emailMap = new Map<string, typeof candidates[0]>();
    for (const c of candidates) {
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
    const toSync = allEmails
      .filter(email => !alreadySyncedSet.has(email))
      .slice(0, limit);

    if (toSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All candidates already synced',
        processed: 0,
        totalCandidates: allEmails.length,
        alreadySynced: alreadySyncedSet.size,
      });
    }

    // Enrich and sync each lead
    const results = {
      total: toSync.length,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ email: string; status: string; reason?: string }>,
    };

    for (const email of toSync) {
      const candidate = emailMap.get(email)!;

      // Try to get enrichment data from contacts/companies
      const { data: contact } = await supabase
        .from('contacts')
        .select(`
          name, email, phone, title,
          companies (
            name, website, city, postal_code, kvk_number,
            employee_count, industry, hoofddomein
          )
        `)
        .eq('email', email)
        .limit(1)
        .single();

      const company = (contact as any)?.companies;
      const nameParts = (contact?.name || '').split(' ');

      const mlResult = await mailerliteSyncService.syncLeadToMailerLite(
        {
          email,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          companyName: company?.name,
          phone: contact?.phone || undefined,
          city: company?.city || undefined,
          postalCode: company?.postal_code || undefined,
          website: company?.website || undefined,
          hoofddomein: company?.hoofddomein || undefined,
          kvkNumber: company?.kvk_number || undefined,
          employeeCount: company?.employee_count || undefined,
          industries: company?.industry ? [company.industry] : undefined,
          title: contact?.title || undefined,
        },
        candidate.pipedrive_org_id || undefined,
        candidate.pipedrive_person_id || undefined,
        'backfill',
        'backfill'
      );

      if (mlResult.success) {
        results.synced++;
        results.details.push({ email, status: 'success' });
      } else if (mlResult.skipped) {
        results.skipped++;
        results.details.push({ email, status: 'skipped', reason: mlResult.skipReason });
      } else {
        results.errors++;
        results.details.push({ email, status: 'error', reason: mlResult.error });
      }
    }

    console.log(`📬 MailerLite backfill: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors out of ${results.total}`);

    return NextResponse.json({
      success: true,
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
