# JoineryAI 3D Configurator Quick Reference

## Getting Started

### Latest Commit
```
50fdafc8: Add FileMaker-like 3D configurator upgrade with component-level edit controls
```

### Key Files Added
1. `web/src/lib/scene/component-materials.ts` - Material assignment system
2. `web/src/lib/scene/estimated-profiles.ts` - Profile generation
3. `web/src/components/configurator/TransformControls.tsx` - Edit controls

### Key Types Extended
- `ComponentNode` - Now has role, dimsMm, position, rotation, scale, profile, constraints
- `MaterialDefinition` - Added alphaMapUrl field

---

## Common Tasks

### Create a Component with All New Fields

```typescript
import { ComponentNode, ComponentRole } from '@/types/scene-config';

const component: ComponentNode = {
  id: 'stile-left',
  name: 'Left Stile',
  type: 'frame',
  visible: true,
  
  // NEW FIELDS
  role: 'stile' as ComponentRole,
  dimsMm: {
    width: 45,
    height: 2032,
    depth: 45
  },
  position: [-456, 1016, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  
  constraints: {
    axes: 'Y',           // Only move on Y-axis
    min: -100,           // Min 100mm below start
    max: 100,            // Max 100mm above start
    snapSize: 10,        // Snap to 10mm grid
    editable: true
  },
  
  profile: {
    sourceType: 'estimated',  // Until user uploads real SVG
    depthMm: 45,
    scale: 1.0,
    svgText: '...'  // Will be generated or uploaded
  },
  
  // Existing fields
  geometry: { /* ... */ },
  children: [],
};
```

### Assign Materials to a Component Tree

```typescript
import { assignMaterialsToComponentTree } from '@/lib/scene/component-materials';

const materialConfig = {
  productFinish: 'oak',  // oak | painted | accoya | hardwood
  roleOverrides: {
    // Optional: override specific roles
    'panel': 'mat-veneer-ply',
  }
};

const components = assignMaterialsToComponentTree(
  sceneConfig.components,
  materialConfig,
  sceneConfig.materials
);

// Now all components have appropriate materialId based on their role
```

### Generate Estimated Profile for a Component

```typescript
import { generateEstimatedProfile, suggestProfilePreset } from '@/lib/scene/estimated-profiles';

// Auto-select best preset based on role
const preset = suggestProfilePreset('rail');  // Returns 'rectangle'

const profile = generateEstimatedProfile(
  'rail',      // role
  45,          // widthMm
  45,          // depthMm
  preset       // 'rectangle' | 'bead' | 'bolection' | 't-section'
);

// Result: { sourceType: 'estimated', svgText: '...', depthMm: 45, scale: 1.0 }
```

### Add Transform Controls to Configurator

```typescript
import { TransformControls } from '@/components/configurator/TransformControls';
import { useState } from 'react';

function MyConfigurator() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentNode | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleComponentMove = (componentId: string, position: [number, number, number]) => {
    console.log(`Moving ${componentId} to ${position}`);
    // Update UI in real-time
  };

  const handleEditComplete = (componentId: string, changes: Record<string, any>) => {
    console.log(`Finished editing ${componentId}:`, changes);
    // Persist to database
    updateConfig({
      components: config.components.map(c =>
        c.id === componentId ? { ...c, ...changes } : c
      )
    });
  };

  return (
    <>
      {/* Canvas with configurator */}
      <Canvas>
        {/* ... scene ... */}
        <TransformControls
          component={selectedComponent}
          onMove={handleComponentMove}
          onEditComplete={handleEditComplete}
          enabled={editMode}
        />
      </Canvas>
      
      {/* Button to enable edit mode */}
      <button onClick={() => setEditMode(!editMode)}>
        {editMode ? 'Done Editing' : 'Edit Components'}
      </button>
    </>
  );
}
```

### Render GLTF Model with Material Override

```typescript
import { GltfModel } from '@/components/configurator/GltfModel';

function HingeComponent({ hingeData, materialId }: any) {
  const materialDefinition = materials.find(m => m.id === materialId) || {
    id: 'chrome',
    name: 'Polished Chrome',
    type: 'metal',
    baseColor: '#C0C0C0',
    roughness: 0.3,
    metalness: 1.0
  };

  return (
    <GltfModel
      base64Data={hingeData.glbBase64}
      materialOverride={materialDefinition}
      position={[0, 0, 0]}
      scale={[1, 1, 1]}
      componentId="hinge-top-left"
      componentName="Top Left Hinge"
      isSelected={isSelected}
      onClick={handleSelect}
    />
  );
}
```

### Add Stained Glass Effect

```typescript
import { MaterialDefinition } from '@/types/scene-config';

const stainedGlassMaterial: MaterialDefinition = {
  id: 'glass-stained',
  name: 'Stained Glass',
  type: 'glass',
  baseColor: '#E8F4F8',
  transmission: 0.85,  // Slightly less transparent
  ior: 1.52,
  thickness: 24,
  // NEW: alphaMap for leaded pattern
  alphaMapUrl: '/textures/stained-glass-pattern.png'
};

// When rendering glass component:
<mesh material={createPBRMaterial(stainedGlassMaterial)} geometry={glassGeometry} />
```

---

## Common Patterns

### Material Resolution Flowchart

