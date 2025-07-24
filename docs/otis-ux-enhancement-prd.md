# Product Requirements Document: Otis Agent UX Enhancement

**Project**: LokaleBanen Dashboard - Otis Agent UX Improvement  
**Document Type**: Brownfield Enhancement PRD  
**Version**: 1.0  
**Date**: December 2024  
**Author**: John, Product Manager  

---

## Executive Summary

### Overview
This PRD outlines the implementation of comprehensive UX improvements for the Otis Agent within the LokaleBanen Dashboard. The enhancement addresses critical user experience pain points identified in the current multi-page workflow: workflow fragmentation, waiting uncertainty, and context loss.

### Business Value
- **User Efficiency**: Reduce workflow completion time by 60% through unified interface
- **User Satisfaction**: Eliminate confusion and frustration from fragmented navigation
- **Operational Excellence**: Improve resource utilization through better process management
- **Scalability**: Enable future enhancements with solid UX foundation

### Success Metrics
- **Workflow Completion Rate**: Increase from 70% to 95%
- **User Support Tickets**: Reduce by 80% related to Otis workflow confusion
- **Session Duration**: Reduce average session time by 40%
- **User Adoption**: Achieve 90% adoption of new unified interface within 2 weeks

---

## Current State Analysis

### Existing System
The current Otis Agent implementation consists of three separate pages:
1. **Job Scraping** (`/agents/otis/enhanced`) - Configure and start scraping
2. **Company Enrichment** (`/agents/otis/enrich`) - Apollo enrichment interface
3. **Contact Management** (`/contacten`) - Campaign integration

### Identified Pain Points
1. **Workflow Fragmentation**: Users navigate between 3+ pages with no clear connection
2. **Waiting & Uncertainty**: No visibility into long-running processes
3. **Context Loss**: Information scattered across different pages
4. **Manual Navigation**: Users must remember and navigate between stages manually

### Technical Infrastructure
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Supabase (PostgreSQL) with Next.js API routes
- **External APIs**: Apify (scraping), Apollo (enrichment), Instantly (campaigns)
- **Real-time**: Existing polling-based updates for Apollo enrichment

---

## Target State Vision

### Unified User Experience
A single-page interface that guides users through the complete Otis workflow:
1. **Job Search Setup** - Configure scraping parameters
2. **Scraping Progress** - Real-time monitoring of job collection
3. **Company Enrichment** - Contact enrichment with progress tracking
4. **Campaign Management** - Contact selection and campaign creation

### Key UX Principles
- **Progressive Disclosure**: Show only relevant information at each stage
- **Context Preservation**: Always visible session summary and progress
- **Real-time Feedback**: Live updates for all long-running operations
- **Smart Navigation**: Prevent errors through intelligent stage management

---

## Functional Requirements

### Epic 1: Unified Dashboard Layout

#### Story 1.1: Workflow State Management
**As a** user of the Otis Agent  
**I want** my workflow state to be preserved across page interactions  
**So that** I don't lose progress when navigating or refreshing the page  

**Acceptance Criteria:**
- [ ] Implement `useOtisWorkflow` hook with persistent state management
- [ ] Store workflow state in localStorage with automatic recovery
- [ ] Handle state migration for existing sessions
- [ ] Provide clear error handling for corrupted state

**Technical Requirements:**
- React Context for global state management
- localStorage persistence with versioning
- State validation and recovery mechanisms
- TypeScript interfaces for all state structures

#### Story 1.2: Unified Interface Layout
**As a** user of the Otis Agent  
**I want** all workflow stages to be visible on a single page  
**So that** I can see my complete progress and navigate easily  

**Acceptance Criteria:**
- [ ] Create unified dashboard layout with all stages visible
- [ ] Implement collapsible sections for each workflow stage
- [ ] Add visual indicators for stage status (idle, active, completed)
- [ ] Ensure responsive design for mobile and desktop

**Technical Requirements:**
- Tailwind CSS grid layout system
- shadcn/ui Card components for stage containers
- CSS transitions for smooth state changes
- Mobile-first responsive design

