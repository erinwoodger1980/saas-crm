/**
 * Lighting Component
 * Studio-quality 3-point lighting setup
 * Soft shadows, physically accurate, scaled to product extents
 * Uses ContactShadows to eliminate shadow catching plane z-fighting
 */

'use client';

import { useMemo } from 'react';
import { ContactShadows } from '@react-three/drei';
import { LightingConfig } from '@/types/scene-config';
import * as THREE from 'three';
import { applyShadowCatcherHints } from '@/lib/render/renderHints';

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
   * Studio 3-point setup: Key, Fill, Rim
   */
  const lightPositions = useMemo(() => {
    const centerX = (boundsX[0] + boundsX[1]) / 2;
    const centerZ = (boundsZ[0] + boundsZ[1]) / 2;
    const extentX = Math.abs(boundsX[1] - boundsX[0]);
    const extentZ = Math.abs(boundsZ[1] - boundsZ[0]);
    const maxExtent = Math.max(extentX, extentZ);

    // Studio lighting scaled to product size
    const keyLightY = maxExtent * 1.2; // Higher for softer shadows
    const keyLightDistance = maxExtent * 1.5; // Further for softer light

    return {
      // Key light - main source (45° from front, elevated)
      key: [centerX + keyLightDistance * 0.7, keyLightY, centerZ + keyLightDistance * 0.7] as [number, number, number],
      // Fill light - softer from opposite side (reduces harsh shadows)
      fill: [centerX - keyLightDistance * 0.5, keyLightY * 0.6, centerZ + keyLightDistance * 0.6] as [number, number, number],
      // Rim light - back highlight for depth separation
      rim: [centerX - keyLightDistance * 0.3, keyLightY * 0.8, centerZ - keyLightDistance * 0.9] as [number, number, number],
      // Shadow camera frustum
      shadowCamera: {
        left: boundsX[0] - extentX * 0.5,
        right: boundsX[1] + extentX * 0.5,
        top: boundsZ[1] + extentZ * 0.5,
        bottom: boundsZ[0] - extentZ * 0.5,
        far: maxExtent * 4,
      },
    };
  }, [boundsX, boundsZ]);

  return (
    <>
      {/* Ambient light - soft studio fill */}
      <ambientLight intensity={ambientIntensity * 0.9} color="#f8f6f0" />

      {/* Key light - primary studio light (like large softbox) */}
      <directionalLight
        position={lightPositions.key}
        intensity={intensity * 2.6}
        color="#fffef8"
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
        shadow-radius={10}
        shadow-normalBias={0.01}
      />

      {/* Fill light - reduces contrast, softens shadows */}
      <directionalLight
        position={lightPositions.fill}
        intensity={intensity * 1.1}
        color="#fff9ed"
      />

      {/* Rim light - back highlight for crisp edges */}
      <directionalLight
        position={lightPositions.rim}
        intensity={intensity * 0.8}
        color="#fffef8"
      />

      {/* Contact Shadows - physically accurate shadow casting without z-fighting */}
      {castShadows && (
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.15}
          scale={shadowCatcherDiameter * 2}
          blur={8}
          far={Math.max(...lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
          resolution={1024}
          color="#000000"
        />
      )}
    </>
  );
}
