# OTIS Simplified Architecture

## Overview

The OTIS dashboard has been simplified to remove complex session management, websocket connections, and over-engineered state management. The new architecture focuses on the core workflow:

1. **Job Scraping** → Send requests to n8n via webhook
2. **Poll Supabase** → Check for new entries with apify_run_id
3. **Apollo Enrichment** → Enrich companies with contact data
4. **Instantly Campaigns** → Add contacts to cold email campaigns

## Key Changes

### Removed Components
- ❌ Complex session management with localStorage persistence
- ❌ WebSocket real-time connections
- ❌ Complex workflow context and reducers
- ❌ Session history and timeline components
- ❌ Advanced loading states and animations
- ❌ Multi-stage navigation system
- ❌ Complex error boundaries and recovery

### Simplified Components
- ✅ Direct API calls without session tracking
- ✅ Simple polling with setInterval
- ✅ Basic state management with useState
- ✅ Clean, focused UI components
- ✅ Straightforward error handling
- ✅ Linear workflow progression

## Architecture

### Frontend (`/app/agents/otis/enhanced/page.tsx`)
```typescript
// Simple state management
const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([])
const [enrichmentJobs, setEnrichmentJobs] = useState<EnrichmentJob[]>([])
const [campaignJobs, setCampaignJobs] = useState<CampaignJob[]>([])

// Direct API calls
const startScraping = async () => {
  const response = await fetch('/api/otis/workflow', {
    method: 'POST',
    body: JSON.stringify({
      action: 'start_scraping',
      data: { jobTitle, location, platform }
    })
  })
}

// Simple polling
const startPolling = (jobId: string) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/otis/apify-runs?jobId=${jobId}`)
    // Update state based on response
  }, 5000)
}
```

### Backend APIs

#### `/api/otis/workflow` - Workflow Actions
- `start_scraping`: Triggers n8n webhook for job scraping
- `start_enrichment`: Initiates Apollo enrichment
- `create_campaign`: Creates Instantly campaign

#### `/api/otis/apify-runs` - Job Status
- Simple polling endpoint to check scraping progress
- Returns job count, company count, and status

#### `/api/apollo/enrich` - Apollo Integration
- Enriches companies with contact data
- Returns batch ID for progress tracking

#### `/api/instantly-campaigns` - Campaign Creation
- Creates cold email campaigns in Instantly
- Adds enriched contacts to campaigns

## Data Flow

1. **User Input** → Job title, location, platform
2. **Scraping** → Webhook to n8n → Apify scraping → Supabase storage
3. **Polling** → Check apify_runs table for progress
4. **Enrichment** → Apollo API → Company enrichment → Contact data
5. **Campaign** → Instantly API → Campaign creation → Contact addition

## Benefits

### Performance
- ✅ No complex state management overhead
- ✅ No WebSocket connection maintenance
- ✅ No localStorage persistence operations
- ✅ Simple polling with automatic cleanup

### Maintainability
- ✅ Clear, linear code flow
- ✅ Minimal dependencies
- ✅ Easy to debug and extend
- ✅ No complex context providers

### Reliability
- ✅ No session state corruption issues
- ✅ No WebSocket connection failures
- ✅ No infinite re-render loops
- ✅ Simple error handling

## Usage

1. Navigate to `/agents/otis/enhanced`
2. Enter job title, location, and select platform
3. Click "Start Job Scraping"
4. Monitor progress in real-time
5. When scraping completes, click "Start Apollo Enrichment"
6. When enrichment completes, click "Create Instantly Campaign"

## Future Enhancements

- Add job history persistence
- Implement retry mechanisms
- Add more detailed progress tracking
- Enhance error recovery
- Add batch processing capabilities

## Troubleshooting

### Common Issues
- **Polling stops**: Check browser console for errors
- **API failures**: Verify webhook URLs and API keys
- **No progress updates**: Check Supabase connection

### Debug Mode
Enable browser developer tools to see:
- API request/response logs
- Polling status updates
- Error messages and stack traces 