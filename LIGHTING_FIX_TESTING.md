/**
 * Manual Test Checklist: ProductConfigurator3D Lighting Fix
 * 
 * Run these tests to verify the fix works in the UI
 */

## Pre-Fix Behavior
❌ Opening Settings → Product Types → 3D Preview crashed with:
   "TypeError: number 67.5 is not iterable"

## Post-Fix Testing

### Test 1: Settings Preview Mode
1. Navigate to Settings → Product Types
2. Select a product type (e.g., "Timber Door")
3. Click "3D Preview" button
4. **Expected:** Preview opens without crash
5. **Expected:** Lighting renders correctly (no dark/missing shadows)

### Test 2: Quote Line 3D Preview
1. Navigate to a quote with product lines
2. Click "3D" button on any line item
3. **Expected:** 3D view opens without crash
4. **Expected:** Product is properly lit

### Test 3: Browser Console Checks
**In Development Mode:**
1. Open browser console (F12)
2. Trigger 3D preview in Settings
3. **Expected:** May see warnings like:
   ```
   [Lighting] invalid boundsX { value: ... }
   ```
   (These are informational only - preview should still work)

**In Production Build:**
1. No warnings should appear (warnings are dev-only)
2. Preview should work silently

### Test 4: Edge Cases
Try these edge cases to ensure resilience:

**Tiny Product:**
- Width: 100mm, Height: 200mm, Depth: 10mm
- Should render with appropriate lighting scale

**Huge Product:**
- Width: 3000mm, Height: 5000mm, Depth: 500mm
- Should render with appropriate lighting scale

**Unusual Aspect Ratio:**
- Width: 5000mm, Height: 300mm, Depth: 50mm (very wide, short)
- Should render without crash

### Test 5: Saved Scene State
1. Open existing project with saved 3D scene
2. **Expected:** Lighting config loads correctly
3. Make changes and save
4. Reload page
5. **Expected:** Lighting persists correctly

## Developer Console Commands

### Quick Test in Browser Console:
```javascript
// Paste this in browser console to test normalization
const { normalizeLightingConfig } = await import('/src/lib/scene/normalize-lighting');

// Test the exact bug case
const bugCase = normalizeLightingConfig({ 
  boundsX: 67.5,  // number instead of tuple
  boundsZ: 45.0 
});
console.log('Bug case result:', bugCase);
// Should show: boundsX: [-750, 750] (fallback)

// Test malformed data
const bad = normalizeLightingConfig({ boundsX: "invalid", intensity: -5 });
console.log('Bad data result:', bad);
// Should show all defaults
```

## Success Criteria
✅ Settings → Product Types → 3D Preview opens
✅ No "is not iterable" errors in console
✅ Lighting renders (product is visible and lit)
✅ Shadows appear when enabled
✅ No crashes with edge-case dimensions
✅ Scene state saves and loads correctly

## If Issues Persist

### Check these files:
1. `web/src/components/configurator/Lighting.tsx` (line 108 fix)
2. `web/src/lib/scene/normalize-lighting.ts` (helper exists)
3. `web/src/types/scene-config.ts` (uses createLightingFromDimensions)
4. `web/src/components/configurator/ProductConfigurator3D.tsx` (uses normalizeLightingConfig)

### Browser Console Debugging:
```javascript
// Check if normalization is being called
localStorage.setItem('debug_lighting', 'true');

// Then reload page and watch for logs
```

### Reset Scene State (if corrupted):
```javascript
// In browser console - clears saved scene for current entity
const tenantId = 'your-tenant-id';
const entityType = 'quote';
const entityId = 'your-quote-id';
fetch(`/api/scene-state?tenantId=${tenantId}&entityType=${entityType}&entityId=${entityId}`, {
  method: 'DELETE',
  credentials: 'include'
});
// Then reload the 3D preview
```

## Rollback Plan (if needed)
The changes are non-breaking:
- New helper file can be removed
- Revert Lighting.tsx line 108 to add back `...` (will restore crash)
- Remove imports of normalize-lighting from other files

**Git revert:** All changes are in one logical commit
