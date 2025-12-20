/**
 * Material Factory for Professional 3D Rendering
 * Creates physically-based materials with proper PBR values
 */

import * as THREE from 'three';
import { MaterialDefinition } from '@/types/scene-config';

export interface MaterialConfig {
  type: 'wood' | 'painted' | 'glass' | 'metal' | 'default';
  baseColor: string;
  metalness?: number;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
}

// Texture cache to avoid reloading and to keep SSR-safe fallbacks
const textureCache: Record<string, THREE.Texture | null> = {};
const textureLoader = typeof window !== 'undefined' ? new THREE.TextureLoader() : null;

function loadTexture(path: string, colorSpace: THREE.ColorSpace | null = null): THREE.Texture | null {
  if (textureCache[path] !== undefined) return textureCache[path];
  if (!textureLoader) {
    textureCache[path] = null;
    return null; // SSR-safe fallback
  }
  try {
    const tex = textureLoader.load(path);
    if (colorSpace) tex.colorSpace = colorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    textureCache[path] = tex;
    return tex;
  } catch (e) {
    textureCache[path] = null;
    return null;
  }
}

/**
 * Create professional PBR material from definition
 */
export function createPBRMaterial(def: MaterialDefinition): THREE.Material {
  const color = new THREE.Color(def.baseColor);
  
  switch (def.type) {
    case 'glass':
      return createGlassMaterial(color, def);
      
    case 'metal':
      return createMetalMaterial(color, def);
      
    case 'wood':
      return createTimberMaterial(color, def);
      
    case 'painted':
      return createPaintedMaterial(color, def);
      
    default:
      return createDefaultMaterial(color, def);
  }
}

/**
 * Glass material - physically accurate transmission
 */
function createGlassMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.95,
    transparent: true,
    ior: 1.52, // Standard glass
    thickness: def.thickness || 24, // IGU thickness in mm
    attenuationColor: new THREE.Color('#ffffff').lerp(color, 0.05),
    attenuationDistance: 500,
    envMapIntensity: 1.5,
    clearcoat: 0.1,
    clearcoatRoughness: 0.05,
  });
}

/**
 * Metal material - metallic ironmongery
 */
function createMetalMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  const roughness = def.roughness ?? 0.3;
  
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1.0,
    roughness,
    envMapIntensity: 1.2,
    clearcoat: 0.05,
    clearcoatRoughness: roughness * 0.8,
  });
}

/**
 * Unpainted timber - natural wood
 */
function createTimberMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  const isOak = /oak/i.test(def.name || '') || /oak/i.test(def.id || '');

  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: def.roughness ?? 0.7,
    envMapIntensity: 0.6,
    sheen: 0.1,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color('#ffffff').lerp(color, 0.8),
  });

  if (isOak) {
    const baseMap = loadTexture('/textures/oak_basecolor.jpg', THREE.SRGBColorSpace);
    const normalMap = loadTexture('/textures/oak_normal.jpg');
    const roughnessMap = loadTexture('/textures/oak_roughness.jpg');

    if (baseMap) {
      baseMap.repeat.set(4, 4);
      material.map = baseMap;
    }
    if (normalMap) {
      normalMap.repeat.set(4, 4);
      material.normalMap = normalMap;
    }
    if (roughnessMap) {
      roughnessMap.repeat.set(4, 4);
      material.roughnessMap = roughnessMap;
    }
  }

  return material;
}

/**
 * Painted timber - subtle clearcoat for highlight catch
 */
function createPaintedMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  const isOakPainted = /oak/i.test(def.name || '') || /oak/i.test(def.id || '');

  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: def.roughness ?? 0.55,
    envMapIntensity: 0.8,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
  });

  if (isOakPainted) {
    const baseMap = loadTexture('/textures/oak_basecolor.jpg', THREE.SRGBColorSpace);
    const normalMap = loadTexture('/textures/oak_normal.jpg');
    const roughnessMap = loadTexture('/textures/oak_roughness.jpg');

    if (baseMap) {
      baseMap.repeat.set(3, 3);
      material.map = baseMap;
    }
    if (normalMap) {
      normalMap.repeat.set(3, 3);
      material.normalMap = normalMap;
    }
    if (roughnessMap) {
      roughnessMap.repeat.set(3, 3);
      material.roughnessMap = roughnessMap;
    }
  }

  return material;
}

/**
 * Default material fallback
 */
function createDefaultMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: def.metalness ?? 0,
    roughness: def.roughness ?? 0.6,
    envMapIntensity: 0.8,
  });
}

/**
 * Material presets library
 */
export const MATERIAL_PRESETS = {
  // Painted finishes
  'ral-9016': { type: 'painted' as const, baseColor: '#F1F0EA', roughness: 0.5 },
  'ral-9010': { type: 'painted' as const, baseColor: '#F7F6F1', roughness: 0.5 },
  'ral-7016': { type: 'painted' as const, baseColor: '#383E42', roughness: 0.45 },
  
  // Timbers
  'oak-natural': { type: 'wood' as const, baseColor: '#C19A6B', roughness: 0.7 },
  'oak-light': { type: 'wood' as const, baseColor: '#D4A574', roughness: 0.65 },
  'pine': { type: 'wood' as const, baseColor: '#E9C893', roughness: 0.75 },
  
  // Glass
  'clear-glass': { type: 'glass' as const, baseColor: '#F8F8FF', thickness: 24 },
  'tinted-grey': { type: 'glass' as const, baseColor: '#E8E8E8', thickness: 24 },
  
  // Metals
  'brushed-nickel': { type: 'metal' as const, baseColor: '#C0C0C0', roughness: 0.3 },
  'polished-chrome': { type: 'metal' as const, baseColor: '#D0D0D0', roughness: 0.1 },
  'bronze': { type: 'metal' as const, baseColor: '#CD7F32', roughness: 0.4 },
};
