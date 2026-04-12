import { supabaseService } from '@/lib/supabase-service';
import { instantlyService, InstantlyBlocklistSyncResult } from './instantly-sync.service';
import { pipedriveService, PipedriveBlocklistSyncResult } from './pipedrive-sync.service';

export interface SyncResult {
  platform: 'instantly' | 'pipedrive';
  success: boolean;
  message?: string;
  error?: string;
  sync_timestamp: Date;
  entry_id?: string;
}

export interface SyncStatus {
  total_entries: number;
  successful_syncs: number;
  failed_syncs: number;
  in_progress: number;
  last_sync_at?: Date;
  platforms: {
    instantly: {
      enabled: boolean;
      last_sync: Date | null;
      success_count: number;
      error_count: number;
      last_error?: string;
    };
    pipedrive: {
      enabled: boolean;
      last_sync: Date | null;
      success_count: number;
      error_count: number;
      last_error?: string;
    };
  };
}

export interface BlocklistEntry {
  id: string;
  type: 'email' | 'domain';
  value: string;
  reason: string;
  is_active: boolean;
  instantly_synced: boolean;
  instantly_synced_at: Date | null;
  instantly_error: string | null;
  pipedrive_synced: boolean;
  pipedrive_synced_at: Date | null;
  pipedrive_error: string | null;
}

