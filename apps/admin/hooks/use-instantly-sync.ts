/**
 * Hook for managing Instantly <> Pipedrive sync events data
 *
 * Features:
 * - Fetches sync events with pagination and filters
 * - Auto-refresh capability (configurable interval)
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEvent, SyncEventsResponse } from '@/app/api/instantly/sync-events/route';

export interface SyncFilters {
  eventTypes?: string[];
  search?: string;
  statuses?: string[]; // 'success' | 'error' | 'skipped'
  fromDate?: string;
  toDate?: string;
}

export interface UseSyncEventsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  initialLimit?: number;
}

export interface UseSyncEventsReturn {
  // Data
  events: SyncEvent[];
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
  filters: SyncFilters;

  // State
  loading: boolean;
  error: string | null;
  autoRefreshEnabled: boolean;

  // Actions
  changePage: (page: number) => void;
  changeLimit: (limit: number) => void;
  updateFilters: (newFilters: Partial<SyncFilters>) => void;
  clearFilters: () => void;
  refetch: () => Promise<void>;
  toggleAutoRefresh: () => void;
}

const DEFAULT_STATS = {
  total: 0,
  successCount: 0,
  errorCount: 0,
  skippedCount: 0,
  successRate: 0,
  lastSyncAt: null,
};

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export function useInstantlySync(options: UseSyncEventsOptions = {}): UseSyncEventsReturn {
  const {
    autoRefresh: initialAutoRefresh = true,
    refreshInterval = 30000, // 30 seconds default
    initialLimit = 50,
  } = options;

  // State
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [pagination, setPagination] = useState({ ...DEFAULT_PAGINATION, limit: initialLimit });
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [filters, setFilters] = useState<SyncFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(initialAutoRefresh);

  // Refs for interval management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch function
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        params.set('event_types', filters.eventTypes.join(','));
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        params.set('statuses', filters.statuses.join(','));
      }
      if (filters.fromDate) {
        params.set('from_date', filters.fromDate);
      }
      if (filters.toDate) {
        params.set('to_date', filters.toDate);
      }

      const response = await fetch(`/api/instantly/sync-events?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SyncEventsResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch sync events');
      }

      setEvents(data.data);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching sync events:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Initial fetch and refetch on filter/pagination changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh management
  useEffect(() => {
    if (autoRefreshEnabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchEvents(true); // Silent refresh
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval, fetchEvents]);

  // Actions
  const changePage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const changeLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<SyncFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev);
  }, []);

  return {
    events,
    pagination,
    stats,
    filters,
    loading,
    error,
    autoRefreshEnabled,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
    refetch,
    toggleAutoRefresh,
  };
}

// Helper: Event type display info
export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  // Engagement events
  email_sent: { label: 'Email Sent', color: 'bg-gray-100 text-gray-700', icon: '📤' },
  email_opened: { label: 'Email Opened', color: 'bg-blue-100 text-blue-700', icon: '👁️' },
  email_link_clicked: { label: 'Link Clicked', color: 'bg-cyan-100 text-cyan-700', icon: '🔗' },

  // Critical events
  email_bounced: { label: 'Bounced', color: 'bg-red-100 text-red-700', icon: '❌' },
  lead_unsubscribed: { label: 'Unsubscribed', color: 'bg-red-100 text-red-700', icon: '🚫' },

  // Reply events
  reply_received: { label: 'Reply', color: 'bg-purple-100 text-purple-700', icon: '💬' },

  // Campaign events
  campaign_completed: { label: 'Campaign Done', color: 'bg-gray-100 text-gray-600', icon: '✓' },

  // Interest events
  lead_interested: { label: 'Interested', color: 'bg-green-100 text-green-700', icon: '👍' },
  lead_not_interested: { label: 'Not Interested', color: 'bg-orange-100 text-orange-700', icon: '👎' },
  lead_neutral: { label: 'Neutral', color: 'bg-yellow-100 text-yellow-700', icon: '😐' },

  // Meeting events (HIGH VALUE)
  lead_meeting_booked: { label: 'Meeting Booked', color: 'bg-emerald-100 text-emerald-700', icon: '📅' },
  lead_meeting_completed: { label: 'Meeting Done', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  lead_closed: { label: 'Closed Won', color: 'bg-emerald-200 text-emerald-800', icon: '🎉' },

  // Special events
  lead_out_of_office: { label: 'Out of Office', color: 'bg-amber-100 text-amber-700', icon: '🏖️' },
  lead_wrong_person: { label: 'Wrong Person', color: 'bg-orange-100 text-orange-700', icon: '❓' },
  account_error: { label: 'Account Error', color: 'bg-red-100 text-red-600', icon: '⚠️' },

  // Backfill
  backfill: { label: 'Backfill', color: 'bg-indigo-100 text-indigo-700', icon: '🔄' },
  lead_added: { label: 'Lead Added', color: 'bg-gray-100 text-gray-600', icon: '➕' },

  // Custom labels
  custom_label_any_positive: { label: 'Interessant/Reageren', color: 'bg-green-100 text-green-700', icon: '⭐' },
  custom_label_any_negative: { label: 'Niet meer contacten', color: 'bg-red-100 text-red-700', icon: '🚫' },
};

export function getEventTypeConfig(eventType: string) {
  return EVENT_TYPE_CONFIG[eventType] || {
    label: eventType,
    color: 'bg-gray-100 text-gray-600',
    icon: '❔',
  };
}
