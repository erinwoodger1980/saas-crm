/**
 * Lighting Component
 * Dynamic lighting scaled to product extents
 * Matches FileMaker light positioning logic
 */

'use client';

import { useMemo } from 'react';
import { LightingConfig } from '@/types/scene-config';
import * as THREE from 'three';

interface LightingProps {
  config: LightingConfig;
}

export function Lighting({ config }: LightingProps) {
  const {
    boundsX,
    boundsZ,
    intensity,
    shadowCatcherDiameter,
    ambientIntensity,
    castShadows,
  } = config;

  /**
   * Calculate light positions based on product bounds
   * Lights scale dynamically - no hard-coded positions
   */
  const lightPositions = useMemo(() => {
    const centerX = (boundsX[0] + boundsX[1]) / 2;
    const centerZ = (boundsZ[0] + boundsZ[1]) / 2;
    const extentX = Math.abs(boundsX[1] - boundsX[0]);
    const extentZ = Math.abs(boundsZ[1] - boundsZ[0]);
    const maxExtent = Math.max(extentX, extentZ);

    // Key light position - scales with product size
    const keyLightY = maxExtent * 0.8;
    const keyLightDistance = maxExtent * 0.7;

    return {
      key: [centerX + keyLightDistance, keyLightY, centerZ + keyLightDistance] as [number, number, number],
      fill: [centerX - keyLightDistance * 0.6, keyLightY * 0.5, centerZ + keyLightDistance * 0.8] as [number, number, number],
      rim: [centerX - keyLightDistance * 0.4, keyLightY * 0.6, centerZ - keyLightDistance] as [number, number, number],
      shadowCamera: {
        left: boundsX[0],
        right: boundsX[1],
        top: boundsZ[1],
        bottom: boundsZ[0],
        far: maxExtent * 3,
      },
    };
  }, [boundsX, boundsZ]);

  return (
    <>
      {/* Ambient light - soft natural indoor lighting */}
      <ambientLight intensity={ambientIntensity} color="#faf8f0" />

      {/* Key light - main directional light */}
      <directionalLight
        position={lightPositions.key}
        intensity={intensity}
        color="#fffdf5"
        castShadow={castShadows}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={lightPositions.shadowCamera.left}
        shadow-camera-right={lightPositions.shadowCamera.right}
        shadow-camera-top={lightPositions.shadowCamera.top}
        shadow-camera-bottom={lightPositions.shadowCamera.bottom}
        shadow-camera-near={0.1}
        shadow-camera-far={lightPositions.shadowCamera.far}
        shadow-bias={-0.00005}
        shadow-radius={2}
      />

      {/* Fill light - softer from opposite side */}
      <directionalLight
        position={lightPositions.fill}
        intensity={intensity * 0.4}
        color="#fff9ed"
      />

      {/* Rim light - subtle back lighting for depth */}
      <directionalLight
        position={lightPositions.rim}
        intensity={intensity * 0.25}
        color="#fffef8"
      />

      {/* Shadow catcher plane */}
      {castShadows && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -shadowCatcherDiameter / 4, 0]}
          receiveShadow
        >
          <circleGeometry args={[shadowCatcherDiameter / 2, 64]} />
          <shadowMaterial opacity={0.2} />
        </mesh>
      )}
    </>
  );
}
