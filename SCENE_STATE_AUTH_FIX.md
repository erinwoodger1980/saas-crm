# Scene State 401 Auth Fix & Crash Prevention

## Problem Summary

The 3D preview in Quote Builder was experiencing persistent crashes:
- `GET /api/scene-state` returned 401 unauthorized
- `POST /api/scene-state` returned 401 unauthorized
- Console error: `Cannot read properties of undefined (reading 'mode')`
- WebGL renderer context lost due to unhandled errors
- Client-side crash prevented any 3D preview usage

## Root Cause Analysis

1. **Authentication Issue**: Next.js proxy route (`/web/src/app/api/scene-state/route.ts`) was forwarding auth headers but NOT including `credentials: 'include'`, which prevented cookies from being sent to the backend API.

2. **No Fallback Handling**: When API returned 401/403/404/500, the client would:
   - Throw errors that bubbled into render
   - Try to access `config.camera.mode` before checking if config existed
   - Crash the WebGL context when errors occurred during render

3. **Retry Storm Risk**: Failed POST requests would continue retrying indefinitely, creating unnecessary load.

## Solution Implemented

### A) Fixed Authentication (Task 1)

**File**: `/web/src/app/api/scene-state/route.ts`

Added `credentials: 'include'` to all fetch calls in the Next.js proxy route:

```typescript
// Before (no credentials)
const res = await fetch(url.toString(), { 
  headers: forwardHeaders(request) 
});

// After (with credentials)
const res = await fetch(url.toString(), { 
  headers: forwardHeaders(request),
  credentials: 'include',  // ✅ Forward cookies
});
```

This ensures the `jauth` HttpOnly cookie is forwarded from browser → Next.js → API backend.

### B) Added Safe Fallbacks (Tasks 2 & 3)

**File**: `/web/src/components/configurator/ProductConfigurator3D.tsx`

#### 1. Improved `loadSceneState` error handling:

```typescript
// Now handles 401/403/404 gracefully without throwing
if (response.status === 401 || response.status === 403) {
  console.warn('[loadSceneState] Auth error, will use default scene:', response.status);
  return null;  // ✅ Returns null instead of throwing
}
```

#### 2. Updated `saveSceneState` return type:

```typescript
// Returns both success status AND whether to disable further saves
return { 
  success: boolean; 
  shouldDisable: boolean  // ✅ Signals auth failure
};
```

#### 3. Added safe camera mode access:

```typescript
// Safe fallback to prevent undefined access crash
const cameraMode = config.camera?.mode || 'Perspective';

// Use throughout component instead of direct property access
<Canvas camera={{ fov: cameraMode === 'Perspective' ? ... }} />
<SceneUI cameraMode={cameraMode} ... />
```

### C) Prevented Retry Storms (Task 4)

**File**: `/web/src/components/configurator/ProductConfigurator3D.tsx`

Added `saveDisabled` state tracking:

```typescript
const [saveDisabled, setSaveDisabled] = useState(false);

// In persistConfig callback:
if (saveDisabled) {
  return;  // ✅ Skip save attempts
}

const result = await saveSceneState(...);

if (result.shouldDisable) {
  setSaveDisabled(true);  // ✅ Disable on 401/403
  toast.error('Scene saving disabled (not authorized)', { duration: 5000 });
}
```

This prevents the client from spamming the API with failed save requests.

### D) Added Debug Logging (Task 5)

Both client and server now respect `DEBUG_SCENE_STATE` environment variable:

**Server-side** (Next.js proxy):
```typescript
if (process.env.DEBUG_SCENE_STATE === 'true') {
  console.log('[proxy GET /api/scene-state]', {
    status: res.status,
    hasAuth: !!request.headers.get('authorization') || !!request.headers.get('cookie'),
  });
}
```

**Client-side**:
```typescript
if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
  console.log('[loadSceneState]', {
    status: response.status,
    tenantId,
    entityType,
    entityId,
  });
}
```

