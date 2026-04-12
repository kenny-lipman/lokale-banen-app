'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw, Shield, Zap } from 'lucide-react';
import { syncOrchestrator } from '@/lib/services/blocklist-sync-orchestrator.service';

interface SyncStatusToasterProps {
  enabled?: boolean;
  pollInterval?: number;
}

export function SyncStatusToaster({
  enabled = true,
  pollInterval = 5000
}: SyncStatusToasterProps) {
  const lastSyncStatus = useRef<{
    instantly: { synced: number; errors: number };
    pipedrive: { synced: number; errors: number };
    inProgress: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const checkSyncStatus = async () => {
      try {
        const status = await syncOrchestrator.getSyncStatus();
        const queueStatus = syncOrchestrator.getQueueStatus();

        // Check for new sync completions
        if (lastSyncStatus.current) {
          const prev = lastSyncStatus.current;

          // Check Instantly sync updates
          if (status.platforms.instantly.success_count > prev.instantly.synced) {
            const newSyncs = status.platforms.instantly.success_count - prev.instantly.synced;
            toast({
              title: 'Instantly Sync Voltooid',
              description: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{newSyncs} contact{newSyncs !== 1 ? 'en' : ''} gesynchroniseerd</span>
                </div>
              ),
              duration: 3000
            });
          }

          // Check Instantly sync errors
          if (status.platforms.instantly.error_count > prev.instantly.errors) {
            const newErrors = status.platforms.instantly.error_count - prev.instantly.errors;
            toast({
              title: 'Instantly Sync Fout',
              description: (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>{newErrors} synchronisatie{newErrors !== 1 ? 's' : ''} mislukt</span>
                </div>
              ),
              variant: 'destructive',
              duration: 5000
            });
          }

          // Check Pipedrive sync updates
          if (status.platforms.pipedrive.success_count > prev.pipedrive.synced) {
            const newSyncs = status.platforms.pipedrive.success_count - prev.pipedrive.synced;
            toast({
              title: 'Pipedrive Sync Voltooid',
              description: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{newSyncs} contact{newSyncs !== 1 ? 'en' : ''} gesynchroniseerd</span>
                </div>
              ),
              duration: 3000
            });
          }

          // Check Pipedrive sync errors
          if (status.platforms.pipedrive.error_count > prev.pipedrive.errors) {
            const newErrors = status.platforms.pipedrive.error_count - prev.pipedrive.errors;
            toast({
              title: 'Pipedrive Sync Fout',
              description: (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>{newErrors} synchronisatie{newErrors !== 1 ? 's' : ''} mislukt</span>
                </div>
              ),
              variant: 'destructive',
              duration: 5000
            });
          }

          // Check for sync queue activity
          if (queueStatus.processing > 0 && prev.inProgress === 0) {
            toast({
              title: 'Synchronisatie Gestart',
              description: (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Blocklist synchronisatie is bezig...</span>
                </div>
              ),
              duration: 2000
            });
          }

          // Check for completed queue
          if (queueStatus.processing === 0 && prev.inProgress > 0) {
            toast({
              title: 'Synchronisatie Compleet',
              description: (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span>Alle blocklist entries zijn gesynchroniseerd</span>
                </div>
              ),
              duration: 3000
            });
          }
        }

        // Update last sync status
        lastSyncStatus.current = {
          instantly: {
            synced: status.platforms.instantly.success_count,
            errors: status.platforms.instantly.error_count
          },
          pipedrive: {
            synced: status.platforms.pipedrive.success_count,
            errors: status.platforms.pipedrive.error_count
          },
          inProgress: queueStatus.processing
        };

        // Check platform health and show warnings
        if (status.platforms.instantly.enabled && status.platforms.instantly.last_error) {
          const timeSinceError = status.platforms.instantly.last_sync
            ? Date.now() - new Date(status.platforms.instantly.last_sync).getTime()
            : Infinity;

          // Show warning if error is recent (within last 5 minutes)
          if (timeSinceError < 5 * 60 * 1000) {
            toast({
              title: 'Instantly Connectie Waarschuwing',
              description: (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span>Mogelijk connectie probleem</span>
                  </div>
                  <p className="text-xs text-gray-600">{status.platforms.instantly.last_error}</p>
                </div>
              ),
              duration: 10000
            });
          }
        }

        if (status.platforms.pipedrive.enabled && status.platforms.pipedrive.last_error) {
          const timeSinceError = status.platforms.pipedrive.last_sync
            ? Date.now() - new Date(status.platforms.pipedrive.last_sync).getTime()
            : Infinity;

          // Show warning if error is recent (within last 5 minutes)
          if (timeSinceError < 5 * 60 * 1000) {
            toast({
              title: 'Pipedrive Connectie Waarschuwing',
              description: (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span>Mogelijk connectie probleem</span>
                  </div>
                  <p className="text-xs text-gray-600">{status.platforms.pipedrive.last_error}</p>
                </div>
              ),
              duration: 10000
            });
          }
        }

      } catch (error) {
        console.error('Failed to check sync status:', error);
      }
    };

    // Initial check
    checkSyncStatus();

    // Set up polling interval
    const interval = setInterval(checkSyncStatus, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, pollInterval]);

  return null; // This component doesn't render anything
}

