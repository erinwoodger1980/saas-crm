/**
 * Render Hints Utility
 * Manages z-fighting, transparency sorting, and render order for 3D components
 */

import * as THREE from 'three';

const EPSILON_OFFSET = 0.001; // Small offset to prevent z-fighting

export interface RenderHints {
  renderOrder?: number;
  polygonOffsetFactor?: number;
  polygonOffsetUnits?: number;
  depthWrite?: boolean;
  transparencySort?: boolean;
  tags?: string[]; // e.g., ['glass', 'panelFace', 'profileOverlay', 'stainedGlassImagePlane']
}

/**
 * Apply render hints to a mesh or material
 * Handles z-fighting prevention, transparency sorting, and depth writes
 */
export function applyRenderHints(mesh: THREE.Mesh | THREE.Object3D, hints: RenderHints): void {
  if (!mesh) return;

  // Type guard for Mesh
  const isMesh = (obj: THREE.Object3D): obj is THREE.Mesh => {
    return 'material' in obj;
  };

  if (!isMesh(mesh)) return;

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : mesh.material
    ? [mesh.material]
    : [];

  // Apply render order if specified
  if (hints.renderOrder !== undefined) {
    mesh.renderOrder = hints.renderOrder;
  }

  // Apply hints to all materials
  materials.forEach((material) => {
    if (!material) return;

    // Polygon offset to prevent z-fighting (typically for shadow-receiving surfaces)
    if (hints.polygonOffsetFactor !== undefined) {
      (material as THREE.Material).polygonOffset = true;
      (material as any).polygonOffsetFactor = hints.polygonOffsetFactor;
    }

    if (hints.polygonOffsetUnits !== undefined) {
      (material as THREE.Material).polygonOffset = true;
      (material as any).polygonOffsetUnits = hints.polygonOffsetUnits;
    }

    // Depth write control (for transparent objects that don't need depth testing)
    if (hints.depthWrite !== undefined) {
      (material as any).depthWrite = hints.depthWrite;
    }

    // Transparency sort (for blended objects)
    if (hints.transparencySort !== undefined) {
      (material as any).transparent = hints.transparencySort || (material as any).transparent;
    }
  });

  // Store tags for debugging
  if (hints.tags) {
    (mesh as any).__renderTags__ = hints.tags;
  }
}

/**
 * Apply render hints to glass materials
 * Glass typically needs: depthWrite=false, high renderOrder, transparent blend
 */
export function applyGlassHints(mesh: THREE.Mesh | THREE.Object3D): void {
  applyRenderHints(mesh, {
    renderOrder: 10, // Render after opaque objects
    depthWrite: false, // Don't write to depth buffer
    transparencySort: true,
    tags: ['glass'],
  });
}

/**
 * Apply render hints to decal/overlay layers (images, decals on surfaces)
 * Prevents z-fighting with underlying geometry
 */
export function applyDecalHints(mesh: THREE.Mesh | THREE.Object3D): void {
  applyRenderHints(mesh, {
    renderOrder: 5, // Between opaque and glass
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
    tags: ['decal', 'overlay'],
  });
}

/**
 * Apply render hints to stained glass image planes
 */
export function applyStainedGlassHints(mesh: THREE.Mesh | THREE.Object3D): void {
  applyRenderHints(mesh, {
    renderOrder: 8,
    depthWrite: false,
    transparencySort: true,
    tags: ['stainedGlassImagePlane'],
  });
}

/**
 * Apply render hints to panel faces / profile overlays
 * These sit on timber/frame surfaces and need offset to prevent shimmer
 */
export function applyPanelFaceHints(mesh: THREE.Mesh | THREE.Object3D): void {
  applyRenderHints(mesh, {
    renderOrder: 3,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    tags: ['panelFace', 'profileOverlay'],
  });
}

/**
 * Apply shadow-receiving surface hints
 * Prevents shimmer on floor/shadow catching surfaces
 */
export function applyShadowCatcherHints(mesh: THREE.Mesh | THREE.Object3D): void {
  applyRenderHints(mesh, {
    renderOrder: 1,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    tags: ['shadowCatcher'],
  });
}

/**
 * Detect potential z-fighting pairs in a scene
 * Returns array of mesh pairs that might exhibit z-fighting
 */
export interface ZFightingPair {
  mesh1: THREE.Mesh;
  mesh2: THREE.Mesh;
  distance: number;
  bounds1: THREE.Box3;
  bounds2: THREE.Box3;
  boundsOverlap: boolean;
}

export function detectZFighting(
  scene: THREE.Scene,
  epsilonThreshold = EPSILON_OFFSET
): ZFightingPair[] {
  const meshes: THREE.Mesh[] = [];
  const pairs: ZFightingPair[] = [];

  // Collect all meshes
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      meshes.push(obj);
    }
  });

  // Check each pair for potential z-fighting
  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      const mesh1 = meshes[i];
      const mesh2 = meshes[j];

      // Get world-space bounds
      const box1 = new THREE.Box3().setFromObject(mesh1);
      const box2 = new THREE.Box3().setFromObject(mesh2);

      // Check if bounds overlap
      const boundsOverlap = box1.intersectsBox(box2);
      if (!boundsOverlap) continue;

      // Check if meshes are coplanar (roughly)
      // Simple heuristic: check if centroids are very close along one axis
      const center1 = box1.getCenter(new THREE.Vector3());
      const center2 = box2.getCenter(new THREE.Vector3());

      const distance = center1.distanceTo(center2);

      // If meshes are very close and bounds overlap, possible z-fighting
      if (distance < epsilonThreshold * 10) {
        pairs.push({
          mesh1,
          mesh2,
          distance,
          bounds1: box1,
          bounds2: box2,
          boundsOverlap: true,
        });
      }
    }
  }

  return pairs;
}

/**
 * Debug log z-fighting warnings
 */
export function logZFightingWarnings(scene: THREE.Scene): void {
  const pairs = detectZFighting(scene);

  if (pairs.length === 0) {
    console.log('✅ Z-fighting audit: no potential conflicts detected');
    return;
  }

  console.warn(`⚠️  Detected ${pairs.length} potential z-fighting pair(s):`);
  pairs.forEach((pair, idx) => {
    console.warn(`  [${idx + 1}] "${pair.mesh1.name}" ↔ "${pair.mesh2.name}" (distance: ${pair.distance.toFixed(4)})`);
    console.warn(`     Tags1: ${(pair.mesh1 as any).__renderTags__?.join(', ') || 'none'}`);
    console.warn(`     Tags2: ${(pair.mesh2 as any).__renderTags__?.join(', ') || 'none'}`);
  });
}

/**
 * Helper to offset coplanar geometry by epsilon to prevent z-fighting
 * Translates a mesh slightly along its normal to separate it from its base
 */
export function offsetMeshByEpsilon(
  mesh: THREE.Mesh,
  direction: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
  epsilon: number = EPSILON_OFFSET
): void {
  mesh.position.addScaledVector(direction, epsilon);
}
