"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Zap, CheckCircle, XCircle, Clock, AlertCircle, X, Minimize2 } from "lucide-react"

export interface EnrichmentJob {
  companyId: string
  companyName: string
  website: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: {
    contactsFound?: number
    enrichedData?: any
    error?: string
  }
}

interface EnrichmentProgressModalProps {
  isOpen: boolean
  onClose: () => void
  jobs: EnrichmentJob[]
  batchId?: string
  onComplete?: () => void
  className?: string
}

export function EnrichmentProgressModal({
  isOpen,
  onClose,
  jobs,
  batchId,
  onComplete,
  className = ""
}: EnrichmentProgressModalProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Calculate progress statistics
  const totalJobs = jobs.length
  const completedJobs = jobs.filter(job => job.status === 'completed').length
  const failedJobs = jobs.filter(job => job.status === 'failed').length
  const processingJobs = jobs.filter(job => job.status === 'processing').length
  const queuedJobs = jobs.filter(job => job.status === 'queued').length
  
  const progressPercentage = totalJobs > 0 ? Math.round(((completedJobs + failedJobs) / totalJobs) * 100) : 0
  const isComplete = (completedJobs + failedJobs) === totalJobs
  
  // Auto-call onComplete when all jobs are done
  useEffect(() => {
    if (isComplete && totalJobs > 0 && onComplete) {
      onComplete()
    }
  }, [isComplete, totalJobs, onComplete])

  const getStatusBadge = (job: EnrichmentJob) => {
    switch (job.status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Voltooid
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Mislukt
          </Badge>
        )
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Bezig
          </Badge>
        )
      case 'queued':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            In wachtrij
          </Badge>
        )
      default:
        return null
    }
  }

  const getResultMessage = (job: EnrichmentJob) => {
    if (job.status === 'completed' && job.result?.contactsFound) {
      return `${job.result.contactsFound} contacten gevonden`
    }
    if (job.status === 'failed' && job.result?.error) {
      return job.result.error
    }
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[80vh] ${className}`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>Apollo Bedrijfsverrijking</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {isComplete 
                    ? `Verrijking voltooid voor ${totalJobs} bedrijven`
                    : `Verrijkt ${totalJobs} bedrijven met Apollo contactgegevens`
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Uitklappen" : "Inklappen"}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={!isComplete}
                title={isComplete ? "Sluiten" : "Wacht tot verrijking voltooid is"}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {!isMinimized && (
          <div className="space-y-6">
            {/* Progress Overview */}
            <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Voortgang</h3>
                  <div className="text-2xl font-bold text-blue-600">
                    {progressPercentage}%
                  </div>
                </div>
                
                <Progress value={progressPercentage} className="h-3" />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{completedJobs}</div>
                    <div className="text-sm text-gray-600">Voltooid</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{failedJobs}</div>
                    <div className="text-sm text-gray-600">Mislukt</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{processingJobs}</div>
                    <div className="text-sm text-gray-600">Bezig</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">{queuedJobs}</div>
                    <div className="text-sm text-gray-600">In wachtrij</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Individual Job Status */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h3 className="font-semibold">Bedrijven Status</h3>
              {jobs.map((job) => (
                <Card key={job.companyId} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{job.companyName}</div>
                        <div className="text-sm text-gray-500 truncate">{job.website}</div>
                      </div>
                      {getStatusBadge(job)}
                    </div>
                    
                    <div className="text-right">
                      {getResultMessage(job) && (
                        <div className={`text-sm ${
                          job.status === 'completed' 
                            ? 'text-green-600' 
                            : job.status === 'failed'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {getResultMessage(job)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Completion Actions */}
            {isComplete && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Sluiten
                </Button>
                <Button 
                  onClick={() => {
                    // TODO: Trigger table refresh
                    onClose()
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Bekijk Resultaten
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Minimized View */}
        {isMinimized && (
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Progress value={progressPercentage} className="w-32 h-2" />
                <span className="text-sm font-medium">{progressPercentage}%</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>{completedJobs}/{totalJobs} voltooid</span>
                {failedJobs > 0 && (
                  <span className="text-red-600">({failedJobs} mislukt)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 