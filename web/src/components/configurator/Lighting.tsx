/**
 * Lighting Component
 * Studio-quality 3-point lighting setup
 * Soft shadows, physically accurate, scaled to product extents
 * Uses ContactShadows to eliminate shadow catching plane z-fighting
 * 
 * Bulletproof against malformed LightingConfig from both Settings
 * and Quote flows. Sanitizes + validates all inputs at runtime.
 */

'use client';

import { useMemo } from 'react';
import { ContactShadows } from '@react-three/drei';
import { LightingConfig } from '@/types/scene-config';
import * as THREE from 'three';
import { applyShadowCatcherHints } from '@/lib/render/renderHints';

/**
 * Sanitize LightingConfig to ensure all values are valid and finite.
 * Fixes malformed data (e.g. boundsX as single number) with sensible defaults.
 */
export function sanitizeLightingConfig(config: unknown): LightingConfig {
  const input = (config && typeof config === 'object' ? config : {}) as Partial<LightingConfig>;

  // Sanitize boundsX: must be [number, number] tuple
  let boundsX: [number, number] = [-1000, 1000];
  if (
    Array.isArray(input.boundsX) &&
    input.boundsX.length === 2 &&
    typeof input.boundsX[0] === 'number' &&
    typeof input.boundsX[1] === 'number' &&
    Number.isFinite(input.boundsX[0]) &&
    Number.isFinite(input.boundsX[1])
  ) {
    boundsX = [input.boundsX[0], input.boundsX[1]];
  } else if (typeof input.boundsX === 'number' && Number.isFinite(input.boundsX)) {
    // Single number: treat as extent
    const extent = Math.abs(input.boundsX);
    boundsX = [-extent, extent];
  }

  // Sanitize boundsZ: must be [number, number] tuple
  let boundsZ: [number, number] = [-1000, 1000];
  if (
    Array.isArray(input.boundsZ) &&
    input.boundsZ.length === 2 &&
    typeof input.boundsZ[0] === 'number' &&
    typeof input.boundsZ[1] === 'number' &&
    Number.isFinite(input.boundsZ[0]) &&
    Number.isFinite(input.boundsZ[1])
  ) {
    boundsZ = [input.boundsZ[0], input.boundsZ[1]];
  } else if (typeof input.boundsZ === 'number' && Number.isFinite(input.boundsZ)) {
    // Single number: treat as extent
    const extent = Math.abs(input.boundsZ);
    boundsZ = [-extent, extent];
  }

  // Sanitize shadowCatcherDiameter: must be finite number >= 500
  let shadowCatcherDiameter = 2000;
  if (typeof input.shadowCatcherDiameter === 'number' && Number.isFinite(input.shadowCatcherDiameter)) {
    shadowCatcherDiameter = Math.max(500, input.shadowCatcherDiameter);
  }

  // Sanitize intensity: must be finite number, 0-10 range
  let intensity = 1.6;
  if (typeof input.intensity === 'number' && Number.isFinite(input.intensity)) {
    intensity = Math.max(0, Math.min(10, input.intensity));
  }

  // Sanitize ambientIntensity: must be finite number, 0-10 range
  let ambientIntensity = 0.45;
  if (typeof input.ambientIntensity === 'number' && Number.isFinite(input.ambientIntensity)) {
    ambientIntensity = Math.max(0, Math.min(10, input.ambientIntensity));
  }

  // Sanitize castShadows: must be boolean
  const castShadows = typeof input.castShadows === 'boolean' ? input.castShadows : true;

  // Detect if sanitization changed values
  const changed =
    !Array.isArray(input.boundsX) ||
    !Array.isArray(input.boundsZ) ||
    typeof input.intensity !== 'number' ||
    typeof input.ambientIntensity !== 'number' ||
    typeof input.castShadows !== 'boolean' ||
    typeof input.shadowCatcherDiameter !== 'number';

  if (changed && process.env.NODE_ENV === 'development') {
    console.warn('[Lighting] Invalid config, sanitized', {
      original: input,
      sanitized: { boundsX, boundsZ, intensity, ambientIntensity, shadowCatcherDiameter, castShadows },
    });
  }

  return {
    boundsX,
    boundsZ,
    intensity,
    ambientIntensity,
    shadowCatcherDiameter,
    castShadows,
  };
}

/**
 * Safe fallback light positions when config is invalid or malformed
 */
const FALLBACK_LIGHT_POSITIONS = {
  key: [1500, 1500, 1500] as [number, number, number],
  fill: [-1500, 900, 1500] as [number, number, number],
  rim: [-900, 1200, -2000] as [number, number, number],
  shadowCamera: {
    left: -3000,
    right: 3000,
    top: 3000,
    bottom: -3000,
    far: 6000,
  },
};

/**
 * Normalize a bounds value to [min, max] tuple
 * Handles:
 * - Valid [number, number] tuples (returned as-is if finite)
 * - Single numbers treated as extent: n → [-n, n]
 * - Null/undefined/invalid → [-fallbackExtent, fallbackExtent]
 * - Non-finite values (NaN, Infinity) → fallback
 */
function normalizeRange(value: unknown, fallbackExtent: number): [number, number] {
  // Check if already a valid [number, number] tuple
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [value[0] as number, value[1] as number];
  }

  // If a single finite number, treat as extent: n → [-n, n]
  if (typeof value === 'number' && Number.isFinite(value)) {
    const extent = Math.abs(value);
    return [-extent, extent];
  }

  // Fallback: [-fallbackExtent, fallbackExtent]
  return [-fallbackExtent, fallbackExtent];
}

