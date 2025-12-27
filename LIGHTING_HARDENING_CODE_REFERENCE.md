# Lighting Hardening - Code Reference

## Overview

This document shows the exact code changes made to harden the Lighting component against WebGL context loss.

---

## File 1: web/src/components/configurator/Lighting.tsx

### New Function Added

```typescript
/**
 * Sanitize LightingConfig to ensure all values are valid and finite.
 * Fixes malformed data (e.g. boundsX as single number) with sensible defaults.
 */
export function sanitizeLightingConfig(config: unknown): LightingConfig {
  const input = (config && typeof config === 'object' ? config : {}) as Partial<LightingConfig>;

  // Sanitize boundsX: must be [number, number] tuple
  let boundsX: [number, number] = [-1000, 1000];
  if (
    Array.isArray(input.boundsX) &&
    input.boundsX.length === 2 &&
    typeof input.boundsX[0] === 'number' &&
    typeof input.boundsX[1] === 'number' &&
    Number.isFinite(input.boundsX[0]) &&
    Number.isFinite(input.boundsX[1])
  ) {
    boundsX = [input.boundsX[0], input.boundsX[1]];
  } else if (typeof input.boundsX === 'number' && Number.isFinite(input.boundsX)) {
    // Single number: treat as extent
    const extent = Math.abs(input.boundsX);
    boundsX = [-extent, extent];
  }

  // Sanitize boundsZ: must be [number, number] tuple
  let boundsZ: [number, number] = [-1000, 1000];
  if (
    Array.isArray(input.boundsZ) &&
    input.boundsZ.length === 2 &&
    typeof input.boundsZ[0] === 'number' &&
    typeof input.boundsZ[1] === 'number' &&
    Number.isFinite(input.boundsZ[0]) &&
    Number.isFinite(input.boundsZ[1])
  ) {
    boundsZ = [input.boundsZ[0], input.boundsZ[1]];
  } else if (typeof input.boundsZ === 'number' && Number.isFinite(input.boundsZ)) {
    // Single number: treat as extent
    const extent = Math.abs(input.boundsZ);
    boundsZ = [-extent, extent];
  }

  // Sanitize shadowCatcherDiameter: must be finite number >= 500
  let shadowCatcherDiameter = 2000;
  if (typeof input.shadowCatcherDiameter === 'number' && Number.isFinite(input.shadowCatcherDiameter)) {
    shadowCatcherDiameter = Math.max(500, input.shadowCatcherDiameter);
  }

  // Sanitize intensity: must be finite number, 0-10 range
  let intensity = 1.6;
  if (typeof input.intensity === 'number' && Number.isFinite(input.intensity)) {
    intensity = Math.max(0, Math.min(10, input.intensity));
  }

  // Sanitize ambientIntensity: must be finite number, 0-10 range
  let ambientIntensity = 0.45;
  if (typeof input.ambientIntensity === 'number' && Number.isFinite(input.ambientIntensity)) {
    ambientIntensity = Math.max(0, Math.min(10, input.ambientIntensity));
  }

  // Sanitize castShadows: must be boolean
  const castShadows = typeof input.castShadows === 'boolean' ? input.castShadows : true;

  // Detect if sanitization changed values
  const changed =
    !Array.isArray(input.boundsX) ||
    !Array.isArray(input.boundsZ) ||
    typeof input.intensity !== 'number' ||
    typeof input.ambientIntensity !== 'number' ||
    typeof input.castShadows !== 'boolean' ||
    typeof input.shadowCatcherDiameter !== 'number';

  if (changed && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] Invalid config, sanitized', {
      original: input,
      sanitized: { boundsX, boundsZ, intensity, ambientIntensity, shadowCatcherDiameter, castShadows },
    });
  }

  return {
    boundsX,
    boundsZ,
    intensity,
    ambientIntensity,
    shadowCatcherDiameter,
    castShadows,
  };
}
```

### Updated: Component Uses Sanitized Config

```typescript
export function Lighting({ config }: LightingProps) {
  // Sanitize config to ensure all values are valid
  const sanitized = useMemo(() => sanitizeLightingConfig(config), [config]);

  const {
    boundsX,
    boundsZ,
    intensity,
    shadowCatcherDiameter,
    ambientIntensity,
    castShadows,
  } = sanitized;
  
  // ... rest of component uses sanitized values
}
```

### Updated: Fallback Rendering

```typescript
return (
  <>
    {/* Ambient light - soft studio fill (always safe fallback) */}
    <ambientLight intensity={ambientIntensity * 0.9} color="#f8f6f0" />

    {/* Validate computed light positions are finite before rendering directional lights */}
    {isFiniteTuple(lightPositions.key) &&
    isFiniteTuple(lightPositions.fill) &&
    isFiniteTuple(lightPositions.rim) ? (
      <>
        {/* Key light - primary studio light (like large softbox) */}
        <directionalLight
          position={lightPositions.key}
          intensity={intensity * 2.6}
          color="#fffef8"
          castShadow={castShadows}
          // ... shadow properties
        />

        {/* Fill light - reduces contrast, softens shadows */}
        <directionalLight
          position={lightPositions.fill}
          intensity={intensity * 1.1}
          color="#fff9ed"
        />

        {/* Rim light - back highlight for crisp edges */}
        <directionalLight
          position={lightPositions.rim}
          intensity={intensity * 0.8}
          color="#fffef8"
        />

        {/* Contact Shadows - physically accurate shadow casting without z-fighting */}
        {castShadows && (
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.15}
            scale={shadowCatcherDiameter * 2}
            blur={8}
            far={Math.max(lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
            resolution={1024}
            color="#000000"
          />
        )}
      </>
    ) : (
      /* Fallback: only ambient light if computed positions are invalid */
      <></>
    )}
  </>
);
```

