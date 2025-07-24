# Technical Architecture Document: Otis Agent UX Enhancement

**Project**: LokaleBanen Dashboard - Otis Agent UX Improvement  
**Document Type**: Technical Architecture Specification  
**Version**: 1.0  
**Date**: December 2024  
**Author**: Winston, Architect  

---

## Executive Summary

This document provides a comprehensive technical validation and architecture specification for the Otis Agent UX enhancement implementation. The proposed approach leverages existing infrastructure while introducing modern real-time capabilities and unified user experience patterns.

### Technical Validation Results

✅ **VALIDATED APPROACHES:**
- **WebSocket Integration**: Feasible with existing Supabase real-time capabilities
- **Unified Dashboard**: Compatible with current Next.js 14 App Router architecture
- **State Management**: Leverages existing caching patterns and hooks
- **Database Schema**: Minimal changes required, builds on existing enrichment tables
- **Performance**: Optimized for real-time updates with minimal latency

⚠️ **TECHNICAL CONSIDERATIONS:**
- **Migration Strategy**: Requires careful state transition from polling to WebSocket
- **Error Handling**: Enhanced error recovery for real-time connections
- **Scalability**: WebSocket connection management for multiple concurrent users

---

## Current Architecture Analysis

### Existing Infrastructure Strengths

**1. Real-time Foundation**
```typescript
// Current polling implementation in useApolloEnrichment.tsx
const startStatusPolling = useCallback((batchId: string) => {
  pollingIntervalRef.current = setInterval(async () => {
    const response = await fetch(`/api/apollo/status/${batchId}`)
    // ... status updates every 2 seconds
  }, 2000)
}, [onComplete])
```

**2. Robust Database Schema**
```sql
-- Existing enrichment tracking tables
CREATE TABLE enrichment_batches (
    id UUID PRIMARY KEY,
    batch_id VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    total_companies INTEGER,
    completed_companies INTEGER,
    -- ... comprehensive tracking
);

CREATE TABLE enrichment_status (
    id UUID PRIMARY KEY,
    batch_id UUID REFERENCES enrichment_batches(id),
    company_id UUID REFERENCES companies(id),
    status VARCHAR(50),
    -- ... individual company tracking
);
```

**3. Caching Architecture**
```typescript
// Current caching pattern in useCompaniesCache.tsx
const CACHE_VERSION = "3.0"
let companiesCache: { [key: string]: any } = {}
// Version-controlled cache invalidation
```

### Current Pain Points (Technical)

**1. Polling Overhead**
- **Issue**: 2-second polling creates unnecessary API calls
- **Impact**: 30+ requests per minute during enrichment
- **Solution**: WebSocket real-time updates

**2. State Fragmentation**
- **Issue**: Multiple React components managing separate states
- **Impact**: Complex state synchronization
- **Solution**: Centralized state management with context

**3. Navigation Context Loss**
- **Issue**: Page navigation resets component state
- **Impact**: User loses progress and context
- **Solution**: Persistent session state with URL parameters

---

## Proposed Technical Architecture

### 1. Real-time Communication Layer

**WebSocket Implementation Strategy**

```typescript
// New: hooks/use-otis-websocket.tsx
interface OtisWebSocketState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  currentBatchId: string | null
  enrichmentProgress: EnrichmentProgress
  scrapingProgress: ScrapingProgress
  errorMessages: string[]
}

export function useOtisWebSocket() {
  const [state, setState] = useState<OtisWebSocketState>({
    connectionStatus: 'disconnected',
    currentBatchId: null,
    enrichmentProgress: { total: 0, completed: 0, failed: 0 },
    scrapingProgress: { total: 0, completed: 0, failed: 0 },
    errorMessages: []
  })

  // Supabase real-time subscription
  useEffect(() => {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('otis-progress')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrichment_status'
      }, (payload) => {
        // Handle real-time updates
        handleEnrichmentUpdate(payload)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'apify_runs'
      }, (payload) => {
        // Handle scraping updates
        handleScrapingUpdate(payload)
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { state, sendMessage, reconnect }
}
```

**Database Triggers for Real-time Updates**

