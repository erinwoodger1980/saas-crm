/**
 * SceneDisposer - Ensures complete WebGL cleanup on unmount
 * Prevents context loss by disposing all geometries, materials, and textures
 */

'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Dispose a material and ALL its texture maps
 */
function disposeMaterial(m: THREE.Material): void {
  const anyM = m as any;
  
  // Dispose all common texture maps
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'aoMap', 
   'alphaMap', 'envMap', 'lightMap', 'emissiveMap', 'displacementMap', 
   'specularMap', 'gradientMap'].forEach(key => {
    if (anyM[key]) {
      anyM[key].dispose?.();
      anyM[key] = null;
    }
  });
  
  m.dispose();
}

/**
 * SceneDisposer component - mounts inside Canvas to clean up on unmount
 */
export function SceneDisposer() {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[SceneDisposer] Cleaning up ALL WebGL resources...');
      }
      
      // Traverse scene and dispose everything
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
      
      // Clear render lists
      if (gl.renderLists) {
        gl.renderLists.dispose();
      }
      
      // Dispose renderer
      gl.dispose();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[SceneDisposer] Cleanup complete');
      }
    };
  }, [gl, scene]);
  
  return null;
}
