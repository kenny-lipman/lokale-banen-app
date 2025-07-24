# Frontend Developer - Otis UX Enhancement To-Dos

**Developer**: Frontend Developer  
**Project**: Otis UX Enhancement  
**Week**: 1  
**Priority**: Critical  

---

## 🚀 **Week 1 Frontend Developer Tasks**

### **Task 1: Basic Dashboard Structure (Days 1-3)**

#### **Day 1: Main Dashboard Component**
**Priority**: Critical  
**Duration**: 4 hours  
**Dependencies**: None

**To-Do List:**
- [ ] **Create component directory structure**
  ```bash
  # Create Otis component structure
  mkdir -p components/otis
  mkdir -p components/otis/stages
  mkdir -p components/otis/ui
  touch components/otis/OtisDashboard.tsx
  touch components/otis/OtisHeader.tsx
  touch components/otis/WorkflowStages.tsx
  touch components/otis/ProgressOverlay.tsx
  touch components/otis/SessionPanel.tsx
  touch components/otis/NavigationControls.tsx
  ```

- [ ] **Implement main dashboard component**
  ```typescript
  // File: components/otis/OtisDashboard.tsx
  "use client"

  import { useState } from 'react'
  import { OtisHeader } from './OtisHeader'
  import { WorkflowStages } from './WorkflowStages'
  import { ProgressOverlay } from './ProgressOverlay'
  import { SessionPanel } from './SessionPanel'
  import { NavigationControls } from './NavigationControls'

  export function OtisDashboard() {
    const [currentStage, setCurrentStage] = useState<'scraping' | 'enrichment' | 'campaigns' | 'results'>('scraping')
    const [isProcessing, setIsProcessing] = useState(false)
    const [sessionId, setSessionId] = useState<string>('')

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OtisHeader sessionId={sessionId} />
          
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
              <WorkflowStages 
                currentStage={currentStage}
                isProcessing={isProcessing}
                onStageChange={setCurrentStage}
              />
            </div>
            
            <div className="lg:col-span-1">
              <SessionPanel 
                currentStage={currentStage}
                isProcessing={isProcessing}
              />
              <NavigationControls 
                currentStage={currentStage}
                onStageChange={setCurrentStage}
                isProcessing={isProcessing}
              />
            </div>
          </div>
          
          {isProcessing && <ProgressOverlay />}
        </div>
      </div>
    )
  }
  ```

