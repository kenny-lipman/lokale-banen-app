"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, XCircle, Loader2, Upload, ArrowRight } from 'lucide-react'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

// ============================================================================
// Types
// ============================================================================

interface PushProgressEvent {
  type: 'start' | 'company_resolving' | 'company_created' | 'company_exists' | 'ai_generating' | 'vacancy_created' | 'skipped' | 'error' | 'complete'
  jobPostingId?: string
  current: number
  total: number
  title?: string
  message: string
  error?: string
}

interface ValidationResult {
  valid: Array<{
    jobPostingId: string
    title: string
    companyName: string
    domain: string
  }>
  invalid: Array<{
    jobPostingId: string
    title: string
    reason: string
  }>
  summary: {
    total: number
    valid: number
    invalid: number
  }
}

type ModalState = 'validating' | 'preview' | 'pushing' | 'complete' | 'error'

interface Props {
  open: boolean
  onClose: () => void
  jobPostingIds: string[]
  onPushComplete?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function LokaleBanenPushModal({ open, onClose, jobPostingIds, onPushComplete }: Props) {
  const [state, setState] = useState<ModalState>('validating')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [progress, setProgress] = useState<PushProgressEvent[]>([])
  const [currentEvent, setCurrentEvent] = useState<PushProgressEvent | null>(null)
  const [result, setResult] = useState<{ success: number; skipped: number; failed: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Validate on open
  useEffect(() => {
    if (open && jobPostingIds.length > 0) {
      setState('validating')
      setValidation(null)
      setProgress([])
      setCurrentEvent(null)
      setResult(null)
      setErrorMessage(null)
      runValidation()
    }
  }, [open, jobPostingIds])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [progress])

  const runValidation = async () => {
    try {
      const res = await authenticatedFetch('/api/lokalebanen/validate', {
        method: 'POST',
        body: JSON.stringify({ jobPostingIds }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = 'Validatie mislukt'
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setValidation(data)
      setState('preview')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Validatie mislukt')
      setState('error')
    }
  }

  const startPush = async () => {
    if (!validation) return

    const validIds = validation.valid.map(v => v.jobPostingId)
    if (validIds.length === 0) return

    setState('pushing')

    try {
      const res = await authenticatedFetch('/api/lokalebanen/push', {
        method: 'POST',
        body: JSON.stringify({ jobPostingIds: validIds }),
      })

      // Handle non-stream error responses (e.g. auth failure, env var missing)
      if (!res.ok || !res.body) {
        const text = await res.text()
        let msg = 'Push mislukt'
        try { msg = JSON.parse(text).error || msg } catch { msg = text || msg }
        throw new Error(msg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const allEvents: PushProgressEvent[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: PushProgressEvent = JSON.parse(line.slice(6))
              setCurrentEvent(event)
              setProgress(prev => [...prev, event])
              allEvents.push(event)

              if (event.type === 'complete') {
                setResult({
                  success: countEvents(allEvents, 'vacancy_created'),
                  skipped: countEvents(allEvents, 'skipped'),
                  failed: countEvents(allEvents, 'error'),
                })
                setState('complete')
              } else if (event.type === 'error' && event.total === 0) {
                // Fatal error (not per-item error)
                throw new Error(event.message)
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                throw parseErr
              }
            }
          }
        }
      }

      // Stream ended without complete event — show results
      if (setState.length === 0 || allEvents[allEvents.length - 1]?.type !== 'complete') {
        setResult({
          success: countEvents(allEvents, 'vacancy_created'),
          skipped: countEvents(allEvents, 'skipped'),
          failed: countEvents(allEvents, 'error'),
        })
        setState('complete')
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Push mislukt')
      setState('error')
    }
  }

  const handleClose = () => {
    if (state === 'complete' && onPushComplete) {
      onPushComplete()
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Push naar Lokale Banen
          </DialogTitle>
          <DialogDescription>
            {jobPostingIds.length} vacature{jobPostingIds.length !== 1 ? 's' : ''} geselecteerd
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Validating */}
          {state === 'validating' && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-500" />
              <span className="text-gray-600">Vacatures valideren...</span>
            </div>
          )}

          {/* Preview */}
          {state === 'preview' && validation && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{validation.summary.valid}</div>
                  <div className="text-xs text-green-600">Klaar voor push</div>
                </div>
                <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{validation.summary.invalid}</div>
                  <div className="text-xs text-orange-600">Worden overgeslagen</div>
                </div>
              </div>

              {/* Invalid items */}
              {validation.invalid.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Worden overgeslagen:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {validation.invalid.map(item => (
                      <div key={item.jobPostingId} className="flex items-start gap-2 text-sm py-1">
                        <XCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium">{item.title}</span>
                          <span className="text-gray-500 ml-1">— {item.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Annuleren
                </Button>
                <Button
                  onClick={startPush}
                  disabled={validation.summary.valid === 0}
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Push {validation.summary.valid} vacature{validation.summary.valid !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Pushing */}
          {state === 'pushing' && currentEvent && (
            <div className="space-y-4">
              <Progress
                value={currentEvent.total > 0 ? (currentEvent.current / currentEvent.total) * 100 : 0}
              />
              <div className="text-sm text-gray-600 text-center">
                {currentEvent.current} / {currentEvent.total}
              </div>

              {/* Current action */}
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>{currentEvent.message}</span>
              </div>

              {/* Log */}
              <div ref={logRef} className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-3">
                {progress.filter(p => p.type !== 'start').map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {getEventIcon(event.type)}
                    <span className="text-gray-600">{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete */}
          {state === 'complete' && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-center">Push voltooid!</h3>

              <div className="flex gap-3">
                {result.success > 0 && (
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{result.success}</div>
                    <div className="text-xs text-green-600">Aangemaakt</div>
                  </div>
                )}
                {result.skipped > 0 && (
                  <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-700">{result.skipped}</div>
                    <div className="text-xs text-orange-600">Overgeslagen</div>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{result.failed}</div>
                    <div className="text-xs text-red-600">Mislukt</div>
                  </div>
                )}
              </div>

              {/* Log */}
              <div ref={logRef} className="max-h-40 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-3">
                {progress.filter(p => ['vacancy_created', 'skipped', 'error'].includes(p.type)).map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {getEventIcon(event.type)}
                    <span className="text-gray-600">
                      <span className="font-medium">{event.title}</span> — {event.message}
                    </span>
                  </div>
                ))}
              </div>

              <Button onClick={handleClose} className="w-full">
                Sluiten
              </Button>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Er is een fout opgetreden</span>
              </div>
              <p className="text-sm text-gray-600">{errorMessage}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Sluiten
                </Button>
                <Button onClick={runValidation} className="flex-1">
                  Opnieuw proberen
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getEventIcon(type: string) {
  switch (type) {
    case 'company_created':
      return <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1">NEW</Badge>
    case 'company_exists':
      return <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1">OK</Badge>
    case 'vacancy_created':
      return <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
    case 'skipped':
      return <XCircle className="h-3 w-3 text-orange-500 flex-shrink-0 mt-0.5" />
    case 'error':
      return <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
    default:
      return <Loader2 className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
  }
}

function countEvents(events: PushProgressEvent[], type: string): number {
  return events.filter(e => e.type === type).length
}