export interface SyncQueueItem {
  id: string;
  entry_id: string;
  platform: 'instantly' | 'pipedrive';
  action: 'create' | 'update' | 'delete';
  data: any;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  scheduled_for: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class BlocklistSyncOrchestrator {
  private supabase = supabaseService.serviceClient;
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor() {
    this.startQueueProcessor();
  }

  async syncEntry(entryId: string, action: 'create' | 'update' | 'delete' = 'create'): Promise<SyncResult[]> {
    try {
      const { data: entry, error } = await this.supabase
        .from('blocklist_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error || !entry) {
        throw new Error(`Failed to fetch blocklist entry: ${error?.message}`);
      }

      const results: SyncResult[] = [];

      const instantlyResult = await this.syncToInstantly(entry, action);
      results.push({
        platform: 'instantly',
        ...instantlyResult,
        entry_id: entryId
      });

      const pipedriveResult = await this.syncToPipedrive(entry, action);
      results.push({
        platform: 'pipedrive',
        ...pipedriveResult,
        entry_id: entryId
      });

      await this.updateSyncStatus(entryId, results);

      return results;
    } catch (error) {
      console.error('Failed to sync entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';

      return [
        {
          platform: 'instantly',
          success: false,
          error: errorMessage,
          sync_timestamp: new Date(),
          entry_id: entryId
        },
        {
          platform: 'pipedrive',
          success: false,
          error: errorMessage,
          sync_timestamp: new Date(),
          entry_id: entryId
        }
      ];
    }
  }

  private async syncToInstantly(
    entry: BlocklistEntry,
    action: 'create' | 'update' | 'delete'
  ): Promise<Omit<SyncResult, 'platform' | 'entry_id'>> {
    try {
      let result: InstantlyBlocklistSyncResult;

      switch (action) {
        case 'create':
        case 'update':
          result = await instantlyService.syncBlocklistEntry(entry);
          break;
        case 'delete':
          if (entry.type === 'email') {
            result = await instantlyService.removeFromSuppressionList(entry.value);
          } else {
            result = {
              success: true,
              message: 'Domain entries are not synced to Instantly',
              sync_timestamp: new Date()
            };
          }
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: result.success,
        message: result.message,
        error: result.error,
        sync_timestamp: result.sync_timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Instantly sync failed',
        sync_timestamp: new Date()
      };
    }
  }

  private async syncToPipedrive(
    entry: BlocklistEntry,
    action: 'create' | 'update' | 'delete'
  ): Promise<Omit<SyncResult, 'platform' | 'entry_id'>> {
    try {
      let result: PipedriveBlocklistSyncResult;

      switch (action) {
        case 'create':
        case 'update':
          result = await pipedriveService.syncBlocklistEntry(entry);
          break;
        case 'delete':
          if (entry.type === 'email') {
            result = await pipedriveService.unblockPersonByEmail(entry.value);
          } else {
            result = {
              success: true,
              message: 'Domain entries require manual handling in Pipedrive',
              sync_timestamp: new Date()
            };
          }
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: result.success,
        message: result.message,
        error: result.error,
        sync_timestamp: result.sync_timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pipedrive sync failed',
        sync_timestamp: new Date()
      };
    }
  }

  private async updateSyncStatus(entryId: string, results: SyncResult[]): Promise<void> {
    const instantlyResult = results.find(r => r.platform === 'instantly');
    const pipedriveResult = results.find(r => r.platform === 'pipedrive');

    const updateData: any = {};

    if (instantlyResult) {
      updateData.instantly_synced = instantlyResult.success;
      updateData.instantly_synced_at = instantlyResult.sync_timestamp;
      updateData.instantly_error = instantlyResult.error || null;
    }

    if (pipedriveResult) {
      updateData.pipedrive_synced = pipedriveResult.success;
      updateData.pipedrive_synced_at = pipedriveResult.sync_timestamp;
      updateData.pipedrive_error = pipedriveResult.error || null;
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await this.supabase
      .from('blocklist_entries')
      .update(updateData)
      .eq('id', entryId);

    if (error) {
      console.error('Failed to update sync status:', error);
    }
  }

  async bulkSync(entryIds: string[], action: 'create' | 'update' | 'delete' = 'create'): Promise<SyncResult[]> {
    const allResults: SyncResult[] = [];

    for (const entryId of entryIds) {
      try {
        const results = await this.syncEntry(entryId, action);
        allResults.push(...results);

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to sync entry ${entryId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        allResults.push(
          {
            platform: 'instantly',
            success: false,
            error: errorMessage,
            sync_timestamp: new Date(),
            entry_id: entryId
          },
          {
            platform: 'pipedrive',
            success: false,
            error: errorMessage,
            sync_timestamp: new Date(),
            entry_id: entryId
          }
        );
      }
    }

    return allResults;
  }

  async queueSync(
    entryId: string,
    platform: 'instantly' | 'pipedrive',
    action: 'create' | 'update' | 'delete',
    data: any,
    scheduleFor?: Date
  ): Promise<string> {
    const queueItem: SyncQueueItem = {
      id: `${entryId}-${platform}-${Date.now()}`,
      entry_id: entryId,
      platform,
      action,
      data,
      retry_count: 0,
      max_retries: this.maxRetries,
      created_at: new Date(),
      scheduled_for: scheduleFor || new Date(),
      status: 'pending'
    };

    this.syncQueue.set(queueItem.id, queueItem);
    return queueItem.id;
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        await this.processQueue();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Queue processing error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processQueue(): Promise<void> {
    const now = new Date();
    const pendingItems = Array.from(this.syncQueue.values())
      .filter(item => item.status === 'pending' && item.scheduled_for <= now)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    for (const item of pendingItems.slice(0, 5)) {
      try {
        item.status = 'processing';
        this.syncQueue.set(item.id, item);

        const results = await this.syncEntry(item.entry_id, item.action);
        const platformResult = results.find(r => r.platform === item.platform);

        if (platformResult?.success) {
          item.status = 'completed';
          this.syncQueue.delete(item.id);
        } else {
          await this.handleFailedSync(item, platformResult?.error || 'Unknown error');
        }
      } catch (error) {
        await this.handleFailedSync(item, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private async handleFailedSync(item: SyncQueueItem, error: string): Promise<void> {
    item.retry_count++;

    if (item.retry_count >= item.max_retries) {
      item.status = 'failed';
      console.error(`Max retries exceeded for sync item ${item.id}: ${error}`);

      setTimeout(() => {
        this.syncQueue.delete(item.id);
      }, 60000);
    } else {
      item.status = 'pending';
      const delay = this.retryDelays[item.retry_count - 1] || 30000;
      item.scheduled_for = new Date(Date.now() + delay);
      console.warn(`Retrying sync item ${item.id} in ${delay}ms (attempt ${item.retry_count}/${item.max_retries})`);
    }

    this.syncQueue.set(item.id, item);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const { data: entries, error } = await this.supabase
        .from('blocklist_entries')
        .select('*');

      if (error) {
        throw new Error(error.message);
      }

      const total = entries?.length || 0;
      const instantlySuccessful = entries?.filter(e => e.instantly_synced).length || 0;
      const pipedriveSuccessful = entries?.filter(e => e.pipedrive_synced).length || 0;
      const instantlyErrors = entries?.filter(e => e.instantly_error).length || 0;
      const pipedriveErrors = entries?.filter(e => e.pipedrive_error).length || 0;

      const lastInstantlySync = entries
        ?.filter(e => e.instantly_synced_at)
        .map(e => new Date(e.instantly_synced_at))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      const lastPipedriveSync = entries
        ?.filter(e => e.pipedrive_synced_at)
        .map(e => new Date(e.pipedrive_synced_at))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      const queuedItems = Array.from(this.syncQueue.values());
      const inProgress = queuedItems.filter(item => item.status === 'processing').length;

      return {
        total_entries: total,
        successful_syncs: Math.min(instantlySuccessful, pipedriveSuccessful),
        failed_syncs: Math.max(instantlyErrors, pipedriveErrors),
        in_progress: inProgress,
        last_sync_at: lastInstantlySync && lastPipedriveSync
          ? new Date(Math.max(lastInstantlySync.getTime(), lastPipedriveSync.getTime()))
          : lastInstantlySync || lastPipedriveSync || undefined,
        platforms: {
          instantly: {
            enabled: !!process.env.INSTANTLY_API_KEY,
            last_sync: lastInstantlySync,
            success_count: instantlySuccessful,
            error_count: instantlyErrors,
            last_error: entries?.find(e => e.instantly_error)?.instantly_error
          },
          pipedrive: {
            enabled: !!process.env.PIPEDRIVE_API_TOKEN,
            last_sync: lastPipedriveSync,
            success_count: pipedriveSuccessful,
            error_count: pipedriveErrors,
            last_error: entries?.find(e => e.pipedrive_error)?.pipedrive_error
          }
        }
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  async testAllConnections(): Promise<{ instantly: boolean; pipedrive: boolean }> {
    const [instantly, pipedrive] = await Promise.all([
      instantlyService.testConnection(),
      pipedriveService.testConnection()
    ]);

    return { instantly, pipedrive };
  }

  async forceResync(entryIds?: string[]): Promise<SyncResult[]> {
    let targetIds: string[];

    if (entryIds) {
      targetIds = entryIds;
    } else {
      const { data: entries, error } = await this.supabase
        .from('blocklist_entries')
        .select('id')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch entries for resync: ${error.message}`);
      }

      targetIds = entries?.map(e => e.id) || [];
    }

    return await this.bulkSync(targetIds, 'update');
  }

  stopQueueProcessor(): void {
    this.isProcessing = false;
  }

  getQueueStatus(): { pending: number; processing: number; failed: number } {
    const items = Array.from(this.syncQueue.values());

    return {
      pending: items.filter(item => item.status === 'pending').length,
      processing: items.filter(item => item.status === 'processing').length,
      failed: items.filter(item => item.status === 'failed').length
    };
  }
}

export const syncOrchestrator = new BlocklistSyncOrchestrator();