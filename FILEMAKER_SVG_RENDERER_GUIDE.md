# FileMaker SVG Profile Renderer Integration Guide

## Overview

This system replicates the FileMaker WebViewer's Three.js renderer, allowing:
- **AI-estimated SVG profiles** as placeholders (confidence scores included)
- **Real profile swaps** when verified profiles are uploaded
- **Component-level profiles** for stiles, rails, mullions, transoms, glazing bars, panels
- **Parametric movement** (rail heights, positions)
- **FileMaker-quality camera framing** and lighting

---

## Architecture

### Core Modules

#### 1. **svg-profile.ts** - SVG Extrusion Pipeline
```typescript
// Main entry point
createExtrudedProfileMesh(svgText, extrudeDepthMm, scale, material)
// Returns THREE.Mesh or null

// Generate estimated profile
generateEstimatedProfile(componentType, widthMm, depthMm)
// Returns SVGProfileDefinition with confidence score

// Swap profile
swapProfileDefinition(profile, newSvgText, newMetadata)
```

**Key Features:**
- Parses SVG using THREE.SVGLoader
- Converts paths → THREE.Shape via toShapes(true)
- Extrudes without bevels
- Rotates -90° on X (SVG XY → 3D XZ)
- Applies scale from viewBox → mm
- Returns PBR material mesh

---

#### 2. **ai-profile-estimation.ts** - AI Profile Generator
```typescript
// Generate profiles for entire assembly
estimateProfilesForAssembly(componentList)
// Returns Map<componentId, SVGProfileDefinition>

// Enhance component list with profiles
enhanceComponentListWithProfiles(componentList)
// Returns ComponentProfile[] with profileDefinitions

// Validate profile
validateProfile(profile)
// Returns { valid, errors[] }

// Merge profiles
mergeProfiles(profiles, newId, newName)
// Combines multiple profiles into composite
```

**Confidence Levels:**
- **0.7+** - Stiles, rails (frame members with standard dimensions)
- **0.6** - Mullions, transoms (narrower dividers)
- **0.5** - Glazing bars (very narrow, decorative)
- **0.4** - Panels (flat/glass; needs material confirmation)

---

#### 3. **filemaker-camera.ts** - Camera Framing
```typescript
// Fit camera to bounding box (FileMaker style)
fitCameraToObject(box, camera, controls, options)

// Animate camera movement
animateCameraToObject(box, camera, controls, duration)

// Get camera state for persistence
captureCameraState(camera, controls)

// Restore camera from saved state
restoreCameraState(camera, controls, state)

// Reset to default view
resetCameraToDefault(box, camera, controls)
```

**Options:**
```typescript
{
  padding?: 1.05,           // 5% extra space
  maxYClamp?: true,         // Clamp max Y height
  perspective?: '3/4',      // front, top, isometric, 3/4
  animateDuration?: 0       // ms for smooth animation
}
```

---

#### 4. **filemaker-lighting.ts** - Studio Lighting
```typescript
// Create complete lighting setup
createFileMakerLighting(config)

// Update light intensities
updateLightingIntensities(lights, config)

// Create shadow catcher floor
createShadowCatcherFloor(productWidth, productDepth)

// Enable/disable high-quality shadows
setHighQualityShadows(lights, enabled)
```

**Lights:**
- **Key Light** (SpotLight, 1.2x intensity) - Main warm light, 45° angled
- **Fill Light** (SpotLight, 0.6x) - Cool fill from opposite side
- **Rim Light** (SpotLight, 0.5x) - Backlit accent
- **Ambient** (0.3x) - Overall lift

**Shadows:**
- PCFSoftShadowMap (4096 high-quality)
- Soft radius (4–6px)
- Shadow catcher floor (non-visible)

---

#### 5. **profiled-component.ts** - Component Rendering
```typescript
// Create single component mesh
createProfiledComponentMesh(component: ProfiledComponent)
// Returns THREE.Group

// Create entire assembly
createProfiledAssembly(components)
// Returns THREE.Group with all components

// Get bounding box
getAssemblyBoundingBox(assembly)
// Returns THREE.Box3

// Raycast for selection
raycastAssembly(assembly, raycaster, camera)
// Returns { component, point }

// Update position
updateComponentPosition(group, [x, y, z])

// Update profile (swap estimated → verified)
updateComponentProfile(group, newProfile, material)
```

