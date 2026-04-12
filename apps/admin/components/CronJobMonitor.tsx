"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle, Clock, RefreshCw, Timer, XCircle, AlertTriangle } from 'lucide-react'
import { supabaseService } from '@/lib/supabase-service'
import { EXPECTED_INTERVAL_MS, OVERDUE_MULTIPLIER } from '@/lib/cron-config'

interface CronJobLog {
  id: string
  job_name: string
  path: string
  status: 'success' | 'error' | 'timeout'
  duration_ms: number
  http_status: number | null
  error_message: string | null
  response_summary: Record<string, unknown> | null
  started_at: string
  completed_at: string
}

interface JobStats {
  totalRuns: number
  successCount: number
  errorCount: number
  timeoutCount: number
  avgDurationMs: number
  maxDurationMs: number
  successRate: number
}

interface JobSummary {
  name: string
  path: string
  schedule: string
  description: string
  latestRun: CronJobLog | null
  stats: JobStats | null
}

interface CronLogsResponse {
  success: boolean
  days: number
  jobs: JobSummary[]
  logs: CronJobLog[]
  error?: string
}

const MAX_DURATION_MS = 300_000
const WARNING_THRESHOLD_MS = 200_000

function isJobOverdue(job: JobSummary): boolean {
  if (!job.latestRun) return false
  const expectedMs = EXPECTED_INTERVAL_MS[job.name]
  if (!expectedMs) return false
  const elapsed = Date.now() - new Date(job.latestRun.started_at).getTime()
  return elapsed > expectedMs * OVERDUE_MULTIPLIER
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'zojuist'
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffHours < 24) return `${diffHours} uur geleden`
  return `${diffDays} dag${diffDays === 1 ? '' : 'en'} geleden`
}

function getDurationColor(ms: number): string {
  if (ms < 60_000) return 'text-green-600'
  if (ms < WARNING_THRESHOLD_MS) return 'text-orange-500'
  return 'text-red-600'
}

function getDurationBgColor(ms: number): string {
  if (ms < 60_000) return 'bg-green-500'
  if (ms < WARNING_THRESHOLD_MS) return 'bg-orange-500'
  return 'bg-red-500'
}

function StatusBadge({ status }: { status: 'success' | 'error' | 'timeout' }) {
  switch (status) {
    case 'success':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Success
        </Badge>
      )
    case 'error':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          <XCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      )
    case 'timeout':
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
          <Timer className="w-3 h-3 mr-1" />
          Timeout
        </Badge>
      )
  }
}

export function CronJobMonitor() {
  const [data, setData] = useState<CronLogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/api/cron/logs?days=7', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`)
      }

      const result: CronLogsResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Summary counts
  const totalJobs = data?.jobs.length ?? 0
  const jobsOk = data?.jobs.filter(j => j.latestRun?.status === 'success').length ?? 0
  const jobsWarning = data?.jobs.filter(j =>
    j.latestRun && j.latestRun.status === 'success' && j.latestRun.duration_ms >= WARNING_THRESHOLD_MS
  ).length ?? 0
  const jobsError = data?.jobs.filter(j =>
    j.latestRun && (j.latestRun.status === 'error' || j.latestRun.status === 'timeout')
  ).length ?? 0
  const jobsNoData = data?.jobs.filter(j => !j.latestRun).length ?? 0

  // Jobs nearing timeout
  const warningJobs = data?.jobs.filter(j =>
    j.latestRun && j.latestRun.duration_ms >= WARNING_THRESHOLD_MS
  ) ?? []

  // Jobs that haven't run when they should have
  const overdueJobs = data?.jobs.filter(j => isJobOverdue(j)) ?? []

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cron Job Monitor</CardTitle>
          <CardDescription>Overzicht van cron job uitvoeringen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cron Job Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Cron Job Monitor
            </CardTitle>
            <CardDescription>
              Overzicht van alle cron jobs — laatste 7 dagen
            </CardDescription>
          </div>
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-gray-500">Totaal Jobs</div>
            <div className="text-2xl font-bold mt-1">{totalJobs}</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="text-sm font-medium text-green-700">OK</div>
            <div className="text-2xl font-bold text-green-700 mt-1">{jobsOk}</div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="text-sm font-medium text-orange-700">Warnings</div>
            <div className="text-2xl font-bold text-orange-700 mt-1">{jobsWarning}</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-medium text-red-700">Errors</div>
            <div className="text-2xl font-bold text-red-700 mt-1">{jobsError}</div>
          </div>
        </div>

        {/* Overdue Alert */}
        {overdueJobs.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{overdueJobs.length} job(s) zijn gestopt met draaien:</strong>{' '}
              {overdueJobs.map(j => {
                const ago = j.latestRun ? formatRelativeTime(j.latestRun.started_at) : 'onbekend'
                return `${j.name} (laatste run: ${ago})`
              }).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Timeout Warning */}
        {warningJobs.length > 0 && (
          <Alert className="border-orange-300 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{warningJobs.length} job(s) naderen de timeout limiet (300s):</strong>{' '}
              {warningJobs.map(j => j.name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Job Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium">Job</th>
                <th className="text-left p-3 font-medium">Schedule</th>
                <th className="text-left p-3 font-medium">Laatste Run</th>
                <th className="text-left p-3 font-medium">Duration</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Timeout Budget</th>
                <th className="text-right p-3 font-medium">7d Stats</th>
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((job) => {
                const durationPercent = job.latestRun
                  ? Math.min((job.latestRun.duration_ms / MAX_DURATION_MS) * 100, 100)
                  : 0

                return (
                  <tr key={job.name} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{job.name}</div>
                      <div className="text-xs text-gray-500">{job.description}</div>
                    </td>
                    <td className="p-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{job.schedule}</code>
                    </td>
                    <td className="p-3">
                      {job.latestRun ? (
                        <span
                          className={isJobOverdue(job) ? 'text-red-600 font-medium' : 'text-gray-600'}
                          title={new Date(job.latestRun.started_at).toLocaleString('nl-NL')}
                        >
                          {formatRelativeTime(job.latestRun.started_at)}
                          {isJobOverdue(job) && ' (overdue!)'}
                        </span>
                      ) : (
                        <span className="text-gray-400">Geen data</span>
                      )}
                    </td>
                    <td className="p-3">
                      {job.latestRun ? (
                        <span className={`font-mono font-medium ${getDurationColor(job.latestRun.duration_ms)}`}>
                          {formatDuration(job.latestRun.duration_ms)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {job.latestRun ? (
                        <StatusBadge status={job.latestRun.status} />
                      ) : (
                        <Badge variant="outline" className="text-gray-400">
                          N/A
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 min-w-[140px]">
                      {job.latestRun ? (
                        <div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getDurationBgColor(job.latestRun.duration_ms)}`}
                              style={{ width: `${durationPercent}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(durationPercent)}% van 300s
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {job.stats ? (
                        <div className="text-xs space-y-0.5">
                          <div>{job.stats.totalRuns} runs</div>
                          <div className="text-green-600">{job.stats.successRate}% OK</div>
                          <div className="text-gray-500">avg {formatDuration(job.stats.avgDurationMs)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Geen data</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* No Data Info */}
        {jobsNoData > 0 && (
          <p className="text-sm text-gray-500">
            {jobsNoData} job(s) hebben nog geen uitvoeringsdata. Data verschijnt na de eerste run met monitoring.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
