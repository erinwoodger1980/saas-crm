/**
 * Enhanced Camera Controller
 * Integrates FileMaker-quality camera framing with OrbitControls
 * Auto-fit, smooth animation, persistence
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  fitCameraToObject,
  captureCameraState,
  restoreCameraState,
  CameraFitOptions,
} from '@/lib/scene/filemaker-camera';

interface EnhancedCameraControllerProps {
  boundingBox?: THREE.Box3;
  autoFit?: boolean;
  perspective?: 'front' | '3/4' | 'top' | 'isometric';
  onCameraChange?: (state: any) => void;
  onControlsReady?: (controls: OrbitControls) => void;
  savedCameraState?: any;
  productWidth?: number;
  productHeight?: number;
  productDepth?: number;
}

export function EnhancedCameraController({
  boundingBox,
  autoFit = true,
  perspective = '3/4',
  onCameraChange,
  onControlsReady,
  savedCameraState,
  productWidth = 1000,
  productHeight = 2000,
  productDepth = 45,
}: EnhancedCameraControllerProps) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<any>(null);
  const autoFitApplied = useRef(false);
  const rafTimer = useRef<number>();
  const lastCapturedState = useRef<any>(null);

  // Create default bounding box if not provided
  const effectiveBoundingBox =
    boundingBox ||
    new THREE.Box3(
      new THREE.Vector3(-productWidth / 2, 0, -productDepth / 2),
      new THREE.Vector3(productWidth / 2, productHeight, productDepth / 2)
    );

  // Auto-fit camera on mount
  useEffect(() => {
    if (autoFit && !autoFitApplied.current && controlsRef.current) {
      fitCameraToObject(
        effectiveBoundingBox,
        camera as THREE.PerspectiveCamera,
        controlsRef.current,
        {
          perspective,
          padding: 1.1,
          animateDuration: 0, // Instant for first fit
        }
      );

      autoFitApplied.current = true;
    }
  }, [autoFit, effectiveBoundingBox, camera, perspective]);

  // Restore saved camera state if provided
  useEffect(() => {
    if (savedCameraState && controlsRef.current) {
      restoreCameraState(camera, controlsRef.current, savedCameraState);
    }
  }, [savedCameraState, camera]);

  // Handle OrbitControls events for persistence
  const handleControlsChange = useCallback(() => {
    if (!controlsRef.current) return;

    // Debounce rapid changes
    if (rafTimer.current) {
      cancelAnimationFrame(rafTimer.current);
    }

    rafTimer.current = requestAnimationFrame(() => {
      const state = captureCameraState(camera, controlsRef.current);

      if (onCameraChange && JSON.stringify(state) !== JSON.stringify(lastCapturedState.current)) {
        onCameraChange(state);
        lastCapturedState.current = state;
      }
    });
  }, [camera, onCameraChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafTimer.current) {
        cancelAnimationFrame(rafTimer.current);
      }
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      args={[camera, scene.children[0]?.element]}
      enableDamping
      dampingFactor={0.05}
      enableZoom
      zoomSpeed={1}
      autoRotate={false}
      enablePan
      panSpeed={1}
      enableRotate
      rotateSpeed={0.5}
      minDistance={effectiveBoundingBox.getSize(new THREE.Vector3()).length() * 0.15}
      maxDistance={effectiveBoundingBox.getSize(new THREE.Vector3()).length() * 25}
      onStart={() => {
        // Disable damping on user interaction for responsiveness
      }}
      onChange={handleControlsChange}
      onEnd={() => {
        // Re-enable damping
      }}
      onMount={(api) => {
        controlsRef.current = api;
        onControlsReady?.(api);
      }}
    />
  );
}