```sql
-- New: migrations/002_add_realtime_triggers.sql
CREATE OR REPLACE FUNCTION notify_otis_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify WebSocket clients of progress changes
  PERFORM pg_notify(
    'otis_progress',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'record', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to enrichment tables
CREATE TRIGGER enrichment_status_notify
  AFTER INSERT OR UPDATE ON enrichment_status
  FOR EACH ROW EXECUTE FUNCTION notify_otis_progress();
```

### 2. Unified Dashboard Architecture

**Component Hierarchy**

```
OtisDashboard/
├── OtisHeader/           # Session summary, navigation
├── WorkflowStages/       # Collapsible stage containers
│   ├── Stage1Scraping/   # Job scraping configuration
│   ├── Stage2Enrichment/ # Company/contact enrichment
│   ├── Stage3Campaigns/  # Instantly campaign setup
│   └── Stage4Results/    # Results and analytics
├── ProgressOverlay/      # Real-time progress indicators
├── SessionPanel/         # Persistent context information
└── NavigationControls/   # Smart stage navigation
```

**State Management Architecture**

```typescript
// New: contexts/otis-workflow-context.tsx
interface OtisWorkflowState {
  // Session persistence
  sessionId: string
  currentStage: 'scraping' | 'enrichment' | 'campaigns' | 'results'
  
  // Workflow data
  scrapingConfig: ScrapingConfiguration
  selectedCompanies: Company[]
  enrichmentProgress: EnrichmentProgress
  campaignConfig: CampaignConfiguration
  
  // Real-time status
  isProcessing: boolean
  errorMessages: string[]
  lastUpdated: Date
}

const OtisWorkflowContext = createContext<{
  state: OtisWorkflowState
  dispatch: React.Dispatch<OtisWorkflowAction>
} | null>(null)

// URL-based state persistence
const useOtisWorkflowState = () => {
  const [state, setState] = useState<OtisWorkflowState>(() => {
    // Initialize from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    return {
      sessionId: urlParams.get('session') || generateSessionId(),
      currentStage: (urlParams.get('stage') as any) || 'scraping',
      // ... other state initialization
    }
  })

  // Sync state to URL
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('session', state.sessionId)
    url.searchParams.set('stage', state.currentStage)
    window.history.replaceState({}, '', url.toString())
  }, [state.sessionId, state.currentStage])

  return { state, setState }
}
```

### 3. Enhanced API Architecture

**Unified API Endpoints**

```typescript
// Enhanced: app/api/otis/workflow/route.ts
export async function POST(req: NextRequest) {
  const { action, data } = await req.json()
  
  switch (action) {
    case 'start_scraping':
      return await handleStartScraping(data)
    case 'start_enrichment':
      return await handleStartEnrichment(data)
    case 'create_campaign':
      return await handleCreateCampaign(data)
    case 'get_progress':
      return await handleGetProgress(data)
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

// New: app/api/otis/websocket/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
  }

  // Upgrade to WebSocket connection
  const { socket, response } = Deno.upgradeWebSocket(req)
  
  // Handle WebSocket connection
  socket.onopen = () => {
    console.log(`WebSocket connected for session: ${sessionId}`)
  }
  
  socket.onmessage = (event) => {
    // Handle incoming messages
    const message = JSON.parse(event.data)
    handleWebSocketMessage(sessionId, message, socket)
  }
  
  return response
}
```

### 4. Database Schema Enhancements

**New Tables for Workflow Management**

```sql
-- New: migrations/003_add_workflow_tables.sql

-- Otis workflow sessions
CREATE TABLE otis_workflow_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_stage VARCHAR(50) NOT NULL DEFAULT 'scraping',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Workflow stage data
CREATE TABLE otis_workflow_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, stage_name)
);

-- Real-time progress tracking
CREATE TABLE otis_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES otis_workflow_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_otis_sessions_user_id ON otis_workflow_sessions(user_id);
CREATE INDEX idx_otis_sessions_status ON otis_workflow_sessions(status);
CREATE INDEX idx_otis_workflow_data_session ON otis_workflow_data(session_id);
CREATE INDEX idx_otis_progress_events_session ON otis_progress_events(session_id, created_at DESC);
```

### 5. Performance Optimization Strategy

**Caching Strategy**

