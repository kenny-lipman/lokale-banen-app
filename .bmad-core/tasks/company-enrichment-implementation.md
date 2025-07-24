# Company Enrichment Implementation

## Story
As a developer, I need to implement the improved company enrichment feature that tracks enrichment status based on actual contacts in the database, displays contact counts, and allows contact selection for campaigns.

## Acceptance Criteria
- [ ] Companies show 'enriched' status only when they have at least 1 contact in Supabase contacts table
- [ ] Contact count is displayed per company before Apollo enrichment
- [ ] Apollo Enrichment Jobs section shows individual contacts with company info
- [ ] Contact selection integrates with Instantly campaign creation
- [ ] All changes follow KISS principle and existing code patterns

## Dev Notes
- Need to modify enrichment status logic to check contacts table instead of Apollo API
- Add contact count queries to company data fetching
- Update Apollo enrichment jobs to display individual contacts
- Integrate contact selection with existing campaign workflow

## Testing
- [ ] Verify enrichment status reflects actual contacts in database
- [ ] Test contact count display accuracy
- [ ] Verify Apollo Enrichment Jobs shows contacts correctly
- [ ] Test contact selection for campaign creation
- [ ] Ensure no regression in existing functionality

## File List
- `app/agents/otis/enhanced/page.tsx` - Main enhanced workflow page
- `hooks/use-apollo-enrichment.tsx` - Apollo enrichment management
- `app/api/apollo/status/[batchId]/route.ts` - Status tracking API
- `app/api/companies/route.ts` - Company data API (may need updates)
- Database queries for contact counts

## Status
Ready for Review

## Tasks
### Task 1: Update Enrichment Status Logic
- [x] Modify `app/api/apollo/status/[batchId]/route.ts` to check contacts table
- [x] Update company enrichment status to reflect actual contacts
- [x] Add contact count field to company data structure
- [x] Update enrichment status display logic

### Task 2: Add Contact Count Queries
- [x] Add contact count queries to company data fetching
- [x] Update company selection UI to show contact counts
- [x] Modify company data structure to include contact information
- [x] Ensure contact counts are accurate and up-to-date

### Task 3: Enhance Apollo Enrichment Jobs Display
- [x] Modify enrichment jobs to show individual contacts
- [x] Add company association to contact display
- [x] Create contact selection interface
- [x] Update enrichment progress modal if needed

### Task 4: Integrate Contact Selection with Campaigns
- [x] Connect selected contacts to Instantly campaign creation
- [x] Update campaign job creation to use selected contacts
- [x] Add contact count to campaign job display
- [x] Ensure smooth workflow from contact selection to campaign

## Dev Agent Record
### Agent Model Used
Developer Agent (James)

### Debug Log References
- Current enrichment status logic in `app/api/apollo/status/[batchId]/route.ts`
- Company data fetching in `app/agents/otis/enhanced/page.tsx`
- Apollo enrichment jobs display in same file

### Completion Notes List
- ✅ Updated enrichment status logic to check contacts table instead of Apollo API response
- ✅ Added contact count queries to company data fetching in scraping results API
- ✅ Enhanced company selection UI to display contact counts and enrichment status
- ✅ Modified Apollo Enrichment Jobs to show individual contacts with company association
- ✅ Created contact selection interface with search and bulk selection
- ✅ Integrated contact selection with Instantly campaign creation
- ✅ Added contact count display in campaign jobs
- ✅ Created API endpoint to fetch contacts by company IDs
- ✅ All changes follow KISS principle and existing code patterns

### Change Log
- Created implementation task for company enrichment improvements
- Defined technical requirements and file modifications
- Identified key implementation steps
- ✅ Completed Task 1: Updated enrichment status logic to check contacts table
- ✅ Completed Task 2: Added contact count queries and UI display
- ✅ Completed Task 3: Enhanced Apollo Enrichment Jobs with contact display
- ✅ Completed Task 4: Integrated contact selection with campaign creation
- ✅ All tasks completed successfully following KISS principle 