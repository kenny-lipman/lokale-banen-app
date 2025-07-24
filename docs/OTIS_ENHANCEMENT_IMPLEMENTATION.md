# Otis Enhancement Implementation Guide

## Overview

This document provides a comprehensive guide to the enhanced Otis Agent implementation, which includes a unified dashboard, real-time WebSocket communication, and improved user experience.

## New Components

### Core Components

#### 1. OtisDashboard (`components/otis/OtisDashboard.tsx`)
The main orchestrator component that manages the entire workflow.

**Features:**
- Unified single-page interface
- Real-time WebSocket integration
- Stage management and navigation
- Progress tracking and visualization

**Usage:**
```tsx
import { OtisDashboard } from '@/components/otis/OtisDashboard'

export default function OtisPage() {
  return <OtisDashboard />
}
```

#### 2. Workflow Stages

##### Stage1Scraping (`components/otis/stages/Stage1Scraping.tsx`)
Handles job vacancy scraping configuration and initiation.

**Features:**
- Location and job title input
- Platform selection (Indeed, LinkedIn, Both)
- Real-time validation
- Integration with Apify scraping

##### Stage2Enrichment (`components/otis/stages/Stage2Enrichment.tsx`)
Manages company enrichment with Apollo integration.

**Features:**
- Company selection interface
- Real-time progress visualization
- Contact count tracking
- Error handling and retry logic

##### Stage3Campaigns (`components/otis/stages/Stage3Campaigns.tsx`)
Email campaign creation with Instantly.ai integration.

**Features:**
- Email template selection
- Contact and company filtering
- Campaign configuration
- Real-time status updates

##### Stage4Results (`components/otis/stages/Stage4Results.tsx`)
Comprehensive results and analytics display.

**Features:**
- Performance metrics
- Export functionality
- Campaign statistics
- Workflow summary

#### 3. Supporting Components

##### ProgressOverlay (`components/otis/ProgressOverlay.tsx`)
Full-screen overlay for processing operations.

**Features:**
- Real-time progress bars
- Stage-specific indicators
- Time estimates
- Cancel functionality

##### SessionPanel (`components/otis/SessionPanel.tsx`)
Persistent session information and context.

**Features:**
- Session ID display
- Connection status
- Stage progress tracking
- Quick statistics
- Recent activity log

##### NavigationControls (`components/otis/NavigationControls.tsx`)
Stage navigation and workflow management.

**Features:**
- Stage-by-stage navigation
- Skip functionality
- Restart workflow
- Processing controls

### Hooks

#### useOtisWebSocket (`hooks/use-otis-websocket.tsx`)
Manages real-time WebSocket communication.

**Features:**
- Automatic connection management
- Reconnection logic
- Message handling
- Error recovery

**Usage:**
```tsx
const [wsState, wsActions] = useOtisWebSocket(sessionId)

// Send a message
wsActions.sendMessage({
  type: 'subscribe_progress',
  sessionId,
  stage: 'scraping'
})

// Reconnect if needed
wsActions.reconnect()
```

## Backend Components

### API Routes

#### 1. WebSocket Route (`app/api/otis/websocket/route.ts`)
Handles WebSocket connections and real-time communication.

**Features:**
- Session validation
- Message routing
- Connection management
- Error handling

#### 2. Workflow Route (`app/api/otis/workflow/route.ts`)
Unified API for workflow operations.

**Features:**
- Stage management
- Progress tracking
- Integration with external services
- Error handling

### Database Schema

#### New Tables

1. **otis_workflow_sessions**
   - Session management
   - User association
   - Stage tracking
   - Expiration handling

2. **otis_workflow_data**
   - Stage-specific data storage
   - JSONB for flexibility
   - Session association

3. **otis_progress_events**
   - Event tracking
   - Audit trail
   - Real-time notifications

#### Triggers and Functions

- **notify_otis_progress()**: Sends real-time notifications
- **update_updated_at_column()**: Automatic timestamp updates
- **Real-time triggers**: Database change notifications

## Implementation Steps

### 1. Database Setup

Run the migration to create the new tables:

```sql
-- Apply the migration
\i migrations/002_add_workflow_tables.sql
```

### 2. Backend Setup

1. **WebSocket Infrastructure**
   - Deploy WebSocket route
   - Configure connection handling
   - Test real-time communication