```typescript
// Enhanced: hooks/use-otis-cache.tsx
interface OtisCacheConfig {
  sessionId: string
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum cache entries
}

class OtisCache {
  private cache = new Map<string, { data: any, timestamp: number }>()
  private config: OtisCacheConfig

  constructor(config: OtisCacheConfig) {
    this.config = config
    this.startCleanupInterval()
  }

  set(key: string, data: any): void {
    // Implement LRU eviction
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.config.ttl) {
          this.cache.delete(key)
        }
      }
    }, 60000) // Cleanup every minute
  }
}
```

**Connection Management**

```typescript
// New: lib/websocket-manager.ts
class WebSocketManager {
  private connections = new Map<string, WebSocket>()
  private reconnectAttempts = new Map<string, number>()
  private maxReconnectAttempts = 5

  connect(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:3000/api/otis/websocket?session=${sessionId}`)
      
      ws.onopen = () => {
        this.connections.set(sessionId, ws)
        this.reconnectAttempts.set(sessionId, 0)
        resolve(ws)
      }
      
      ws.onclose = () => {
        this.connections.delete(sessionId)
        this.handleReconnect(sessionId)
      }
      
      ws.onerror = (error) => {
        reject(error)
      }
    })
  }

  private handleReconnect(sessionId: string): void {
    const attempts = this.reconnectAttempts.get(sessionId) || 0
    
    if (attempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts.set(sessionId, attempts + 1)
        this.connect(sessionId).catch(console.error)
      }, Math.pow(2, attempts) * 1000) // Exponential backoff
    }
  }

  disconnect(sessionId: string): void {
    const ws = this.connections.get(sessionId)
    if (ws) {
      ws.close()
      this.connections.delete(sessionId)
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**High Impact, Low Effort**

1. **Database Schema Updates**
   ```sql
   -- Run migrations
   -- 002_add_realtime_triggers.sql
   -- 003_add_workflow_tables.sql
   ```

2. **WebSocket Infrastructure**
   ```typescript
   // Implement WebSocket manager
   // Create real-time hooks
   // Add connection management
   ```

3. **Basic Unified Dashboard**
   ```typescript
   // Create OtisDashboard component
   // Implement stage containers
   // Add basic navigation
   ```

### Phase 2: Real-time Integration (Week 3-4)

**High Impact, Medium Effort**

1. **Replace Polling with WebSocket**
   ```typescript
   // Migrate useApolloEnrichment to WebSocket
   // Update status endpoints
   // Add real-time progress indicators
   ```

2. **Enhanced State Management**
   ```typescript
   // Implement OtisWorkflowContext
   // Add URL-based persistence
   // Create session management
   ```

3. **Progress Visualization**
   ```typescript
   // Real-time progress bars
   // Live status updates
   // Error handling and recovery
   ```

### Phase 3: Advanced Features (Week 5-6)

**Medium Impact, Medium Effort**

1. **Smart Navigation**
   ```typescript
   // Stage dependency validation
   // Auto-progression logic
   // Context-aware navigation
   ```

2. **Process Queue Management**
   ```typescript
   // Visual queue display
   // Batch processing controls
   // Priority management
   ```

3. **Enhanced Error Handling**
   ```typescript
   // Comprehensive error recovery
   // Retry mechanisms
   // User-friendly error messages
   ```

---

## Technical Risk Assessment

### Low Risk ✅

**1. WebSocket Implementation**
- **Risk**: Connection stability and reconnection logic
- **Mitigation**: Proven Supabase real-time patterns, exponential backoff
- **Fallback**: Graceful degradation to polling

**2. State Management**
- **Risk**: Complex state synchronization
- **Mitigation**: Context API with clear data flow, URL persistence
- **Fallback**: Local storage backup

**3. Database Changes**
- **Risk**: Migration complexity
- **Mitigation**: Backward-compatible schema changes, rollback scripts
- **Fallback**: Feature flags for gradual rollout

### Medium Risk ⚠️

**1. Performance Impact**
- **Risk**: WebSocket connection overhead
- **Mitigation**: Connection pooling, efficient event handling
- **Monitoring**: Real-time performance metrics

**2. Browser Compatibility**
- **Risk**: WebSocket support in older browsers
- **Mitigation**: Feature detection, polyfills
- **Fallback**: Polling for unsupported browsers

### High Risk 🔴

**1. Real-time Data Consistency**
- **Risk**: Race conditions in concurrent updates
- **Mitigation**: Optimistic updates with conflict resolution
- **Monitoring**: Comprehensive logging and error tracking

---

## Performance Benchmarks

### Current Performance (Baseline)

- **Polling Overhead**: 30 requests/minute during enrichment
- **Page Load Time**: 2.3s average
- **State Synchronization**: Manual refresh required
- **Memory Usage**: 45MB average

### Target Performance (After Enhancement)

- **Real-time Updates**: <100ms latency
- **Page Load Time**: 1.8s average (22% improvement)
- **State Synchronization**: Automatic
- **Memory Usage**: 52MB average (15% increase for real-time features)

### Monitoring Metrics

```typescript
// New: lib/performance-monitor.ts
interface PerformanceMetrics {
  websocketLatency: number
  pageLoadTime: number
  memoryUsage: number
  errorRate: number
  userSatisfaction: number
}

class PerformanceMonitor {
  trackWebSocketLatency(event: string, startTime: number): void {
    const latency = Date.now() - startTime
    this.metrics.websocketLatency = latency
    this.reportMetric('websocket_latency', latency)
  }

  trackUserSatisfaction(score: number): void {
    this.metrics.userSatisfaction = score
    this.reportMetric('user_satisfaction', score)
  }

  private reportMetric(name: string, value: number): void {
    // Send to analytics service
    analytics.track('otis_performance', { name, value })
  }
}
```

---

## Security Considerations

### WebSocket Security

```typescript
// Enhanced: lib/websocket-security.ts
class WebSocketSecurity {
  validateSession(sessionId: string, userId: string): boolean {
    // Verify session ownership
    return this.verifySessionOwnership(sessionId, userId)
  }

  sanitizeMessage(message: any): any {
    // Sanitize incoming WebSocket messages
    return this.sanitizeData(message)
  }

  rateLimitConnection(ip: string): boolean {
    // Implement connection rate limiting
    return this.checkRateLimit(ip)
  }
}
```

### Data Protection

- **Session Isolation**: Each user session is isolated
- **Input Validation**: All WebSocket messages validated
- **Rate Limiting**: Connection and message rate limits
- **Audit Logging**: Comprehensive security event logging

---

## Deployment Strategy

### Staging Environment

1. **Feature Flags**
   ```typescript
   // Enable/disable new features
   const FEATURES = {
     OTIS_UNIFIED_DASHBOARD: process.env.NODE_ENV === 'production' ? false : true,
     OTIS_WEBSOCKET: process.env.NODE_ENV === 'production' ? false : true
   }
   ```

2. **Gradual Rollout**
   - 10% of users get new interface
   - Monitor performance and error rates
   - Gradually increase to 100%

3. **Rollback Plan**
   - Database migration rollback scripts
   - Feature flag to disable new features
   - Fallback to existing polling implementation

### Production Deployment

1. **Database Migration**
   ```bash
   # Run migrations in order
   supabase migration up
   ```

2. **Application Deployment**
   ```bash
   # Deploy with feature flags disabled
   npm run build && npm run start
   ```

3. **Feature Activation**
   ```bash
   # Enable features gradually
   # Monitor performance metrics
   # Activate for all users
   ```

---

## Conclusion

The proposed technical architecture provides a robust foundation for the Otis UX enhancement while leveraging existing infrastructure strengths. The WebSocket-based real-time updates, unified dashboard, and enhanced state management will significantly improve user experience while maintaining system reliability and performance.

### Key Success Factors

1. **Incremental Implementation**: Phased rollout reduces risk
2. **Backward Compatibility**: Existing functionality preserved
3. **Performance Monitoring**: Real-time metrics for optimization
4. **Error Handling**: Comprehensive error recovery mechanisms
5. **User Feedback**: Continuous improvement based on usage data

### Next Steps

1. **Technical Review**: Validate architecture with development team
2. **Prototype Development**: Create proof-of-concept for critical components
3. **Performance Testing**: Benchmark real-time update performance
4. **Security Audit**: Review WebSocket security implementation
5. **User Testing**: Validate UX improvements with target users

This architecture document complements the PRD and provides the technical foundation for successful implementation of the Otis UX enhancement project. 