#### Story 1.3: Smart Navigation System
**As a** user of the Otis Agent  
**I want** intelligent navigation that prevents errors and guides me through the workflow  
**So that** I can't accidentally skip required steps or access incomplete stages  

**Acceptance Criteria:**
- [ ] Implement stage readiness validation logic
- [ ] Disable stages that aren't ready yet with clear explanations
- [ ] Auto-advance to next stage when current stage completes
- [ ] Provide quick navigation to any completed stage for review

**Technical Requirements:**
- Stage dependency validation system
- Auto-advancement logic with user confirmation option
- Breadcrumb navigation with stage indicators
- Keyboard navigation support

### Epic 2: Real-time Progress & Feedback

#### Story 2.1: Progress Tracking System
**As a** user of the Otis Agent  
**I want** real-time progress updates for all long-running operations  
**So that** I know exactly what's happening and when operations will complete  

**Acceptance Criteria:**
- [ ] Implement progress bars with percentage and time estimates
- [ ] Show detailed status for each operation (scraping, enrichment, campaign creation)
- [ ] Display estimated time remaining for operations
- [ ] Provide operation-specific error messages and recovery options

**Technical Requirements:**
- WebSocket connection for real-time updates
- Server-Sent Events (SSE) as fallback
- Progress calculation algorithms
- Error handling and retry mechanisms

#### Story 2.2: Status Indicators & Badges
**As a** user of the Otis Agent  
**I want** clear visual indicators for the status of each operation  
**So that** I can quickly understand what's happening at a glance  

**Acceptance Criteria:**
- [ ] Create status badge system with consistent visual language
- [ ] Implement status transitions with smooth animations
- [ ] Show operation-specific status details on hover/click
- [ ] Provide status history for completed operations

**Technical Requirements:**
- Status badge component with configurable states
- CSS animations for status transitions
- Tooltip system for detailed status information
- Status history tracking and display

#### Story 2.3: Notification System
**As a** user of the Otis Agent  
**I want** notifications when operations complete or fail  
**So that** I can be informed of important events even when not actively monitoring  

**Acceptance Criteria:**
- [ ] Implement browser notifications for operation completion
- [ ] Show toast notifications for immediate feedback
- [ ] Provide email summaries for long-running operations
- [ ] Allow users to configure notification preferences

**Technical Requirements:**
- Browser notification API integration
- Toast notification system (existing shadcn/ui)
- Email notification service integration
- User preference management

### Epic 3: Session Context & Summary

#### Story 3.1: Session Summary Panel
**As a** user of the Otis Agent  
**I want** an always-visible summary of my current session  
**So that** I can track my progress and understand the value of my work  

**Acceptance Criteria:**
- [ ] Create persistent session summary panel
- [ ] Display key metrics: jobs found, companies extracted, contacts enriched, campaigns created
- [ ] Show session duration and overall progress
- [ ] Provide quick actions for common tasks

**Technical Requirements:**
- Session summary component with real-time updates
- Metric calculation and display system
- Quick action buttons with proper state management
- Session persistence across browser sessions

#### Story 3.2: Contextual Information Display
**As a** user of the Otis Agent  
**I want** contextual information that helps me make better decisions  
**So that** I can optimize my workflow and understand the impact of my actions  

**Acceptance Criteria:**
- [ ] Show success rates and conversion metrics
- [ ] Display recommendations based on historical data
- [ ] Provide insights about data quality and completeness
- [ ] Show comparative metrics with previous sessions

**Technical Requirements:**
- Analytics data collection and display
- Recommendation engine integration
- Data quality assessment algorithms
- Historical data comparison system

### Epic 4: Process Queue Management

#### Story 4.1: Process Queue Visualization
**As a** user of the Otis Agent  
**I want** a visual representation of all running and queued processes  
**So that** I can understand resource utilization and manage operations effectively  

**Acceptance Criteria:**
- [ ] Create process queue component with visual queue representation
- [ ] Show process status, progress, and estimated completion time
- [ ] Display resource allocation and system capacity
- [ ] Provide process manipulation controls (pause, resume, cancel)

