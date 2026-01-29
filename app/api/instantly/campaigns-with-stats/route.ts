/**
 * GET /api/instantly/campaigns-with-stats
 *
 * Returns all Instantly campaigns with analytics data.
 * Uses the bulk /campaigns/analytics endpoint (single API call for all campaigns).
 * Used by the Campaign Sync tab on the dashboard.
 */

import { NextResponse } from 'next/server';
import { instantlyClient, type InstantlyCampaignAnalytics } from '@/lib/instantly-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch all campaign analytics in a single API call
    const allAnalytics = await instantlyClient.getAllCampaignsAnalytics();

    const campaigns = allAnalytics.map((a) => ({
      id: a.campaign_id,
      name: a.campaign_name,
      status: a.campaign_status,
      leadsCount: a.leads_count || 0,
      contactedCount: a.contacted_count || 0,
      emailsSentCount: a.emails_sent_count || 0,
      openCount: a.open_count || 0,
      replyCount: a.reply_count || 0,
      bouncedCount: a.bounced_count || 0,
      completedCount: a.completed_count || 0,
    }));

    return NextResponse.json({
      success: true,
      total: campaigns.length,
      campaigns,
    });
  } catch (error) {
    console.error('Error fetching campaigns with stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch campaigns',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