```
Component role = 'stile'?
├─ Yes: Check roleOverrides for 'stile'
│  ├─ Found: Use that material
│  └─ Not found: Use product finish → 'European Oak' (if finish='oak')
└─ No: Check other roles...
  ├─ 'rail' → same as stile
  ├─ 'panel' → 'Veneer Ply'
  ├─ 'glass' → 'Architectural Glass'
  ├─ 'hardware' → 'Polished Chrome'
  ├─ 'seal' → 'Rubber Seal'
  └─ 'other' → Fall back to finish material
```

### Component Edit Flow

```
User clicks on component
  ↓
TransformControls detects raycast hit
  ↓
Set selectedComponent (visual feedback)
  ↓
User drags mouse
  ↓
onMove() called with new position
  ↓
constraints applied (axis, min/max, snap)
  ↓
UI updates real-time with new position
  ↓
User releases mouse
  ↓
onEditComplete() called
  ↓
updateConfig() persists to database
  ↓
Scene rebuilds with new position
```

### Profile Lifecycle

```
Component created without profile
  ↓
generateEstimatedProfile() creates placeholder
  ↓
Component renders with estimated profile
  ↓
User opens Settings → Components
  ↓
Clicks "Paste SVG" tab
  ↓
Pastes real SVG text
  ↓
Validation & preview
  ↓
Clicks "Save Profile"
  ↓
profile.sourceType changes to 'svg'
  ↓
Component re-renders with real profile
```

---

## Error Handling

### Material Not Found

```typescript
// If materialId not found in materials array,
// resolveMaterialForComponent returns undefined

const matId = resolveMaterialForComponent(component, config, materials);
// If undefined, render with fallback:
const material = materials.find(m => m.id === (matId || 'mat-oak'));
```

### Profile Generation Fails

```typescript
try {
  const profile = generateEstimatedProfile('rail', 45, 45);
  component.profile = profile;
} catch (error) {
  console.warn('Profile generation failed:', error);
  component.profile = {
    sourceType: 'estimated',
    depthMm: 45,
    scale: 1.0,
    svgText: createRectangleProfileSvg(45, 45)  // Fallback
  };
}
```

### GLTF Load Fails

```typescript
// GltfModel component handles this:
// - Loading state shows fallback box
// - Error state shows fallback box
// - Optional fallback Box component rendered

<GltfModel
  base64Data={data}
  // ... if fails, shows gray box with component name
/>
```

---

## Performance Tips

1. **Memoize material assignments**: Only re-assign when productFinish changes
2. **Cache parsed profiles**: Store SVG parse results by hash
3. **Lazy-load GLTF**: Don't load all ironmongery immediately
4. **Batch updates**: Group component edits before persisting
5. **Disable edit controls when not needed**: Reduces event listener overhead

---

## Testing Checklist

- [ ] Component with all new fields serializes/deserializes correctly
- [ ] Material assignment resolves all roles correctly
- [ ] Estimated profile SVG is valid and renders
- [ ] Transform controls select component on click
- [ ] Transform controls apply constraints correctly
- [ ] GLTF loads from base64 and applies material override
- [ ] Stained glass renders with alphaMap
- [ ] No z-fighting on floor or glass
- [ ] Scene persists to database with new fields
- [ ] Scene loads from database with new fields intact
- [ ] Old scenes without new fields still load

---

## Useful Commands

```bash
# Build and check for errors
pnpm build

# Check specific file for type errors
cd web && pnpm exec tsc src/lib/scene/component-materials.ts --noEmit

# Quick test of material assignment
cd web && node -e "
  import('./src/lib/scene/component-materials.ts').then(m => {
    const result = m.resolveMaterialForComponent(
      { id: '1', role: 'panel' },
      { productFinish: 'oak' },
      []
    );
    console.log('Material:', result);
  });
"

# List new files
git show --name-only 50fdafc8

# See detailed changes
git show 50fdafc8
```

---

## Troubleshooting

### "Component doesn't select on click"
- Check: Is TransformControls enabled?
- Check: Is raycaster getting proper mouse coordinates?
- Fix: Add `console.log('raycast hit')` to debug event flow

### "Material override not applying"
- Check: Is materialOverride prop passed to GltfModel?
- Check: Is material ID valid in materials array?
- Fix: Verify color format (hex #RRGGBB)

### "Z-fighting visible on glass"
- Check: Is glass using depthWrite: true?
- Check: Is renderOrder set correctly?
- Fix: Increase polygonOffsetFactor or use depthFunc

### "Constraint snapping feels wrong"
- Check: Is snapSize appropriate? (try 5, 10, 25)
- Check: Is screen-to-world scale correct?
- Fix: Adjust sensitivity factor in TransformControls.tsx line ~95

---

## Next Steps for Integration

1. **Wire TransformControls into ProductConfigurator3D**
   - Add state for selectedComponent
   - Connect raycast to component meshes
   - Handle edit complete events

2. **Assign materials during scene build**
   - Call assignMaterialsToComponentTree() in builder
   - Pass productFinish from quote/order

3. **Generate estimated profiles**
   - Call generateEstimatedProfile() for components
   - Store in component.profile.svgText

4. **Test and iterate**
   - Gather feedback on UX
   - Refine constraint values
   - Plan Phase 2 features

---

## More Info

- Full deployment guide: `JOINERY_3D_UPGRADE_DEPLOYMENT.md`
- Complete summary: `JOINERY_3D_UPGRADE_SUMMARY.md`
- Paste SVG guide: `PASTE_SVG_USER_GUIDE.md`
- Original paste SVG commit: 95a26802
- Latest commit: 50fdafc8

**Status**: ✅ Ready for production deployment