- [ ] **Create header component**
  ```typescript
  // File: components/otis/OtisHeader.tsx
  interface OtisHeaderProps {
    sessionId: string
  }

  export function OtisHeader({ sessionId }: OtisHeaderProps) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Otis Agent Dashboard</h1>
            <p className="text-gray-500">Streamlined job scraping and enrichment workflow</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Session ID</p>
              <p className="text-sm font-mono text-gray-900">
                {sessionId || 'Not started'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Connected</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Create workflow stages container**
  ```typescript
  // File: components/otis/WorkflowStages.tsx
  import { Stage1Scraping } from './stages/Stage1Scraping'
  import { Stage2Enrichment } from './stages/Stage2Enrichment'
  import { Stage3Campaigns } from './stages/Stage3Campaigns'
  import { Stage4Results } from './stages/Stage4Results'

  interface WorkflowStagesProps {
    currentStage: string
    isProcessing: boolean
    onStageChange: (stage: 'scraping' | 'enrichment' | 'campaigns' | 'results') => void
  }

  export function WorkflowStages({ currentStage, isProcessing, onStageChange }: WorkflowStagesProps) {
    return (
      <div className="space-y-6">
        <Stage1Scraping 
          isActive={currentStage === 'scraping'}
          isProcessing={isProcessing}
          onComplete={() => onStageChange('enrichment')}
        />
        <Stage2Enrichment 
          isActive={currentStage === 'enrichment'}
          isProcessing={isProcessing}
          onComplete={() => onStageChange('campaigns')}
        />
        <Stage3Campaigns 
          isActive={currentStage === 'campaigns'}
          isProcessing={isProcessing}
          onComplete={() => onStageChange('results')}
        />
        <Stage4Results 
          isActive={currentStage === 'results'}
          isProcessing={isProcessing}
        />
      </div>
    )
  }
  ```

**Acceptance Criteria:**
- [ ] Main dashboard component renders without errors
- [ ] Header component displays session information
- [ ] Workflow stages container structure complete
- [ ] Basic navigation between stages working

#### **Day 2: Individual Stage Components**
**Priority**: Critical  
**Duration**: 4 hours  
**Dependencies**: Day 1 tasks

**To-Do List:**
- [ ] **Create Stage 1: Scraping component**
  ```typescript
  // File: components/otis/stages/Stage1Scraping.tsx
  "use client"

  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

  interface Stage1ScrapingProps {
    isActive: boolean
    isProcessing: boolean
    onComplete: () => void
  }

  export function Stage1Scraping({ isActive, isProcessing, onComplete }: Stage1ScrapingProps) {
    const [location, setLocation] = useState('')
    const [jobTitle, setJobTitle] = useState('')
    const [platform, setPlatform] = useState('indeed')

    const handleStartScraping = async () => {
      if (!location || !jobTitle) return

      try {
        const response = await fetch('/api/otis/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_scraping',
            data: { location, jobTitle, platform }
          })
        })

        const result = await response.json()
        if (result.success) {
          onComplete()
        }
      } catch (error) {
        console.error('Failed to start scraping:', error)
      }
    }

    return (
      <div className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
        isActive ? 'ring-2 ring-blue-500' : 'opacity-60'
      }`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">1</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Job Scraping</h3>
              <p className="text-sm text-gray-500">Configure and start job scraping process</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          {isActive ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Amsterdam, Netherlands"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Software Engineer"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indeed">Indeed</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleStartScraping}
                disabled={isProcessing || !location || !jobTitle}
                className="w-full"
              >
                {isProcessing ? 'Starting Scraping...' : 'Start Scraping'}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Complete previous stages to unlock</p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Create Stage 2: Enrichment component**
  ```typescript
  // File: components/otis/stages/Stage2Enrichment.tsx
  "use client"

  import { useState, useEffect } from 'react'
  import { Button } from '@/components/ui/button'
  import { Progress } from '@/components/ui/progress'

  interface Stage2EnrichmentProps {
    isActive: boolean
    isProcessing: boolean
    onComplete: () => void
  }

  export function Stage2Enrichment({ isActive, isProcessing, onComplete }: Stage2EnrichmentProps) {
    const [progress, setProgress] = useState(0)
    const [companies, setCompanies] = useState<any[]>([])

    useEffect(() => {
      if (isActive && isProcessing) {
        // TODO: Connect to WebSocket for real-time updates
        const interval = setInterval(() => {
          setProgress(prev => Math.min(prev + 10, 100))
        }, 1000)

        return () => clearInterval(interval)
      }
    }, [isActive, isProcessing])

    const handleStartEnrichment = async () => {
      try {
        const response = await fetch('/api/otis/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_enrichment',
            data: { companies }
          })
        })

        const result = await response.json()
        if (result.success) {
          // Enrichment started
        }
      } catch (error) {
        console.error('Failed to start enrichment:', error)
      }
    }

    return (
      <div className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
        isActive ? 'ring-2 ring-blue-500' : 'opacity-60'
      }`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-semibold">2</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Company Enrichment</h3>
              <p className="text-sm text-gray-500">Enrich scraped companies with contact information</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          {isActive ? (
            <div className="space-y-4">
              {isProcessing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Enrichment Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    Enriching company data with Apollo...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-4">
                      {companies.length} companies ready for enrichment
                    </p>
                    <Button onClick={handleStartEnrichment} className="w-full">
                      Start Enrichment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Complete scraping stage to unlock</p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Create Stage 3: Campaigns component**
  ```typescript
  // File: components/otis/stages/Stage3Campaigns.tsx
  "use client"

  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Textarea } from '@/components/ui/textarea'

  interface Stage3CampaignsProps {
    isActive: boolean
    isProcessing: boolean
    onComplete: () => void
  }

  export function Stage3Campaigns({ isActive, isProcessing, onComplete }: Stage3CampaignsProps) {
    const [campaignName, setCampaignName] = useState('')
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')

    const handleCreateCampaign = async () => {
      if (!campaignName || !emailSubject || !emailBody) return

      try {
        const response = await fetch('/api/otis/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_campaign',
            data: { campaignName, emailSubject, emailBody }
          })
        })

        const result = await response.json()
        if (result.success) {
          onComplete()
        }
      } catch (error) {
        console.error('Failed to create campaign:', error)
      }
    }

    return (
      <div className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
        isActive ? 'ring-2 ring-blue-500' : 'opacity-60'
      }`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-semibold">3</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Email Campaign</h3>
              <p className="text-sm text-gray-500">Create and send email campaign to enriched contacts</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          {isActive ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Q1 2024 Outreach"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emailSubject">Email Subject</Label>
                <Input
                  id="emailSubject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g., Exciting opportunity for your company"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emailBody">Email Body</Label>
                <Textarea
                  id="emailBody"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your email content here..."
                  rows={6}
                />
              </div>
              
              <Button 
                onClick={handleCreateCampaign}
                disabled={isProcessing || !campaignName || !emailSubject || !emailBody}
                className="w-full"
              >
                {isProcessing ? 'Creating Campaign...' : 'Create Campaign'}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Complete enrichment stage to unlock</p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Create Stage 4: Results component**
  ```typescript
  // File: components/otis/stages/Stage4Results.tsx
  "use client"

  import { useState, useEffect } from 'react'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

  interface Stage4ResultsProps {
    isActive: boolean
    isProcessing: boolean
  }

  export function Stage4Results({ isActive, isProcessing }: Stage4ResultsProps) {
    const [results, setResults] = useState({
      jobsScraped: 0,
      companiesEnriched: 0,
      contactsFound: 0,
      emailsSent: 0
    })

    useEffect(() => {
      if (isActive) {
        // TODO: Fetch results from API
        setResults({
          jobsScraped: 150,
          companiesEnriched: 45,
          contactsFound: 89,
          emailsSent: 67
        })
      }
    }, [isActive])

    return (
      <div className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
        isActive ? 'ring-2 ring-blue-500' : 'opacity-60'
      }`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-semibold">4</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Results Summary</h3>
              <p className="text-sm text-gray-500">View your workflow results and analytics</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          {isActive ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Jobs Scraped</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-600">{results.jobsScraped}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Companies Enriched</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">{results.companiesEnriched}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contacts Found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-purple-600">{results.contactsFound}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Emails Sent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-600">{results.emailsSent}</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex space-x-2">
                <Button variant="outline" className="flex-1">
                  Download Report
                </Button>
                <Button className="flex-1">
                  Start New Workflow
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Complete all previous stages to view results</p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

**Acceptance Criteria:**
- [ ] All stage components created and functional
- [ ] Form inputs working correctly
- [ ] Stage navigation working
- [ ] Basic API integration implemented

#### **Day 3: Supporting Components**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Day 2 tasks

**To-Do List:**
- [ ] **Create progress overlay component**
  ```typescript
  // File: components/otis/ProgressOverlay.tsx
  "use client"

  import { Progress } from '@/components/ui/progress'
  import { Loader2 } from 'lucide-react'

  interface ProgressOverlayProps {
    isVisible: boolean
    progress: {
      total: number
      completed: number
      failed: number
    }
    currentOperation: string
  }

  export function ProgressOverlay({ isVisible, progress, currentOperation }: ProgressOverlayProps) {
    if (!isVisible) return null

    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center space-x-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">{currentOperation}</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <Progress value={percentage} className="w-full" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{progress.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{progress.completed}</p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{progress.failed}</p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Create session panel component**
  ```typescript
  // File: components/otis/SessionPanel.tsx
  "use client"

  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Badge } from '@/components/ui/badge'

  interface SessionPanelProps {
    currentStage: string
    isProcessing: boolean
  }

  export function SessionPanel({ currentStage, isProcessing }: SessionPanelProps) {
    const stages = [
      { id: 'scraping', name: 'Scraping', status: 'completed' },
      { id: 'enrichment', name: 'Enrichment', status: currentStage === 'enrichment' ? 'active' : 'pending' },
      { id: 'campaigns', name: 'Campaigns', status: 'pending' },
      { id: 'results', name: 'Results', status: 'pending' }
    ]

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{stage.name}</span>
              <Badge 
                variant={stage.status === 'completed' ? 'default' : 
                        stage.status === 'active' ? 'secondary' : 'outline'}
              >
                {stage.status}
              </Badge>
            </div>
          ))}
          
          {isProcessing && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Processing {currentStage} stage...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
  ```

- [ ] **Create navigation controls component**
  ```typescript
  // File: components/otis/NavigationControls.tsx
  "use client"

  import { Button } from '@/components/ui/button'
  import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

  interface NavigationControlsProps {
    currentStage: string
    onStageChange: (stage: 'scraping' | 'enrichment' | 'campaigns' | 'results') => void
    isProcessing: boolean
  }

  export function NavigationControls({ currentStage, onStageChange, isProcessing }: NavigationControlsProps) {
    const stages: ('scraping' | 'enrichment' | 'campaigns' | 'results')[] = ['scraping', 'enrichment', 'campaigns', 'results']
    const currentIndex = stages.indexOf(currentStage as any)

    const goToPrevious = () => {
      if (currentIndex > 0) {
        onStageChange(stages[currentIndex - 1])
      }
    }

    const goToNext = () => {
      if (currentIndex < stages.length - 1) {
        onStageChange(stages[currentIndex + 1])
      }
    }

    const resetWorkflow = () => {
      onStageChange('scraping')
    }

    return (
      <div className="mt-4 space-y-2">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentIndex === 0 || isProcessing}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            disabled={currentIndex === stages.length - 1 || isProcessing}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={resetWorkflow}
          disabled={isProcessing}
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset Workflow
        </Button>
      </div>
    )
  }
  ```

**Acceptance Criteria:**
- [ ] Progress overlay component functional
- [ ] Session panel displays workflow status
- [ ] Navigation controls working
- [ ] All components responsive

### **Task 2: WebSocket Hook Implementation (Days 4-5)**

#### **Day 4: WebSocket Hook**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Backend Developer Task 1 (WebSocket Infrastructure)

**To-Do List:**
- [ ] **Create WebSocket hook**
  ```bash
  # Create hook file
  touch hooks/use-otis-websocket.tsx
  ```

- [ ] **Implement WebSocket hook**
  ```typescript
  // File: hooks/use-otis-websocket.tsx
  "use client"

  import { useState, useEffect, useCallback } from 'react'
  import { createClient } from '@/lib/supabase'

  interface OtisWebSocketState {
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
    currentBatchId: string | null
    enrichmentProgress: {
      total: number
      completed: number
      failed: number
    }
    scrapingProgress: {
      total: number
      completed: number
      failed: number
    }
    errorMessages: string[]
  }

  export function useOtisWebSocket(sessionId: string) {
    const [state, setState] = useState<OtisWebSocketState>({
      connectionStatus: 'disconnected',
      currentBatchId: null,
      enrichmentProgress: { total: 0, completed: 0, failed: 0 },
      scrapingProgress: { total: 0, completed: 0, failed: 0 },
      errorMessages: []
    })

    const handleEnrichmentUpdate = useCallback((payload: any) => {
      setState(prev => ({
        ...prev,
        enrichmentProgress: {
          total: payload.total || prev.enrichmentProgress.total,
          completed: payload.completed || prev.enrichmentProgress.completed,
          failed: payload.failed || prev.enrichmentProgress.failed
        }
      }))
    }, [])

    const handleScrapingUpdate = useCallback((payload: any) => {
      setState(prev => ({
        ...prev,
        scrapingProgress: {
          total: payload.total || prev.scrapingProgress.total,
          completed: payload.completed || prev.scrapingProgress.completed,
          failed: payload.failed || prev.scrapingProgress.failed
        }
      }))
    }, [])

    useEffect(() => {
      if (!sessionId) return

      const supabase = createClient()
      
      const subscription = supabase
        .channel('otis-progress')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'enrichment_status'
        }, (payload) => {
          handleEnrichmentUpdate(payload)
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'apify_runs'
        }, (payload) => {
          handleScrapingUpdate(payload)
        })
        .subscribe()

      setState(prev => ({ ...prev, connectionStatus: 'connected' }))

      return () => {
        subscription.unsubscribe()
        setState(prev => ({ ...prev, connectionStatus: 'disconnected' }))
      }
    }, [sessionId, handleEnrichmentUpdate, handleScrapingUpdate])

    const sendMessage = useCallback((message: any) => {
      // TODO: Implement WebSocket message sending
      console.log('Sending message:', message)
    }, [])

    const reconnect = useCallback(() => {
      setState(prev => ({ ...prev, connectionStatus: 'connecting' }))
      // TODO: Implement reconnection logic
    }, [])

    return { state, sendMessage, reconnect }
  }
  ```

- [ ] **Create progress visualization components**
  ```typescript
  // File: components/otis/ui/ProgressBar.tsx
  interface ProgressBarProps {
    value: number
    max: number
    label: string
    color?: 'blue' | 'green' | 'red' | 'purple'
  }

  export function ProgressBar({ value, max, label, color = 'blue' }: ProgressBarProps) {
    const percentage = max > 0 ? (value / max) * 100 : 0
    
    const colorClasses = {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      red: 'bg-red-600',
      purple: 'bg-purple-600'
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`${colorClasses[color]} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
  ```

- [ ] **Create status indicator component**
  ```typescript
  // File: components/otis/ui/StatusIndicator.tsx
  import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

  interface StatusIndicatorProps {
    status: 'success' | 'error' | 'pending' | 'warning'
    message: string
  }

  export function StatusIndicator({ status, message }: StatusIndicatorProps) {
    const icons = {
      success: CheckCircle,
      error: XCircle,
      pending: Clock,
      warning: AlertCircle
    }

    const colors = {
      success: 'text-green-600',
      error: 'text-red-600',
      pending: 'text-yellow-600',
      warning: 'text-orange-600'
    }

    const Icon = icons[status]

    return (
      <div className="flex items-center space-x-2">
        <Icon className={`h-4 w-4 ${colors[status]}`} />
        <span className="text-sm text-gray-600">{message}</span>
      </div>
    )
  }
  ```

**Acceptance Criteria:**
- [ ] WebSocket hook implemented
- [ ] Real-time event handlers working
- [ ] Progress visualization components created
- [ ] Connection management functional

#### **Day 5: Integration & Testing**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Day 4 tasks

**To-Do List:**
- [ ] **Integrate WebSocket hook with dashboard**
  ```typescript
  // Update OtisDashboard.tsx to use WebSocket hook
  import { useOtisWebSocket } from '@/hooks/use-otis-websocket'

  export function OtisDashboard() {
    const [sessionId, setSessionId] = useState<string>('test-session')
    const { state: wsState, sendMessage, reconnect } = useOtisWebSocket(sessionId)
    
    // Use WebSocket state in components
    const progress = wsState.connectionStatus === 'connected' ? 
      wsState.enrichmentProgress : { total: 0, completed: 0, failed: 0 }
    
    // ... rest of component
  }
  ```

- [ ] **Add error handling and recovery**
  ```typescript
  // File: components/otis/ui/ErrorBoundary.tsx
  "use client"

  import { Component, ReactNode } from 'react'
  import { AlertTriangle, RefreshCw } from 'lucide-react'
  import { Button } from '@/components/ui/button'

  interface Props {
    children: ReactNode
  }

  interface State {
    hasError: boolean
    error?: Error
  }

  export class OtisErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
      super(props)
      this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
      return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: any) {
      console.error('Otis Error Boundary caught an error:', error, errorInfo)
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                An error occurred while loading the Otis dashboard.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </div>
          </div>
        )
      }

      return this.props.children
    }
  }
  ```

- [ ] **Create component tests**
  ```typescript
  // File: __tests__/components/otis/OtisDashboard.test.tsx
  import { render, screen } from '@testing-library/react'
  import { OtisDashboard } from '@/components/otis/OtisDashboard'

  describe('OtisDashboard', () => {
    it('renders dashboard with all stages', () => {
      render(<OtisDashboard />)
      
      expect(screen.getByText('Otis Agent Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Job Scraping')).toBeInTheDocument()
      expect(screen.getByText('Company Enrichment')).toBeInTheDocument()
      expect(screen.getByText('Email Campaign')).toBeInTheDocument()
      expect(screen.getByText('Results Summary')).toBeInTheDocument()
    })
  })
  ```

- [ ] **Add responsive design improvements**
  ```typescript
  // Update components for mobile responsiveness
  // Add mobile-specific styles and layouts
  // Test on different screen sizes
  ```

**Acceptance Criteria:**
- [ ] WebSocket integration complete
- [ ] Error handling implemented
- [ ] Component tests written
- [ ] Responsive design working

---

## 📋 **Daily Standup Template for Frontend Developer**

### **Daily Questions:**
1. **What did you complete yesterday?**
2. **What will you work on today?**
3. **Are there any blockers or dependencies?**
4. **Do you need help from other team members?**

### **Week 1 Success Criteria:**
- [ ] Dashboard structure complete and functional
- [ ] All stage components implemented
- [ ] WebSocket hook working
- [ ] Real-time updates functional
- [ ] Responsive design implemented

### **Dependencies to Track:**
- [ ] Backend Developer: WebSocket infrastructure (Day 3)
- [ ] Backend Developer: Workflow API (Day 4)
- [ ] Database Engineer: Workflow tables (Day 4)

---

## 🚀 **Immediate Next Steps**

### **Day 1 Actions:**
1. **Set up component structure**
2. **Create main dashboard component**
3. **Implement header and navigation**
4. **Test basic layout**

### **Day 2 Actions:**
1. **Create individual stage components**
2. **Implement form inputs and validation**
3. **Add stage navigation logic**
4. **Test component interactions**

### **Day 3 Actions:**
1. **Create supporting components**
2. **Implement progress visualization**
3. **Add responsive design**
4. **Component testing**

### **Day 4 Actions:**
1. **Implement WebSocket hook**
2. **Create progress components**
3. **Add real-time updates**
4. **Integration testing**

### **Day 5 Actions:**
1. **Integrate WebSocket with dashboard**
2. **Add error handling**
3. **Create component tests**
4. **Final polish and testing**

---

## 🎯 **Code Quality Checklist**

### **Before Committing:**
- [ ] Components render without errors
- [ ] TypeScript types are correct
- [ ] Props interfaces defined
- [ ] Error boundaries implemented
- [ ] Tests are written and passing
- [ ] Responsive design tested

### **Integration Points:**
- [ ] WebSocket connections stable
- [ ] API calls working correctly
- [ ] Real-time updates functional
- [ ] Error scenarios handled gracefully
- [ ] Performance is acceptable

---

This detailed to-do list provides the Frontend Developer with specific, actionable tasks for implementing the unified dashboard and WebSocket integration. Each task includes code examples, acceptance criteria, and clear dependencies. 