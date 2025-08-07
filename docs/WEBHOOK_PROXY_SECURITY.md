# Webhook Proxy Security Implementation

## Overview

This document describes the security improvements implemented to hide external webhook URLs from client-side code and provide centralized webhook management.

## Problem Solved

**Before**: External webhook URLs like `ba.grive-dev.com` were hardcoded throughout the codebase, creating several security and maintenance issues:

- ❌ External service URLs exposed in code
- ❌ Difficult to change webhook URLs without code updates  
- ❌ No centralized authentication/validation
- ❌ Inconsistent webhook handling across endpoints

## Solution: Webhook Proxy Pattern

**After**: All webhook calls now go through an internal proxy endpoint that forwards to the actual external service.

### Architecture

```
Frontend/API → /api/webhooks/apollo → External Apollo Service
                    (Proxy)           (ba.grive-dev.com)
```

### Benefits

- ✅ **Security**: External URLs completely hidden from codebase
- ✅ **Flexibility**: Change external URLs via environment variables only
- ✅ **Centralization**: Single place for webhook configuration, auth, logging
- ✅ **Maintainability**: No hardcoded external URLs in code
- ✅ **Monitoring**: Centralized logging and error handling
- ✅ **Authentication**: Can add API keys, rate limiting in one place

## Implementation Details

### 1. Proxy Endpoint
**File**: `/app/api/webhooks/apollo/route.ts`

- Accepts POST requests and forwards to `process.env.APOLLO_WEBHOOK_URL`
- Handles authentication, logging, and error management
- Returns standardized responses
- Includes health check endpoint (GET)

### 2. Updated Endpoints
**Files Updated**:
- `/app/api/apollo/enrich/route.ts` - Now uses proxy
- `/app/api/test-webhook/route.ts` - Now uses proxy  

**Pattern**:
```typescript
// OLD: Hardcoded external URL
const response = await fetch('https://ba.grive-dev.com/webhook/receive-companies-website', {
  // ...
})

// NEW: Internal proxy
const webhookUrl = `${request.nextUrl.origin}/api/webhooks/apollo`
const response = await fetch(webhookUrl, {
  // ...
})
```

### 3. Environment Configuration
**File**: `env.example`

```bash
# Apollo Enrichment Configuration
# Set this to the actual Apollo webhook URL (kept secret via environment variable)
APOLLO_WEBHOOK_URL=https://ba.grive-dev.com/webhook/receive-companies-website
```

### 4. Consistent Pattern
**Good Examples** (Already implemented):
- `/app/api/apollo/enrich-selected/route.ts` - Uses `process.env.APOLLO_WEBHOOK_URL`

## Usage

### For Developers

1. **Environment Setup**: Set `APOLLO_WEBHOOK_URL` in your `.env.local`
2. **API Calls**: Always use `/api/webhooks/apollo` instead of external URLs  
3. **Testing**: Use `/api/test-webhook` to verify connectivity
4. **Monitoring**: Check logs for proxy request/response details

### Health Check

```bash
GET /api/webhooks/apollo
```

Returns:
```json
{
  "service": "Apollo Webhook Proxy",
  "status": "healthy", 
  "configured": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Handling

The proxy provides detailed error responses:
```json
{
  "success": false,
  "error": "Webhook proxy failed",
  "details": "Connection timeout" // Only in development
}
```

## Security Considerations

1. **Environment Variables**: Keep `APOLLO_WEBHOOK_URL` in environment variables, never commit to code
2. **Authentication**: Add API keys/tokens in the proxy if required by external service
3. **Rate Limiting**: Implement rate limiting in proxy to prevent abuse
4. **Logging**: Log requests but sanitize sensitive data
5. **HTTPS**: Always use HTTPS for external webhook calls

## Future Enhancements

1. **Authentication**: Add API key validation for external services
2. **Rate Limiting**: Implement request throttling
3. **Retry Logic**: Add exponential backoff for failed requests  
4. **Caching**: Cache responses for idempotent operations
5. **Multiple Services**: Extend pattern for other external webhooks

## Migration Checklist

- [x] Create proxy endpoint `/api/webhooks/apollo`
- [x] Update Apollo enrich endpoint to use proxy
- [x] Update test webhook to use proxy
- [x] Update environment configuration
- [ ] Add authentication to proxy (if required)
- [ ] Implement rate limiting (if required)
- [ ] Update other hardcoded webhook URLs (if any)
- [ ] Add monitoring/alerting for webhook failures

## Monitoring

### Logs to Watch
- `🔄 Proxying Apollo webhook request:` - Request forwarding
- `✅ Apollo webhook response:` - Successful responses  
- `❌ Apollo webhook proxy error:` - Proxy failures

### Metrics to Track
- Webhook success/failure rates
- Response times
- Error patterns
- Request volumes

This implementation significantly improves security by hiding external service URLs while maintaining full functionality and adding operational benefits.