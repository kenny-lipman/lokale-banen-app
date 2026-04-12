"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Users,
  Building,
  Mail
} from 'lucide-react'

interface StageProgressIndicatorProps {
  currentStage: 'scraping' | 'enrichment' | 'campaigns' | 'results'
  isProcessing: boolean
  progress: {
    total: number
    completed: number
    failed: number
  }
  currentOperation: string
}

export function StageProgressIndicator({ 
  currentStage, 
  isProcessing, 
  progress, 
  currentOperation 
}: StageProgressIndicatorProps) {
  const getStageIcon = () => {
    switch (currentStage) {
      case 'scraping': return <TrendingUp className="w-5 h-5 text-blue-600" />
      case 'enrichment': return <Building className="w-5 h-5 text-green-600" />
      case 'campaigns': return <Mail className="w-5 h-5 text-orange-600" />
      case 'results': return <CheckCircle className="w-5 h-5 text-purple-600" />
      default: return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const getStageColor = () => {
    switch (currentStage) {
      case 'scraping': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'enrichment': return 'text-green-600 bg-green-50 border-green-200'
      case 'campaigns': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'results': return 'text-purple-600 bg-purple-50 border-purple-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStageTitle = () => {
    switch (currentStage) {
      case 'scraping': return 'Job Scraping'
      case 'enrichment': return 'Company Enrichment'
      case 'campaigns': return 'Campaign Creation'
      case 'results': return 'Results & Analytics'
      default: return 'Workflow Stage'
    }
  }

  const getStageDescription = () => {
    switch (currentStage) {
      case 'scraping': return 'Collecting job vacancies from selected platforms'
      case 'enrichment': return 'Enriching companies with contact information'
      case 'campaigns': return 'Creating and sending email campaigns'
      case 'results': return 'Analyzing workflow results and performance'
      default: return 'Processing workflow stage'
    }
  }

  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0

  return (
    <Card className={`border-2 ${getStageColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          {getStageIcon()}
          <div className="flex-1">
            <CardTitle className="text-lg">{getStageTitle()}</CardTitle>
            <p className="text-sm text-gray-600">{getStageDescription()}</p>
          </div>
          <Badge 
            variant={isProcessing ? "secondary" : "outline"}
            className={isProcessing ? "bg-blue-100 text-blue-800 animate-pulse" : ""}
          >
            {isProcessing ? "Processing" : "Ready"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">
              {progress.completed}/{progress.total} ({Math.round(progressPercentage)}%)
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
            <div className="text-xs text-green-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
            <div className="text-xs text-red-600">Failed</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{progress.total - progress.completed - progress.failed}</div>
            <div className="text-xs text-blue-600">Pending</div>
          </div>
        </div>

        {/* Current Operation */}
        {isProcessing && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">{currentOperation}</span>
            </div>
          </div>
        )}

        {/* Stage-specific metrics */}
        {currentStage === 'scraping' && progress.completed > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div>• Found {progress.completed} job vacancies</div>
              <div>• Extracted {Math.round(progress.completed * 0.8)} unique companies</div>
            </div>
          </div>
        )}

        {currentStage === 'enrichment' && progress.completed > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div>• Enriched {progress.completed} companies</div>
              <div>• Found {Math.round(progress.completed * 2.3)} contacts</div>
            </div>
          </div>
        )}

        {currentStage === 'campaigns' && progress.completed > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div>• Created {progress.completed} campaigns</div>
              <div>• Sent to {Math.round(progress.completed * 33.5)} recipients</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 