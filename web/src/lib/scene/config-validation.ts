/**
 * Scene Config Validation and Normalization
 * Ensures scene configs are valid before passing to 3D renderer
 */

import type { SceneConfig } from '@/types/scene-config';

/**
 * Validates if a scene config has the minimum required structure
 */
export function isValidSceneConfig(config: any): config is SceneConfig {
  if (!config || typeof config !== 'object') return false;
  
  // Must have dimensions
  if (!config.dimensions || typeof config.dimensions !== 'object') return false;
  if (typeof config.dimensions.width !== 'number') return false;
  if (typeof config.dimensions.height !== 'number') return false;
  
  // Must have materials array
  if (!Array.isArray(config.materials)) return false;
  
  // Must have components array
  if (!Array.isArray(config.components)) return false;
  
  return true;
}

/**
 * Normalizes a scene config, filling in missing required fields with defaults
 */
export function normalizeSceneConfig(config: any): SceneConfig | null {
  if (!config || typeof config !== 'object') {
    console.warn('[normalizeSceneConfig] Config is null or not an object');
    return null;
  }

  try {
    const normalized: any = {
      version: config.version || '1.0',
      updatedAt: config.updatedAt || new Date().toISOString(),
      
      // Dimensions - required
      dimensions: {
        width: config.dimensions?.width || 914,
        height: config.dimensions?.height || 2032,
        depth: config.dimensions?.depth || 45,
        bounds: config.dimensions?.bounds || {
          min: [
            -(config.dimensions?.width || 914) / 2,
            -(config.dimensions?.height || 2032) / 2,
            -(config.dimensions?.depth || 45) / 2
          ],
          max: [
            (config.dimensions?.width || 914) / 2,
            (config.dimensions?.height || 2032) / 2,
            (config.dimensions?.depth || 45) / 2
          ]
        }
      },
      
      // Components - required
      components: Array.isArray(config.components) ? config.components : [],
      
      // Materials - required
      materials: Array.isArray(config.materials) ? config.materials : [],
      
      // Camera - with safe defaults
      camera: {
        mode: config.camera?.mode || 'perspective',
        position: config.camera?.position || [1500, 1000, 1500],
        target: config.camera?.target || [0, 0, 0],
        fov: config.camera?.fov || 45,
        rotation: config.camera?.rotation || [0, 0, 0],
        zoom: config.camera?.zoom || 1,
      },
      
      // Lighting - with safe defaults
      lighting: {
        boundsX: config.lighting?.boundsX || [-750, 750],
        boundsZ: config.lighting?.boundsZ || [-750, 750],
        intensity: config.lighting?.intensity || 1.6,
        ambientIntensity: config.lighting?.ambientIntensity || 0.45,
        shadowCatcherDiameter: config.lighting?.shadowCatcherDiameter || 3000,
        castShadows: config.lighting?.castShadows !== false,
      },
      
      // UI toggles
      ui: {
        axis: config.ui?.axis || false,
        guides: config.ui?.guides || false,
        componentList: config.ui?.componentList !== false,
        dimensions: config.ui?.dimensions !== false,
      },
      
      // Visibility map
      visibility: config.visibility || {},
      
      // Metadata
      metadata: {
        productName: config.metadata?.productName,
        configuredBy: config.metadata?.configuredBy,
        notes: config.metadata?.notes,
      },
    };

    if (!isValidSceneConfig(normalized)) {
      console.error('[normalizeSceneConfig] Normalized config failed validation', normalized);
      return null;
    }

    return normalized as SceneConfig;
  } catch (error) {
    console.error('[normalizeSceneConfig] Error normalizing config:', error);
    return null;
  }
}

/**
 * Creates a minimal valid scene config for a given product type
 */
export function createDefaultSceneConfig(
  categoryId: string,
  width: number = 914,
  height: number = 2032,
  depth: number = 45
): SceneConfig {
  return {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    dimensions: {
      width,
      height,
      depth,
      bounds: {
        min: [-width / 2, -height / 2, -depth / 2],
        max: [width / 2, height / 2, depth / 2],
      },
    },
    components: [],
    materials: [],
    camera: {
      mode: 'perspective' as any,
      position: [1500, 1000, 1500],
      target: [0, 0, 0],
      fov: 45,
      rotation: [0, 0, 0],
      zoom: 1,
    },
    lighting: {
      boundsX: [-750, 750],
      boundsZ: [-750, 750],
      intensity: 1.6,
      ambientIntensity: 0.45,
      shadowCatcherDiameter: 3000,
      castShadows: true,
    },
    ui: {
      axis: false,
      guides: false,
      componentList: true,
      dimensions: true,
    },
    visibility: {},
    metadata: {
      productName: `New ${categoryId}`,
    },
  };
}