**Technical Requirements:**
- Process queue visualization component
- Real-time queue status updates
- Process control API integration
- Resource monitoring and display

#### Story 4.2: Queue Management Controls
**As a** user of the Otis Agent  
**I want** the ability to manage running processes  
**So that** I can optimize resource usage and handle urgent requests  

**Acceptance Criteria:**
- [ ] Implement pause/resume functionality for running processes
- [ ] Allow cancellation of queued or running processes
- [ ] Provide process prioritization controls
- [ ] Show impact of process changes on overall workflow

**Technical Requirements:**
- Process control API endpoints
- Queue management logic
- Priority system implementation
- Impact analysis and display

---

## Non-Functional Requirements

### Performance
- **Page Load Time**: < 2 seconds for initial load
- **Real-time Updates**: < 500ms latency for status updates
- **State Persistence**: < 100ms for state save/load operations
- **Memory Usage**: < 50MB additional memory usage

### Scalability
- **Concurrent Users**: Support 100+ concurrent users
- **Process Queue**: Handle 50+ concurrent processes
- **Data Volume**: Support 10,000+ jobs per session
- **API Rate Limits**: Respect external API rate limits

### Reliability
- **Uptime**: 99.9% availability during business hours
- **Error Recovery**: Automatic recovery from 95% of error conditions
- **Data Integrity**: Zero data loss during state transitions
- **Graceful Degradation**: Functionality maintained with reduced features during API outages

### Security
- **Authentication**: Maintain existing Supabase authentication
- **Authorization**: Preserve role-based access controls
- **Data Protection**: Encrypt sensitive data in localStorage
- **API Security**: Secure all external API communications

### Accessibility
- **WCAG 2.1 AA**: Full compliance with accessibility standards
- **Keyboard Navigation**: Complete keyboard accessibility
- **Screen Reader**: Full screen reader compatibility
- **High Contrast**: Support for high contrast mode

---

## Technical Architecture

