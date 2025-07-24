# Apollo Enrichment Feature Setup

## Overview
The Apollo enrichment feature allows users to automatically enrich company data with contact information and additional business details using the Apollo API.

## Database Migration Required

Before using the Apollo enrichment feature, you must run the database migration to create the necessary tables and columns.

### Migration File
`migrations/001_create_enrichment_tables.sql`

### How to Run Migration

#### Option 1: Supabase Dashboard
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/001_create_enrichment_tables.sql`
4. Paste and execute the SQL

#### Option 2: Supabase CLI
```bash
supabase db reset
# or
supabase migration up
```

## Feature Components

### Frontend Components Created:
- `hooks/use-company-selection.tsx` - Enhanced company selection with batch validation
- `hooks/use-apollo-enrichment.tsx` - Apollo enrichment process management
- `components/bulk-action-bar.tsx` - Bulk action UI for Apollo enrichment
- `components/enrichment-progress-modal.tsx` - Real-time progress tracking modal

### Backend Components Created:
- `app/api/apollo/enrich/route.ts` - Main Apollo enrichment API endpoint
- `app/api/apollo/status/[batchId]/route.ts` - Real-time status tracking API

### Database Tables Created:
- `enrichment_batches` - Tracks batch enrichment operations
- `enrichment_status` - Tracks individual company enrichment status
- Added Apollo fields to `companies` table:
  - `apollo_enriched_at` - Timestamp of last enrichment
  - `apollo_contacts_count` - Number of contacts found
  - `apollo_enrichment_data` - JSON data from Apollo
  - `last_enrichment_batch_id` - Reference to last batch

## Features Added

### 1. Frontend Visibility Indicators
- **Feature Banner**: Prominent Apollo enrichment banner at the top of companies page
- **Table Header Icon**: Small Zap icon in table header showing Apollo capability
- **Enriched Company Badges**: Blue "Apollo" badges on companies that have been enriched
- **Contact Count Display**: Shows number of contacts found in Apollo badges

### 2. Enhanced Workflow Support
- **Companies Without Websites**: Now supports enriching companies that don't have websites
- **Batch Processing**: Handles up to 100 companies per batch
- **Real-time Updates**: Live progress tracking with individual company status
- **Error Handling**: Comprehensive error handling and rollback mechanisms

### 3. User Experience
- **Visual Progress**: Real-time modal showing enrichment progress
- **Auto-refresh**: Table automatically refreshes after enrichment completion
- **Clear Validation**: Helpful validation messages and batch size limits
- **Intuitive Selection**: Enhanced multi-select with visual highlighting

## Usage Instructions

1. **Navigate to Companies Page** (`/companies`)
2. **See Apollo Banner** - Feature visibility indicator at top
3. **Select Companies** - Check boxes to select companies (max 100)
4. **Apollo Action Bar Appears** - Shows selection count and enrichment button
5. **Click "Verrijk met Apollo"** - Starts enrichment process
6. **Monitor Progress** - Real-time modal shows individual company status
7. **View Results** - Table refreshes with Apollo badges on enriched companies

## API Endpoints

### POST `/api/apollo/enrich`
Starts Apollo enrichment for selected companies
```json
{
  "batchId": "batch_123456",
  "companies": [
    {
      "id": "company-id-1",
      "website": "company1.com" // optional
    }
  ]
}
```

### GET `/api/apollo/status/[batchId]`
Gets real-time status of enrichment batch
```json
{
  "batchId": "batch_123456",
  "status": "processing",
  "totalCompanies": 10,
  "completedCompanies": 7,
  "failedCompanies": 1,
  "progressPercentage": 80,
  "companies": [...]
}
```

## Configuration

### Apollo Webhook URL
The feature calls: `https://ba.grive-dev.com/webhook/receive-companies-website`

### Batch Size Limit
Maximum 100 companies per batch (configurable in `useCompanySelection` hook)

### Polling Interval
Status updates every 2 seconds (configurable in `useApolloEnrichment` hook)

## Notes

- Companies without websites are now supported in the enrichment workflow
- All selected companies are considered "enrichable" regardless of website presence
- Real-time status updates use polling (can be upgraded to WebSocket for better performance)
- Apollo enrichment data is stored in JSON format for flexibility
- The feature includes comprehensive audit trails with timestamps 