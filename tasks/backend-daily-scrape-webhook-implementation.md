# Backend Development Task: Daily Scrape Webhook Implementation

## Task Overview
**Priority**: High  
**Estimated Time**: 4-6 hours  
**Dependencies**: None (uses existing infrastructure)  
**Type**: Feature Implementation  

## Objective
Modify the existing cron job system to send simplified webhook payloads to `https://ba.grive-dev.com/webhook/daily-scrape` for each enabled platform, with the payload structure `{ "location": "central_place" }`.

## Technical Requirements

### Current State Analysis
- **File**: `app/api/cron/trigger-automation/route.ts`
- **Current Webhook**: Sends complex payloads to n8n webhook
- **Current Payload**: 7+ fields including user_id, platform, timestamp, etc.
- **Target Webhook**: `https://ba.grive-dev.com/webhook/daily-scrape`
- **New Payload**: `{ "location": "central_place" }`

### Implementation Requirements

#### 1. Environment Configuration
```bash
# Add to .env.local and production environment
DAILY_SCRAPE_WEBHOOK_URL=https://ba.grive-dev.com/webhook/daily-scrape
```

#### 2. Database Query Optimization
```sql
-- Optimized query for daily scrape webhooks
SELECT 
  upp.regio_platform,
  rpc.central_place
FROM user_platform_automation_preferences upp
JOIN regio_platform_central_places rpc 
  ON upp.regio_platform = rpc.regio_platform
WHERE upp.automation_enabled = true 
  AND rpc.is_active = true
  AND rpc.central_place IS NOT NULL
ORDER BY upp.regio_platform
```

