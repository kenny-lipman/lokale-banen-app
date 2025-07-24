# Backend Developer - Otis UX Enhancement To-Dos

**Developer**: Backend Developer  
**Project**: Otis UX Enhancement  
**Week**: 1  
**Priority**: Critical  

---

## 🚀 **Week 1 Backend Developer Tasks**

### **Task 1: WebSocket Infrastructure Setup (Days 1-3)**

#### **Day 1: WebSocket Manager Class**
**Priority**: Critical  
**Duration**: 4 hours  
**Dependencies**: Database Engineer Task 2 (Real-time Triggers)

**To-Do List:**
- [ ] **Create WebSocket Manager Class**
  ```bash
  # Create file structure
  mkdir -p lib
  touch lib/websocket-manager.ts
  touch lib/websocket-security.ts
  ```

- [ ] **Implement WebSocketManager class**
  ```typescript
  // File: lib/websocket-manager.ts
  export class WebSocketManager {
    private connections = new Map<string, WebSocket>()
    private reconnectAttempts = new Map<string, number>()
    private maxReconnectAttempts = 5

    async connect(sessionId: string): Promise<WebSocket> {
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
        }, Math.pow(2, attempts) * 1000)
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

- [ ] **Add WebSocket security layer**
  ```typescript
  // File: lib/websocket-security.ts
  export class WebSocketSecurity {
    static validateSession(sessionId: string, userId: string): boolean {
      // TODO: Implement session validation logic
      return true // Placeholder
    }

    static sanitizeMessage(message: any): any {
      // TODO: Implement message sanitization
      return message // Placeholder
    }

    static rateLimitConnection(ip: string): boolean {
      // TODO: Implement rate limiting
      return true // Placeholder
    }
  }
  ```

**Acceptance Criteria:**
- [ ] WebSocketManager class compiles without errors
- [ ] Connection management methods implemented
- [ ] Reconnection logic with exponential backoff
- [ ] Security layer structure in place

#### **Day 2: WebSocket API Route**
**Priority**: Critical  
**Duration**: 4 hours  
**Dependencies**: Day 1 tasks

**To-Do List:**
- [ ] **Create WebSocket API route structure**
  ```bash
  # Create API route directory
  mkdir -p app/api/otis/websocket
  touch app/api/otis/websocket/route.ts
  ```

- [ ] **Implement WebSocket API route**
  ```typescript
  // File: app/api/otis/websocket/route.ts
  import { NextRequest } from 'next/server'
  import { createClient } from '@/lib/supabase'

  export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session')
    
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 })
    }

    // Verify session exists and user has access
    const supabase = createClient()
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error || !session) {
      return new Response('Invalid session', { status: 401 })
    }

    // Upgrade to WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req)
    
    socket.onopen = () => {
      console.log(`WebSocket connected for session: ${sessionId}`)
    }
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWebSocketMessage(sessionId, message, socket)
      } catch (error) {
        console.error('Invalid WebSocket message:', error)
      }
    }
    
    socket.onclose = () => {
      console.log(`WebSocket disconnected for session: ${sessionId}`)
    }
    
    return response
  }

  function handleWebSocketMessage(sessionId: string, message: any, socket: WebSocket) {
    // Handle different message types
    switch (message.type) {
      case 'subscribe_progress':
        // TODO: Subscribe to real-time updates
        socket.send(JSON.stringify({ type: 'subscribed', sessionId }))
        break
      case 'get_status':
        // TODO: Return current status
        socket.send(JSON.stringify({ type: 'status', data: {} }))
        break
      default:
        socket.send(JSON.stringify({ error: 'Unknown message type' }))
    }
  }
  ```

- [ ] **Add WebSocket event handlers**
  ```typescript
  // File: lib/websocket-event-handlers.ts
  export class WebSocketEventHandlers {
    static handleProgressUpdate(sessionId: string, data: any, socket: WebSocket) {
      // TODO: Handle progress updates
      socket.send(JSON.stringify({
        type: 'progress_update',
        sessionId,
        data
      }))
    }

    static handleError(sessionId: string, error: any, socket: WebSocket) {
      socket.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: error.message
      }))
    }
  }
  ```

**Acceptance Criteria:**
- [ ] WebSocket API route functional
- [ ] Session validation working
- [ ] Message handling implemented
- [ ] Basic error handling in place

#### **Day 3: Integration & Testing**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Day 2 tasks

**To-Do List:**
- [ ] **Test WebSocket connections**
  ```bash
  # Test WebSocket endpoint
  curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
    "http://localhost:3000/api/otis/websocket?session=test-session"
  ```

- [ ] **Add connection pooling**
  ```typescript
  // File: lib/websocket-pool.ts
  export class WebSocketPool {
    private static instance: WebSocketPool
    private connections = new Map<string, WebSocket>()
    private maxConnections = 100

    static getInstance(): WebSocketPool {
      if (!WebSocketPool.instance) {
        WebSocketPool.instance = new WebSocketPool()
      }
      return WebSocketPool.instance
    }

    addConnection(sessionId: string, ws: WebSocket): boolean {
      if (this.connections.size >= this.maxConnections) {
        return false
      }
      this.connections.set(sessionId, ws)
      return true
    }

    removeConnection(sessionId: string): void {
      this.connections.delete(sessionId)
    }

    getConnection(sessionId: string): WebSocket | undefined {
      return this.connections.get(sessionId)
    }

    broadcast(message: any): void {
      this.connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message))
        }
      })
    }
  }
  ```

- [ ] **Create WebSocket tests**
  ```typescript
  // File: __tests__/websocket.test.ts
  import { WebSocketManager } from '@/lib/websocket-manager'

  describe('WebSocketManager', () => {
    it('should connect to WebSocket', async () => {
      const manager = new WebSocketManager()
      const sessionId = 'test-session'
      
      // TODO: Implement test
    })

    it('should handle reconnection', async () => {
      // TODO: Implement test
    })
  })
  ```

**Acceptance Criteria:**
- [ ] WebSocket connections tested
- [ ] Connection pooling implemented
- [ ] Basic tests written
- [ ] Error scenarios handled

### **Task 2: Unified API Endpoints (Days 4-5)**

#### **Day 4: Workflow API Implementation**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Task 1 complete

**To-Do List:**
- [ ] **Create unified workflow API**
  ```bash
  # Create API route
  mkdir -p app/api/otis/workflow
  touch app/api/otis/workflow/route.ts
  ```

- [ ] **Implement workflow API**
  ```typescript
  // File: app/api/otis/workflow/route.ts
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase'
  import { OtisErrorHandler } from '@/lib/error-handler'

  export async function POST(req: NextRequest) {
    try {
      const { action, data } = await req.json()
      const supabase = createClient()
      
      switch (action) {
        case 'start_scraping':
          return await handleStartScraping(data, supabase)
        case 'start_enrichment':
          return await handleStartEnrichment(data, supabase)
        case 'create_campaign':
          return await handleCreateCampaign(data, supabase)
        case 'get_progress':
          return await handleGetProgress(data, supabase)
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
    } catch (error) {
      const handledError = OtisErrorHandler.handle(error, 'workflow_api')
      return NextResponse.json(handledError, { status: 500 })
    }
  }

  async function handleStartScraping(data: any, supabase: any) {
    // TODO: Implement scraping logic
    const { location, jobTitle, platform } = data
    
    // Create scraping session
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .insert({
        session_id: `scraping_${Date.now()}`,
        current_stage: 'scraping',
        status: 'active'
      })
      .select()
      .single()

    if (error) throw error

    // TODO: Trigger Apify scraping
    // TODO: Send WebSocket notification

    return NextResponse.json({ 
      success: true, 
      message: 'Scraping started',
      sessionId: session.session_id
    })
  }

  async function handleStartEnrichment(data: any, supabase: any) {
    // TODO: Implement enrichment logic
    const { sessionId, companies } = data
    
    // Update session stage
    await supabase
      .from('otis_workflow_sessions')
      .update({ current_stage: 'enrichment' })
      .eq('session_id', sessionId)

    // TODO: Trigger Apollo enrichment
    // TODO: Send WebSocket notification

    return NextResponse.json({ 
      success: true, 
      message: 'Enrichment started' 
    })
  }

  async function handleCreateCampaign(data: any, supabase: any) {
    // TODO: Implement campaign creation logic
    const { sessionId, contacts, campaignName } = data
    
    // Update session stage
    await supabase
      .from('otis_workflow_sessions')
      .update({ current_stage: 'campaigns' })
      .eq('session_id', sessionId)

    // TODO: Create Instantly campaign
    // TODO: Send WebSocket notification

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign created' 
    })
  }

  async function handleGetProgress(data: any, supabase: any) {
    // TODO: Implement progress retrieval logic
    const { sessionId } = data
    
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      progress: {
        currentStage: session.current_stage,
        status: session.status,
        lastUpdated: session.updated_at
      }
    })
  }
  ```

- [ ] **Add error handling**
  ```typescript
  // File: lib/error-handler.ts
  export class OtisErrorHandler {
    static handle(error: any, context: string): any {
      console.error(`Otis Error [${context}]:`, error)
      
      // Categorize errors
      if (error.code === 'NETWORK_ERROR') {
        return { type: 'network', message: 'Connection failed', retry: true }
      }
      
      if (error.code === 'VALIDATION_ERROR') {
        return { type: 'validation', message: 'Invalid data provided', retry: false }
      }
      
      if (error.code === 'AUTH_ERROR') {
        return { type: 'auth', message: 'Authentication required', retry: false }
      }
      
      return { type: 'unknown', message: 'An unexpected error occurred', retry: true }
    }

    static logError(error: any, context: string, userId?: string): void {
      // TODO: Implement error logging
      console.error(`[${context}] Error for user ${userId}:`, error)
    }
  }
  ```

**Acceptance Criteria:**
- [ ] Workflow API implemented
- [ ] All action handlers functional
- [ ] Error handling comprehensive
- [ ] Database operations working

#### **Day 5: API Integration & Testing**
**Priority**: High  
**Duration**: 4 hours  
**Dependencies**: Day 4 tasks

**To-Do List:**
- [ ] **Update existing Apollo endpoints**
  ```typescript
  // File: app/api/apollo/enrich/route.ts
  // Add to existing code:
  
  // After successful enrichment start, send WebSocket notification
  const { data: session } = await supabase
    .from('otis_workflow_sessions')
    .select('session_id')
    .eq('id', batchData.id)
    .single()

  if (session) {
    // Send WebSocket notification
    const pool = WebSocketPool.getInstance()
    const ws = pool.getConnection(session.session_id)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'enrichment_started',
        batchId,
        companiesCount: companies.length
      }))
    }
  }
  ```

- [ ] **Add rate limiting**
  ```typescript
  // File: lib/rate-limit.ts
  export class RateLimiter {
    private static limits = new Map<string, { count: number, resetTime: number }>()
    
    static checkLimit(key: string, maxRequests: number, windowMs: number): boolean {
      const now = Date.now()
      const limit = this.limits.get(key)
      
      if (!limit || now > limit.resetTime) {
        this.limits.set(key, { count: 1, resetTime: now + windowMs })
        return true
      }
      
      if (limit.count >= maxRequests) {
        return false
      }
      
      limit.count++
      return true
    }
  }
  ```

- [ ] **Create API tests**
  ```typescript
  // File: __tests__/workflow-api.test.ts
  import { NextRequest } from 'next/server'
  import { POST } from '@/app/api/otis/workflow/route'

  describe('Workflow API', () => {
    it('should handle start_scraping action', async () => {
      const req = new NextRequest('http://localhost:3000/api/otis/workflow', {
        method: 'POST',
        body: JSON.stringify({
          action: 'start_scraping',
          data: { location: 'Amsterdam', jobTitle: 'Developer' }
        })
      })
      
      const response = await POST(req)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
  ```

- [ ] **Add comprehensive logging**
  ```typescript
  // File: lib/logger.ts
  export class OtisLogger {
    static info(message: string, context?: any): void {
      console.log(`[INFO] ${message}`, context || '')
    }

    static error(message: string, error?: any): void {
      console.error(`[ERROR] ${message}`, error || '')
    }

    static warn(message: string, context?: any): void {
      console.warn(`[WARN] ${message}`, context || '')
    }

    static debug(message: string, context?: any): void {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${message}`, context || '')
      }
    }
  }
  ```

**Acceptance Criteria:**
- [ ] Existing endpoints updated
- [ ] Rate limiting implemented
- [ ] API tests passing
- [ ] Logging comprehensive

---

## 📋 **Daily Standup Template for Backend Developer**

### **Daily Questions:**
1. **What did you complete yesterday?**
2. **What will you work on today?**
3. **Are there any blockers or dependencies?**
4. **Do you need help from other team members?**

### **Week 1 Success Criteria:**
- [ ] WebSocket infrastructure functional
- [ ] Workflow API endpoints implemented
- [ ] Error handling comprehensive
- [ ] Integration with existing Apollo endpoints
- [ ] Basic testing completed

### **Dependencies to Track:**
- [ ] Database Engineer: Real-time triggers (Day 2)
- [ ] Database Engineer: Workflow tables (Day 4)
- [ ] Frontend Developer: WebSocket hook (Day 4)

---

## 🚀 **Immediate Next Steps**

### **Day 1 Actions:**
1. **Set up development environment**
2. **Create WebSocket manager class**
3. **Implement basic security layer**
4. **Test WebSocket connections**

### **Day 2 Actions:**
1. **Create WebSocket API route**
2. **Implement session validation**
3. **Add message handling**
4. **Test with frontend developer**

### **Day 3 Actions:**
1. **Add connection pooling**
2. **Implement error handling**
3. **Create basic tests**
4. **Integration testing**

### **Day 4 Actions:**
1. **Create workflow API**
2. **Implement action handlers**
3. **Add error handling**
4. **Database integration**

### **Day 5 Actions:**
1. **Update existing endpoints**
2. **Add rate limiting**
3. **Create comprehensive tests**
4. **Documentation and logging**

---

## 🎯 **Code Quality Checklist**

### **Before Committing:**
- [ ] Code compiles without errors
- [ ] TypeScript types are correct
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] Tests are written and passing
- [ ] Documentation is updated

### **Integration Points:**
- [ ] WebSocket connections stable
- [ ] API endpoints respond correctly
- [ ] Database operations successful
- [ ] Error scenarios handled gracefully
- [ ] Performance is acceptable

---

This detailed to-do list provides the Backend Developer with specific, actionable tasks for implementing the WebSocket infrastructure and unified API endpoints. Each task includes code examples, acceptance criteria, and clear dependencies. 