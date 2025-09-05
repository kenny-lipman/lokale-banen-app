# User Story: Implement Card-Based UI/UX for Contacts Tab

## Story ID
`US-OTIS-001`

## Title
As a user, I want the Contacts tab to have the same card-based UI/UX as the Companies tab so that I can efficiently manage contact qualification workflows with consistent visual design and interaction patterns.

## Epic
OTIS Dashboard Enhancement

## Priority
High

## Story Points
8

## Acceptance Criteria

### Functional Requirements

#### 1. Status Cards Implementation
- [ ] **Contact Status Cards**: Implement 4 status cards at the top of the Contacts tab matching the Companies tab design:
  - **Qualified Contacts**: Green card showing count of qualified contacts with "Ready for Campaign" description
  - **In Review Contacts**: Orange card showing count of contacts marked for review with "Needs attention" description  
  - **Disqualified Contacts**: Red card showing count of disqualified contacts with "Not suitable" description
  - **Pending Contacts**: Gray card showing count of pending contacts with "Needs qualification" description

#### 2. Workflow Tabs Implementation
- [ ] **Qualification Workflow Tabs**: Implement 4 tabs below status cards matching Companies tab structure:
  - **✅ Qualified** tab: Shows qualified contacts ready for campaign addition
  - **⭕ Review** tab: Shows contacts marked for review requiring manual decision
  - **❌ Disqualified** tab: Shows disqualified contacts archived from workflow
  - **⏳ Pending** tab: Shows pending contacts awaiting qualification

#### 3. Card-Based Contact Display
- [ ] **Contact Cards**: Replace current table/list view with individual contact cards matching company card styling:
  - Each contact displayed as a card with consistent spacing and visual hierarchy
  - Contact cards should show: name, title, email, LinkedIn, company, qualification status
  - Cards should have color-coded borders based on qualification status (green/orange/red/gray)
  - Cards should include qualification action buttons (Qualify/Review/Disqualify)

#### 4. Bulk Actions Integration
- [ ] **Bulk Action Bar**: Implement bulk action bar for each qualification state matching Companies tab:
  - Checkbox for selecting all contacts in current tab
  - Bulk qualification buttons (Qualify Selected, Review Selected, Disqualify Selected)
  - Selection counter showing "X of Y selected"
  - Campaign addition button for qualified contacts

#### 5. Visual Consistency
- [ ] **Design Consistency**: Ensure all visual elements match Companies tab exactly:
  - Same color scheme (green/orange/red/gray for status states)
  - Same card styling, spacing, and typography
  - Same badge designs and icons
  - Same button styles and hover effects
  - Same empty state messaging and icons

### Technical Requirements

#### 6. Component Architecture
- [ ] **Reusable Components**: Create or extend existing components to support contact cards:
  - `ContactStats` component for status cards (similar to CompanyStats)
  - `ContactCard` component for individual contact display
  - `ContactBulkActions` component for bulk operations
  - Extend existing qualification workflow components to handle contacts

#### 7. State Management
- [ ] **Contact State Management**: Implement proper state management for contact qualification:
  - Contact selection state (Set<string> for selected contact IDs)
  - Contact qualification state (loading states for individual contacts)
  - Bulk operation states (loading states for bulk actions)
  - Filter states (qualification status, search, etc.)

#### 8. API Integration
- [ ] **API Consistency**: Ensure contact qualification APIs work with new UI:
  - Individual contact qualification endpoint (`/api/otis/contacts/qualification`)
  - Bulk contact qualification endpoint (`/api/otis/contacts/qualification/batch`)
  - Contact status aggregation for status cards
  - Contact filtering by qualification status

### User Experience Requirements

#### 9. Interaction Patterns
- [ ] **Consistent Interactions**: Match all interaction patterns from Companies tab:
  - Click to select/deselect contacts
  - Keyboard shortcuts (⌘Q, ⌘R, ⌘D for qualification actions)
  - Hover effects and visual feedback
  - Loading states and progress indicators
  - Toast notifications for actions

#### 10. Workflow Navigation
- [ ] **Tab Navigation**: Implement smooth tab navigation:
  - Tab switching should maintain contact selection state
  - Tab switching should preserve search/filter states
  - Tab switching should show appropriate empty states
  - Tab switching should update status card counts

#### 11. Responsive Design
- [ ] **Mobile Compatibility**: Ensure card-based UI works on mobile devices:
  - Cards should stack properly on smaller screens
  - Touch interactions should work for selection and actions
  - Status cards should adapt to mobile layout
  - Bulk action bar should be mobile-friendly

### Performance Requirements

#### 12. Performance Optimization
- [ ] **Efficient Rendering**: Optimize for large contact lists:
  - Virtual scrolling for large contact lists (if needed)
  - Efficient re-rendering when qualification status changes
  - Optimized state updates for bulk operations
  - Proper memoization of contact cards

#### 13. Data Loading
- [ ] **Loading States**: Implement proper loading states:
  - Skeleton loading for status cards
  - Loading states for contact cards
  - Progress indicators for bulk operations
  - Error states for failed operations

## Definition of Done

### Code Quality
- [ ] All components follow existing code patterns and conventions
- [ ] TypeScript types are properly defined for all new components
- [ ] Components are properly tested (unit tests where applicable)
- [ ] No console errors or warnings in development mode

### Visual Quality
- [ ] UI matches Companies tab design exactly
- [ ] All status cards display correct counts and styling
- [ ] Contact cards render properly with all required information
- [ ] Color coding and visual hierarchy are consistent
- [ ] Empty states are properly implemented for each tab

### Functionality
- [ ] Contact qualification works for individual contacts
- [ ] Bulk qualification works for selected contacts
- [ ] Tab switching works correctly and maintains state
- [ ] Search and filtering work within each tab
- [ ] Campaign addition works for qualified contacts
- [ ] Keyboard shortcuts work as expected

### Integration
- [ ] New UI integrates seamlessly with existing OTIS workflow
- [ ] API calls work correctly and handle errors gracefully
- [ ] State management doesn't conflict with existing functionality
- [ ] Performance is acceptable with large contact lists

### Documentation
- [ ] Code is properly commented
- [ ] Component props and interfaces are documented
- [ ] Any new API endpoints are documented
- [ ] User-facing changes are documented in release notes

## Dependencies
- Existing Companies tab implementation (for design reference)
- Contact qualification API endpoints
- Apollo enrichment integration
- Instantly campaign integration

## Risks
- Large contact lists may impact performance
- Complex state management for multiple qualification states
- Potential conflicts with existing contact management functionality

## Notes
- This implementation should maintain backward compatibility with existing contact functionality
- The design should be consistent with the existing Companies tab to provide a unified user experience
- Consider implementing progressive enhancement to ensure the new UI doesn't break existing workflows 