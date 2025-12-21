/**
 * Safe Texture Loading for 3D Materials
 * 
 * Prevents crashes from missing textures by:
 * 1. Validating texture loading success
 * 2. Never applying broken texture objects to materials
 * 3. Providing safe fallback when textures unavailable
 */

import * as THREE from 'three';

interface SafeTextureResult {
  baseMap: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
}

const textureCache = new Map<string, THREE.Texture | null>();
const loadingPromises = new Map<string, Promise<THREE.Texture | null>>();

/**
 * Load a single texture with validation
 * Returns null if texture fails to load or doesn't exist
 */
async function loadSingleTexture(
  path: string, 
  colorSpace: THREE.ColorSpace | null = null
): Promise<THREE.Texture | null> {
  // Check cache first
  if (textureCache.has(path)) {
    return textureCache.get(path) ?? null;
  }

  // Check if already loading
  if (loadingPromises.has(path)) {
    return loadingPromises.get(path)!;
  }

  // SSR safety
  if (typeof window === 'undefined') {
    textureCache.set(path, null);
    return null;
  }

  const loader = new THREE.TextureLoader();
  
  const loadPromise = new Promise<THREE.Texture | null>((resolve) => {
    loader.load(
      path,
      (texture) => {
        // Validate texture loaded successfully
        if (!texture.image || texture.image.width === 0 || texture.image.height === 0) {
          console.warn(`[safe-textures] Texture loaded but invalid: ${path}`);
          textureCache.set(path, null);
          resolve(null);
          return;
        }

        // Configure texture
        if (colorSpace) texture.colorSpace = colorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        
        textureCache.set(path, texture);
        resolve(texture);
      },
      undefined,
      (error) => {
        console.warn(`[safe-textures] Failed to load texture: ${path}`, error?.message ?? error);
        textureCache.set(path, null);
        resolve(null);
      }
    );
  });

  loadingPromises.set(path, loadPromise);
  
  try {
    return await loadPromise;
  } finally {
    loadingPromises.delete(path);
  }
}

/**
 * Load oak texture set with validation
 * Returns null for each texture that fails to load
 * NEVER throws - safe for production use
 */
export async function loadOakTextures(): Promise<SafeTextureResult> {
  try {
    const [baseMap, normalMap, roughnessMap] = await Promise.all([
      loadSingleTexture('/textures/oak_basecolor.jpg', THREE.SRGBColorSpace),
      loadSingleTexture('/textures/oak_normal.jpg'),
      loadSingleTexture('/textures/oak_roughness.jpg'),
    ]);

    return { baseMap, normalMap, roughnessMap };
  } catch (error) {
    console.error('[safe-textures] Unexpected error loading oak textures:', error);
    return { baseMap: null, normalMap: null, roughnessMap: null };
  }
}

/**
 * Synchronous texture loader with fallback
 * Returns null immediately if texture not in cache
 * Safe for use in render functions
 */
export function getTextureSafe(path: string, colorSpace: THREE.ColorSpace | null = null): THREE.Texture | null {
  if (textureCache.has(path)) {
    return textureCache.get(path) ?? null;
  }

  // Start async load in background (cache for next render)
  if (typeof window !== 'undefined' && !loadingPromises.has(path)) {
    loadSingleTexture(path, colorSpace).catch(() => {
      // Already handled in loadSingleTexture
    });
  }

  return null;
}

/**
 * Clear texture cache (useful for testing)
 */
export function clearTextureCache(): void {
  textureCache.clear();
  loadingPromises.clear();
}
