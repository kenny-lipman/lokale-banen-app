/**
 * MailerLite Sync Events API
 *
 * Provides paginated list of sync events for the dashboard table view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export interface MailerLiteSyncEvent {
  id: string;
  email: string;
  mailerlite_subscriber_id: string | null;
  mailerlite_group_id: string | null;
  mailerlite_group_name: string | null;
  pipedrive_org_id: number | null;
  pipedrive_person_id: number | null;
  hoofddomein: string | null;
  sync_source: string;
  sync_success: boolean;
  sync_error: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MailerLiteSyncEventsResponse {
  success: boolean;
  data: MailerLiteSyncEvent[];
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
    successRate: number;
    lastSyncAt: string | null;
  };
}

/**
 * GET /api/mailerlite/sync-events
 *
 * Query parameters:
 * - page (default: 1)
 * - limit (default: 50, max: 100)
 * - search (search in email or group name)
 * - statuses (comma-separated: success,error)
 * - sync_source (filter by sync source)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const search = searchParams.get('search');
    const statusesParam = searchParams.get('statuses');
    const syncSource = searchParams.get('sync_source');

    const statuses = statusesParam ? statusesParam.split(',').filter(Boolean) : [];
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('mailerlite_syncs')
      .select(`
        id,
        email,
        mailerlite_subscriber_id,
        mailerlite_group_id,
        mailerlite_group_name,
        pipedrive_org_id,
        pipedrive_person_id,
        hoofddomein,
        sync_source,
        sync_success,
        sync_error,
        synced_at,
        created_at,
        updated_at
      `, { count: 'exact' });

    if (search) {
      query = query.or(`email.ilike.%${search}%,mailerlite_group_name.ilike.%${search}%`);
    }

    if (statuses.length > 0) {
      const statusConditions: string[] = [];
      if (statuses.includes('success')) {
        statusConditions.push('sync_success.eq.true');
      }
      if (statuses.includes('error')) {
        statusConditions.push('sync_success.eq.false');
      }
      if (statusConditions.length > 0) {
        query = query.or(statusConditions.join(','));
      }
    }

    if (syncSource) {
      query = query.eq('sync_source', syncSource);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching mailerlite sync events:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sync events' },
        { status: 500 }
      );
    }

    // Get stats
    const { data: statsData } = await supabase
      .from('mailerlite_syncs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const { count: successCount } = await supabase
      .from('mailerlite_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('sync_success', true);

    const { count: errorCount } = await supabase
      .from('mailerlite_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('sync_success', false);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const lastSyncAt = statsData?.[0]?.created_at || null;
    const totalStats = (successCount || 0) + (errorCount || 0);
    const successRate = totalStats > 0 ? Math.round(((successCount || 0) / totalStats) * 100) : 0;

    const response: MailerLiteSyncEventsResponse = {
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        total: totalStats,
        successCount: successCount || 0,
        errorCount: errorCount || 0,
        successRate,
        lastSyncAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in mailerlite sync-events endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
