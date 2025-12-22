# AI Service Integration Fixes

## Summary
Replaced all stub/dummy AI connections with live service integrations and added production environment guards.

## Changes Made

### 1. PDF Parser Service (`api/src/services/pdf/parseSupplier.ts`)
**Before:** Returned hard-coded stub data: `["STUB: parser reachable", ...]`

**After:** 
- Calls real ML service via `callMlWithUpload()` 
- Fails fast in production if `ML_URL` is missing or points to localhost
- Reads actual PDF files and sends to ML parser endpoint
- Normalizes ML response and converts to expected format
- Proper error handling with descriptive messages

### 2. PDF Parser TypeScript Shim (`api/ml/pdf_parser.ts`)
**Before:** Returned empty string placeholder

**After:** 
- Throws explicit error indicating Python bridge needed
- Directs users to use ML service API instead

### 3. Supplier Quote Structuring (`api/src/lib/supplier/parse.ts`)
**Before:** Silently skipped LLM structuring with generic warning

**After:**
- Production mode: Logs error when `OPENAI_API_KEY` is missing
- Clear differentiation between dev mode (skipped) vs production (required)
- Warning message indicates production requirement

### 4. AI Code Generation (`api/src/routes/codexRun.ts`)
**Before:** Generated stub patches when OpenAI key was missing

**After:**
- Returns 503 Service Unavailable in production if `OPENAI_API_KEY` is missing
- Clear error message: "OPENAI_API_KEY must be configured in production"
- Prevents stub diff generation in production environment

### 5. Server Startup Validation (`api/src/server.ts`)
**Added comprehensive AI service validation:**

**ML Service Checks:**
- ❌ Critical error if `ML_URL` not set in production
- ❌ Critical error if `ML_URL` points to localhost/127.0.0.1 in production
- ✅ Success message with configured endpoint
- ⚠️  Warning in dev mode if not configured

**OpenAI Checks:**
- ⚠️  Warning if `OPENAI_API_KEY` not set in production (some features limited)
- ✅ Success message showing partial key (e.g., "sk-proj...")
- Info message in dev mode

**Overall Status Summary:**
- ✅ All services configured (ML + OpenAI both OK)
- ❌ Critical: Neither configured
- ❌ Critical: ML not configured (parsing/estimation will fail)
- ⚠️  Warning: OpenAI not configured (structuring/code gen limited)

## Required Environment Variables

### Production (CRITICAL)
```bash
ML_URL=https://your-ml-service.com  # Must NOT be localhost
```

### Production (Recommended)
```bash
OPENAI_API_KEY=sk-proj-...  # For quote structuring and AI code gen
```

### Development
Both variables optional in dev mode; will fall back to localhost or skip features gracefully.

## Behavior Changes

### Before
- Services silently used stub/dummy data
- No clear indication of missing configuration
- Production could run with localhost URLs
- No startup validation

### After
- Services fail fast in production when misconfigured
- Clear console logging at startup showing service status
- Production blocks localhost/missing URLs with errors
- Comprehensive validation prevents silent failures

## Testing
✅ Build completed successfully
✅ TypeScript compilation passed
✅ All changes maintain backward compatibility in dev mode

## Next Steps
1. Set `ML_URL` environment variable in production deployment
2. Set `OPENAI_API_KEY` for full AI feature support
3. Monitor startup logs for service configuration status
4. Test supplier PDF parsing with real ML endpoint
5. Verify quote structuring with OpenAI integration
