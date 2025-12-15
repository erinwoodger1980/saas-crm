<!-- DOOR_CONFIGURATOR_ARCHITECTURE.md -->

# Professional Door Configurator Architecture

## Overview

This is a **production-grade** 3D door configurator with complete state persistence, designed to match (and exceed) FileMaker + WebViewer + Three.js behaviour in a modern React/Next.js application.

## Core Principles

### 1. Single Source of Truth
All scene state lives in a single `SceneConfig` object that includes:
- Product dimensions
- Component hierarchy
- Material definitions
- Camera state (position, rotation, target, zoom, mode)
- Visibility map
- Lighting configuration
- UI toggles

### 2. FileMaker Parity
The system exactly replicates FileMaker window globals:
- Camera state persists on every interaction
- Visibility toggles persist per component
- View mode (Perspective/Ortho) persists
- No camera resets unless explicitly requested
- Stable, predictable behaviour

### 3. State Persistence
Scene configuration persists to PostgreSQL via REST API:
- Keyed by `tenantId + entityType + entityId`
- Debounced writes (500ms default)
- Automatic restore on page load
- Tracks modification history

### 4. Professional UX
- No reflows or camera jumps
- CAD-like controls (rotate/pan/zoom)
- Smooth OrbitControls with damping
- Hierarchical component tree with expand/collapse
- Real-time visibility toggles
- Seamless camera mode switching

## File Structure

```
web/src/
├── types/
│   └── scene-config.ts           # TypeScript types for entire system
├── components/configurator/
│   ├── DoorConfigurator.tsx      # Main component, orchestrates everything
│   ├── CameraController.tsx      # Camera state management with persistence
│   ├── Lighting.tsx              # Dynamic lighting scaled to product
│   ├── DoorComponents.tsx        # Hierarchical component rendering
│   └── SceneUI.tsx               # UI controls overlay
├── lib/
│   └── scene-utils.ts            # Utility functions for scene building
├── app/
│   ├── api/scene-state/
│   │   └── route.ts              # REST API for persistence
│   └── configurator-demo/
│       └── page.tsx              # Example usage
└── prisma/
    └── scene-state-schema.prisma # Database schema
```

## Usage

### Basic Usage

```tsx
import { DoorConfigurator } from '@/components/configurator/DoorConfigurator';

export default function MyPage() {
  return (
    <DoorConfigurator
      tenantId="tenant-123"
      entityType="door"
      entityId="door-456"
      height="600px"
    />
  );
}
```

### With Initial Configuration

```tsx
import { DoorConfigurator } from '@/components/configurator/DoorConfigurator';
import { createStandardDoorScene } from '@/lib/scene-utils';

export default function MyPage() {
  const initialConfig = createStandardDoorScene(914, 2032, 45);
  
  return (
    <DoorConfigurator
      tenantId="tenant-123"
      entityType="door"
      entityId="door-456"
      initialConfig={initialConfig}
      onChange={(config) => console.log('Updated:', config)}
      height="600px"
    />
  );
}
```

## Component Hierarchy

### DoorConfigurator (Main Component)
- **Responsibility**: Orchestrate all sub-components, manage state
- **State**: Complete `SceneConfig` object
- **API Interaction**: Load/save via REST endpoints
- **Props**:
  - `tenantId`: Multi-tenant identifier
  - `entityType`: Type of entity being configured
  - `entityId`: Unique entity identifier
  - `initialConfig`: Optional initial configuration
  - `onChange`: Callback when config changes

### CameraController
- **Responsibility**: Camera state management with FileMaker parity
- **Features**:
  - Perspective/Orthographic mode switching
  - OrbitControls with CAD-like feel
  - Auto-fit zoom calculation for ortho mode
  - Debounced persistence (500ms default)
  - No camera resets on state updates
- **Math**: Auto-fit zoom matches FileMaker exactly:
  ```typescript
  zoom = min(
    viewportHeight / productHeight * 0.66,
    viewportWidth / productWidth * 0.4
  )
  ```

### Lighting
- **Responsibility**: Dynamic lighting scaled to product extents
- **Features**:
  - Light positions computed from product bounds
  - No hard-coded positions
  - Shadow catcher scales with product size
  - Key + Fill + Rim light setup
  - 4K shadow maps with soft shadows

### DoorComponents
- **Responsibility**: Render hierarchical component tree
- **Features**:
  - 1:1 mapping with geometry nodes
  - Recursive rendering of children
  - Material assignment per component
  - Visibility from flat map for performance
  - Support for Box, Cylinder, Extrude, Custom geometries

### SceneUI
- **Responsibility**: UI controls overlay
- **Features**:
  - Camera mode toggle (Perspective/Ortho)
  - Reset camera button
  - View option toggles (guides, axis, dimensions)
  - Hierarchical component tree
  - Expand/collapse groups
  - Visibility toggles per component

## Database Schema

```prisma
model SceneState {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenantId   String
  entityType String
  entityId   String
  config     Json

  modifiedBy String?

  @@unique([tenantId, entityType, entityId])
  @@index([tenantId])
  @@index([entityType, entityId])
}
```

## API Endpoints

### GET /api/scene-state
Load scene configuration for an entity.