---

### React Components

#### **ProfileRenderer.tsx**
Renders SVG-extruded components with interactive controls.

```tsx
<ProfileRenderer
  components={components}
  onSelect={(id) => setSelectedId(id)}
  selectedId={selectedId}
  onTransformEnd={(id, pos) => handleMove(id, pos)}
  enableRaycast
  enableTransformControls
  orbitControlsRef={controlsRef}
/>
```

---

#### **EnhancedCameraController.tsx**
Manages camera framing and OrbitControls persistence.

```tsx
<EnhancedCameraController
  boundingBox={box}
  autoFit
  perspective="3/4"
  onCameraChange={(state) => persistCamera(state)}
  onControlsReady={(controls) => setControlsRef(controls)}
  savedCameraState={loadedState}
  productWidth={1000}
  productHeight={2000}
  productDepth={45}
/>
```

---

#### **Lighting.tsx** (Enhanced)
Integrates FileMaker-quality 3-point studio lighting.

```tsx
<Lighting
  config={DEFAULT_LIGHTING_CONFIG}
  productWidth={1000}
  productDepth={45}
  highQuality={true}
  onLightingReady={(lights) => cacheLights(lights)}
/>
```

---

### Hooks

#### **useProfileAssembly**
Manages assembly lifecycle, auto-fitting, and bounding box.

```typescript
const {
  assemblyRef,
  controlsRef,
  getAssembly,
  getBoundingBox,
  fitToComponent,
  resetView
} = useProfileAssembly(components, {
  autoFit: true,
  autoFitPerspective: '3/4',
  enableRaycast: true,
  enableTransformControls: true,
  onBoundingBoxChange: (box) => {},
  onComponentSelect: (id) => {}
});
```

---

## Integration with ProductConfigurator3D

### Step 1: Extract Components from AI Response

```typescript
// After OpenAI generates component tree
const aiComponents = [
  { id: 'stile-left', type: 'stile', widthMm: 50, depthMm: 45 },
  { id: 'rail-top', type: 'rail', widthMm: 80, depthMm: 45 },
  // ...
];

// Enhance with estimated profiles
const enhancedComponents = enhanceComponentListWithProfiles(aiComponents);
// Each has SVGProfileDefinition with confidence score
```

### Step 2: Create PBR Materials

```typescript
import { createPBRMaterial } from '@/lib/scene/materials';

const material = createPBRMaterial({
  timber: 'oak',
  finish: 'satin',
  envMapIntensity: 0.8,
});
```

### Step 3: Convert to ProfiledComponent Format

```typescript
const profiledComponents: ProfiledComponent[] = enhancedComponents.map(comp => ({
  id: comp.componentId,
  type: comp.componentType,
  profile: comp.profileDefinition,
  position: [0, comp.position?.offsetFromTopMm || 0, 0],
  material: material,
  castShadow: true,
  receiveShadow: true,
}));
```

### Step 4: Render in Canvas

```tsx
export function JoineryConfigurator({ lineItem }) {
  const [profiledComponents, setProfiledComponents] = useState<ProfiledComponent[]>([]);
  const controlsRef = useRef<any>(null);
  
  return (
    <Canvas>
      <Suspense fallback={null}>
        {/* Enhanced lighting */}
        <Lighting
          productWidth={lineItem.widthMm}
          productDepth={45}
          highQuality={true}
        />

        {/* FileMaker-style camera framing */}
        <EnhancedCameraController
          autoFit
          perspective="3/4"
          onControlsReady={(c) => setControlsRef(c)}
          productWidth={lineItem.widthMm}
          productHeight={lineItem.heightMm}
          productDepth={45}
        />

        {/* Profile rendering */}
        <ProfileRenderer
          components={profiledComponents}
          onSelect={(id) => setSelectedId(id)}
          selectedId={selectedId}
          onTransformEnd={(id, pos) => updateComponentPosition(id, pos)}
          orbitControlsRef={controlsRef}
          enableTransformControls
          enableRaycast
        />
      </Suspense>
    </Canvas>
  );
}
```

---

## Profile Swap Workflow

