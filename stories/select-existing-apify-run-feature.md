# Story: Select Existing Apify Run for Job Scraping

## User Story
As a user of the OTIS Job Scraper, I want to be able to select an existing successful Apify run from a dropdown, so that I can view and work with previously scraped job data without having to start a new scraping session.

## Acceptance Criteria
- [ ] In the "Job Scraping Configuration" section, add a toggle/option to "Use Existing Run"
- [ ] When "Use Existing Run" is selected, show a dropdown with successful Apify runs
- [ ] Dropdown should display: `{region.plaats} - {title} ({platform})`
- [ ] Only show runs with `status = 'SUCCEEDED'` AND `actor_id = 'hMvNSpz3JnHgl5jkh'`
- [ ] When an existing run is selected, populate the form fields and show the scraped results
- [ ] Maintain the ability to start new scraping sessions

## Technical Requirements
- Fetch Apify runs from `apify_runs` table with the specified filters
- Join with `regions` table to get `plaats` information
- Update the form state to handle existing run selection
- Reuse existing results display logic for showing scraped data

## UI/UX Design Options

### Option 1: Simple Toggle + Dropdown (Recommended - KISS)
```
┌─────────────────────────────────────────────────────────┐
│ Job Scraping Configuration                              │
├─────────────────────────────────────────────────────────┤
│ ○ Start New Scraping    ○ Use Existing Run             │
│                                                         │
│ [When "Use Existing Run" is selected]                  │
│ Select Existing Run:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Amsterdam - Software Engineer (Indeed) ▼           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [When "Start New Scraping" is selected]                │
│ Job Title: [Software Engineer]                         │
│ Location: [Amsterdam ▼]                                │
│ Platform: [Indeed ▼]                                   │
│                                                         │
│ [Start Job Scraping] or [Load Selected Run]            │
└─────────────────────────────────────────────────────────┘
```

**Pros:**
- Simple and intuitive
- Clear separation between new and existing runs
- Minimal UI changes
- Easy to understand

**Cons:**
- Takes up more vertical space
- Requires form field updates

### Option 2: Inline Dropdown with "Recent Runs"
```
┌─────────────────────────────────────────────────────────┐
│ Job Scraping Configuration                              │
├─────────────────────────────────────────────────────────┤
│ Job Title: [Software Engineer]                         │
│ Location: [Amsterdam ▼]                                │
│ Platform: [Indeed ▼]                                   │
│                                                         │
│ Or select from recent successful runs:                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ── Select Recent Run ── ▼                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Start Job Scraping]                                   │
└─────────────────────────────────────────────────────────┘
```

**Pros:**
- Compact design
- Doesn't change existing form layout
- Quick access to recent runs

**Cons:**
- Less obvious that it's a different workflow
- Might confuse users about what happens when selected

### Option 3: Tabbed Interface
```
┌─────────────────────────────────────────────────────────┐
│ [New Scraping] [Existing Runs]                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Tab 1: New Scraping]                                  │
│ Job Title: [Software Engineer]                         │
│ Location: [Amsterdam ▼]                                │
│ Platform: [Indeed ▼]                                   │
│ [Start Job Scraping]                                   │
│                                                         │
│ [Tab 2: Existing Runs]                                 │
│ Select Run:                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Amsterdam - Software Engineer (Indeed) ▼           │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Load Selected Run]                                    │
└─────────────────────────────────────────────────────────┘
```

**Pros:**
- Clear separation of workflows
- Scalable for future features
- Professional appearance

**Cons:**
- More complex implementation
- Takes up more space
- Might be overkill for this feature

## Recommended Implementation: Option 1 (Simple Toggle + Dropdown)

### Why Option 1 is the best KISS approach:

1. **Minimal Cognitive Load**: Users understand immediately they have two choices
2. **Familiar Pattern**: Toggle switches are widely used and understood
3. **Progressive Disclosure**: Form fields only show when relevant
4. **Easy to Implement**: Minimal changes to existing code
5. **Scalable**: Easy to add more options later if needed

### Implementation Steps:

1. **Add Toggle Component**
   - Use existing UI components (RadioGroup or Switch)
   - State: `useExistingRun: boolean`

2. **Create API Endpoint**
   - `/api/otis/apify-runs/successful` 
   - Filter by `status = 'SUCCEEDED'` AND `actor_id = 'hMvNSpz3JnHgl5jkh'`
   - Join with regions table for `plaats`

3. **Update Form Logic**
   - When `useExistingRun = true`: Show dropdown, hide form fields
   - When `useExistingRun = false`: Show form fields, hide dropdown
   - Handle form submission for both cases

4. **Reuse Results Display**
   - Use existing `refreshResults` function
   - Pass selected `apify_run_id` instead of `session_id`

### Data Flow:
```
User selects "Use Existing Run" 
→ Load successful runs from API
→ User selects run from dropdown
→ Load results using existing run ID
→ Display results using existing UI components
```

### Error Handling:
- Show loading states for API calls
- Handle cases where no successful runs exist
- Validate that selected run has associated job data

### Future Enhancements (Post-MVP):
- Add search/filter to dropdown for many runs
- Show run date in dropdown
- Add "favorite" runs functionality
- Show run statistics (job count, company count) in dropdown

## Success Metrics:
- Users can successfully select and view existing runs
- No confusion between new scraping and existing run workflows
- Minimal increase in page load time
- Existing functionality remains unchanged 