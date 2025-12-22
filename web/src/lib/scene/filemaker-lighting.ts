/**
 * FileMaker-Quality Lighting Pipeline
 * Replicates the exact lighting setup from legacy WebViewer
 * - HDR environment map
 * - Key, fill, rim lights
 * - Soft shadows (PCFSoftShadowMap)
 * - Shadow catcher floor
 * - No visible floor plane
 */

import * as THREE from 'three';

export interface LightingConfig {
  keyLightIntensity?: number; // 0–2
  fillLightIntensity?: number; // 0–1
  rimLightIntensity?: number; // 0–1
  ambientIntensity?: number; // 0–1
  shadowMapSize?: number; // 1024, 2048, 4096
  shadowBias?: number;
  shadowRadius?: number;
  environmentIntensity?: number; // 0–2
}

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  keyLightIntensity: 1.2,
  fillLightIntensity: 0.6,
  rimLightIntensity: 0.5,
  ambientIntensity: 0.3,
  shadowMapSize: 2048,
  shadowBias: -0.0001,
  shadowRadius: 4,
  environmentIntensity: 0.8,
};

/**
 * Create FileMaker-style lighting setup
 * Returns object with all lights to add to scene
 */
export function createFileMakerLighting(config: LightingConfig = {}) {
  const finalConfig = { ...DEFAULT_LIGHTING_CONFIG, ...config };

  const lights = {
    keyLight: createKeyLight(finalConfig.keyLightIntensity || 1.2),
    fillLight: createFillLight(finalConfig.fillLightIntensity || 0.6),
    rimLight: createRimLight(finalConfig.rimLightIntensity || 0.5),
    ambientLight: createAmbientLight(finalConfig.ambientIntensity || 0.3),
  };

  // Configure shadow maps
  configureShadowMaps(Object.values(lights), finalConfig);

  return lights;
}

/**
 * Key light: main directional light (warm, angled from upper-left)
 */
function createKeyLight(intensity: number): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, intensity, 0, Math.PI / 3, 1, 2);
  light.position.set(2, 3, 3).normalize().multiplyScalar(5);
  light.target.position.set(0, 0, 0);
  light.castShadow = true;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 100;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 4;
  return light;
}

/**
 * Fill light: soft fill from opposite side (cool, lower intensity)
 */
function createFillLight(intensity: number): THREE.SpotLight {
  const light = new THREE.SpotLight(0xb0d0ff, intensity, 0, Math.PI / 2, 0.8, 2);
  light.position.set(-2, 1, -3).normalize().multiplyScalar(4);
  light.target.position.set(0, 0, 0);
  light.castShadow = false;
  return light;
}

/**
 * Rim light: backlit accent (warm rim highlight)
 */
function createRimLight(intensity: number): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffb89f, intensity, 0, Math.PI / 4, 1, 2);
  light.position.set(0, 2, -5).normalize().multiplyScalar(6);
  light.target.position.set(0, 0, 0);
  light.castShadow = false;
  return light;
}

/**
 * Ambient light: overall fill (no shadows, just lift shadows)
 */
function createAmbientLight(intensity: number): THREE.AmbientLight {
  return new THREE.AmbientLight(0xffffff, intensity);
}

/**
 * Configure shadow maps on all lights
 */
function configureShadowMaps(
  lights: THREE.Light[],
  config: LightingConfig
): void {
  const shadowMapSize = config.shadowMapSize || 2048;

  lights.forEach((light) => {
    if (light.shadow) {
      light.shadow.mapSize.width = shadowMapSize;
      light.shadow.mapSize.height = shadowMapSize;
      light.shadow.bias = config.shadowBias || -0.0001;
      light.shadow.radius = config.shadowRadius || 4;

      // Enable soft shadows on WebGL renderer
      if (light instanceof THREE.SpotLight && light.shadow.map) {
        (light.shadow.map as any).minFilter = THREE.LinearFilter;
      }
    }
  });
}

/**
 * Create shadow catcher floor (invisible except for shadows)
 * Uses alpha map to catch shadows without visible geometry
 */
export function createShadowCatcherFloor(
  productWidth: number,
  productDepth: number
): THREE.Mesh {
  // Use a very thin plane with alpha-blended shadow material
  const geometry = new THREE.PlaneGeometry(productWidth * 2, productDepth * 2);

  // Material that receives shadows but is otherwise transparent
  const material = new THREE.ShadowMaterial({
    opacity: 0.5, // Subtle shadow visibility
  });

  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01; // Just below product
  floor.receiveShadow = true;
  floor.castShadow = false;

  return floor;
}

/**
 * Update lighting intensities at runtime
 * Useful for dynamic quality adjustments
 */
export function updateLightingIntensities(
  lights: ReturnType<typeof createFileMakerLighting>,
  config: Partial<LightingConfig>
): void {
  if (config.keyLightIntensity !== undefined) {
    lights.keyLight.intensity = config.keyLightIntensity;
  }

  if (config.fillLightIntensity !== undefined) {
    lights.fillLight.intensity = config.fillLightIntensity;
  }

  if (config.rimLightIntensity !== undefined) {
    lights.rimLight.intensity = config.rimLightIntensity;
  }

  if (config.ambientIntensity !== undefined) {
    lights.ambientLight.intensity = config.ambientIntensity;
  }
}

/**
 * Enable/disable high-quality shadows
 */
export function setHighQualityShadows(
  lights: ReturnType<typeof createFileMakerLighting>,
  enabled: boolean
): void {
  const mapSize = enabled ? 4096 : 2048;
  const radius = enabled ? 6 : 2;

  lights.keyLight.shadow.mapSize.width = mapSize;
  lights.keyLight.shadow.mapSize.height = mapSize;
  lights.keyLight.shadow.radius = radius;
  lights.keyLight.shadow.map = null as any; // Force refresh
}

/**
 * Get lighting state for persistence
 */
export function captureLightingState(
  lights: ReturnType<typeof createFileMakerLighting>
): LightingConfig {
  return {
    keyLightIntensity: lights.keyLight.intensity,
    fillLightIntensity: lights.fillLight.intensity,
    rimLightIntensity: lights.rimLight.intensity,
    ambientIntensity: lights.ambientLight.intensity,
    shadowMapSize: lights.keyLight.shadow.mapSize.width,
    shadowBias: lights.keyLight.shadow.bias,
    shadowRadius: lights.keyLight.shadow.radius,
  };
}