No logging spam - only when explicitly enabled for debugging.

## Files Changed

1. **`/web/src/app/api/scene-state/route.ts`**
   - Added `credentials: 'include'` to GET/POST/DELETE
   - Added debug logging controlled by env var

2. **`/web/src/components/configurator/ProductConfigurator3D.tsx`**
   - Updated `loadSceneState` to handle 401/403/404 gracefully
   - Updated `saveSceneState` to return `{ success, shouldDisable }`
   - Added `saveDisabled` state tracking
   - Added safe `cameraMode` variable with fallback
   - Updated `persistConfig` to respect `saveDisabled`

## Testing Locally

### Enable Debug Logging (Optional)

Add to `/web/.env.local`:
```bash
NEXT_PUBLIC_DEBUG_SCENE_STATE=true
```

Add to `/api/.env` or Render environment:
```bash
DEBUG_SCENE_STATE=true
```

### Test Scenarios

1. **Authenticated User**:
   - Log in normally
   - Open Quote Builder 3D preview
   - Should load scene state OR initialize with defaults
   - Should save changes successfully

2. **Unauthenticated/Expired Session**:
   - Clear cookies or wait for session expiry
   - Open 3D preview
   - Should see: "Scene saving disabled (not authorized)" toast
   - Should still render 3D preview with default scene
   - Should NOT crash or retry save requests

3. **First-Time Use (404)**:
   - Open 3D preview for new line item
   - Should initialize with default scene
   - Should save successfully on first change

## Deployment

### Environment Variables

**Not required** - debug logging is disabled by default.

If you want to enable debug logging in production (temporarily):

**Web (Render service `saas-crm-web`)**:
```
NEXT_PUBLIC_DEBUG_SCENE_STATE=true
```

**API (Render service `saas-crm-api`)** - Not applicable (uses Next.js env var)

### Deployment Commands

```bash
# Commit changes
git add -A
git commit -m "fix: Scene state 401 auth + crash prevention

- Add credentials: 'include' to forward auth cookies
- Handle 401/403/404 gracefully without crashes
- Prevent retry storms with saveDisabled state
- Add safe camera.mode access with fallback
- Add DEBUG_SCENE_STATE flag for targeted logging

Fixes client-side crashes when opening 3D preview"

# Push to trigger Render auto-deploy
git push origin main
```

Both services will automatically rebuild and deploy.

## Verification Steps

After deployment:

1. **Check Render logs** for successful deployment
2. **Test authenticated flow**:
   - Log in
   - Open Quote Builder
   - Click 3D preview button
   - Verify no 401 errors in Network tab
   - Verify scene loads and saves work
3. **Test error recovery**:
   - Open dev console Network tab
   - Clear cookies manually
   - Refresh page
   - Verify 3D preview still renders (with default scene)
   - Verify single toast message appears
   - Verify NO retry storm in Network tab

## Success Criteria

✅ **Auth Issue Fixed**: 
- No more 401 errors when user is logged in
- Cookies properly forwarded through Next.js proxy

✅ **Crash Prevention**: 
- No more "Cannot read properties of undefined (reading 'mode')" errors
- WebGL renderer stays stable
- 3D preview always renders (even with API failures)

✅ **No Retry Storms**:
- Failed saves tracked with `saveDisabled` flag
- Single error toast shown
- No repeated 401 requests

✅ **Debug Capability**:
- Can enable targeted logging with env var
- No spam in production logs by default

## Rollback Plan

If issues occur:

```bash
# Revert this commit
git revert HEAD
git push origin main
```

Both services will auto-deploy the previous version.

## Future Improvements

1. **Better Auth Feedback**: Show login prompt when auth fails (instead of just disabling saves)
2. **Retry with Exponential Backoff**: Add smart retry logic for transient errors (5xx)
3. **Optimistic UI**: Show changes immediately, sync in background
4. **Scene State Migration**: Handle breaking changes to SceneConfig schema gracefully
