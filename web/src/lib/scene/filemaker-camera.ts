/**
 * FileMaker-Quality Camera Fitting
 * Replicates the exact camera framing behavior from legacy WebViewer
 * - Compute Box3 from product bounds
 * - Calculate optimal distance using fov + aspect
 * - Set camera position, near/far, controls target
 * - No zoom lock issues
 */

import * as THREE from 'three';

export interface CameraFitOptions {
  padding?: number; // Extra space around product (1.05 = 5% padding)
  maxYClamp?: boolean; // Clamp max Y height like FileMaker
  perspective?: 'front' | '3/4' | 'top' | 'isometric';
  animateDuration?: number; // ms for smooth animation (0 = instant)
}

/**
 * Main entry point: fit camera to bounding box
 * Matches FileMaker WebViewer behavior exactly
 */
export function fitCameraToObject(
  boundingBox: THREE.Box3,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: any, // OrbitControls
  options: CameraFitOptions = {}
): void {
  const {
    padding = 1.05,
    maxYClamp = true,
    perspective = '3/4',
    animateDuration = 0,
  } = options;

  // Get size and center
  const size = boundingBox.getSize(new THREE.Vector3());
  const center = boundingBox.getCenter(new THREE.Vector3());

  // Clamp max Y height (FileMaker behavior)
  if (maxYClamp && center.y > size.y * 0.5) {
    center.y = Math.max(0, center.y - size.y * 0.2);
  }

  // Set controls target
  controls.target.copy(center);

  // Calculate camera position based on perspective
  const cameraPos = calculateCameraPosition(size, perspective);

  // Calculate optimal distance using camera fov
  const distance = calculateOptimalDistance(
    camera,
    size,
    padding,
    perspective === '3/4' ? 0.866 : 1 // 3/4 view uses ~0.866 scale
  );

  // Scale position by distance
  const newPosition = new THREE.Vector3()
    .copy(cameraPos)
    .normalize()
    .multiplyScalar(distance)
    .add(center);

  if (isPerspectiveCamera(camera)) {
    // Perspective camera
    camera.position.copy(newPosition);
    camera.lookAt(center);

    // Set near/far planes
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.near = Math.max(0.1, maxDim * 0.01);
    camera.far = Math.max(1000, maxDim * 50);
    camera.updateProjectionMatrix();
  } else {
    // Orthographic camera
    camera.position.copy(newPosition);
    camera.lookAt(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    camera.left = -maxDim * padding;
    camera.right = maxDim * padding;
    camera.top = maxDim * padding;
    camera.bottom = -maxDim * padding;
    camera.near = -maxDim * 10;
    camera.far = maxDim * 10;
    camera.updateProjectionMatrix();
  }

  // Update controls
  controls.minDistance = Math.max(0.1, distance * 0.15);
  controls.maxDistance = Math.max(controls.minDistance * 6, distance * 25);
  controls.update();
}

/**
 * Calculate camera position offset based on perspective
 */
function calculateCameraPosition(
  size: THREE.Vector3,
  perspective: string
): THREE.Vector3 {
  const maxDim = Math.max(size.x, size.y, size.z);

  switch (perspective) {
    case 'front':
      return new THREE.Vector3(0, size.y * 0.5, maxDim);
    case 'top':
      return new THREE.Vector3(0, maxDim, 0);
    case 'isometric':
      return new THREE.Vector3(maxDim, size.y * 0.5, maxDim);
    case '3/4':
    default:
      // 3/4 view: slightly rotated for visual interest
      return new THREE.Vector3(maxDim * 0.7, size.y * 0.6, maxDim * 0.7);
  }
}

/**
 * Calculate optimal distance from camera to object
 * Uses field of view and aspect ratio
 */
function calculateOptimalDistance(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  size: THREE.Vector3,
  padding: number,
  perspectiveScale: number = 1
): number {
  if (isPerspectiveCamera(camera)) {
    const vFOV = (camera.fov * Math.PI) / 180; // convert to radians
    const maxHeight = size.y * padding;

    // Distance = height / (2 * tan(fov/2))
    return maxHeight / (2 * Math.tan(vFOV / 2)) * perspectiveScale;
  } else {
    // For orthographic, return a reasonable distance
    return Math.max(size.x, size.y, size.z) * 2 * padding;
  }
}

/**
 * Type guard for PerspectiveCamera
 */
function isPerspectiveCamera(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
): camera is THREE.PerspectiveCamera {
  return (camera as THREE.PerspectiveCamera).fov !== undefined;
}

/**
 * Animate camera to target over time
 * Smooth easing for visual polish
 */
export function animateCameraToObject(
  boundingBox: THREE.Box3,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: any,
  duration: number = 1000, // ms
  options: CameraFitOptions = {}
): Promise<void> {
  return new Promise((resolve) => {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const startZoom = isPerspectiveCamera(camera) ? camera.fov : 1;

    // Calculate final position
    const tempCamera = camera.clone();
    fitCameraToObject(boundingBox, tempCamera, { target: startTarget }, options);
    const endPos = tempCamera.position.clone();
    const endTarget = controls.target.clone();
    const endZoom = isPerspectiveCamera(tempCamera) ? tempCamera.fov : 1;

    // Animation loop
    const startTime = Date.now();
    let animationId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(t);

      // Interpolate position
      camera.position.lerpVectors(startPos, endPos, eased);

      // Interpolate target
      controls.target.lerpVectors(startTarget, endTarget, eased);

      // Interpolate zoom/fov
      if (isPerspectiveCamera(camera)) {
        camera.fov = startZoom + (endZoom - startZoom) * eased;
        camera.updateProjectionMatrix();
      }

      camera.lookAt(controls.target);

      if (t >= 1) {
        cancelAnimationFrame(animationId);
        resolve();
      } else {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
  });
}

/**
 * Cubic easing function for smooth animation
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Reset camera to default isometric view
 */
export function resetCameraToDefault(
  boundingBox: THREE.Box3,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: any
): void {
  fitCameraToObject(boundingBox, camera, controls, {
    perspective: 'isometric',
    padding: 1.1,
  });
}

/**
 * Get current camera state for persistence
 */
export function captureCameraState(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: any
): {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  zoom?: number;
} {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    ...(isPerspectiveCamera(camera) && { fov: camera.fov }),
    ...(!isPerspectiveCamera(camera) && { zoom: (camera as THREE.OrthographicCamera).zoom }),
  };
}

/**
 * Restore camera from saved state
 */
export function restoreCameraState(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: any,
  state: any
): void {
  if (state.position) {
    camera.position.set(...state.position);
  }

  if (state.target) {
    controls.target.set(...state.target);
  }

  if (state.fov && isPerspectiveCamera(camera)) {
    (camera as THREE.PerspectiveCamera).fov = state.fov;
    camera.updateProjectionMatrix();
  }

  if (state.zoom && !isPerspectiveCamera(camera)) {
    (camera as THREE.OrthographicCamera).zoom = state.zoom;
    camera.updateProjectionMatrix();
  }

  camera.lookAt(controls.target);
  controls.update();
}
