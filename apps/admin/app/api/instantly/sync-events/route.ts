/**
 * Instantly Sync Events API
 *
 * Provides paginated list of sync events for the dashboard table view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export interface SyncEvent {
  id: string;
  event_type: string;
  instantly_lead_email: string;
  instantly_campaign_id: string;
  instantly_campaign_name: string | null;
  pipedrive_org_id: number | null;
  pipedrive_org_name: string | null;
  pipedrive_person_id: number | null;
  status_prospect_set: string | null;
  sync_source: string;
  has_reply: boolean;
  reply_sentiment: string | null;
  sync_success: boolean;
  sync_error: string | null;
  status_skipped: boolean;
  skip_reason: string | null;
  org_created: boolean;
  person_created: boolean;
  instantly_event_at: string | null;
  synced_at: string;
  created_at: string;
}

export interface SyncEventsResponse {
  success: boolean;
  data: SyncEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    successRate: number;
    lastSyncAt: string | null;
  };
}

/**
 * GET /api/instantly/sync-events
 *
 * Query parameters:
 * - page (default: 1)
 * - limit (default: 50, max: 100)
 * - event_types (comma-separated list of event types)
 * - search (search in email or campaign name)
 * - statuses (comma-separated: success,error,skipped)
 * - from_date (ISO date string)
 * - to_date (ISO date string)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const eventTypesParam = searchParams.get('event_types');
    const search = searchParams.get('search');
    const statusesParam = searchParams.get('statuses');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    // Parse comma-separated values
    const eventTypes = eventTypesParam ? eventTypesParam.split(',').filter(Boolean) : [];
    const statuses = statusesParam ? statusesParam.split(',').filter(Boolean) : [];

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('instantly_pipedrive_syncs')
      .select(`
        id,
        event_type,
        instantly_lead_email,
        instantly_campaign_id,
        instantly_campaign_name,
        pipedrive_org_id,
        pipedrive_org_name,
        pipedrive_person_id,
        status_prospect_set,
        sync_source,
        has_reply,
        reply_sentiment,
        sync_success,
        sync_error,
        status_skipped,
        skip_reason,
        org_created,
        person_created,
        instantly_event_at,
        synced_at,
        created_at
      `, { count: 'exact' });

    // Apply event type filter (multiple)
    if (eventTypes.length > 0) {
      query = query.in('event_type', eventTypes);
    }

    if (search) {
      query = query.or(`instantly_lead_email.ilike.%${search}%,instantly_campaign_name.ilike.%${search}%`);
    }

    // Apply status filter (multiple)
    if (statuses.length > 0) {
      const statusConditions: string[] = [];
      if (statuses.includes('success')) {
        statusConditions.push('and(sync_success.eq.true,status_skipped.eq.false)');
      }
      if (statuses.includes('error')) {
        statusConditions.push('sync_success.eq.false');
      }
      if (statuses.includes('skipped')) {
        statusConditions.push('status_skipped.eq.true');
      }
      if (statusConditions.length > 0) {
        query = query.or(statusConditions.join(','));
      }
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }

    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    // Order by created_at descending and apply pagination
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching sync events:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sync events' },
        { status: 500 }
      );
    }

    // Get stats (totals)
    const { data: statsData } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('sync_success, status_skipped, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    // Count success/error/skipped
    const { count: successCount } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('sync_success', true)
      .eq('status_skipped', false);

    const { count: errorCount } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('sync_success', false);

    const { count: skippedCount } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('status_skipped', true);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const lastSyncAt = statsData?.[0]?.created_at || null;
    const successRate = total > 0 ? Math.round(((successCount || 0) / total) * 100) : 0;

    const response: SyncEventsResponse = {
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        total,
        successCount: successCount || 0,
        errorCount: errorCount || 0,
        skippedCount: skippedCount || 0,
        successRate,
        lastSyncAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in sync-events endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