### Initial State: Estimated Profile
```typescript
{
  id: 'est_stile_1234567890',
  name: 'Estimated stile profile',
  svgText: '<svg>...</svg>',
  metadata: {
    source: 'estimated',
    confidence: 0.7,
    estimatedFrom: 'stile'
  }
}
```

### After Verification Upload: Real Profile
```typescript
// 1. Load verified profile from database
const verifiedProfile = await loadProfileDefinition(tenantId, 'verified_oak_stile_v2');

// 2. Find component using estimated profile
const componentGroup = findComponentInAssembly(assembly, componentId);

// 3. Update component with real profile
updateComponentProfile(componentGroup, verifiedProfile, material);

// 4. Persist to database
await storeProfileDefinition(tenantId, verifiedProfile);
```

**Benefits:**
- User sees instant placeholder
- No waiting for profile upload
- Seamless swap when ready
- Component IDs/transforms unchanged
- Database tracks profile sources

---

## Database Schema (Future)

```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  component_type VARCHAR(50),
  svg_text TEXT,
  viewbox_width INT,
  viewbox_height INT,
  extrude_depth_mm INT,
  scale FLOAT,
  
  source VARCHAR(20), -- 'estimated', 'verified', 'uploaded'
  confidence FLOAT, -- 0-1 for estimated
  estimated_from VARCHAR(50),
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE component_profiles (
  component_id TEXT PRIMARY KEY,
  profile_id TEXT,
  created_at TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);
```

---

## Error Handling

### Profile Validation
```typescript
const validation = validateProfile(profile);
if (!validation.valid) {
  console.error('Invalid profile:', validation.errors);
  // Fallback to estimated profile or box geometry
}
```

### Graceful Degradation
```typescript
const mesh = createExtrudedProfileMesh(svgText, depth, scale, material);
if (!mesh) {
  // Use fallback box geometry
  const fallbackGeometry = new THREE.BoxGeometry(width, height, depth);
  return new THREE.Mesh(fallbackGeometry, material);
}
```

---

## Performance Optimization

### Texture Loading (Cached)
```typescript
// Materials cache textures to avoid redundant loads
const oakMaterial = createPBRMaterial({ timber: 'oak' });
// First component loads texture
// Subsequent components reuse cached texture
```

### Geometry Instancing (Optional)
```typescript
// For 100+ identical components, use InstancedMesh
// Reduces draw calls and GPU memory
const instanced = new THREE.InstancedMesh(
  geometry,
  material,
  componentCount
);
```

### LOD (Level of Detail)
```typescript
// For complex profiles, use LOD
// Simplified geometry at distance, detailed up close
const lod = new THREE.LOD();
lod.addLevel(simplifiedGeometry, 100);
lod.addLevel(detailedGeometry, 0);
```

---

## Debugging

### Enable Debug Logging
```typescript
// In browser console
localStorage.setItem('DEBUG_SVG_PROFILE', 'true');
localStorage.setItem('DEBUG_FILEMAKER_CAMERA', 'true');
```

### Inspect Assembly
```typescript
// In browser console
const assembly = window.__profileAssembly;
const box = window.__profileBoundingBox;
console.log(assembly.children); // All components
console.log(box); // Bounding box
```

---

## Next Steps

1. **Database Integration**
   - Create profiles table
   - Implement API endpoints (/api/profiles)
   - Build profile upload UI

2. **AI Enhancement**
   - Fine-tune estimated profiles per timber type
   - Add confidence thresholds
   - Implement profile suggestions

3. **User Interface**
   - Profile selector UI (estimated vs. verified)
   - Confidence badges
   - Profile upload/edit workflows

4. **Advanced Features**
   - Profile templates library
   - AI-generated curved profiles
   - Historic profile library (Georgian, Victorian, etc.)
   - SVG editor for custom profiles

---

## References

- **SVG Loader**: `THREE.SVGLoader` from examples/jsm
- **Extrude Geometry**: `THREE.ExtrudeGeometry`
- **Shadow Material**: `THREE.ShadowMaterial`
- **Transform Controls**: `@react-three/drei TransformControls`
- **OrbitControls**: `THREE.OrbitControls`

---

## Support

For issues or questions:
1. Check console for validation errors
2. Verify SVG structure (must contain `<path>` or `<rect>`)
3. Ensure scale factor matches viewBox units
4. Test with simple rectilinear profiles first
5. Review FileMaker source for camera/lighting reference