// Helper function to show manual sync toast
export function showSyncToast(
  platform: 'instantly' | 'pipedrive' | 'both',
  action: 'start' | 'success' | 'error',
  details?: { count?: number; error?: string }
) {
  switch (action) {
    case 'start':
      toast({
        title: `${platform === 'both' ? 'Volledige' : platform} Synchronisatie`,
        description: (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Synchronisatie wordt gestart...</span>
          </div>
        ),
        duration: 2000
      });
      break;

    case 'success':
      toast({
        title: 'Synchronisatie Succesvol',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>
              {details?.count
                ? `${details.count} entries gesynchroniseerd naar ${platform}`
                : `Synchronisatie naar ${platform} voltooid`}
            </span>
          </div>
        ),
        duration: 4000
      });
      break;

    case 'error':
      toast({
        title: 'Synchronisatie Mislukt',
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>Fout bij synchroniseren naar {platform}</span>
            </div>
            {details?.error && (
              <p className="text-xs text-gray-600">{details.error}</p>
            )}
          </div>
        ),
        variant: 'destructive',
        duration: 6000
      });
      break;
  }
}

// Helper function for bulk operation toasts
export function showBulkOperationToast(
  operation: 'block' | 'unblock' | 'sync',
  status: 'start' | 'progress' | 'complete' | 'error',
  details?: { total?: number; completed?: number; failed?: number; error?: string }
) {
  const operationText = operation === 'block' ? 'Blokkeren' : operation === 'unblock' ? 'Deblokkeren' : 'Synchroniseren';

  switch (status) {
    case 'start':
      toast({
        title: `Bulk ${operationText}`,
        description: (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Bezig met {details?.total || 0} items...</span>
          </div>
        ),
        duration: 3000
      });
      break;

    case 'progress':
      if (details?.completed && details?.total) {
        const percentage = Math.round((details.completed / details.total) * 100);
        toast({
          title: `${operationText} Voortgang`,
          description: (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span>{details.completed} van {details.total} voltooid</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          ),
          duration: 2000
        });
      }
      break;

    case 'complete':
      toast({
        title: `${operationText} Voltooid`,
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>
              {details?.completed || 0} succesvol
              {details?.failed ? `, ${details.failed} mislukt` : ''}
            </span>
          </div>
        ),
        duration: 4000
      });
      break;

    case 'error':
      toast({
        title: `${operationText} Fout`,
        description: (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>Bulk operatie mislukt</span>
            </div>
            {details?.error && (
              <p className="text-xs text-gray-600">{details.error}</p>
            )}
          </div>
        ),
        variant: 'destructive',
        duration: 6000
      });
      break;
  }
}