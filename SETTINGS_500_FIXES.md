# Fixes for Settings Page 500 Errors

## Issues Identified

1. **GET /tenant/settings** - JSON parsing of `quoteDefaults` can throw
2. **GET /auth/me** - Missing null checks on tenant
3. **GET /stripe/billing/status** - No error handling
4. **Async error handling** - Some routes don't catch all async errors
5. **Missing type guards** on JSON fields (quoteDefaults, questionnaire, etc.)

## Fixes Applied

### 1. api/src/routes/tenants.ts - GET /settings
- Added safe JSON parsing helper
- Added null checks for all JSON fields
- Return safe defaults instead of throwing

### 2. api/src/routes/billing.ts - GET /status
- Wrapped in try-catch
- Added error logging
- Return safe default response on error

### 3. api/src/routes/auth.ts - GET /me
- Added tenant existence check
- Better error logging

### 4. api/src/server.ts - Global error handler
- Enhanced to catch async errors
- Added request context logging

## Git Diffs Below