### Frontend Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Otis UX Enhancement                   │
├─────────────────────────────────────────────────────────┤
│  Unified Dashboard Layout                               │
│  ├── WorkflowStateManager (Context + localStorage)     │
│  ├── StageNavigation (Smart routing)                   │
│  └── SessionSummary (Persistent display)               │
├─────────────────────────────────────────────────────────┤
│  Real-time Progress System                              │
│  ├── WebSocketService (Primary)                        │
│  ├── SSEFallback (Secondary)                           │
│  └── ProgressIndicators (Visual feedback)              │
├─────────────────────────────────────────────────────────┤
│  Process Queue Management                               │
│  ├── QueueVisualization (Status display)               │
│  ├── ProcessControls (Pause/resume/cancel)             │
│  └── ResourceMonitoring (Capacity tracking)            │
└─────────────────────────────────────────────────────────┘
```

### Backend Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Backend Services                     │
├─────────────────────────────────────────────────────────┤
│  WebSocket Server                                       │
│  ├── Connection Management                              │
│  ├── Message Broadcasting                               │
│  └── Client Authentication                              │
├─────────────────────────────────────────────────────────┤
│  Process Management API                                 │
│  ├── Queue Management                                   │
│  ├── Process Control                                    │
│  └── Status Updates                                     │
├─────────────────────────────────────────────────────────┤
│  Analytics & Metrics                                    │
│  ├── Session Tracking                                   │
│  ├── Performance Metrics                                │
│  └── User Behavior Analysis                             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow
1. **User Action** → WorkflowStateManager updates state
2. **State Change** → Triggers API calls and UI updates
3. **API Response** → WebSocket broadcasts progress updates
4. **Progress Update** → UI components reflect new state
5. **State Persistence** → localStorage saves current state

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Establish core infrastructure and basic unified interface

**Deliverables:**
- [ ] Workflow state management system
- [ ] Unified dashboard layout
- [ ] Basic progress indicators
- [ ] Session summary panel
- [ ] Smart navigation logic

**Success Criteria:**
- Users can complete basic workflow without page navigation
- State persists across browser sessions
- Progress is visible for all operations

### Phase 2: Real-time Features (Week 2)
**Goal**: Implement real-time updates and process management

**Deliverables:**
- [ ] WebSocket infrastructure
- [ ] Real-time progress updates
- [ ] Process queue management
- [ ] Notification system
- [ ] Queue manipulation features

**Success Criteria:**
- Real-time updates work reliably
- Users can manage running processes
- Notifications provide timely feedback

### Phase 3: Integration & Polish (Week 3)
**Goal**: Complete integration and optimize user experience

**Deliverables:**
- [ ] Full workflow integration
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] User testing and refinement

**Success Criteria:**
- Complete workflow functions seamlessly
- Error handling is robust and user-friendly
- Performance meets all requirements

---

## Risk Assessment

### Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebSocket connection failures | Medium | High | Implement SSE fallback |
| State corruption in localStorage | Low | High | State validation and recovery |
| Performance degradation with large datasets | Medium | Medium | Implement virtualization and pagination |
| External API rate limiting | High | Medium | Implement queue management and retry logic |

### Business Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User resistance to interface changes | Medium | Medium | Provide training and gradual rollout |
| Increased support load during transition | High | Low | Comprehensive documentation and help system |
| Temporary productivity decrease during learning | High | Low | Provide parallel old interface during transition |

### Mitigation Strategies
1. **Gradual Rollout**: Deploy to small user group first
2. **Feature Flags**: Enable/disable features for testing
3. **Rollback Plan**: Maintain ability to revert to old interface
4. **User Training**: Provide comprehensive documentation and training
5. **Monitoring**: Implement detailed analytics and error tracking

---

## Success Metrics & KPIs

### Primary Metrics
- **Workflow Completion Rate**: Target 95% (current 70%)
- **Average Session Duration**: Target 40% reduction
- **User Support Tickets**: Target 80% reduction
- **User Adoption Rate**: Target 90% within 2 weeks

### Secondary Metrics
- **Page Load Performance**: < 2 seconds
- **Real-time Update Latency**: < 500ms
- **Error Rate**: < 1% of operations
- **User Satisfaction Score**: > 4.5/5

### Measurement Methods
1. **Analytics Tracking**: Implement comprehensive event tracking
2. **User Surveys**: Regular feedback collection
3. **Performance Monitoring**: Real-time performance metrics
4. **Support Ticket Analysis**: Track issue categories and resolution times

---

## Dependencies & Constraints

### External Dependencies
- **Apify API**: Job scraping functionality
- **Apollo API**: Company enrichment services
- **Instantly API**: Campaign management
- **Supabase**: Database and authentication

### Internal Dependencies
- **Existing UI Components**: shadcn/ui component library
- **Authentication System**: Supabase Auth integration
- **Database Schema**: Existing table structures
- **API Routes**: Current Next.js API endpoints

### Constraints
- **Browser Compatibility**: Must support Chrome, Firefox, Safari, Edge
- **Mobile Responsiveness**: Must work on tablets and mobile devices
- **API Rate Limits**: Must respect external API limitations
- **Data Privacy**: Must comply with GDPR and data protection regulations

---

## Appendix

### A. User Personas
**Primary User**: Marketing/Recruitment professional using Otis for lead generation
**Secondary User**: Admin managing Otis operations and monitoring performance

### B. User Journey Maps
**Current Journey**: Fragmented across 3+ pages with context loss
**Target Journey**: Seamless single-page experience with full context preservation

### C. Technical Specifications
- **Frontend Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Context + localStorage
- **Real-time**: WebSocket with SSE fallback
- **Backend**: Next.js API routes with Supabase

### D. Glossary
- **Otis Agent**: Job scraping and enrichment automation system
- **Apify**: External service for web scraping
- **Apollo**: External service for company enrichment
- **Instantly**: External service for email campaign management
- **Workflow Stage**: Individual step in the Otis process
- **Process Queue**: System for managing concurrent operations

---

**Document Status**: Approved  
**Next Review**: After Phase 1 completion  
**Stakeholders**: Development Team, UX Team, Product Management 