/**
 * Validate that all values in a tuple are finite numbers
 */
function isFiniteTuple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

interface LightingProps {
  config: LightingConfig;
}

export function Lighting({ config }: LightingProps) {
  // Sanitize config to ensure all values are valid
  const sanitized = useMemo(() => sanitizeLightingConfig(config), [config]);

  const {
    boundsX,
    boundsZ,
    intensity,
    shadowCatcherDiameter,
    ambientIntensity,
    castShadows,
  } = sanitized;

  /**
   * Calculate light positions based on product bounds
   * Studio 3-point setup: Key, Fill, Rim
   * Validates all computed values and falls back to safe defaults on error
   */
  const lightPositions = useMemo(() => {
    // Normalize bounds to [min, max] tuples, defensive against malformed config
    const bx = normalizeRange(boundsX, 1000);
    const bz = normalizeRange(boundsZ, 1000);

    const centerX = (bx[0] + bx[1]) / 2;
    const centerZ = (bz[0] + bz[1]) / 2;
    let extentX = Math.abs(bx[1] - bx[0]);
    let extentZ = Math.abs(bz[1] - bz[0]);

    // Ensure minimum extent to prevent degenerate geometry
    const MIN_EXTENT = 1000;
    extentX = Math.max(extentX, MIN_EXTENT);
    extentZ = Math.max(extentZ, MIN_EXTENT);

    const maxExtent = Math.max(extentX, extentZ);

    // Validate maxExtent is finite and positive
    if (!Number.isFinite(maxExtent) || maxExtent <= 0) {
      if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
        console.warn('[Lighting] Invalid maxExtent computed, using fallback', {
          raw_boundsX: boundsX,
          raw_boundsZ: boundsZ,
          normalized_bx: bx,
          normalized_bz: bz,
          extentX,
          extentZ,
          maxExtent,
        });
      }
      return FALLBACK_LIGHT_POSITIONS;
    }

    // Studio lighting scaled to product size
    const keyLightY = maxExtent * 1.2; // Higher for softer shadows
    const keyLightDistance = maxExtent * 1.5; // Further for softer light

    // Compute light positions
    const key: [number, number, number] = [
      centerX + keyLightDistance * 0.7,
      keyLightY,
      centerZ + keyLightDistance * 0.7,
    ];

    const fill: [number, number, number] = [
      centerX - keyLightDistance * 0.5,
      keyLightY * 0.6,
      centerZ + keyLightDistance * 0.6,
    ];

    const rim: [number, number, number] = [
      centerX - keyLightDistance * 0.3,
      keyLightY * 0.8,
      centerZ - keyLightDistance * 0.9,
    ];

    // Validate all light positions are finite tuples
    const allValid =
      isFiniteTuple(key) &&
      isFiniteTuple(fill) &&
      isFiniteTuple(rim) &&
      Number.isFinite(keyLightY) &&
      Number.isFinite(keyLightDistance);

    if (!allValid) {
      if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
        console.warn('[Lighting] Invalid light positions computed, using fallback', {
          raw_boundsX: boundsX,
          raw_boundsZ: boundsZ,
          normalized_bx: bx,
          normalized_bz: bz,
          key,
          fill,
          rim,
          keyLightY,
          keyLightDistance,
        });
      }
      return FALLBACK_LIGHT_POSITIONS;
    }

    // Debug logging if enabled
    if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
      console.log('[Lighting] Config validated successfully', {
        raw_boundsX: boundsX,
        raw_boundsZ: boundsZ,
        normalized_bx: bx,
        normalized_bz: bz,
        extents: { extentX, extentZ, maxExtent },
        lightPositions: { key, fill, rim },
        shadowCamera: {
          left: bx[0] - extentX * 0.5,
          right: bx[1] + extentX * 0.5,
          top: bz[1] + extentZ * 0.5,
          bottom: bz[0] - extentZ * 0.5,
          far: maxExtent * 4,
        },
      });
    }

    return {
      // Key light - main source (45° from front, elevated)
      key,
      // Fill light - softer from opposite side (reduces harsh shadows)
      fill,
      // Rim light - back highlight for depth separation
      rim,
      // Shadow camera frustum
      shadowCamera: {
        left: bx[0] - extentX * 0.5,
        right: bx[1] + extentX * 0.5,
        top: bz[1] + extentZ * 0.5,
        bottom: bz[0] - extentZ * 0.5,
        far: maxExtent * 4,
      },
    };
  }, [boundsX, boundsZ]);

  return (
    <>
      {/* Ambient light - soft studio fill (always safe fallback) */}
      <ambientLight intensity={ambientIntensity * 0.9} color="#f8f6f0" />

      {/* Validate computed light positions are finite before rendering directional lights */}
      {isFiniteTuple(lightPositions.key) &&
      isFiniteTuple(lightPositions.fill) &&
      isFiniteTuple(lightPositions.rim) ? (
        <>
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
              far={Math.max(lightPositions.shadowCamera.top, Math.abs(lightPositions.shadowCamera.bottom)) * 2}
              resolution={1024}
              color="#000000"
            />
          )}
        </>
      ) : (
        /* Fallback: only ambient light if computed positions are invalid */
        <></>
      )}
    </>
  );
}
