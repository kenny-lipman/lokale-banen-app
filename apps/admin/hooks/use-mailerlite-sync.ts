/**
 * Hook for managing MailerLite sync events data
 *
 * Features:
 * - Fetches sync events with pagination and filters
 * - Auto-refresh capability (configurable interval)
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MailerLiteSyncEvent, MailerLiteSyncEventsResponse } from '@/app/api/mailerlite/sync-events/route';

export interface MailerLiteSyncFilters {
  search?: string;
  statuses?: string[]; // 'success' | 'error'
  syncSource?: string;
}

export interface UseMailerLiteSyncOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialLimit?: number;
}

export interface UseMailerLiteSyncReturn {
  events: MailerLiteSyncEvent[];
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
  filters: MailerLiteSyncFilters;
  loading: boolean;
  error: string | null;
  autoRefreshEnabled: boolean;
  changePage: (page: number) => void;
  changeLimit: (limit: number) => void;
  updateFilters: (newFilters: Partial<MailerLiteSyncFilters>) => void;
  clearFilters: () => void;
  refetch: () => Promise<void>;
  toggleAutoRefresh: () => void;
}

const DEFAULT_STATS = {
  total: 0,
  successCount: 0,
  errorCount: 0,
  successRate: 0,
  lastSyncAt: null,
};

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export function useMailerLiteSync(options: UseMailerLiteSyncOptions = {}): UseMailerLiteSyncReturn {
  const {
    autoRefresh: initialAutoRefresh = true,
    refreshInterval = 30000,
    initialLimit = 50,
  } = options;

  const [events, setEvents] = useState<MailerLiteSyncEvent[]>([]);
  const [pagination, setPagination] = useState({ ...DEFAULT_PAGINATION, limit: initialLimit });
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [filters, setFilters] = useState<MailerLiteSyncFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(initialAutoRefresh);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        params.set('statuses', filters.statuses.join(','));
      }
      if (filters.syncSource) {
        params.set('sync_source', filters.syncSource);
      }

      const response = await fetch(`/api/mailerlite/sync-events?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: MailerLiteSyncEventsResponse = await response.json();

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
      console.error('Error fetching mailerlite sync events:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (autoRefreshEnabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchEvents(true);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval, fetchEvents]);

  const changePage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const changeLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<MailerLiteSyncFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
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