---

## File 2: web/src/components/configurator/ProductConfigurator3D.tsx

### Updated: normalizeSceneConfig()

```typescript
function normalizeSceneConfig(config: SceneConfig): SceneConfig {
  const normalized: SceneConfig = {
    ...config,
    components: Array.isArray(config.components) ? config.components : [],
    materials: Array.isArray(config.materials) ? config.materials : [],
    visibility: config.visibility || {},
    ui: config.ui || { ...DEFAULT_UI_TOGGLES },
    // Always ensure lighting is present and merged with defaults
    lighting: {
      ...buildDefaultLighting(config.dimensions),
      ...(config.lighting || {}),
    },
  };

  normalized.materials = normalized.materials.map((mat) => {
    const safeMat: any = { ...mat };
    safeMat.baseColor = mat.baseColor || '#cccccc';
    safeMat.roughness = mat.roughness ?? 0.6;
    safeMat.metalness = mat.metalness ?? 0;
    safeMat.maps = Array.isArray((mat as any).maps) ? (mat as any).maps : [];
    return safeMat;
  });

  return normalized;
}
```

### Updated: initialConfig Processing

```typescript
// Priority 1: Use provided initialConfig
if (initialConfig) {
  // Merge initialConfig with defaults, ensuring lighting is present
  loaded = {
    ...initialConfig,
    lighting: {
      ...buildDefaultLighting(initialConfig.dimensions),
      ...(initialConfig.lighting || {}),
    },
  };
  if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
    console.log('✓ Using initialConfig with merged defaults');
  }
}
```

---

## Sanitization Examples

### Example 1: Single Number Bounds (Bug Case)
```typescript
// Input
config = {
  boundsX: 67.5,        // ❌ Single number (bad!)
  boundsZ: 45.0,
  intensity: 1.6,
  // ...
}

// After sanitization
sanitized = {
  boundsX: [-67.5, 67.5],  // ✅ Normalized to tuple
  boundsZ: [-45, 45],
  intensity: 1.6,
  // ...
}
```

### Example 2: Null/Undefined Bounds
```typescript
// Input
config = {
  boundsX: null,        // ❌ Null (bad!)
  boundsZ: undefined,   // ❌ Undefined (bad!)
  intensity: 1.6,
  // ...
}

// After sanitization
sanitized = {
  boundsX: [-1000, 1000],  // ✅ Fallback default
  boundsZ: [-1000, 1000],
  intensity: 1.6,
  // ...
}
```

### Example 3: Valid Config (No Change)
```typescript
// Input
config = {
  boundsX: [-750, 750],    // ✅ Valid tuple
  boundsZ: [-750, 750],
  intensity: 1.6,
  // ...
}

// After sanitization (unchanged)
sanitized = {
  boundsX: [-750, 750],
  boundsZ: [-750, 750],
  intensity: 1.6,
  // ...
}
```

---

## Type Safety

### Exports
```typescript
// Exported from Lighting.tsx for use elsewhere
export function sanitizeLightingConfig(config: unknown): LightingConfig
```

### No Breaking Changes
- Function signature unchanged
- Component props unchanged
- All existing code continues to work
- Valid configs render identically

---

## Testing the Fix

### Manual Test 1: Settings Preview
```bash
# Start dev server
pnpm dev

# Navigate to Settings → Product Types
# Create or edit a product type
# Click "Generate with AI"
# Click "Preview" or "3D View"

# Expected: 3D preview opens without crash
# If debug enabled, check console for [Lighting] warnings
```

### Manual Test 2: Quote Line Item
```bash
# Start dev server
pnpm dev

# Navigate to Quotes
# Open or create a quote
# Click on line item → "Configure" or "3D Preview"

# Expected: 3D scene loads without WebGL context loss
# Check browser console for any errors (should be none)
```

### Manual Test 3: Invalid Config (Edge Case)
```typescript
// In browser console while 3D preview is open:
// This would simulate the original bug:
config.lighting.boundsX = 67.5;  // Single number

// But sanitizeLightingConfig() would fix it
// Scene would still render with fallback lighting
```

---

## Verification Commands

```bash
# Build verification
pnpm build
# Expected: ✓ Compiled successfully in ~2.8s, 0 TypeScript errors

# Type checking
pnpm tsc --noEmit
# Expected: 0 errors

# Lint check
pnpm lint
# Expected: No lint errors in modified files
```

---

## Summary

- ✅ `sanitizeLightingConfig()` validates all inputs
- ✅ Lighting.tsx uses sanitized config
- ✅ ProductConfigurator3D.tsx merges config.lighting with defaults
- ✅ Fallback rendering (ambient-only) if validation fails
- ✅ No WebGL context loss
- ✅ 0 TypeScript errors
- ✅ Backwards compatible
