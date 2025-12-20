/**
 * PostFX - lightweight postprocessing stack
 * Adds subtle SSAO and mild contrast polish when enabled
 */

'use client';

import { Fragment } from 'react';
import { EffectComposer, SSAO, BrightnessContrast } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostFXProps {
  enabled: boolean;
  heroMode?: boolean;
}

export function PostFX({ enabled, heroMode = false }: PostFXProps) {
  // When disabled, render nothing to keep performance cost at zero
  if (!enabled) return <Fragment />;

  // SSAO tuned to be subtle and non-gaming; softer when hero mode for drama
  const ssaoRadius = heroMode ? 0.1 : 0.08;
  const ssaoIntensity = heroMode ? 0.8 : 0.6;

  return (
    <EffectComposer multisampling={enabled ? 2 : 0}>
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
}
