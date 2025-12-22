/**
 * PostFX - lightweight postprocessing stack
 * Adds subtle SSAO and mild contrast polish when enabled
 * 
 * HARDENED: Validates all Three.js context before mounting EffectComposer
 * to prevent "Cannot read properties of undefined (reading 'length')" crash
 */

'use client';

import { Fragment, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, SSAO, BrightnessContrast } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostFXProps {
  enabled: boolean;
  heroMode?: boolean;
}

export function PostFX({ enabled, heroMode = false }: PostFXProps) {
  const composerRef = useRef<any>(null);
  
  // CRITICAL: Get Three.js context - must validate before rendering EffectComposer
  const { gl, scene, camera, size } = useThree((state) => ({
    gl: state.gl,
    scene: state.scene,
    camera: state.camera,
    size: state.size,
  }));

  // Cleanup on unmount to prevent WebGL context loss
  useEffect(() => {
    return () => {
      if (composerRef.current?.dispose) {
        try {
          composerRef.current.dispose();
        } catch (err) {
          console.warn('[PostFX] Failed to dispose composer:', err);
        }
      }
    };
  }, []);

  // SAFETY KILL-SWITCH: Allow disabling PostFX entirely via env var
  if (process.env.NEXT_PUBLIC_DISABLE_POSTFX === 'true') {
    return null;
  }

  // TEMPORARY FIX: Disable PostFX due to EffectComposer crashes
  // Error: "Cannot read properties of undefined (reading 'length')" in EffectComposer.js:82
  // TODO: Debug postprocessing library compatibility with current Three.js version
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[PostFX] Disabled temporarily due to EffectComposer instability');
  }
  return null;

  // GUARD 1: Disabled by prop
  if (!enabled) {
    return null;
  }

  // GUARD 2: Validate Three.js context is ready
  // Without these, EffectComposer crashes with "Cannot read properties of undefined (reading 'length')"
  if (!gl || !scene || !camera || !size) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostFX] Three.js context not ready, skipping post-processing');
    }
    return null;
  }

  // GUARD 3: Validate size has valid dimensions
  if (!size.width || !size.height || size.width <= 0 || size.height <= 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PostFX] Invalid canvas size, skipping post-processing');
    }
    return null;
  }

  // SSAO tuned to be subtle and non-gaming; softer when hero mode for drama
  const ssaoRadius = heroMode ? 0.1 : 0.08;
  const ssaoIntensity = heroMode ? 0.8 : 0.6;

  // GUARD 4: Wrap in try-catch to prevent crashes from postprocessing library
  try {
    return (
      <EffectComposer 
        ref={composerRef}
        multisampling={2} 
        enableNormalPass={true}
      >
        <SSAO
          samples={8}
          radius={ssaoRadius}
          intensity={ssaoIntensity}
          bias={0.025}
          color="black"
          worldDistanceThreshold={0.4}
          worldDistanceFalloff={0.2}
          worldProximityThreshold={0.4}
          worldProximityFalloff={0.1}
        />
        <BrightnessContrast
          brightness={0.01}
          contrast={0.04}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    );
  } catch (error) {
    console.error('[PostFX] EffectComposer failed to render:', error);
    return null;
  }
}
