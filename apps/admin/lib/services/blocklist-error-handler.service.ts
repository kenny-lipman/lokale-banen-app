import { createClient } from '@/lib/supabase/client';

export interface ErrorLog {
  id: string;
  error_type: 'sync' | 'api' | 'validation' | 'connection';
  platform: 'instantly' | 'pipedrive' | 'system';
  entry_id?: string;
  error_code?: string;
  error_message: string;
  error_details?: any;
  retry_count: number;
  max_retries: number;
  is_recoverable: boolean;
  created_at: Date;
  resolved_at?: Date;
  resolution_method?: string;
  stack_trace?: string;
}

export interface ErrorStats {
  total_errors: number;
  unresolved_errors: number;
  error_rate_24h: number;
  most_common_errors: Array<{
    error_type: string;
    platform: string;
    count: number;
    last_seen: Date;
  }>;
  platform_health: {
    instantly: { status: 'healthy' | 'degraded' | 'down'; error_count: number };
    pipedrive: { status: 'healthy' | 'degraded' | 'down'; error_count: number };
  };
}

export interface RecoveryAction {
  action_type: 'retry' | 'skip' | 'manual_intervention' | 'reset_connection';
  description: string;
  estimated_fix_time?: string;
  requires_user_action?: boolean;
  recovery_steps?: string[];
}

