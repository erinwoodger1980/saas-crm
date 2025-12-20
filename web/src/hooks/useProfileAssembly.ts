/**
 * useProfileAssembly Hook
 * Manages profile-based assembly lifecycle
 * Handles creation, updates, auto-framing, and persistence
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  fitCameraToObject,
  getAssemblyBoundingBox,
  ProfiledComponent,
  createProfiledAssembly,
} from '@/lib/scene/profiled-component';

export interface UseProfileAssemblyOptions {
  autoFit?: boolean;
  autoFitPerspective?: 'front' | '3/4' | 'top' | 'isometric';
  enableRaycast?: boolean;
  enableTransformControls?: boolean;
  onBoundingBoxChange?: (box: THREE.Box3) => void;
  onComponentSelect?: (componentId: string | null) => void;
}

export function useProfileAssembly(
  components: ProfiledComponent[],
  options: UseProfileAssemblyOptions = {}
) {
  const {
    autoFit = true,
    autoFitPerspective = '3/4',
    enableRaycast = true,
    enableTransformControls = true,
    onBoundingBoxChange,
    onComponentSelect,
  } = options;

  const { scene, camera } = useThree();
  const assemblyRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<any>(null);
  const autoFitApplied = useRef(false);

  // Create or update assembly
  useEffect(() => {
    // Dispose old assembly
    if (assemblyRef.current) {
      assemblyRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
      scene.remove(assemblyRef.current);
    }

    // Create new assembly
    const assembly = createProfiledAssembly(components);
    scene.add(assembly);
    assemblyRef.current = assembly;

    // Compute bounding box
    const box = getAssemblyBoundingBox(assembly);
    onBoundingBoxChange?.(box);

    // Reset auto-fit flag
    autoFitApplied.current = false;
  }, [components, scene, onBoundingBoxChange]);

  // Auto-fit camera
  useEffect(() => {
    if (
      !autoFit ||
      autoFitApplied.current ||
      !assemblyRef.current ||
      !controlsRef.current
    ) {
      return;
    }

    const box = getAssemblyBoundingBox(assemblyRef.current);
    fitCameraToObject(box, camera as THREE.PerspectiveCamera, controlsRef.current, {
      perspective: autoFitPerspective,
      padding: 1.1,
      animateDuration: 0,
    });

    autoFitApplied.current = true;
  }, [autoFit, autoFitPerspective, camera]);

  // Get assembly reference
  const getAssembly = useCallback(() => assemblyRef.current, []);

  // Get bounding box
  const getBoundingBox = useCallback(() => {
    if (!assemblyRef.current) return null;
    return getAssemblyBoundingBox(assemblyRef.current);
  }, []);

  // Fit to component
  const fitToComponent = useCallback(
    (componentId: string) => {
      if (!assemblyRef.current || !controlsRef.current) return;

      const box = new THREE.Box3();
      assemblyRef.current.children.forEach((child) => {
        if (child.userData.componentId === componentId) {
          box.expandByObject(child);
        }
      });

      if (!box.isEmpty()) {
        fitCameraToObject(box, camera as THREE.PerspectiveCamera, controlsRef.current, {
          perspective: autoFitPerspective,
          padding: 1.2,
        });
      }
    },
    [camera, autoFitPerspective]
  );

  // Reset view
  const resetView = useCallback(() => {
    if (assemblyRef.current && controlsRef.current) {
      const box = getAssemblyBoundingBox(assemblyRef.current);
      fitCameraToObject(box, camera as THREE.PerspectiveCamera, controlsRef.current, {
        perspective: autoFitPerspective,
        padding: 1.1,
      });
    }
  }, [camera, autoFitPerspective]);

  return {
    assemblyRef,
    controlsRef,
    getAssembly,
    getBoundingBox,
    fitToComponent,
    resetView,
  };
}
