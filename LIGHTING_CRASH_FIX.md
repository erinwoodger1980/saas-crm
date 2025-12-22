# Lighting.tsx Crash Fix - Complete

## Problem
Opening ProductConfigurator3D from Settings → Product Types crashed with:
```
TypeError: number 67.5 is not iterable
```

## Root Cause
**Lighting.tsx line 108** had incorrect spread operator usage:
```tsx
far={Math.max(...lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
```

The `...` spread operator tried to destructure `lightPositions.shadowCamera.top` (a number like `67.5`) as if it were an array, causing "number is not iterable" error.

## Solution Implemented

### 1. Fixed Spread Operator Bug
**File:** `web/src/components/configurator/Lighting.tsx`

**Before (line 108):**
```tsx
far={Math.max(...lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
```

**After:**
```tsx
far={Math.max(lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
```

### 2. Created Lighting Normalization Helper
**New File:** `web/src/lib/scene/normalize-lighting.ts`

Features:
- **`normalizeLightingConfig(input: unknown): LightingConfig`**
  - Validates all lighting fields
  - Converts bad values to correct structure
  - Falls back to safe defaults
  - Dev-only console warnings for invalid data
  
- **`createLightingFromDimensions(width, height, depth): LightingConfig`**
  - Creates valid lighting from product dimensions
  - Used for new scene initialization

**Validation:**
- `boundsX`/`boundsZ` must be `[number, number]` tuples
- `intensity` must be positive number
- `shadowCatcherDiameter` must be positive number
- `ambientIntensity` must be non-negative number
- `castShadows` must be boolean

**Dev Warnings:**
```typescript
console.warn('[Lighting] invalid boundsX', { value: config.boundsX });
console.warn('[Lighting] boundsZ must be [number, number] tuple', { value: config.boundsZ });
```

### 3. Updated All Config Creation Sites

**`web/src/types/scene-config.ts` - `createDefaultSceneConfig()`:**
```typescript
import { createLightingFromDimensions } from '@/lib/scene/normalize-lighting';

// Before: manual lighting creation
lighting: {
  boundsX: [bounds.min[0] * 1.5, bounds.max[0] * 1.5],
  boundsZ: [bounds.min[2] * 1.5, bounds.max[2] * 1.5],
  intensity: 1.6,
  shadowCatcherDiameter: Math.max(width, height) * 2,
  ambientIntensity: 0.45,
  castShadows: true,
}

// After: normalized creation
lighting: createLightingFromDimensions(width, height, depth)
```

**`web/src/lib/scene/builder-registry.ts` - `initializeSceneFromParams()`:**
```typescript
import { normalizeLightingConfig } from './normalize-lighting';

// Wrapped lighting creation in normalizeLightingConfig()
lighting: normalizeLightingConfig({
  boundsX: result.lighting.boundsX,
  boundsZ: result.lighting.boundsZ,
  intensity: 3.5,
  shadowCatcherDiameter: result.lighting.shadowCatcherDiameter,
  ambientIntensity: 1.2,
  castShadows: true,
})
```

**`web/src/components/configurator/ProductConfigurator3D.tsx`:**
```typescript
import { createLightingFromDimensions, normalizeLightingConfig } from '@/lib/scene/normalize-lighting';

// buildDefaultLighting() now uses helper
function buildDefaultLighting(dimensions: SceneConfig['dimensions']): LightingConfig {
  const width = dimensions?.width ?? 1000;
  const height = dimensions?.height ?? 2000;
  const depth = dimensions?.depth ?? 45;
  
  return createLightingFromDimensions(width, height, depth);
}

// normalizeSceneConfig() wraps lighting in validator
function normalizeSceneConfig(config: SceneConfig): SceneConfig {
  const normalized: SceneConfig = {
    ...config,
    lighting: normalizeLightingConfig(config.lighting || buildDefaultLighting(config.dimensions)),
    // ...
  };
  return normalized;
}
```

### 4. Added Comprehensive Tests
**New File:** `web/src/lib/scene/__tests__/normalize-lighting.test.ts`

Test coverage:
- ✅ Valid config passes through unchanged
- ✅ Malformed `boundsX` (number instead of tuple) falls back to default
- ✅ Missing fields use defaults
- ✅ `null`/`undefined` input handled gracefully
- ✅ Invalid types (strings, NaN, negative) fall back to defaults
- ✅ `createLightingFromDimensions()` creates valid config

## Results

### ✅ Acceptance Criteria Met
- [x] Settings → Product Types → 3D Preview opens without crashing
- [x] Lighting is rendered correctly
- [x] No "number is not iterable" error
- [x] All lighting configs validated at creation
- [x] Dev warnings for debugging malformed data
- [x] Comprehensive test coverage

### Build Status
```bash
✓ Compiled successfully in 2.7s
✓ All tests pass
```

## Files Changed

### Modified
1. `web/src/components/configurator/Lighting.tsx` - Fixed spread operator
2. `web/src/types/scene-config.ts` - Use `createLightingFromDimensions`
3. `web/src/lib/scene/builder-registry.ts` - Use `normalizeLightingConfig`
4. `web/src/components/configurator/ProductConfigurator3D.tsx` - Use normalization helpers

### Created
1. `web/src/lib/scene/normalize-lighting.ts` - Validation helper
2. `web/src/lib/scene/__tests__/normalize-lighting.test.ts` - Unit tests

## Lighting Schema (Now Enforced)

```typescript
interface LightingConfig {
  boundsX: [number, number];        // Must be tuple, not single number
  boundsZ: [number, number];        // Must be tuple, not single number
  intensity: number;                 // Must be positive
  shadowCatcherDiameter: number;    // Must be positive
  ambientIntensity: number;         // Must be non-negative
  castShadows: boolean;             // Must be boolean
}
```

## Prevention Strategy
- All lighting configs pass through `normalizeLightingConfig()` before use
- Type guards validate structure at runtime
- Dev warnings alert developers to data issues
- Safe defaults prevent crashes
- Tests ensure edge cases are handled

## Next Steps (Optional)
1. Monitor dev console for "[Lighting] invalid" warnings
2. Track down any remaining sources of malformed data
3. Consider adding TypeScript strict mode for even earlier detection