export class BlocklistErrorHandler {
  private supabase = createClient();
  private errorQueue: Map<string, ErrorLog> = new Map();
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000, 30000, 60000]; // Progressive backoff

  async logError(
    errorType: 'sync' | 'api' | 'validation' | 'connection',
    platform: 'instantly' | 'pipedrive' | 'system',
    error: Error | string,
    context?: {
      entryId?: string;
      errorCode?: string;
      additionalDetails?: any;
      isRecoverable?: boolean;
    }
  ): Promise<string> {
    const errorId = `${errorType}-${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const errorLog: ErrorLog = {
      id: errorId,
      error_type: errorType,
      platform,
      entry_id: context?.entryId,
      error_code: context?.errorCode,
      error_message: error instanceof Error ? error.message : error,
      error_details: context?.additionalDetails,
      retry_count: 0,
      max_retries: this.maxRetries,
      is_recoverable: context?.isRecoverable ?? this.isRecoverableError(error, errorType, platform),
      created_at: new Date(),
      stack_trace: error instanceof Error ? error.stack : undefined
    };

    // Store in memory queue for immediate processing
    this.errorQueue.set(errorId, errorLog);

    // Log to console for immediate visibility
    console.error(`[BlocklistErrorHandler] ${errorType.toUpperCase()} error on ${platform}:`, {
      errorId,
      message: errorLog.error_message,
      entryId: context?.entryId,
      isRecoverable: errorLog.is_recoverable
    });

    // Store in database for persistence (if available)
    try {
      await this.persistError(errorLog);
    } catch (dbError) {
      console.error('Failed to persist error to database:', dbError);
    }

    // Trigger automatic recovery if possible
    if (errorLog.is_recoverable) {
      this.scheduleRecovery(errorId);
    }

    return errorId;
  }

  private async persistError(errorLog: ErrorLog): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('error_logs')
        .insert({
          id: errorLog.id,
          error_type: errorLog.error_type,
          platform: errorLog.platform,
          entry_id: errorLog.entry_id,
          error_code: errorLog.error_code,
          error_message: errorLog.error_message,
          error_details: errorLog.error_details,
          retry_count: errorLog.retry_count,
          max_retries: errorLog.max_retries,
          is_recoverable: errorLog.is_recoverable,
          created_at: errorLog.created_at.toISOString(),
          stack_trace: errorLog.stack_trace
        });

      if (error) {
        console.warn('Database error logging not available:', error.message);
      }
    } catch (error) {
      console.warn('Error persistence failed:', error);
    }
  }

  private isRecoverableError(
    error: Error | string,
    errorType: string,
    platform: string
  ): boolean {
    const errorMessage = (error instanceof Error ? error.message : error).toLowerCase();

    // Network/connectivity errors are usually recoverable
    if (errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('enotfound')) {
      return true;
    }

    // Rate limiting errors are recoverable with delay
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('429')) {
      return true;
    }

    // Server errors (5xx) are usually temporary
    if (errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('server error')) {
      return true;
    }

    // Platform-specific recoverable errors
    if (platform === 'instantly') {
      if (errorMessage.includes('temporarily unavailable') ||
          errorMessage.includes('service unavailable')) {
        return true;
      }
    }

    if (platform === 'pipedrive') {
      if (errorMessage.includes('temporary error') ||
          errorMessage.includes('try again later')) {
        return true;
      }
    }

    // Authentication errors are not recoverable without manual intervention
    if (errorMessage.includes('unauthorized') ||
        errorMessage.includes('invalid token') ||
        errorMessage.includes('authentication failed')) {
      return false;
    }

    // Validation errors are not recoverable
    if (errorType === 'validation') {
      return false;
    }

    // Default to non-recoverable for safety
    return false;
  }

  private scheduleRecovery(errorId: string): void {
    const errorLog = this.errorQueue.get(errorId);
    if (!errorLog || errorLog.retry_count >= errorLog.max_retries) {
      return;
    }

    const delay = this.retryDelays[errorLog.retry_count] || 60000;

    setTimeout(async () => {
      await this.attemptRecovery(errorId);
    }, delay);
  }

  private async attemptRecovery(errorId: string): Promise<boolean> {
    const errorLog = this.errorQueue.get(errorId);
    if (!errorLog || !errorLog.is_recoverable) {
      return false;
    }

    errorLog.retry_count++;

    try {
      let recoverySuccessful = false;

      switch (errorLog.error_type) {
        case 'sync':
          recoverySuccessful = await this.recoverSyncError(errorLog);
          break;
        case 'api':
          recoverySuccessful = await this.recoverApiError(errorLog);
          break;
        case 'connection':
          recoverySuccessful = await this.recoverConnectionError(errorLog);
          break;
        default:
          recoverySuccessful = false;
      }

      if (recoverySuccessful) {
        await this.markErrorResolved(errorId, 'automatic_recovery');
        return true;
      } else if (errorLog.retry_count < errorLog.max_retries) {
        this.scheduleRecovery(errorId);
        return false;
      } else {
        console.error(`Max retries exceeded for error ${errorId}, manual intervention required`);
        return false;
      }
    } catch (recoveryError) {
      console.error(`Recovery attempt failed for error ${errorId}:`, recoveryError);
      if (errorLog.retry_count < errorLog.max_retries) {
        this.scheduleRecovery(errorId);
      }
      return false;
    }
  }

  private async recoverSyncError(errorLog: ErrorLog): Promise<boolean> {
    if (!errorLog.entry_id) {
      return false;
    }

    try {
      // Import sync orchestrator dynamically to avoid circular dependency
      const { syncOrchestrator } = await import('./blocklist-sync-orchestrator.service');

      const results = await syncOrchestrator.syncEntry(errorLog.entry_id, 'update');
      const platformResult = results.find(r => r.platform === errorLog.platform);

      return platformResult?.success || false;
    } catch (error) {
      console.error('Sync recovery failed:', error);
      return false;
    }
  }

  private async recoverApiError(errorLog: ErrorLog): Promise<boolean> {
    try {
      // Test the connection to see if the API is back online
      if (errorLog.platform === 'instantly') {
        const { instantlyService } = await import('./instantly-sync.service');
        return await instantlyService.testConnection();
      } else if (errorLog.platform === 'pipedrive') {
        const { pipedriveService } = await import('./pipedrive-sync.service');
        return await pipedriveService.testConnection();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async recoverConnectionError(errorLog: ErrorLog): Promise<boolean> {
    // Wait a bit and try to establish connection again
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.recoverApiError(errorLog);
  }

  async markErrorResolved(errorId: string, resolutionMethod: string): Promise<void> {
    const errorLog = this.errorQueue.get(errorId);
    if (errorLog) {
      errorLog.resolved_at = new Date();
      errorLog.resolution_method = resolutionMethod;
      this.errorQueue.delete(errorId);
    }

    try {
      await this.supabase
        .from('error_logs')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_method: resolutionMethod
        })
        .eq('id', errorId);
    } catch (error) {
      console.warn('Failed to update error resolution in database:', error);
    }
  }

  async getErrorStats(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<ErrorStats> {
    const now = new Date();
    const timeframeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const since = new Date(now.getTime() - timeframeMs[timeframe]);

    try {
      const { data: errors } = await this.supabase
        .from('error_logs')
        .select('*')
        .gte('created_at', since.toISOString());

      const totalErrors = errors?.length || 0;
      const unresolvedErrors = errors?.filter(e => !e.resolved_at).length || 0;

      // Calculate error rate (errors per hour)
      const hoursInTimeframe = timeframeMs[timeframe] / (60 * 60 * 1000);
      const errorRate = totalErrors / hoursInTimeframe;

      // Group errors by type and platform
      const errorGroups = (errors || []).reduce((acc, error) => {
        const key = `${error.error_type}-${error.platform}`;
        if (!acc[key]) {
          acc[key] = {
            error_type: error.error_type,
            platform: error.platform,
            count: 0,
            last_seen: new Date(error.created_at)
          };
        }
        acc[key].count++;
        const errorDate = new Date(error.created_at);
        if (errorDate > acc[key].last_seen) {
          acc[key].last_seen = errorDate;
        }
        return acc;
      }, {} as Record<string, any>);

      const mostCommonErrors = Object.values(errorGroups)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);

      // Platform health assessment
      const instantlyErrors = errors?.filter(e => e.platform === 'instantly' && !e.resolved_at).length || 0;
      const pipedriveErrors = errors?.filter(e => e.platform === 'pipedrive' && !e.resolved_at).length || 0;

      const getHealthStatus = (errorCount: number): 'healthy' | 'degraded' | 'down' => {
        if (errorCount === 0) return 'healthy';
        if (errorCount <= 5) return 'degraded';
        return 'down';
      };

      return {
        total_errors: totalErrors,
        unresolved_errors: unresolvedErrors,
        error_rate_24h: timeframe === '24h' ? errorRate : 0,
        most_common_errors: mostCommonErrors,
        platform_health: {
          instantly: {
            status: getHealthStatus(instantlyErrors),
            error_count: instantlyErrors
          },
          pipedrive: {
            status: getHealthStatus(pipedriveErrors),
            error_count: pipedriveErrors
          }
        }
      };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        total_errors: 0,
        unresolved_errors: 0,
        error_rate_24h: 0,
        most_common_errors: [],
        platform_health: {
          instantly: { status: 'healthy', error_count: 0 },
          pipedrive: { status: 'healthy', error_count: 0 }
        }
      };
    }
  }

  getRecoveryRecommendation(errorLog: ErrorLog): RecoveryAction {
    const errorMessage = errorLog.error_message.toLowerCase();

    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
      return {
        action_type: 'manual_intervention',
        description: 'API credentials need to be updated or refreshed',
        requires_user_action: true,
        recovery_steps: [
          'Check API key/token configuration',
          'Verify credentials are still valid',
          'Update environment variables if needed',
          'Test connection after updating credentials'
        ]
      };
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        action_type: 'retry',
        description: 'Wait for rate limit to reset, then retry automatically',
        estimated_fix_time: '5-15 minutes',
        recovery_steps: [
          'Wait for rate limit window to reset',
          'Reduce request frequency',
          'Consider implementing request batching'
        ]
      };
    }

    // Network/connectivity issues
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        action_type: 'retry',
        description: 'Temporary network issue, will retry automatically',
        estimated_fix_time: '1-5 minutes',
        recovery_steps: [
          'Check internet connectivity',
          'Verify API endpoints are accessible',
          'Consider network proxy/firewall settings'
        ]
      };
    }

    // Server errors
    if (errorMessage.includes('500') || errorMessage.includes('server error')) {
      return {
        action_type: 'retry',
        description: 'External service experiencing issues, will retry',
        estimated_fix_time: '5-30 minutes',
        recovery_steps: [
          'Check service status pages',
          'Monitor for service restoration',
          'Contact support if issue persists'
        ]
      };
    }

    // Data validation errors
    if (errorLog.error_type === 'validation') {
      return {
        action_type: 'manual_intervention',
        description: 'Data validation failed, manual review required',
        requires_user_action: true,
        recovery_steps: [
          'Review the data that failed validation',
          'Correct any format or content issues',
          'Re-submit the corrected data'
        ]
      };
    }

    // Default recommendation
    return {
      action_type: errorLog.is_recoverable ? 'retry' : 'manual_intervention',
      description: errorLog.is_recoverable
        ? 'Will retry automatically with exponential backoff'
        : 'Manual investigation required',
      requires_user_action: !errorLog.is_recoverable
    };
  }

  async getUnresolvedErrors(limit: number = 50): Promise<ErrorLog[]> {
    return Array.from(this.errorQueue.values())
      .filter(error => !error.resolved_at)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  async clearResolvedErrors(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [id, error] of this.errorQueue.entries()) {
      if (error.resolved_at && error.resolved_at < cutoff) {
        this.errorQueue.delete(id);
        clearedCount++;
      }
    }

    try {
      await this.supabase
        .from('error_logs')
        .delete()
        .not('resolved_at', 'is', null)
        .lt('resolved_at', cutoff.toISOString());
    } catch (error) {
      console.warn('Failed to clear resolved errors from database:', error);
    }

    return clearedCount;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const stats = await this.getErrorStats('1h');
    const unresolvedErrors = await this.getUnresolvedErrors(10);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (stats.unresolved_errors > 10) {
      status = 'critical';
      issues.push(`High number of unresolved errors: ${stats.unresolved_errors}`);
      recommendations.push('Investigate and resolve critical errors immediately');
    } else if (stats.unresolved_errors > 3) {
      status = 'degraded';
      issues.push(`Moderate number of unresolved errors: ${stats.unresolved_errors}`);
      recommendations.push('Review and address recent errors');
    }

    if (stats.platform_health.instantly.status === 'down') {
      status = 'critical';
      issues.push('Instantly integration is down');
      recommendations.push('Check Instantly API credentials and connectivity');
    }

    if (stats.platform_health.pipedrive.status === 'down') {
      status = 'critical';
      issues.push('Pipedrive integration is down');
      recommendations.push('Check Pipedrive API credentials and connectivity');
    }

    if (stats.error_rate_24h > 5) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`High error rate: ${stats.error_rate_24h.toFixed(2)} errors/hour`);
      recommendations.push('Monitor error patterns and consider rate limiting');
    }

    return { status, issues, recommendations };
  }
}

export const errorHandler = new BlocklistErrorHandler();