#### 3. Webhook Function Implementation
```typescript
// New function to replace triggerN8nWebhook
const triggerDailyScrapeWebhook = async (platform: string, centralPlace: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const webhookUrl = process.env.DAILY_SCRAPE_WEBHOOK_URL
    
    if (!webhookUrl) {
      throw new Error('DAILY_SCRAPE_WEBHOOK_URL not configured')
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lokale-Banen-DailyScrape/1.0'
      },
      body: JSON.stringify({
        location: centralPlace
      })
    })

    if (response.status !== 200) {
      const errorText = await response.text()
      throw new Error(`Daily scrape webhook failed: ${response.status} - ${errorText}`)
    }

    console.log(`✅ Successfully triggered daily scrape for platform: ${platform} (${centralPlace})`)
    return { success: true }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to trigger daily scrape for platform ${platform}:`, errorMessage)
    return { success: false, error: errorMessage }
  }
}
```

#### 4. Main Processing Logic Updates
```typescript
// Update the main processing function
const processDailyScrapeTriggers = async (platforms: Array<{ regio_platform: string; central_place: string }>): Promise<{ success: number; failed: number; errors: string[] }> => {
  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  console.log(`🚀 Starting daily scrape for ${platforms.length} platforms`)

  // Process each platform individually (no batching needed for 25 max platforms)
  for (const platform of platforms) {
    console.log(`📡 Processing platform: ${platform.regio_platform}`)
    
    const result = await triggerDailyScrapeWebhook(platform.regio_platform, platform.central_place)
    
    if (result.success) {
      successCount++
    } else {
      failedCount++
      if (result.error) {
        errors.push(`${platform.regio_platform}: ${result.error}`)
      }
    }

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { success: successCount, failed: failedCount, errors }
}
```

## Implementation Steps

### Step 1: Environment Setup (15 minutes)
- [x] Add `DAILY_SCRAPE_WEBHOOK_URL` to `.env.local`
- [x] Add `DAILY_SCRAPE_WEBHOOK_URL` to production environment variables
- [x] Update environment variable documentation

### Step 2: Code Implementation (2-3 hours)
- [x] Create new `triggerDailyScrapeWebhook` function
- [x] Update database query to only fetch required fields
- [x] Replace `triggerN8nWebhook` calls with new function
- [x] Update logging messages to reflect daily scrape context
- [x] Remove unused fields from payload preparation

### Step 3: Error Handling & Logging (1 hour)
- [x] Update error messages to be specific to daily scrape
- [x] Ensure proper logging of platform names and central places
- [x] Maintain existing error handling structure
- [x] Add validation for central place data

### Step 4: Testing (1-2 hours)
- [x] Test with mock webhook endpoint
- [x] Verify payload structure is correct
- [x] Test error scenarios (network failures, invalid responses)
- [x] Test with platforms that have missing central places
- [x] Verify logging output

## Code Changes Required

### File: `app/api/cron/trigger-automation/route.ts`

#### 1. Add Environment Variable Check
```typescript
// Add at the top of the file
const DAILY_SCRAPE_WEBHOOK_URL = process.env.DAILY_SCRAPE_WEBHOOK_URL

if (!DAILY_SCRAPE_WEBHOOK_URL) {
  console.error('❌ DAILY_SCRAPE_WEBHOOK_URL not configured')
}
```

#### 2. Replace Webhook Function
```typescript
// Replace the existing triggerN8nWebhook function with triggerDailyScrapeWebhook
const triggerDailyScrapeWebhook = async (platform: string, centralPlace: string): Promise<{ success: boolean; error?: string }> => {
  // Implementation as shown above
}
```

#### 3. Update Database Query
```typescript
// Simplify the query to only fetch required fields
const { data: enabledPlatforms, error } = await supabase
  .from('user_platform_automation_preferences')
  .select(`
    regio_platform
  `)
  .eq('automation_enabled', true)
```

#### 4. Update Central Places Query
```typescript
// Simplify to only fetch central place
const { data: centralPlaces, error: centralPlacesError } = await supabase
  .from('regio_platform_central_places')
  .select('regio_platform, central_place')
  .eq('is_active', true)
  .not('central_place', 'is', null)
```

#### 5. Update Processing Logic
```typescript
// Simplify the triggers array creation
const triggers = enabledPlatforms
  .filter(platform => {
    const centralPlace = centralPlacesMap.get(platform.regio_platform)
    if (!centralPlace?.central_place) {
      console.warn(`⚠️ No central place found for platform: ${platform.regio_platform}`)
      return false
    }
    return true
  })
  .map(platform => {
    const centralPlace = centralPlacesMap.get(platform.regio_platform)!
    return {
      regio_platform: platform.regio_platform,
      central_place: centralPlace.central_place
    }
  })
```

## Testing Checklist

### Unit Tests
- [ ] Test payload structure generation
- [ ] Test platform filtering logic
- [ ] Test error handling scenarios
- [ ] Test with missing central places

### Integration Tests
- [ ] Test webhook calls to mock endpoint
- [ ] Test with various platform configurations
- [ ] Test error scenarios (network failures, invalid responses)
- [ ] Test with maximum 25 platforms

### Manual Testing
- [ ] Trigger cron job manually
- [ ] Verify all enabled platforms are processed
- [ ] Check logging output
- [ ] Verify webhook payload structure

## Success Criteria

### Functional Requirements
- [x] All enabled platforms receive webhook calls
- [x] Payload contains only `{ "location": "central_place" }`
- [x] Separate request sent for each platform
- [x] Error handling works for failed webhook calls
- [x] Comprehensive logging implemented

### Non-Functional Requirements
- [x] No authentication required
- [x] No rate limiting issues (25 platforms max)
- [x] Maintains existing cron job reliability
- [x] Clear monitoring and alerting

## Risk Mitigation

### High Risk Items
- [ ] **Webhook Endpoint Changes**: Test with staging endpoint first
- [ ] **Payload Structure**: Validate payload format thoroughly

### Medium Risk Items
- [ ] **Error Handling**: Test various error scenarios
- [ ] **Logging**: Ensure sufficient debugging information

## Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Code reviewed and tested
- [ ] Staging deployment successful
- [ ] Manual testing completed

### Post-Deployment
- [ ] Monitor first nightly run
- [ ] Verify logging output
- [ ] Check webhook success rates
- [ ] Document any issues

## Rollback Plan

If issues arise:
1. **Immediate**: Revert to previous version of `trigger-automation/route.ts`
2. **Investigation**: Check logs for specific error patterns
3. **Fix**: Address issues and redeploy
4. **Monitoring**: Closely monitor subsequent runs

## Documentation Updates

### Code Documentation
- [ ] Update function comments
- [ ] Document new environment variables
- [ ] Update API documentation

### Operational Documentation
- [ ] Update deployment guide
- [ ] Update monitoring guide
- [ ] Update troubleshooting guide 