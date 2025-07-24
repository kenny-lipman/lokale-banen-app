# OTIS Smart Polling & WebSocket Implementation PRD

## Product Requirements Document
**Project:** OTIS Enhanced Workflow - Smart Polling & Real-time Updates  
**Version:** 1.0  
**Date:** January 2025  
**Author:** John (PM)  

---

## 1. Executive Summary

### Problem Statement
The current OTIS Step 2 (Enrichment) implementation suffers from poor user experience due to constant polling and UI reloading, even when no new data is available. This creates distracting flickering and unnecessary network requests, especially for older sessions where no new scraping is occurring.

### Solution Overview
Implement a hybrid WebSocket + Smart Polling system that provides real-time updates when data changes while eliminating unnecessary UI refreshes and network requests.

### Success Metrics
- **Reduced UI flickering:** 0% unnecessary component reloads
- **Improved performance:** 80% reduction in unnecessary API calls
- **Better UX:** Seamless background updates with subtle indicators
- **Reliability:** 99.9% uptime with WebSocket fallback

---

## 2. User Stories & Requirements

### Primary User Story
**As a** user working with OTIS enrichment  
**I want** real-time updates without UI disruption  
**So that** I can focus on selecting companies without distracting flickering  

### Acceptance Criteria
- [ ] WebSocket provides real-time updates for new data
- [ ] Background polling only occurs when necessary
- [ ] UI only updates when data actually changes
- [ ] Subtle progress indicators show background activity
- [ ] Graceful fallback to polling if WebSocket fails
- [ ] No UI flickering for older sessions with no new data

---

## 3. Technical Architecture

### 3.1 WebSocket Implementation
```typescript
// Real-time update system
interface WebSocketMessage {
  type: 'enrichment_update' | 'scraping_update' | 'status_change'
  sessionId: string
  data: {
    newCompanies?: number
    newJobs?: number
    enrichmentProgress?: {
      total: number
      completed: number
      failed: number
    }
    timestamp: string
  }
}
```

### 3.2 Smart Polling Strategy
```typescript
// Adaptive polling based on session state
interface PollingConfig {
  newSession: {
    initialInterval: 5000,    // 5s for first 2 minutes
    normalInterval: 15000,    // 15s after 2 minutes
    maxInterval: 30000        // 30s max
  }
  oldSession: {
    initialInterval: 30000,   // 30s for old sessions
    normalInterval: 60000,    // 1 minute
    maxInterval: 300000       // 5 minutes max
  }
}
```

### 3.3 Data Change Detection
```typescript
// Only update UI when data actually changes
interface DataSnapshot {
  companiesCount: number
  jobsCount: number
  enrichmentStatus: string
  lastUpdate: string
  hash: string // Content hash for change detection
}
```

---

## 4. Implementation Plan

### Phase 1: WebSocket Infrastructure (Week 1)
- [ ] Enhance existing WebSocket endpoint for real-time updates
- [ ] Implement session-specific WebSocket channels
- [ ] Add WebSocket connection management and reconnection logic
- [ ] Create WebSocket message handlers for enrichment updates

### Phase 2: Smart Polling Logic (Week 2)
- [ ] Implement adaptive polling based on session age and activity
- [ ] Add data change detection with content hashing
- [ ] Create polling state management (active/inactive/adaptive)
- [ ] Implement user activity detection to pause polling during interactions

### Phase 3: UI Updates & Indicators (Week 3)
- [ ] Replace current polling UI with subtle progress indicators
- [ ] Implement smooth data transitions without component reloads
- [ ] Add background activity indicators (small spinner, progress dots)
- [ ] Create loading states that don't disrupt current UI

### Phase 4: Testing & Optimization (Week 4)
- [ ] Performance testing with various session types
- [ ] WebSocket fallback testing
- [ ] User experience testing and feedback collection
- [ ] Optimization based on real usage patterns

---

## 5. Technical Specifications

### 5.1 WebSocket Endpoint Enhancement
**Current:** `/api/otis/websocket?session={sessionId}`  
**Enhanced:** Support for enrichment-specific events and real-time data updates

**New Message Types:**
- `enrichment_progress_update` - Real-time enrichment progress
- `new_companies_found` - New companies added to session
- `enrichment_complete` - Enrichment process finished
- `session_status_change` - Session state changes

