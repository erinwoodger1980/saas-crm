/**
 * Example: Applying Render Quality Improvements to Scene Components
 * 
 * Shows how to use renderHints, PostFX, and proper material configuration
 * for a professional 3D configurator.
 */

import { DoorConfigurator } from '@/components/configurator/DoorConfigurator';
import { SceneConfig, ComponentNode, MaterialDefinition } from '@/types/scene-config';

/**
 * Example: Building a high-quality door scene with render hints
 */
export function createHighQualityDoorConfig(): any {
  // Glass panel component with proper tags
  const glassPanel: ComponentNode = {
    id: 'glass-panel-front',
    name: 'Front Glass Pane',
    type: 'group',
    visible: true,
    materialId: 'glass-clear',
    tags: ['glass'], // ← Apply glass render hints
    geometry: {
      type: 'box',
      position: [0, 0, 10],
      rotation: [0, 0, 0],
      dimensions: [900, 2100, 4],
    },
  };

  // Stained glass overlay
  const stainedGlassPlane: ComponentNode = {
    id: 'stained-glass-1',
    name: 'Stained Glass Image',
    type: 'group',
    visible: true,
    materialId: 'glass-textured',
    tags: ['stainedGlassImagePlane'], // ← Special handling for image planes
    geometry: {
      type: 'box',
      position: [0, 0, 11], // Offset to prevent z-fighting
      rotation: [0, 0, 0],
      dimensions: [850, 2050, 1],
    },
  };

  // Panel face (sits on timber frame)
  const panelFace: ComponentNode = {
    id: 'panel-face-1',
    name: 'Door Panel Face',
    type: 'group',
    visible: true,
    materialId: 'painted-white',
    tags: ['panelFace', 'profileOverlay'], // ← Apply panel face hints
    geometry: {
      type: 'box',
      position: [0, 0, 5],
      rotation: [0, 0, 0],
      dimensions: [880, 2080, 2],
    },
  };

  // Decal texture (logo or pattern)
  const decal: ComponentNode = {
    id: 'decal-logo',
    name: 'Logo Decal',
    type: 'group',
    visible: true,
    materialId: 'decal-texture',
    tags: ['decal', 'overlay'], // ← Apply decal render hints
    geometry: {
      type: 'box',
      position: [0, 100, 6], // Offset to prevent z-fighting
      rotation: [0, 0, 0],
      dimensions: [400, 300, 0.5],
    },
  };

  // Glass materials with proper transmission settings
  const glassMaterials: MaterialDefinition[] = [
    {
      id: 'glass-clear',
      name: 'Clear Glass',
      type: 'glass',
      baseColor: '#e8f4f8',
      roughness: 0.2,
      metalness: 0,
      // Note: MeshPhysicalMaterial will be created with:
      // - transmission: 0.95
      // - ior: 1.5
      // - depthWrite: false ← CRITICAL for transparency sorting
      // - renderOrder: 10 ← Render after opaque objects
    },
    {
      id: 'glass-textured',
      name: 'Textured Glass',
      type: 'glass',
      baseColor: '#ffffff',
      roughness: 0.4,
      metalness: 0,
    },
  ];

  const woodMaterials: MaterialDefinition[] = [
    {
      id: 'timber-natural',
      name: 'Natural Timber',
      type: 'wood',
      baseColor: '#8b6f47',
      roughness: 0.7,
      metalness: 0,
    },
    {
      id: 'painted-white',
      name: 'White Paint',
      type: 'painted',
      baseColor: '#f5f5f5',
      roughness: 0.5,
      metalness: 0,
    },
  ];

  const decalMaterials: MaterialDefinition[] = [
    {
      id: 'decal-texture',
      name: 'Logo Texture',
      type: 'painted',
      baseColor: '#0066cc',
      roughness: 0.3,
      metalness: 0,
      // Note: Will be rendered with:
      // - renderOrder: 5 ← Between opaque and glass
      // - depthWrite: false
      // - polygonOffset: -1, -1
    },
  ];

  // Root component tree
  const doorFrame: ComponentNode = {
    id: 'door-frame',
    name: 'Door Frame',
    type: 'group',
    visible: true,
    geometry: {
      type: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: [914, 2032, 45],
    },
    children: [
      panelFace,
      glassPanel,
      stainedGlassPlane,
      decal,
    ],
  };

  return {
    tenantId: 'tenant-001',
    entityType: 'door',
    entityId: 'door-001',
    dimensions: {
      width: 914,
      height: 2032,
      depth: 45,
      bounds: {
        min: [-457, -1016, -22.5],
        max: [457, 1016, 22.5],
      },
    },
    components: [doorFrame],
    materials: [
      ...glassMaterials,
      ...woodMaterials,
      ...decalMaterials,
    ],
    visibility: {
      'door-frame': true,
      'glass-panel-front': true,
      'stained-glass-1': true,
      'panel-face-1': true,
      'decal-logo': true,
    },
    camera: {
      mode: 'perspective' as any,
      position: [1500, 1000, 1500],
      target: [0, 0, 0],
      fov: 45,
      rotation: [0, 0, 0],
      zoom: 1,
    },
    lighting: {
      boundsX: [-500, 500],
      boundsZ: [-500, 500],
      intensity: 1.5,
      shadowCatcherDiameter: 2000,
      ambientIntensity: 0.8,
      castShadows: true,
    },
    ui: {
      axis: false,
      guides: false,
      componentList: false,
      dimensions: false,
    },
    metadata: {
      productName: 'Premium Glass Door with Stained Glass',
      notes: 'High-quality 3D configurator with anti-aliasing and z-fighting prevention. v2.0 quality audit render',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Usage in React component
 */
export function HighQualityConfiguratorExample() {
  const config = createHighQualityDoorConfig();

  return (
    <div className="w-full h-screen">
      <DoorConfigurator
        tenantId="tenant-001"
        entityType="door"
        entityId="door-001"
        initialConfig={config}
        width="100%"
        height="100%"
        onChange={(newConfig) => {
          console.log('Configuration updated:', newConfig);
          // Persist to backend
        }}
      />
    </div>
  );
}

/**
 * Render hints documentation
 * 
 * Apply these hints to components for optimal rendering:
 * 
 * 1. GLASS COMPONENTS:
 *    - tags: ['glass']
 *    - Will automatically receive:
 *      * renderOrder: 10 (render last)
 *      * depthWrite: false (transparent sorting)
 *      * Proper MeshPhysicalMaterial with transmission
 * 
 * 2. DECALS/OVERLAYS:
 *    - tags: ['decal', 'overlay']
 *    - Will automatically receive:
 *      * renderOrder: 5 (between opaque and glass)
 *      * depthWrite: false
 *      * polygonOffset: -1, -1 (sits on surface)
 * 
 * 3. STAINED GLASS IMAGE PLANES:
 *    - tags: ['stainedGlassImagePlane']
 *    - Will automatically receive:
 *      * renderOrder: 8
 *      * depthWrite: false
 *      * Transparent blend mode
 * 
 * 4. PANEL FACES (on timber frames):
 *    - tags: ['panelFace', 'profileOverlay']
 *    - Will automatically receive:
 *      * renderOrder: 3
 *      * polygonOffset: 1, 1 (sits slightly above frame)
 * 
 * Z-FIGHTING PREVENTION:
 * - Use tags to automatically apply correct hints
 * - Offset coplanar geometry by epsilon (~0.001 units)
 * - ContactShadows handles shadow plane (no manual offset needed)
 * - Enable NEXT_PUBLIC_DEBUG_ZFIGHT=true to audit scene
 */
