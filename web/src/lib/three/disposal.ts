/**
 * WebGL Resource Disposal Utilities
 * Ensures proper cleanup of Three.js resources to prevent memory leaks and context loss
 */

import * as THREE from 'three';

/**
 * Recursively dispose all geometries, materials, and textures in a scene
 */
export function disposeScene(scene: THREE.Scene | THREE.Object3D): void {
  scene.traverse((object) => {
    // Dispose geometry
    if ((object as any).geometry) {
      (object as any).geometry.dispose();
    }

    // Dispose material(s)
    if ((object as any).material) {
      const materials = Array.isArray((object as any).material) 
        ? (object as any).material 
        : [(object as any).material];
      
      materials.forEach((material: THREE.Material) => {
        disposeMaterial(material);
      });
    }
  });
}

/**
 * Dispose a material and all its maps/textures
 */
export function disposeMaterial(material: THREE.Material): void {
  // Dispose all texture maps
  Object.keys(material).forEach((key) => {
    const value = (material as any)[key];
    if (value && value instanceof THREE.Texture) {
      value.dispose();
    }
  });
  
  // Dispose the material itself
  material.dispose();
}

/**
 * Dispose a renderer and all its resources
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer): void {
  // Dispose render lists
  renderer.renderLists.dispose();
  
  // Dispose the renderer
  renderer.dispose();
  
  // Clear references
  renderer.domElement.remove();
}

/**
 * Texture cache to prevent loading same texture multiple times
 */
class TextureCache {
  private cache = new Map<string, THREE.Texture>();
  private textureLoader = new THREE.TextureLoader();

  load(url: string): THREE.Texture {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    const texture = this.textureLoader.load(url);
    this.cache.set(url, texture);
    return texture;
  }

  dispose(): void {
    this.cache.forEach((texture) => {
      texture.dispose();
    });
    this.cache.clear();
  }

  remove(url: string): void {
    const texture = this.cache.get(url);
    if (texture) {
      texture.dispose();
      this.cache.delete(url);
    }
  }
}

// Global texture cache instance
export const textureCache = new TextureCache();

/**
 * Material cache to prevent recreating same materials
 */
class MaterialCache {
  private cache = new Map<string, THREE.Material>();

  get(key: string): THREE.Material | undefined {
    return this.cache.get(key);
  }

  set(key: string, material: THREE.Material): void {
    this.cache.set(key, material);
  }

  dispose(): void {
    this.cache.forEach((material) => {
      disposeMaterial(material);
    });
    this.cache.clear();
  }

  remove(key: string): void {
    const material = this.cache.get(key);
    if (material) {
      disposeMaterial(material);
      this.cache.delete(key);
    }
  }
}

// Global material cache instance
export const materialCache = new MaterialCache();
