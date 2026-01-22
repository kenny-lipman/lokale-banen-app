/**
 * Hook for managing Campaign Assignment data
 *
 * Features:
 * - Fetches assignment logs with pagination and filters
 * - Fetches stats and batch history
 * - Manual trigger functionality
 * - Auto-refresh capability (configurable interval)
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface CampaignAssignmentLog {
  id: string;
  batch_id: string;
  contact_id: string;
  contact_email: string;
  company_id: string | null;
  company_name: string | null;
  platform_id: string | null;
  platform_name: string | null;
  instantly_campaign_id: string | null;
  status: 'added' | 'skipped_klant' | 'skipped_ai_error' | 'skipped_duplicate' | 'error';
  skip_reason: string | null;
  error_message: string | null;
  ai_personalization: Record<string, unknown> | null;
  ai_processing_time_ms: number | null;
  instantly_lead_id: string | null;
  pipedrive_org_id: number | null;
  pipedrive_is_klant: boolean;
  created_at: string;
}

export interface CampaignAssignmentBatch {
  id: string;
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_candidates: number;
  processed: number;
  added: number;
  skipped: number;
  errors: number;
  platform_stats: Record<string, { added: number; skipped: number; errors: number }>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CampaignAssignmentStats {
  total: number;
  added: number;
  skipped: number;
  skippedKlant: number;
  skippedAiError: number;
  skippedDuplicate: number;
  errors: number;
  successRate: number;
}

export interface CampaignAssignmentFilters {
  status?: string;
  platformId?: string;
  batchId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface UseCampaignAssignmentOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialLimit?: number;
}

export interface UseCampaignAssignmentReturn {
  // Logs data
  logs: CampaignAssignmentLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: CampaignAssignmentFilters;

  // Stats data
  stats: CampaignAssignmentStats;
  platformStats: Record<string, { added: number; skipped: number; errors: number }>;
  recentBatches: CampaignAssignmentBatch[];
  dailyTrend: Record<string, { added: number; skipped: number; errors: number }>;
  activeBatch: CampaignAssignmentBatch | undefined;

  // State
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  autoRefreshEnabled: boolean;
  isRunning: boolean;

  // Actions
  changePage: (page: number) => void;
  changeLimit: (limit: number) => void;
  updateFilters: (newFilters: Partial<CampaignAssignmentFilters>) => void;
  clearFilters: () => void;
  refetch: () => Promise<void>;
  refetchStats: () => Promise<void>;
  toggleAutoRefresh: () => void;
  runAssignment: (maxTotal?: number, maxPerPlatform?: number) => Promise<{ success: boolean; batchId?: string; error?: string }>;
  cancelAssignment: (batchId?: string) => Promise<{ success: boolean; error?: string }>;
  previewCandidates: (maxTotal?: number, maxPerPlatform?: number) => Promise<{ success: boolean; candidates?: unknown[]; error?: string }>;
}

const DEFAULT_STATS: CampaignAssignmentStats = {
  total: 0,
  added: 0,
  skipped: 0,
  skippedKlant: 0,
  skippedAiError: 0,
  skippedDuplicate: 0,
  errors: 0,
  successRate: 0,
};

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export function useCampaignAssignment(options: UseCampaignAssignmentOptions = {}): UseCampaignAssignmentReturn {
  const {
    autoRefresh: initialAutoRefresh = true,
    refreshInterval = 30000,
    initialLimit = 50,
  } = options;

  // Logs state
  const [logs, setLogs] = useState<CampaignAssignmentLog[]>([]);
  const [pagination, setPagination] = useState({ ...DEFAULT_PAGINATION, limit: initialLimit });
  const [filters, setFilters] = useState<CampaignAssignmentFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<CampaignAssignmentStats>(DEFAULT_STATS);
  const [platformStats, setPlatformStats] = useState<Record<string, { added: number; skipped: number; errors: number }>>({});
  const [recentBatches, setRecentBatches] = useState<CampaignAssignmentBatch[]>([]);
  const [dailyTrend, setDailyTrend] = useState<Record<string, { added: number; skipped: number; errors: number }>>({});
  const [statsLoading, setStatsLoading] = useState(true);

  // Other state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(initialAutoRefresh);
  const [isRunning, setIsRunning] = useState(false);

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch logs
  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      if (filters.status) params.set('status', filters.status);
      if (filters.platformId) params.set('platformId', filters.platformId);
      if (filters.batchId) params.set('batchId', filters.batchId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(`/api/campaign-assignment/logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch logs');
      }

      setLogs(data.data);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching campaign assignment logs:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Fetch stats
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const response = await fetch(`/api/campaign-assignment/stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      setStats(data.stats);
      setPlatformStats(data.platformStats || {});
      setRecentBatches(data.recentBatches || []);
      setDailyTrend(data.dailyTrend || {});
    } catch (err) {
      console.error('Error fetching campaign assignment stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Check if there's an active batch
  const activeBatch = recentBatches.find(b => b.status === 'processing' || b.status === 'pending');

  // Auto-refresh - faster when there's an active batch
  useEffect(() => {
    if (autoRefreshEnabled) {
      // Poll every 3 seconds when batch is active, otherwise use normal interval
      const interval = activeBatch ? 3000 : refreshInterval;

      intervalRef.current = setInterval(() => {
        fetchLogs(true);
        fetchStats(true);
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval, fetchLogs, fetchStats, activeBatch?.id]);

  // Actions
  const changePage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const changeLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<CampaignAssignmentFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchLogs();
  }, [fetchLogs]);

  const refetchStats = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev);
  }, []);

  const runAssignment = useCallback(async (maxTotal = 500, maxPerPlatform = 30) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/campaign-assignment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTotal, maxPerPlatform }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to run assignment');
      }

      // Refetch data after run
      await Promise.all([fetchLogs(), fetchStats()]);

      return { success: true, batchId: data.batchId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMessage };
    } finally {
      setIsRunning(false);
    }
  }, [fetchLogs, fetchStats]);

  const cancelAssignment = useCallback(async (batchId?: string) => {
    try {
      const response = await fetch('/api/campaign-assignment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel assignment');
      }

      // Refetch data after cancel
      await Promise.all([fetchLogs(), fetchStats()]);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }, [fetchLogs, fetchStats]);

  const previewCandidates = useCallback(async (maxTotal = 50, maxPerPlatform = 10) => {
    try {
      const params = new URLSearchParams();
      params.set('maxTotal', maxTotal.toString());
      params.set('maxPerPlatform', maxPerPlatform.toString());

      const response = await fetch(`/api/campaign-assignment/run?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to preview candidates');
      }

      return { success: true, candidates: data.candidates };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    logs,
    pagination,
    filters,
    stats,
    platformStats,
    recentBatches,
    dailyTrend,
    activeBatch,
    loading,
    statsLoading,
    error,
    autoRefreshEnabled,
    isRunning,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
    refetch,
    refetchStats,
    toggleAutoRefresh,
    runAssignment,
    cancelAssignment,
    previewCandidates,
  };
}

// Status display config
export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  added: { label: 'Added', color: 'bg-green-100 text-green-700', icon: '✓' },
  skipped_klant: { label: 'Skipped (Klant)', color: 'bg-yellow-100 text-yellow-700', icon: '🏢' },
  skipped_ai_error: { label: 'Skipped (AI Error)', color: 'bg-orange-100 text-orange-700', icon: '🤖' },
  skipped_duplicate: { label: 'Skipped (Duplicate)', color: 'bg-gray-100 text-gray-700', icon: '♻️' },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: '❌' },
};

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-600',
    icon: '❔',
  };
}
