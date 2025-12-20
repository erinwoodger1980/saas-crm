/**
 * AutoFrame Component
 * Automatically frames the product in the viewport when components load or change
 * Integrates with Three.js scene and OrbitControls for smooth auto-zoom
 */

'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fitCameraToBox } from '@/lib/scene/fit-camera';
import { ComponentNode } from '@/types/scene-config';

interface AutoFrameProps {
  components: ComponentNode[];
  controls?: any;
  heroMode?: boolean;
  onFrameComplete?: (success: boolean) => void;
}

/**
 * AutoFrame component
 * Runs once on initial mount and when components structure changes
 * Does NOT run on every tiny edit (uses ref guard)
 */
export function AutoFrame({
  components,
  controls,
  heroMode = false,
  onFrameComplete,
}: AutoFrameProps) {
  const { camera, scene } = useThree();
  const didAutoFrameRef = useRef(false);
  const componentCountRef = useRef(0);

  useEffect(() => {
    // Guard: only run when component structure changes significantly
    const componentCount = components?.length || 0;
    const hasComponentStructureChanged = componentCount !== componentCountRef.current;
    
    if (!hasComponentStructureChanged || didAutoFrameRef.current) {
      return;
    }

    componentCountRef.current = componentCount;

    // Compute bounding box of all meshes in the scene
    const box = new THREE.Box3();
    let foundMesh = false;

    scene.traverse((obj: any) => {
      if (obj.isMesh && obj !== scene) {
        // Include mesh in bounding box
        box.expandByObject(obj);
        foundMesh = true;
      }
    });

    if (!foundMesh) {
      console.warn('[AutoFrame] No meshes found in scene');
      onFrameComplete?.(false);
      return;
    }

    // Use fitCameraToBox to position camera
    // Padding: 1.25 in hero mode (more dramatic zoom), 1.15 in normal mode
    const padding = heroMode ? 1.25 : 1.15;

    try {
      fitCameraToBox(box, camera, controls, padding);
      didAutoFrameRef.current = true;
      onFrameComplete?.(true);
    } catch (error) {
      console.error('[AutoFrame] Error framing camera:', error);
      onFrameComplete?.(false);
    }
  }, [components, camera, scene, controls, heroMode, onFrameComplete]);

  return null; // This is a non-rendering component
}