**Query Parameters:**
- `tenantId`: string
- `entityType`: string
- `entityId`: string

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "config": { ... },
    "updatedAt": "2025-12-15T10:30:00Z",
    "modifiedBy": "user-id"
  }
}
```

### POST /api/scene-state
Save or update scene configuration.

**Body:**
```json
{
  "tenantId": "...",
  "entityType": "door",
  "entityId": "...",
  "config": { ... }
}
```

### DELETE /api/scene-state
Delete scene configuration (resets to default).

## Camera Math

### Orthographic Auto-Fit
Matches FileMaker behaviour exactly:
```typescript
function calculateOrthoZoom(
  productWidth: number,
  productHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const zoomFromHeight = (viewportHeight / productHeight) * 0.66;
  const zoomFromWidth = (viewportWidth / productWidth) * 0.4;
  return Math.min(zoomFromHeight, zoomFromWidth);
}
```

### Camera State Persistence
Camera state persists on:
- OrbitControls `onEnd` event
- Debounced 500ms after interaction
- Includes: position, rotation, target, zoom (ortho), fov (perspective)

## Lighting Math

### Dynamic Light Positioning
Lights scale based on product extents:
```typescript
const maxExtent = max(boundsX[1] - boundsX[0], boundsZ[1] - boundsZ[0]);
const keyLightY = maxExtent * 0.8;
const keyLightDistance = maxExtent * 0.7;
const keyPosition = [centerX + keyLightDistance, keyLightY, centerZ + keyLightDistance];
```

### Shadow Catcher
Diameter scales with product:
```typescript
shadowCatcherDiameter = max(productWidth, productHeight) * 2;
```

## Performance Optimizations

1. **Debounced Persistence**: 500ms debounce on camera changes
2. **Flat Visibility Map**: O(1) lookup instead of tree traversal
3. **Memoized Materials**: Materials created once, reused
4. **Geometry Caching**: Three.js geometries cached in useMemo
5. **Lazy Loading**: Canvas loads on demand with Suspense
6. **Soft Shadows**: PCFSoftShadowMap for performance/quality balance

## Extending the System

### Adding New Component Types

1. **Define geometry in scene-config.ts:**
```typescript
export interface ComponentNode {
  geometry?: {
    type: 'box' | 'cylinder' | 'extrude' | 'your-new-type';
    // ...
  };
}
```

2. **Handle in DoorComponents.tsx:**
```typescript
case 'your-new-type':
  return createYourGeometry(customData);
```

### Adding New Material Types

1. **Add to MaterialDefinition type**
2. **Handle in DoorComponents.tsx `createMaterials()`**

### Custom Geometry

Use `type: 'custom'` with `customData`:
```typescript
{
  type: 'custom',
  customData: {
    vertices: [...],
    indices: [...],
    normals: [...],
  }
}
```

## Testing

### Manual Testing Checklist
- [ ] Camera state persists on page reload
- [ ] Visibility toggles persist
- [ ] Camera mode toggle works seamlessly
- [ ] No camera jumps on state updates
- [ ] OrbitControls feel natural (CAD-like)
- [ ] Lights scale correctly with product size
- [ ] Component tree expands/collapses
- [ ] Saving indicator appears
- [ ] Multi-tenancy isolation works

### Integration Testing
```typescript
// Test scene state persistence
const config = await loadSceneState('tenant', 'door', 'id');
expect(config.camera.mode).toBe('Perspective');

// Test visibility toggle
updateVisibility('component-id', false);
const updated = await loadSceneState('tenant', 'door', 'id');
expect(updated.visibility['component-id']).toBe(false);
```

## Production Deployment

### Environment Variables
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
```

### Database Migration
```bash
npx prisma migrate dev --name add_scene_state
npx prisma generate
```

### Build
```bash
pnpm build
```

### Performance Monitoring
Monitor:
- Scene state load time
- Persistence write frequency
- Camera interaction smoothness
- Component render performance

## Troubleshooting

### Camera Resets on Every Update
**Problem**: Camera jumps to default position
**Solution**: Ensure `useEffect` in CameraController only runs on mode change, not on every state update

### State Not Persisting
**Problem**: Changes don't save to database
**Solution**: Check:
1. API route permissions
2. Database connection
3. Tenant access verification
4. Console for API errors

### Lights Not Scaling
**Problem**: Lights in wrong positions
**Solution**: Verify `calculateProductBounds()` returns correct extents

## Best Practices

1. **Always use the state system**: Don't bypass with local state
2. **Debounce writes**: Avoid excessive database updates
3. **Validate on server**: API routes must validate user permissions
4. **Handle errors gracefully**: Show user-friendly messages
5. **Test persistence**: Reload page frequently during development
6. **Scale lights dynamically**: Never hard-code light positions
7. **Keep component IDs stable**: Don't regenerate IDs on every render

## Future Enhancements

- [ ] Undo/redo for state changes
- [ ] State history/versioning
- [ ] Collaborative editing with WebSockets
- [ ] Export to GLTF/OBJ
- [ ] Measurement tools
- [ ] Annotation system
- [ ] Material texture uploads
- [ ] Custom geometry importer

---

**Built for commercial use. Expert users expect precision, persistence, and reliability.**
