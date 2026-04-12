# DEPRECATED API ENDPOINT

This endpoint has been deprecated and replaced with `/api/platforms/automation`.

## Migration Date
2025-01-26

## Reason
Moved from per-user platform automation preferences to global platform settings stored in the `platforms` table.

## Replacement
Use `/api/platforms/automation` instead:
- GET: Fetch platform automation settings
- PUT: Update platform automation settings

## Can be removed
This endpoint can be safely removed after confirming the new system works correctly in production.