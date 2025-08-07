# Daily Scrape Webhook Payload - Product Requirements Document

## Executive Summary

This PRD defines the requirements for modifying the existing nightly automation system to send webhook payloads to `https://ba.grive-dev.com/webhook/daily-scrape` for each enabled platform, with a simplified payload structure containing only the central place location.

## Background & Context

### Current State
- Existing cron job system at `/api/cron/trigger-automation` runs nightly at 4:00 AM
- Currently sends complex payloads to n8n webhook with multiple fields
- System tracks enabled platforms per user in `user_platform_automation_preferences`
- Each platform has a central place defined in `regio_platform_central_places`

### Problem Statement
The current webhook payload is overly complex for the new daily-scrape endpoint, which only requires the central place location. We need to simplify the payload structure while maintaining the per-platform separation requirement.

## Product Goals

### Primary Goals
1. **Simplify Payload Structure**: Reduce payload to only essential `location` field
2. **Maintain Platform Separation**: Send separate requests for each enabled platform
3. **Preserve Existing Infrastructure**: Leverage current cron job and platform management system
4. **Ensure Reliability**: Maintain error handling and logging from current system

### Success Metrics
- 100% of enabled platforms receive webhook calls nightly
- Zero payload structure errors
- Maintained audit trail of webhook calls
- No disruption to existing automation features

## User Stories

### As a System Administrator
- I want the nightly scrape to trigger automatically for all enabled platforms
- I want clear logging of which platforms were processed successfully
- I want error notifications when webhook calls fail

### As a Platform Manager
- I want each platform to be processed independently
- I want the central place location to be accurately sent for each platform
- I want the system to handle platforms without central places gracefully

## Technical Requirements

### Webhook Endpoint
- **URL**: `https://ba.grive-dev.com/webhook/daily-scrape`
- **Method**: POST
- **Content-Type**: application/json
- **Authentication**: TBD (to be determined based on endpoint requirements)

### Payload Structure
```json
{
  "location": "central_place"
}
```

### Platform Processing Logic
1. **Query Enabled Platforms**: Fetch all platforms where `automation_enabled = true`
2. **Get Central Places**: Retrieve central place data for each enabled platform
3. **Filter Valid Platforms**: Only process platforms with valid central places
4. **Send Individual Requests**: Make separate webhook call for each platform
5. **Handle Errors**: Log failures and continue processing other platforms

### Data Flow
```
Cron Trigger (4:00 AM)
    ↓
Query user_platform_automation_preferences
    ↓
Filter enabled platforms
    ↓
Join with regio_platform_central_places
    ↓
For each platform:
    ↓
Send POST to /webhook/daily-scrape
    ↓
Log result (success/failure)
```

## Implementation Requirements

### Database Queries
```sql
-- Get all enabled platforms with central places
SELECT 
  upp.user_id,
  upp.regio_platform,
  rpc.central_place,
  rpc.central_postcode
FROM user_platform_automation_preferences upp
JOIN regio_platform_central_places rpc 
  ON upp.regio_platform = rpc.regio_platform
WHERE upp.automation_enabled = true 
  AND rpc.is_active = true
```

### API Endpoint Modifications
- **File**: `app/api/cron/trigger-automation/route.ts`
- **Changes**: 
  - Update webhook URL to new endpoint
  - Simplify payload structure
  - Update logging messages
  - Maintain existing error handling

### Environment Variables
```bash
# New webhook configuration
DAILY_SCRAPE_WEBHOOK_URL=https://ba.grive-dev.com/webhook/daily-scrape
DAILY_SCRAPE_WEBHOOK_TOKEN=<authentication_token_if_required>
```

## User Experience

### Error Handling
- **Missing Central Place**: Skip platform, log warning
- **Webhook Failure**: Log error, continue with other platforms
- **Network Issues**: Retry logic with exponential backoff
- **Invalid Response**: Log response details for debugging

### Monitoring & Logging
- **Success Logs**: Platform name, central place, response time
- **Error Logs**: Platform name, error message, HTTP status
- **Summary Logs**: Total processed, successful, failed counts
- **Audit Trail**: Timestamp, user_id, platform, payload sent

## Security Considerations

### Authentication
- Determine if the new webhook endpoint requires authentication
- If required, implement appropriate auth headers
- Store credentials securely in environment variables

### Data Privacy
- Only send essential location data
- No user-specific information in payload
- Log minimal data for debugging

### Rate Limiting
- Maintain existing batch processing (10 platforms per batch)
- 1-second delay between batches
- Respect any rate limits on the new endpoint

## Testing Strategy

### Unit Tests
- Test payload structure generation
- Test platform filtering logic
- Test error handling scenarios

### Integration Tests
- Test webhook calls to staging endpoint
- Test with various platform configurations
- Test error scenarios (network failures, invalid responses)

### End-to-End Tests
- Run full cron job in staging environment
- Verify all enabled platforms are processed
- Verify logging and monitoring work correctly

## Deployment Plan

### Phase 1: Development
1. Create new webhook configuration
2. Modify payload structure in cron job
3. Update logging and error handling
4. Add unit tests

### Phase 2: Staging
1. Deploy to staging environment
2. Test with staging webhook endpoint
3. Verify all platforms are processed correctly
4. Test error scenarios

### Phase 3: Production
1. Deploy to production
2. Monitor first few nightly runs
3. Verify logging and monitoring
4. Document any issues or improvements needed

## Risk Assessment

### High Risk
- **Webhook Endpoint Changes**: New endpoint may have different requirements
- **Authentication**: Unknown auth requirements for new endpoint

### Medium Risk
- **Payload Structure**: Simplified payload may miss required fields
- **Error Handling**: New endpoint may return different error formats

### Low Risk
- **Platform Processing**: Existing logic is well-tested
- **Cron Scheduling**: Current cron system is stable

## Success Criteria

### Functional Requirements
- [ ] All enabled platforms receive webhook calls nightly
- [ ] Payload contains only `location` field with central place
- [ ] Separate request sent for each platform
- [ ] Error handling works for failed webhook calls
- [ ] Comprehensive logging implemented

### Non-Functional Requirements
- [ ] Zero downtime during deployment
- [ ] Maintain existing cron job reliability
- [ ] Clear monitoring and alerting
- [ ] Backward compatibility with existing features

## Future Considerations

### Potential Enhancements
- **Retry Logic**: Implement exponential backoff for failed calls
- **Payload Validation**: Add validation for central place data
- **Metrics Dashboard**: Create dashboard for webhook success rates
- **Manual Trigger**: Add ability to manually trigger daily scrape

### Scalability
- **Platform Growth**: System should handle increasing number of platforms
- **Performance**: Monitor webhook response times
- **Rate Limits**: Monitor for any rate limiting issues

## Appendix

### Current Payload Structure (for reference)
```json
{
  "user_id": "user-uuid",
  "platform": "platform-name",
  "central_place": "location-name",
  "central_postcode": "1234AB",
  "timestamp": "2024-01-01T04:00:00.000Z",
  "scope": "last_24_hours",
  "source": "automation_cron"
}
```

### New Payload Structure
```json
{
  "location": "central_place"
}
```

### Database Schema Reference
- `user_platform_automation_preferences`: User platform preferences
- `regio_platform_central_places`: Platform central place definitions
- `regions`: Geographic region data 