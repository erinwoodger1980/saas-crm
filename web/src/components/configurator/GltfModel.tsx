/**
 * GltfModel Component
 * Renders GLTF/GLB models loaded from asset cache or base64 data
 * Applies material overrides (e.g., polished chrome for ironmongery)
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useAsset } from '@/hooks/useAsset';
import * as THREE from 'three';
import { createPBRMaterial } from '@/lib/scene/materials';
import { MaterialDefinition } from '@/types/scene-config';

interface GltfModelProps {
  /** Asset ID to load (from asset cache) */
  assetId?: string;
  /** Base64-encoded GLB data (alternative to assetId) */
  base64Data?: string;
  /** Position override */
  position?: [number, number, number];
  /** Rotation override (in radians) */
  rotation?: [number, number, number];
  /** Scale override */
  scale?: [number, number, number];
  /** Transform from asset metadata */
  transform?: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  /** Component ID for selection */
  componentId?: string;
  /** Component name */
  componentName?: string;
  /** Selection state */
  isSelected?: boolean;
  /** Click handler */
  onClick?: (e: any) => void;
  /** Material override (e.g., polished chrome for ironmongery) */
  materialOverride?: MaterialDefinition;
}

/**
 * Fallback box shown while loading or on error
 */
function FallbackBox({ position, isSelected, onClick }: any) {
  return (
    <mesh position={position} onClick={onClick} castShadow receiveShadow>
      <boxGeometry args={[100, 100, 100]} />
      <meshStandardMaterial
        color={isSelected ? '#4a90e2' : '#cccccc'}
        emissive={isSelected ? '#4a90e2' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0}
      />
    </mesh>
  );
}

export function GltfModel({
  assetId,
  base64Data,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  transform,
  componentId,
  componentName,
  isSelected,
  onClick,
  materialOverride,
}: GltfModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { objectURL, loading, error } = useAsset(assetId || '');

  // Load from base64 or assetId
  const urlToLoad = useMemo(() => {
    if (base64Data) {
      // Convert base64 to Object URL
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'model/gltf-binary' });
        return URL.createObjectURL(blob);
      } catch {
        console.error('[GltfModel] Failed to decode base64 data');
        return null;
      }
    }
    return objectURL;
  }, [base64Data, objectURL]);

  const gltf = urlToLoad ? useGLTF(urlToLoad) : null;

  // Apply transform from asset metadata + node overrides
  const finalPosition = useMemo(() => {
    if (!transform) return position;
    return [
      position[0] + transform.position[0],
      position[1] + transform.position[1],
      position[2] + transform.position[2],
    ] as [number, number, number];
  }, [position, transform]);

  const finalRotation = useMemo(() => {
    if (!transform) return rotation;
    return [
      rotation[0] + transform.rotation[0],
      rotation[1] + transform.rotation[1],
      rotation[2] + transform.rotation[2],
    ] as [number, number, number];
  }, [rotation, transform]);

  const finalScale = useMemo(() => {
    if (!transform) return scale;
    return [
      scale[0] * transform.scale[0],
      scale[1] * transform.scale[1],
      scale[2] * transform.scale[2],
    ] as [number, number, number];
  }, [scale, transform]);

  // Apply selection highlight and material overrides
  useEffect(() => {
    if (!gltf || !groupRef.current) return;

    groupRef.current.traverse((obj: any) => {
      if (obj.isMesh) {
        // Apply material override (e.g., polished chrome for ironmongery)
        if (materialOverride) {
          const overrideMat = createPBRMaterial(materialOverride);
          obj.material = overrideMat;
          obj.userData.overrideMaterial = overrideMat;
        }

        // Apply selection highlight
        if (isSelected) {
          const mat = obj.material.clone();
          mat.emissive = new THREE.Color('#4a90e2');
          mat.emissiveIntensity = 0.3;
          obj.material = mat;
        } else {
          // Reset to original or override
          if (obj.userData.overrideMaterial) {
            obj.material = obj.userData.overrideMaterial;
          } else if (obj.userData.originalMaterial) {
            obj.material = obj.userData.originalMaterial;
          }
        }
      }
    });
  }, [gltf, isSelected, materialOverride]);

  // Store original materials for reset
  useEffect(() => {
    if (!gltf || !groupRef.current) return;

    groupRef.current.traverse((obj: any) => {
      if (obj.isMesh && !obj.userData.originalMaterial) {
        obj.userData.originalMaterial = obj.material.clone();
      }
    });
  }, [gltf]);

  // Show fallback while loading or on error
  if (loading || error || !gltf) {
    return <FallbackBox position={finalPosition} isSelected={isSelected} onClick={onClick} />;
  }

  return (
    <group
      ref={groupRef}
      position={finalPosition}
      rotation={finalRotation}
      scale={finalScale}
      onClick={onClick}
      userData={{ componentId, componentName }}
    >
      <primitive object={gltf.scene.clone()} />
    </group>
  );
}

// Preload GLTFs to avoid initial lag
useGLTF.preload = (url: string) => {
  // no-op; preloading handled by useAsset hook
};
