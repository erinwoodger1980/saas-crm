/**
 * Component-Level Profile Renderer
 * Renders joinery components with SVG-extruded profiles
 * Each component has its own profile, extrude depth, and material
 */

import * as THREE from 'three';
import { SVGProfileDefinition, createExtrudedProfileMesh } from './svg-profile';

export interface ProfiledComponent {
  id: string;
  type: 'stile' | 'rail' | 'mullion' | 'transom' | 'glazing_bar' | 'panel';
  profile: SVGProfileDefinition;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Create mesh group for a profiled component
 * Returns THREE.Group containing the extruded profile
 */
export function createProfiledComponentMesh(
  component: ProfiledComponent
): THREE.Group | null {
  // Create extruded profile mesh
  const profileMesh = createExtrudedProfileMesh(
    component.profile.svgText,
    component.profile.extrudeDepthMm,
    component.profile.scale,
    component.material
  );

  if (!profileMesh) {
    console.warn(`[profiled-component] Failed to create profile mesh for ${component.id}`);
    return null;
  }

  // Wrap in group for easier transformation
  const group = new THREE.Group();
  group.userData.componentId = component.id;
  group.userData.componentType = component.type;
  group.userData.profile = component.profile;

  // Apply transformations
  group.position.set(...component.position);

  if (component.rotation) {
    group.rotation.set(...component.rotation);
  }

  if (component.scale) {
    group.scale.set(...component.scale);
  }

  // Shadow settings
  profileMesh.castShadow = component.castShadow !== false;
  profileMesh.receiveShadow = component.receiveShadow !== false;

  group.add(profileMesh);

  return group;
}

/**
 * Update component position (e.g., rail height)
 * Preserves profile and material
 */
export function updateComponentPosition(
  group: THREE.Group,
  newPosition: [number, number, number]
): void {
  group.position.set(...newPosition);
}

/**
 * Update component profile (e.g., swap estimated for verified)
 * Recreates mesh with new profile SVG
 */
export function updateComponentProfile(
  group: THREE.Group,
  newProfile: SVGProfileDefinition,
  material: THREE.Material
): void {
  // Remove old mesh
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  // Create new mesh with updated profile
  const newMesh = createExtrudedProfileMesh(
    newProfile.svgText,
    newProfile.extrudeDepthMm,
    newProfile.scale,
    material
  );

  if (newMesh) {
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;
    group.add(newMesh);
    group.userData.profile = newProfile;
  }
}

/**
 * Create complete assembly from component list
 * Returns THREE.Group containing all profiled components
 */
export function createProfiledAssembly(
  components: ProfiledComponent[]
): THREE.Group {
  const assembly = new THREE.Group();
  assembly.userData.isAssembly = true;

  components.forEach((component) => {
    const mesh = createProfiledComponentMesh(component);
    if (mesh) {
      assembly.add(mesh);
    }
  });

  return assembly;
}

/**
 * Get bounding box of assembly
 * Useful for camera framing
 */
export function getAssemblyBoundingBox(assembly: THREE.Group): THREE.Box3 {
  const box = new THREE.Box3();
  assembly.children.forEach((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
      box.expandByObject(child);
    }
  });
  return box;
}

/**
 * Find component by ID in assembly
 */
export function findComponentInAssembly(
  assembly: THREE.Group,
  componentId: string
): THREE.Group | null {
  return assembly.children.find(
    (child) => child.userData.componentId === componentId
  ) as THREE.Group | null;
}

/**
 * Raycasting helper for component selection
 */
export function raycastAssembly(
  assembly: THREE.Group,
  raycaster: THREE.Raycaster,
  camera: THREE.Camera
): { component: THREE.Group; point: THREE.Vector3 } | null {
  const intersects = raycaster.intersectObject(assembly, true);

  if (intersects.length === 0) return null;

  // Find parent component group
  let current = intersects[0].object;
  let componentGroup: THREE.Group | null = null;

  while (current && !componentGroup) {
    if (current.userData.componentId) {
      componentGroup = current as THREE.Group;
      break;
    }
    current = current.parent as THREE.Object3D;
  }

  if (!componentGroup) return null;

  return {
    component: componentGroup,
    point: intersects[0].point,
  };
}

/**
 * Apply material override to all components
 * Useful for selection highlighting
 */
export function applyMaterialToAssembly(
  assembly: THREE.Group,
  material: THREE.Material,
  componentId?: string
): void {
  assembly.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      // Apply to specific component or all
      if (!componentId || object.parent?.userData.componentId === componentId) {
        object.material = material;
      }
    }
  });
}

/**
 * Restore original materials in assembly
 */
export function restoreMaterialsInAssembly(
  assembly: THREE.Group,
  materialMap: Map<string, THREE.Material>,
  componentId?: string
): void {
  assembly.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const compId = object.parent?.userData.componentId;
      if (!componentId || compId === componentId) {
        const originalMaterial = materialMap.get(compId);
        if (originalMaterial) {
          object.material = originalMaterial;
        }
      }
    }
  });
}

/**
 * Get all components from assembly
 */
export function getAssemblyComponents(assembly: THREE.Group): Array<{
  id: string;
  type: string;
  profile: SVGProfileDefinition;
  position: THREE.Vector3;
}> {
  const components: any[] = [];

  assembly.children.forEach((child) => {
    if (child instanceof THREE.Group && child.userData.componentId) {
      components.push({
        id: child.userData.componentId,
        type: child.userData.componentType,
        profile: child.userData.profile,
        position: child.position.clone(),
      });
    }
  });

  return components;
}

/**
 * Clone component preserving profile and transforms
 */
export function cloneComponent(
  component: THREE.Group,
  newId: string
): THREE.Group | null {
  const profile = component.userData.profile as SVGProfileDefinition;
  const type = component.userData.componentType;

  if (!profile) return null;

  // Clone each mesh
  const cloned = new THREE.Group();
  cloned.userData.componentId = newId;
  cloned.userData.componentType = type;
  cloned.userData.profile = profile;
  cloned.position.copy(component.position);
  cloned.rotation.copy(component.rotation);
  cloned.scale.copy(component.scale);

  component.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      const clonedMesh = child.clone();
      cloned.add(clonedMesh);
    }
  });

  return cloned;
}
