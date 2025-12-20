/**
 * Camera Controller Component
 * Manages camera state with FileMaker parity
 * Handles perspective/ortho toggle and state persistence
 */

'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera as DreiPerspectiveCamera, OrthographicCamera as DreiOrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CameraState, calculateOrthoZoom } from '@/types/scene-config';
import { calculateDistanceLimits, calculateCameraFarPlane, calculateZoomLimits } from '@/lib/scene/fit-camera';

interface CameraControllerProps {
  cameraState: CameraState;
  productWidth: number;
  productHeight: number;
  productDepth?: number;
  onCameraChange: (state: Partial<CameraState>) => void;
  /** Debounce time in ms before persisting camera changes */
  persistDebounce?: number;
  /** Callback when controls are ready, for external access (e.g., auto-framing) */
  onControlsReady?: (controls: any) => void;
}

export function CameraController({
  cameraState,
  productWidth,
  productHeight,
  productDepth = 45,
  onCameraChange,
  persistDebounce = 500,
  onControlsReady,
}: CameraControllerProps) {
  const { gl, size } = useThree();
  const controlsRef = useRef<any>(null);
  const perspCamRef = useRef<THREE.PerspectiveCamera>(null);
  const orthoCamRef = useRef<THREE.OrthographicCamera>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserInteractingRef = useRef(false);
  
  // Calculate dynamic distance limits and far plane based on product size
  const { minDistance, maxDistance } = calculateDistanceLimits(productWidth, productHeight, productDepth);
  const farPlane = calculateCameraFarPlane(productWidth, productHeight, productDepth);
  
  // Calculate zoom limits for orthographic mode
  const fitZoom = calculateOrthoZoom(productWidth, productHeight, size.width, size.height);
  const { minZoom: minOrthoZoom, maxZoom: maxOrthoZoom } = calculateZoomLimits(fitZoom);
  
  // Safe access to camera mode with fallback to prevent crashes
  const cameraMode = cameraState?.mode || 'Perspective';
  const currentCamera = cameraMode === 'Perspective' ? perspCamRef.current : orthoCamRef.current;

  /**
   * Apply camera state to active camera
   * Called on mode switch or initial mount
   */
  useEffect(() => {
    if (!currentCamera || !controlsRef.current) return;

    const [px, py, pz] = cameraState.position;
    const [tx, ty, tz] = cameraState.target;
    
    // Set camera position
    currentCamera.position.set(px, py, pz);
    
    // Set controls target
    controlsRef.current.target.set(tx, ty, tz);
    
    // Apply mode-specific settings
    if (cameraMode === 'Ortho' && orthoCamRef.current) {
      // Use fit zoom if zoom is default (1), otherwise use persisted zoom
      const zoom = cameraState.zoom === 1 ? fitZoom : cameraState.zoom;
      
      orthoCamRef.current.zoom = zoom;
      orthoCamRef.current.updateProjectionMatrix();
    } else if (cameraMode === 'Perspective' && perspCamRef.current) {
      if (cameraState.fov) {
        perspCamRef.current.fov = cameraState.fov;
        perspCamRef.current.updateProjectionMatrix();
      }
    }
    
    // Apply rotation if specified
    if (cameraState.rotation) {
      const [rx, ry, rz] = cameraState.rotation;
      currentCamera.rotation.set(rx, ry, rz);
    }
    
    controlsRef.current.update();
  }, [cameraMode, currentCamera, fitZoom]);

  /**
   * Notify parent when controls are ready for auto-framing
   */
  useEffect(() => {
    if (controlsRef.current && onControlsReady) {
      onControlsReady(controlsRef.current);
    }
  }, [onControlsReady]);

  /**
   * Handle camera interaction end
   * Debounced persistence to avoid excessive writes
   */
  const handleInteractionEnd = () => {
    isUserInteractingRef.current = false;
    
    if (!currentCamera || !controlsRef.current) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce persistence
    debounceTimerRef.current = setTimeout(() => {
      const newState: Partial<CameraState> = {
        position: [
          currentCamera.position.x,
          currentCamera.position.y,
          currentCamera.position.z,
        ],
        target: [
          controlsRef.current.target.x,
          controlsRef.current.target.y,
          controlsRef.current.target.z,
        ],
        rotation: [
          currentCamera.rotation.x,
          currentCamera.rotation.y,
          currentCamera.rotation.z,
        ],
      };

      // Add mode-specific state
      if (cameraMode === 'Ortho' && orthoCamRef.current) {
        newState.zoom = orthoCamRef.current.zoom;
      } else if (cameraMode === 'Perspective' && perspCamRef.current) {
        newState.fov = perspCamRef.current.fov;
      }

      onCameraChange(newState);
    }, persistDebounce);
  };

  /**
   * Monitor controls for interaction
   */
  useFrame(() => {
    if (controlsRef.current) {
      // Detect if user is currently interacting
      const isInteracting = controlsRef.current.enabled && 
        (controlsRef.current as any).object?.userData?.isInteracting;
      
      if (isInteracting && !isUserInteractingRef.current) {
        isUserInteractingRef.current = true;
      }
    }
  });

  /**
   * Cleanup debounce timer
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle viewport resize for orthographic camera
   */
  useEffect(() => {
    if (cameraMode === 'Ortho' && orthoCamRef.current) {
      const aspect = size.width / size.height;
      const frustumSize = 10;
      
      orthoCamRef.current.left = (-frustumSize * aspect) / 2;
      orthoCamRef.current.right = (frustumSize * aspect) / 2;
      orthoCamRef.current.top = frustumSize / 2;
      orthoCamRef.current.bottom = -frustumSize / 2;
      orthoCamRef.current.updateProjectionMatrix();
    }
  }, [size, cameraMode]);

  return (
    <>
      {/* Perspective Camera */}
      {cameraMode === 'Perspective' && (
        <DreiPerspectiveCamera
          ref={perspCamRef}
          makeDefault
          fov={cameraState.fov || 35}
          position={cameraState.position}
          near={0.1}
          far={farPlane}
        />
      )}

      {/* Orthographic Camera */}
      {cameraMode === 'Ortho' && (
        <DreiOrthographicCamera
          ref={orthoCamRef}
          makeDefault
          position={cameraState.position}
          zoom={cameraState.zoom}
          near={0.1}
          far={farPlane}
        />
      )}

      {/* Orbit Controls */}
      <OrbitControls
        ref={controlsRef}
        target={cameraState.target}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        panSpeed={0.8}
        zoomSpeed={1.2}
        enableZoom={true}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minZoom={minOrthoZoom}
        maxZoom={maxOrthoZoom}
        onEnd={handleInteractionEnd}
        // CAD-like controls
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  );
}
