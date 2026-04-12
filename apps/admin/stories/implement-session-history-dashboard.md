# Story: Implement Session History Dashboard

## Status: Draft

## Story
As a user of the Otis workflow, I want to see my session history in the dashboard sidebar so that I can track my previous workflow runs, view results, and resume sessions when needed.

## Acceptance Criteria
- [ ] Users can view their session history in an expandable sidebar panel
- [ ] Session cards display key metrics: jobs scraped, companies enriched, contacts found
- [ ] Users can view detailed session information in a modal
- [ ] Users can resume previous sessions with full state restoration
- [ ] Admin users can view all sessions with user filtering
- [ ] Session history is always preserved and accessible
- [ ] Performance is optimized for large session lists
- [ ] Mobile responsive design works correctly

## Dev Notes
- Integrate with existing Otis Dashboard layout
- Use existing design system components
- Maintain real-time updates via WebSocket
- Ensure proper error handling and loading states
- Follow existing code patterns and conventions

## Testing
- Unit tests for all new components
- Integration tests for API endpoints
- E2E tests for session history workflows
- Performance testing for large datasets
- Accessibility testing for screen readers

## Tasks

### 1. Database Schema Updates
- [ ] Extend otis_workflow_sessions table with new columns:
  - user_id (UUID, references auth.users)
  - completed_at (TIMESTAMP)
  - total_jobs (INTEGER, default 0)
  - total_companies (INTEGER, default 0)
  - total_contacts (INTEGER, default 0)
  - total_campaigns (INTEGER, default 0)
  - workflow_state (JSONB) - for session resume
- [ ] Add performance indexes:
  - idx_otis_sessions_user_id
  - idx_otis_sessions_created_at
- [ ] Create and test migration script
- [ ] Update TypeScript database types

### 2. API Endpoints Implementation
- [ ] GET /api/otis/sessions
  - Returns user's session history with pagination
  - Supports filtering by date, status
  - Includes basic metrics per session
- [ ] GET /api/otis/sessions/[sessionId]
  - Returns detailed session information
  - Includes complete workflow timeline
  - Returns all stage data and results
- [ ] GET /api/otis/sessions/[sessionId]/resume
  - Returns serialized workflow state
  - Validates session ownership
  - Includes all necessary data for resume
- [ ] POST /api/otis/sessions/[sessionId]/resume
  - Validates session can be resumed
  - Returns success/error response
- [ ] GET /api/admin/sessions
  - Returns all sessions (admin only)
  - Supports user filtering
  - Includes user information

### 3. Core Components Development
- [ ] SessionHistoryPanel.tsx
  - Expandable/collapsible sidebar panel
  - Session list with virtual scrolling
  - Quick stats summary
  - Search and filter functionality
- [ ] SessionCard.tsx
  - Compact session information display
  - Status indicators (completed, failed, in progress)
  - Key metrics display
  - Action buttons (View Details, Resume)
- [ ] SessionDetailsModal.tsx
  - Complete session details view
  - Stage-by-stage timeline
  - Results breakdown with charts
  - Resume functionality
- [ ] use-session-history.tsx
  - Data fetching with pagination
  - Real-time updates
  - Search and filter logic
  - Error handling

### 4. Integration & State Management
- [ ] Update RightSidebar.tsx
  - Add SessionHistoryPanel component
  - Handle expand/collapse state
  - Pass current session context
- [ ] Extend WorkflowContext
  - Add session completion tracking
  - Add session history state
  - Add resume functionality
- [ ] Implement session completion logic
  - Track when sessions are completed
  - Aggregate results data
  - Update session metrics
- [ ] Add state serialization
  - Serialize workflow state for storage
  - Deserialize state for resume
  - Validate state integrity

### 5. Resume Functionality
- [ ] State restoration logic
  - Load session state from database
  - Restore workflow context
  - Navigate to appropriate stage
- [ ] Resume confirmation flow
  - Confirmation dialog
  - Progress indicators
  - Error handling
- [ ] Session state validation
  - Validate state completeness
  - Handle corrupted states
  - Provide fallback options

### 6. Admin Features
- [ ] Admin session panel component
  - All sessions view
  - User filtering
  - Bulk operations
- [ ] User filtering functionality
  - Filter by user
  - Filter by date range
  - Filter by status
- [ ] System-wide analytics
  - Total sessions count
  - Success rate metrics
  - Performance analytics
- [ ] Admin permission checks
  - Verify admin role
  - Secure data access
  - Audit logging

### 7. Testing & Polish
- [ ] Unit tests for all components
  - Component rendering tests
  - Hook functionality tests
  - Utility function tests
- [ ] Integration tests for API endpoints
  - Endpoint functionality tests
  - Authentication tests
  - Error handling tests
- [ ] Performance optimization
  - Virtual scrolling implementation
  - Lazy loading of session details
  - Database query optimization
- [ ] Error handling and edge cases
  - Network error handling
  - Empty state handling
  - Invalid session handling

## Dev Agent Record

### Agent Model Used
- Full Stack Developer (James)

### Debug Log References
- None yet

### Completion Notes List
- None yet

### File List
- None yet

### Change Log
- None yet

## Dependencies
- Existing Otis Dashboard components
- Supabase database
- WebSocket infrastructure
- Existing design system 