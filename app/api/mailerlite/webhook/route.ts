import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { pipedriveClient } from '@/lib/pipedrive-client';

/**
 * POST /api/mailerlite/webhook
 *
 * Handles MailerLite webhook events:
 * - subscriber.unsubscribed → set "Afgemeld" on Pipedrive org
 * - subscriber.spam_reported → set "Afgemeld" on Pipedrive org
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body?.events?.[0]?.type || body?.type;
    const subscriberEmail = body?.events?.[0]?.data?.subscriber?.email || body?.data?.subscriber?.email || body?.email;

    console.log(`📬 MailerLite webhook received: ${eventType} for ${subscriberEmail || 'unknown'}`);

    if (!subscriberEmail) {
      return NextResponse.json({ error: 'No subscriber email in payload' }, { status: 400 });
    }

    // Only handle unsubscribe/spam events
    if (eventType !== 'subscriber.unsubscribed' && eventType !== 'subscriber.spam_reported') {
      return NextResponse.json({ message: `Event "${eventType}" ignored` });
    }

    const email = subscriberEmail.toLowerCase().trim();
    const supabase = createServiceRoleClient();

    // Look up Pipedrive org ID via multiple strategies
    const orgId = await findPipedriveOrgId(supabase, email);

    if (!orgId) {
      console.warn(`⚠️ No Pipedrive org found for unsubscribed email ${email}`);
      return NextResponse.json({
        message: 'Processed but no Pipedrive org found',
        email,
      });
    }

    // Set "Afgemeld" on Pipedrive organization
    const result = await pipedriveClient.setNieuwsbriefStatus(orgId, 'Afgemeld');

    // Update mailerlite_syncs record if exists
    await supabase
      .from('mailerlite_syncs')
      .update({
        sync_success: false,
        sync_error: `Unsubscribed via ${eventType}`,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    console.log(`✅ Processed MailerLite ${eventType} for ${email} → Pipedrive org ${orgId}: ${result.success ? 'Afgemeld' : result.reason}`);

    return NextResponse.json({
      success: true,
      message: `Set Nieuwsbrief Status to "Afgemeld" for org ${orgId}`,
      email,
      pipedriveOrgId: orgId,
    });
  } catch (error: any) {
    console.error('❌ MailerLite webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Find Pipedrive org ID for an email using 3 strategies:
 * 1. mailerlite_syncs table
 * 2. instantly_pipedrive_syncs table
 * 3. Pipedrive person search → org lookup
 */
async function findPipedriveOrgId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  email: string
): Promise<number | null> {
  // Strategy 1: mailerlite_syncs
  const { data: mlSync } = await supabase
    .from('mailerlite_syncs')
    .select('pipedrive_org_id')
    .eq('email', email)
    .not('pipedrive_org_id', 'is', null)
    .single();

  if (mlSync?.pipedrive_org_id) {
    return mlSync.pipedrive_org_id;
  }

  // Strategy 2: instantly_pipedrive_syncs
  const { data: ipSync } = await supabase
    .from('instantly_pipedrive_syncs')
    .select('pipedrive_org_id')
    .eq('instantly_lead_email', email)
    .not('pipedrive_org_id', 'is', null)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  if (ipSync?.pipedrive_org_id) {
    return ipSync.pipedrive_org_id;
  }

  // Strategy 3: Pipedrive person search
  try {
    const persons = await pipedriveClient.searchPersonByEmail(email);
    if (persons?.[0]?.item?.organization?.id) {
      return persons[0].item.organization.id;
    }
  } catch {
    // Pipedrive search failed, that's OK
  }

  return null;
}
