"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  SkipForward, 
  RotateCcw, 
  Settings,
  Play,
  Pause,
  Square
} from 'lucide-react'
import { useWorkflow } from '@/contexts/otis-workflow-context'

interface NavigationControlsProps {
  currentStage: 'scraping' | 'enrichment' | 'campaigns' | 'results'
  isProcessing: boolean
  onStageChange: (stage: 'scraping' | 'enrichment' | 'campaigns' | 'results') => void
}

export function NavigationControls({ 
  currentStage, 
  isProcessing, 
  onStageChange 
}: NavigationControlsProps) {
  const { state, canNavigateToStage, isStageCompleted } = useWorkflow()
  
  const stages = [
    { id: 'scraping', name: 'Scraping', number: 1 },
    { id: 'enrichment', name: 'Enrichment', number: 2 },
    { id: 'campaigns', name: 'Campaigns', number: 3 },
    { id: 'results', name: 'Results', number: 4 }
  ]

  const currentStageIndex = stages.findIndex(stage => stage.id === currentStage)
  const canGoBack = currentStageIndex > 0 && isStageCompleted(stages[currentStageIndex - 1].id as any)
  const canGoForward = currentStageIndex < stages.length - 1 && isStageCompleted(currentStage)
  const canSkip = !isProcessing && currentStageIndex < stages.length - 1

  const handlePrevious = () => {
    if (canGoBack) {
      const previousStage = stages[currentStageIndex - 1].id as 'scraping' | 'enrichment' | 'campaigns' | 'results'
      onStageChange(previousStage)
    }
  }

  const handleNext = () => {
    if (canGoForward) {
      const nextStage = stages[currentStageIndex + 1].id as 'scraping' | 'enrichment' | 'campaigns' | 'results'
      onStageChange(nextStage)
    }
  }

  const handleSkip = () => {
    if (canSkip) {
      const nextStage = stages[currentStageIndex + 1].id as 'scraping' | 'enrichment' | 'campaigns' | 'results'
      onStageChange(nextStage)
    }
  }

  const handleRestart = () => {
    onStageChange('scraping')
  }

  const getStageStatus = (stageId: string) => {
    const stageIndex = stages.findIndex(stage => stage.id === stageId)
    
    if (isStageCompleted(stageId as any)) {
      return 'completed'
    } else if (stageIndex === currentStageIndex) {
      return isProcessing ? 'processing' : 'current'
    } else {
      return 'pending'
    }
  }

  const getStageIcon = (status: string, stageId: string) => {
    switch (status) {
      case 'completed':
        return <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
          <span className="text-green-600 text-xs font-semibold">✓</span>
        </div>
      case 'processing':
        return <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
        </div>
      case 'current':
        return <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-600 text-xs font-semibold">{stages[currentStageIndex].number}</span>
        </div>
      default:
        return <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-gray-400 text-xs font-semibold">{stages.find(s => s.id === stageId)?.number}</span>
        </div>
    }
  }

  return (
    <div className="space-y-4">
      {/* Stage Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Stage Navigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((stage) => {
            const status = getStageStatus(stage.id)
            const isClickable = status === 'completed' || status === 'current'
            
            return (
              <button
                key={stage.id}
                onClick={() => {
                  if (isClickable && !isProcessing) {
                    onStageChange(stage.id as 'scraping' | 'enrichment' | 'campaigns' | 'results')
                  }
                }}
                disabled={!isClickable || isProcessing}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  isClickable && !isProcessing
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : 'cursor-not-allowed opacity-60'
                } ${
                  currentStage === stage.id ? 'bg-blue-50 border border-blue-200' : ''
                }`}
                title={isClickable ? `Go to ${stage.name}` : `Complete previous stages to unlock ${stage.name}`}
              >
                {getStageIcon(status, stage.id)}
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      status === 'completed' ? 'text-green-700' :
                      status === 'processing' ? 'text-blue-700' :
                      status === 'current' ? 'text-blue-700' :
                      'text-gray-500'
                    }`}>
                      {stage.name}
                    </span>
                    {status === 'processing' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        Processing
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {stage.id === 'scraping' && 'Job vacancy scraping'}
                    {stage.id === 'enrichment' && 'Company data enrichment'}
                    {stage.id === 'campaigns' && 'Email campaign creation'}
                    {stage.id === 'results' && 'View results and analytics'}
                  </p>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Navigation Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Previous/Next Buttons */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={!canGoBack || isProcessing}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!canGoForward || isProcessing}
              className="flex-1"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Skip Button */}
          {canSkip && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkip}
              disabled={isProcessing}
              className="w-full"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip Stage
            </Button>
          )}

          {/* Restart Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            disabled={isProcessing}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restart Workflow
          </Button>
        </CardContent>
      </Card>

      {/* Processing Controls */}
      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-900">Processing Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="flex-1"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                disabled
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </div>
            
            <p className="text-xs text-blue-700">
              Processing {currentStage} stage. You can safely navigate away.
            </p>
          </CardContent>
        </Card>
      )}



      {/* Stage Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Workflow Progress</span>
              <span className="font-medium">
                {Math.round(((currentStageIndex + 1) / stages.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStageIndex + 1) / stages.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">
              Stage {currentStageIndex + 1} of {stages.length}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 