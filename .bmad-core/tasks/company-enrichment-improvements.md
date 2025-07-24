# Company Enrichment Feature Improvements

## Story
As a user of the OTIS enhanced workflow, I want to improve the company enrichment feature so that I can better track which companies have been enriched and see contact information before starting Apollo enrichment. I also want to view scraped contacts in the Apollo Enrichment Jobs section to select them for Instantly campaigns.

## Acceptance Criteria
- [ ] Companies show 'enriched' status only when they have at least 1 contact linked from Supabase contacts table
- [ ] Display contact count per company before starting Apollo enrichment
- [ ] Show scraped contacts in 'Apollo Enrichment Jobs' section with company association
- [ ] Allow selection of contacts from Apollo Enrichment Jobs for Instantly campaigns
- [ ] Maintain KISS principle - keep implementation simple and focused

## Dev Notes
- Current enrichment status is based on Apollo API response, need to change to Supabase contacts table
- Need to add contact count display in company selection UI
- Apollo Enrichment Jobs section needs to show individual contacts with company info
- Contact selection should integrate with existing Instantly campaign workflow

## Testing
- [ ] Verify companies show 'enriched' only when contacts exist in database
- [ ] Test contact count display accuracy
- [ ] Verify Apollo Enrichment Jobs shows contacts with company info
- [ ] Test contact selection for Instantly campaigns

## File List
- `app/agents/otis/enhanced/page.tsx` - Main enhanced workflow page
- `hooks/use-apollo-enrichment.tsx` - Apollo enrichment management
- `components/enrichment-progress-modal.tsx` - Progress tracking modal
- `app/api/apollo/status/[batchId]/route.ts` - Status tracking API
- Database queries for contact counts and enrichment status

## Status
Draft

## Tasks
### Task 1: Update Enrichment Status Logic
- [ ] Modify enrichment status to check Supabase contacts table instead of Apollo API response
- [ ] Update company status display to show 'enriched' only when contacts exist
- [ ] Add contact count field to company data structure

### Task 2: Add Contact Count Display
- [ ] Add contact count column to company selection table
- [ ] Display contact count before Apollo enrichment starts
- [ ] Update company selection UI to show contact information

### Task 3: Enhance Apollo Enrichment Jobs Section
- [ ] Modify enrichment jobs to show individual contacts
- [ ] Add company association to each contact
- [ ] Create contact selection interface
- [ ] Add contact details display (name, email, title, company)

### Task 4: Integrate Contact Selection with Instantly
- [ ] Connect selected contacts to Instantly campaign creation
- [ ] Update campaign job creation to use selected contacts
- [ ] Add contact count to campaign job display

## Dev Agent Record
### Agent Model Used
PM Agent (John)

### Debug Log References
- Current enrichment status logic in `app/api/apollo/status/[batchId]/route.ts`
- Company selection UI in `app/agents/otis/enhanced/page.tsx`
- Apollo enrichment jobs display in same file

### Completion Notes List
- Need to understand current contact storage structure in Supabase
- Verify Apollo API response format for contact data
- Check existing Instantly campaign integration

### Change Log
- Created initial task breakdown for company enrichment improvements
- Defined clear acceptance criteria based on user requirements
- Identified key files that need modification 