/**
 * Lighting Configuration Normalization
 * Ensures lighting config is always valid with safe defaults
 * Prevents crashes from malformed data
 */

import { LightingConfig } from '@/types/scene-config';

const DEFAULT_BOUNDS_X: [number, number] = [-750, 750];
const DEFAULT_BOUNDS_Z: [number, number] = [-750, 750];
const DEFAULT_INTENSITY = 1.6;
const DEFAULT_SHADOW_DIAMETER = 3000;
const DEFAULT_AMBIENT = 0.45;

/**
 * Normalize lighting configuration with safe defaults
 * Validates all fields and converts bad values to correct structure
 * 
 * @param input - Raw lighting config (may be partial or malformed)
 * @returns Fully valid LightingConfig with all required fields
 */
export function normalizeLightingConfig(input: unknown): LightingConfig {
  const config = (input && typeof input === 'object' ? input : {}) as Partial<LightingConfig>;
  
  // Normalize boundsX
  let boundsX: [number, number] = DEFAULT_BOUNDS_X;
  if (Array.isArray(config.boundsX) && config.boundsX.length === 2) {
    const [x0, x1] = config.boundsX;
    if (typeof x0 === 'number' && typeof x1 === 'number' && Number.isFinite(x0) && Number.isFinite(x1)) {
      boundsX = [x0, x1];
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Lighting] invalid boundsX', { value: config.boundsX });
      }
    }
  } else if (config.boundsX !== undefined && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] boundsX must be [number, number] tuple', { value: config.boundsX });
  }
  
  // Normalize boundsZ
  let boundsZ: [number, number] = DEFAULT_BOUNDS_Z;
  if (Array.isArray(config.boundsZ) && config.boundsZ.length === 2) {
    const [z0, z1] = config.boundsZ;
    if (typeof z0 === 'number' && typeof z1 === 'number' && Number.isFinite(z0) && Number.isFinite(z1)) {
      boundsZ = [z0, z1];
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Lighting] invalid boundsZ', { value: config.boundsZ });
      }
    }
  } else if (config.boundsZ !== undefined && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] boundsZ must be [number, number] tuple', { value: config.boundsZ });
  }
  
  // Normalize intensity
  let intensity = DEFAULT_INTENSITY;
  if (typeof config.intensity === 'number' && Number.isFinite(config.intensity) && config.intensity > 0) {
    intensity = config.intensity;
  } else if (config.intensity !== undefined && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] invalid intensity', { value: config.intensity });
  }
  
  // Normalize shadowCatcherDiameter
  let shadowCatcherDiameter = DEFAULT_SHADOW_DIAMETER;
  if (typeof config.shadowCatcherDiameter === 'number' && Number.isFinite(config.shadowCatcherDiameter) && config.shadowCatcherDiameter > 0) {
    shadowCatcherDiameter = config.shadowCatcherDiameter;
  } else if (config.shadowCatcherDiameter !== undefined && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] invalid shadowCatcherDiameter', { value: config.shadowCatcherDiameter });
  }
  
  // Normalize ambientIntensity
  let ambientIntensity = DEFAULT_AMBIENT;
  if (typeof config.ambientIntensity === 'number' && Number.isFinite(config.ambientIntensity) && config.ambientIntensity >= 0) {
    ambientIntensity = config.ambientIntensity;
  } else if (config.ambientIntensity !== undefined && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] invalid ambientIntensity', { value: config.ambientIntensity });
  }
  
  // Normalize castShadows
  const castShadows = typeof config.castShadows === 'boolean' ? config.castShadows : true;
  
  return {
    boundsX,
    boundsZ,
    intensity,
    shadowCatcherDiameter,
    ambientIntensity,
    castShadows,
  };
}

/**
 * Create lighting config from product dimensions
 * Used when initializing new scenes
 */
export function createLightingFromDimensions(
  width: number,
  height: number,
  depth: number
): LightingConfig {
  const boundsX: [number, number] = [(-width / 2) * 1.5, (width / 2) * 1.5];
  const boundsZ: [number, number] = [(-depth / 2) * 1.5, (depth / 2) * 1.5];
  const shadowCatcherDiameter = Math.max(width, height) * 2;
  
  return normalizeLightingConfig({
    boundsX,
    boundsZ,
    intensity: 1.6,
    shadowCatcherDiameter,
    ambientIntensity: 0.45,
    castShadows: true,
  });
}