2. **Workflow API**
   - Deploy unified workflow route
   - Configure external service integrations
   - Test API endpoints

### 3. Frontend Setup

1. **Component Installation**
   - Copy all components to `components/otis/`
   - Install required dependencies
   - Configure TypeScript types

2. **Hook Integration**
   - Add WebSocket hook
   - Configure real-time updates
   - Test connection management

### 4. Testing

1. **Unit Tests**
   - Component rendering
   - Hook functionality
   - API responses

2. **Integration Tests**
   - End-to-end workflow
   - WebSocket communication
   - Database operations

3. **User Acceptance Tests**
   - Workflow completion
   - Error handling
   - Performance validation

## Configuration

### Environment Variables

```env
# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/otis/websocket

# External Service APIs
APIFY_API_KEY=your_apify_api_key
APOLLO_API_KEY=your_apollo_api_key
INSTANTLY_API_KEY=your_instantly_api_key

# Database Configuration
DATABASE_URL=your_database_url
```

### Feature Flags

```typescript
// Enable/disable features
const FEATURES = {
  REAL_TIME_UPDATES: true,
  WEB_SOCKET_FALLBACK: true,
  PROGRESS_OVERLAY: true,
  SESSION_PERSISTENCE: true
}
```

## Usage Examples

### Basic Workflow

```tsx
import { OtisDashboard } from '@/components/otis/OtisDashboard'

export default function OtisWorkflow() {
  return (
    <div className="min-h-screen">
      <OtisDashboard />
    </div>
  )
}
```

### Custom Stage Configuration

```tsx
import { Stage1Scraping } from '@/components/otis/stages/Stage1Scraping'

export default function CustomScraping() {
  const handleComplete = (data: any) => {
    console.log('Scraping completed:', data)
  }

  return (
    <Stage1Scraping
      isActive={true}
      isProcessing={false}
      onComplete={handleComplete}
      onProcessingStart={() => console.log('Starting...')}
      onProcessingComplete={() => console.log('Complete!')}
    />
  )
}
```

### WebSocket Integration

```tsx
import { useOtisWebSocket } from '@/hooks/use-otis-websocket'

export default function RealTimeComponent() {
  const [wsState, wsActions] = useOtisWebSocket('session_123')

  useEffect(() => {
    if (wsState.connectionStatus === 'connected') {
      wsActions.sendMessage({
        type: 'get_status',
        sessionId: 'session_123'
      })
    }
  }, [wsState.connectionStatus, wsActions])

  return (
    <div>
      <p>Status: {wsState.connectionStatus}</p>
      <p>Progress: {wsState.scrapingProgress.completed}/{wsState.scrapingProgress.total}</p>
    </div>
  )
}
```

## Performance Considerations

### 1. WebSocket Management
- Automatic reconnection with exponential backoff
- Connection pooling for multiple sessions
- Message queuing for offline scenarios

### 2. Database Optimization
- Indexed queries for session data
- Efficient JSONB operations
- Connection pooling

### 3. Frontend Optimization
- Component lazy loading
- Memoized calculations
- Efficient re-renders

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check server availability
   - Verify session ID format
   - Check network connectivity

2. **Database Connection Issues**
   - Verify DATABASE_URL
   - Check migration status
   - Validate table permissions

3. **Component Rendering Issues**
   - Check TypeScript types
   - Verify prop interfaces
   - Validate component imports

### Debug Mode

Enable debug logging:

```typescript
const DEBUG = process.env.NODE_ENV === 'development'

if (DEBUG) {
  console.log('WebSocket State:', wsState)
  console.log('Component Props:', props)
}
```

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Performance metrics
   - Success rate tracking
   - Cost analysis

2. **Enhanced UI**
   - Dark mode support
   - Mobile responsiveness
   - Accessibility improvements

3. **Integration Extensions**
   - Additional scraping platforms
   - More enrichment services
   - Campaign management tools

### Migration Path

The new implementation is designed to be backward compatible. Existing functionality will continue to work while new features are gradually enabled.

## Support

For technical support or questions about the implementation:

1. Check the troubleshooting section
2. Review the component documentation
3. Test with the provided examples
4. Contact the development team

---

**Version:** 1.0.0  
**Last Updated:** January 2024  
**Compatibility:** Next.js 14+, TypeScript 5+, Supabase 