### 5.2 Smart Polling Algorithm
```typescript
function shouldPoll(session: SessionData, userActivity: UserActivity): boolean {
  // Don't poll if user is actively interacting
  if (userActivity.isInteracting) return false
  
  // Don't poll old sessions frequently
  if (session.age > 24 * 60 * 60 * 1000) { // 24 hours
    return session.lastActivity > 5 * 60 * 1000 // 5 minutes ago
  }
  
  // Adaptive polling for active sessions
  return true
}
```

### 5.3 UI Update Strategy
```typescript
function updateUI(newData: DataSnapshot, currentData: DataSnapshot): boolean {
  // Only update if data actually changed
  if (newData.hash === currentData.hash) {
    return false // No update needed
  }
  
  // Smooth transition for new data
  return true
}
```

---

## 6. User Experience Design

### 6.1 Visual Indicators
- **Subtle Progress Dots:** Small animated dots showing background activity
- **Smooth Transitions:** Fade-in/out for new data instead of hard reloads
- **Status Badge:** Small indicator showing connection status
- **Activity Indicator:** Minimal spinner only when actively processing

### 6.2 Interaction States
- **Idle:** No indicators, clean interface
- **Background Activity:** Subtle dots animation
- **New Data Available:** Gentle notification without disruption
- **Processing:** Small progress indicator
- **Error:** Non-intrusive error message

### 6.3 Responsive Behavior
- **User Active:** Pause polling during user interactions
- **Tab Inactive:** Reduce polling frequency
- **Network Issues:** Graceful fallback to polling
- **Session Age:** Adaptive polling based on session state

---

## 7. Risk Assessment & Mitigation

### 7.1 Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebSocket connection failures | Medium | High | Robust fallback to polling |
| Browser WebSocket limitations | Low | Medium | Feature detection and polyfills |
| Memory leaks from long connections | Medium | Medium | Connection cleanup and monitoring |
| Performance impact on old devices | Low | Medium | Adaptive polling and throttling |

### 7.2 User Experience Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users not noticing updates | Medium | Medium | Subtle but clear indicators |
| Connection status confusion | Low | Low | Clear status indicators |
| Performance degradation | Low | High | Monitoring and optimization |

---

## 8. Success Criteria & KPIs

### 8.1 Technical Metrics
- **WebSocket Uptime:** >99.5%
- **Polling Reduction:** >80% fewer unnecessary requests
- **UI Update Efficiency:** 0% unnecessary component reloads
- **Response Time:** <100ms for real-time updates

### 8.2 User Experience Metrics
- **User Satisfaction:** >4.5/5 rating for Step 2 experience
- **Task Completion Rate:** >95% successful company selection
- **Error Rate:** <1% connection-related errors
- **Performance Score:** >90 Lighthouse performance score

### 8.3 Business Metrics
- **Session Completion Rate:** >90% users complete enrichment
- **Time to Complete:** <5 minutes average for company selection
- **Support Tickets:** <5% related to connection issues

---

## 9. Implementation Timeline

### Week 1: Foundation
- WebSocket infrastructure setup
- Basic real-time messaging
- Connection management

### Week 2: Smart Logic
- Adaptive polling implementation
- Data change detection
- Session state management

### Week 3: User Interface
- Subtle progress indicators
- Smooth UI transitions
- Activity state management

### Week 4: Testing & Launch
- Comprehensive testing
- Performance optimization
- User feedback integration
- Production deployment

---

## 10. Future Enhancements

### 10.1 Advanced Features
- **Predictive Polling:** ML-based polling frequency optimization
- **Offline Support:** Queue updates when offline
- **Multi-session Support:** Handle multiple active sessions
- **Advanced Analytics:** Detailed usage and performance metrics

### 10.2 Integration Opportunities
- **Notification System:** Browser notifications for important updates
- **Mobile Optimization:** Touch-friendly indicators and interactions
- **Accessibility:** Screen reader support for status updates
- **Internationalization:** Multi-language support for status messages

---

## 11. Conclusion

This PRD outlines a comprehensive solution to eliminate the poor user experience caused by constant polling and UI flickering in the OTIS enrichment workflow. By implementing WebSocket-based real-time updates with smart polling fallback, we will create a seamless, responsive, and reliable user experience that allows users to focus on their core task of selecting companies for enrichment.

The hybrid approach ensures both real-time responsiveness and system reliability, while the intelligent UI update strategy eliminates unnecessary visual disruptions. This solution addresses the immediate UX pain points while establishing a foundation for future real-time features across the OTIS platform. 