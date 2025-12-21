/**
 * Material Factory for Professional 3D Rendering
 * Creates physically-based materials with proper PBR values
 * ENHANCED: Wood materials with texture maps, realistic roughness, and reduced shininess
 */

import * as THREE from 'three';
import { MaterialDefinition } from '@/types/scene-config';
import { getTextureSafe } from './safe-textures';

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

// Wood material constants - realistic wood properties
const WOOD_BASE_ROUGHNESS = 0.75; // Matte wood surface
const WOOD_METALNESS = 0; // Wood is not metallic
const WOOD_ENV_MAP_INTENSITY = 0.4; // Reduce glossiness
const WOOD_CLEARCOAT = 0; // No clear coat on natural wood
const WOOD_GRAIN_SCALE = 300; // Repeat grain every ~300mm

// Painted timber constants - realistic painted wood
const PAINTED_WOOD_ROUGHNESS = 0.55; // Slightly smoother than raw wood
const PAINTED_WOOD_CLEARCOAT = 0.08; // Minimal clearcoat for subtle highlights
const PAINTED_WOOD_CLEARCOAT_ROUGHNESS = 0.4;
const PAINTED_WOOD_ENV_MAP_INTENSITY = 0.3;

// Oak material fallback constants - used when textures unavailable
const OAK_FALLBACK_COLOR = '#C19A6B'; // Natural oak tone
const OAK_FALLBACK_ROUGHNESS = WOOD_BASE_ROUGHNESS;
const OAK_FALLBACK_METALNESS = WOOD_METALNESS;

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
 * Calculate texture repeat scale based on dimension
 * Repeats grain every ~300mm for realistic wood grain
 */
function calculateTextureRepeat(dimMm: number = 1000): number {
  return Math.max(1, Math.round(dimMm / WOOD_GRAIN_SCALE));
}

/**
 * Unpainted timber - natural wood with grain texture
 * ENHANCED: Reduced shininess, wood grain textures, realistic clearcoat
 * SAFE: Falls back to flat color if textures unavailable
 */
function createTimberMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  const isOak = /oak/i.test(def.name || '') || /oak/i.test(def.id || '');

  // Base material with realistic wood properties
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: WOOD_METALNESS,
    roughness: def.roughness ?? WOOD_BASE_ROUGHNESS,
    envMapIntensity: WOOD_ENV_MAP_INTENSITY,
    clearcoat: WOOD_CLEARCOAT,
    sheen: 0,
    sheenRoughness: 0,
  });

  if (isOak) {
    // Safe texture loading - returns null if not loaded yet or failed
    const baseMap = getTextureSafe('/textures/oak_basecolor.jpg', THREE.SRGBColorSpace);
    const normalMap = getTextureSafe('/textures/oak_normal.jpg');
    const roughnessMap = getTextureSafe('/textures/oak_roughness.jpg');

    let texturesApplied = false;

    // Calculate repeat scale for realistic grain
    const dimMm = (def as any).dimensions?.[0] ?? 1000;
    const repeatScale = calculateTextureRepeat(dimMm);

    // Only apply textures if they loaded successfully AND have valid image data
    if (baseMap?.image && (baseMap.image as any).width > 0) {
      baseMap.repeat.set(repeatScale, repeatScale);
      baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
      material.map = baseMap;
      texturesApplied = true;
    }
    if (normalMap?.image && (normalMap.image as any).width > 0) {
      normalMap.repeat.set(repeatScale, repeatScale);
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      material.normalMap = normalMap;
      material.normalScale.set(0.8, 0.8); // Subtle normal bump
      texturesApplied = true;
    }
    if (roughnessMap?.image && (roughnessMap.image as any).width > 0) {
      roughnessMap.repeat.set(repeatScale, repeatScale);
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
      material.roughnessMap = roughnessMap;
      texturesApplied = true;
    }

    // Debug logging for texture fallback
    if (!texturesApplied && process.env.NODE_ENV === 'development') {
      console.log(
        `[materials] Oak timber using fallback color ${OAK_FALLBACK_COLOR} - textures not loaded`
      );
    }
  }

  return material;
}

/**
 * Painted timber - subtle clearcoat for highlight catch
 * ENHANCED: Realistic painted wood with mild sheen
 * SAFE: Falls back to flat color if textures unavailable
 */
function createPaintedMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  const isOakPainted = /oak/i.test(def.name || '') || /oak/i.test(def.id || '');

  // Base material with realistic painted wood properties
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: WOOD_METALNESS,
    roughness: def.roughness ?? PAINTED_WOOD_ROUGHNESS,
    envMapIntensity: PAINTED_WOOD_ENV_MAP_INTENSITY,
    clearcoat: PAINTED_WOOD_CLEARCOAT,
    clearcoatRoughness: PAINTED_WOOD_CLEARCOAT_ROUGHNESS,
  });

  if (isOakPainted) {
    // Safe texture loading - returns null if not loaded yet or failed
    const baseMap = getTextureSafe('/textures/oak_basecolor.jpg', THREE.SRGBColorSpace);
    const normalMap = getTextureSafe('/textures/oak_normal.jpg');
    const roughnessMap = getTextureSafe('/textures/oak_roughness.jpg');

    let texturesApplied = false;

    // Calculate repeat scale for realistic grain visibility under paint
    const dimMm = (def as any).dimensions?.[0] ?? 1000;
    const repeatScale = Math.max(1, calculateTextureRepeat(dimMm) * 0.8); // Slightly less prominent

    // Only apply textures if they loaded successfully AND have valid image data
    if (baseMap?.image && (baseMap.image as any).width > 0) {
      baseMap.repeat.set(repeatScale, repeatScale);
      baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
      material.map = baseMap;
      texturesApplied = true;
    }
    if (normalMap?.image && (normalMap.image as any).width > 0) {
      normalMap.repeat.set(repeatScale, repeatScale);
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      material.normalMap = normalMap;
      material.normalScale.set(0.3, 0.3); // Very subtle under paint
      texturesApplied = true;
    }
    if (roughnessMap?.image && (roughnessMap.image as any).width > 0) {
      roughnessMap.repeat.set(repeatScale, repeatScale);
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
      material.roughnessMap = roughnessMap;
      texturesApplied = true;
    }

    // Debug logging for texture fallback
    if (!texturesApplied && process.env.NODE_ENV === 'development') {
      console.log(
        `[materials] Oak painted using fallback color ${color.getHexString()} - textures not loaded`
      );
    }
  }

  return material;
}

/**
 * Default fallback material
 */
function createDefaultMaterial(color: THREE.Color, def: MaterialDefinition): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.5,
    envMapIntensity: 0.5,
  });
}

/**
 * Material presets - common colors for different wood types and finishes
 * Used as fallback when specific material not defined
 * 
 * ENHANCED: Updated PBR values for realistic wood appearance
 * - Wood materials use matte finish (roughness 0.65-0.85, clearcoat 0, low envMapIntensity)
 * - Painted materials use subtle clearcoat (0.05-0.15) for finish highlight
 * - All materials use cached textures via safe-textures.ts
 */
export const MATERIAL_PRESETS: Record<string, MaterialDefinition> = {
  'oak-natural': {
    name: 'Oak Natural',
    type: 'wood',
    id: 'oak-natural',
    baseColor: '#C19A6B',
    roughness: WOOD_BASE_ROUGHNESS, // 0.75 - matte natural wood
    metalness: WOOD_METALNESS, // 0
  },
  'oak-light': {
    name: 'Oak Light',
    type: 'wood',
    id: 'oak-light',
    baseColor: '#D4A574',
    roughness: 0.70, // Slightly less rough
    metalness: 0,
  },
  'oak-dark': {
    name: 'Oak Dark',
    type: 'wood',
    id: 'oak-dark',
    baseColor: '#8B6914',
    roughness: 0.80, // Slightly more textured
    metalness: 0,
  },
  'pine-natural': {
    name: 'Pine Natural',
    type: 'wood',
    id: 'pine-natural',
    baseColor: '#E9C893',
    roughness: 0.75,
    metalness: 0,
  },
  'walnut': {
    name: 'Walnut',
    type: 'wood',
    id: 'walnut',
    baseColor: '#5D4037',
    roughness: 0.75,
    metalness: 0,
  },
  'teak': {
    name: 'Teak',
    type: 'wood',
    id: 'teak',
    baseColor: '#B5A642',
    roughness: 0.70,
    metalness: 0,
  },
  'painted-white': {
    name: 'Painted White',
    type: 'painted',
    id: 'painted-white',
    baseColor: '#F5F5F5',
    roughness: PAINTED_WOOD_ROUGHNESS, // 0.55
    clearcoat: PAINTED_WOOD_CLEARCOAT, // 0.08 - subtle finish
    metalness: 0,
  },
  'painted-cream': {
    name: 'Painted Cream',
    type: 'painted',
    id: 'painted-cream',
    baseColor: '#FFFDD0',
    roughness: PAINTED_WOOD_ROUGHNESS,
    clearcoat: PAINTED_WOOD_CLEARCOAT,
    metalness: 0,
  },
  'painted-black': {
    name: 'Painted Black',
    type: 'painted',
    id: 'painted-black',
    baseColor: '#1A1A1A',
    roughness: PAINTED_WOOD_ROUGHNESS,
    clearcoat: PAINTED_WOOD_CLEARCOAT,
    metalness: 0,
  },
  'painted-grey': {
    name: 'Painted Grey',
    type: 'painted',
    id: 'painted-grey',
    baseColor: '#808080',
    roughness: PAINTED_WOOD_ROUGHNESS,
    clearcoat: PAINTED_WOOD_CLEARCOAT,
    metalness: 0,
  },
  'glass-clear': {
    name: 'Glass Clear',
    type: 'glass',
    id: 'glass-clear',
    baseColor: '#E8F4F8',
    transmission: 0.95,
    ior: 1.52,
    thickness: 24,
  },
  'glass-tinted': {
    name: 'Glass Tinted',
    type: 'glass',
    id: 'glass-tinted',
    baseColor: '#B0E0E6',
    transmission: 0.85,
    ior: 1.52,
    thickness: 24,
  },
  'stainless-steel': {
    name: 'Stainless Steel',
    type: 'metal',
    id: 'stainless-steel',
    baseColor: '#CCCCCC',
    metalness: 1.0,
    roughness: 0.2,
  },
  'bronze': {
    name: 'Bronze',
    type: 'metal',
    id: 'bronze',
    baseColor: '#CD7F32',
    metalness: 1.0,
    roughness: 0.3,
  },
};
