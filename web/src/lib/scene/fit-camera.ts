/**
 * Camera Framing Utilities
 * Automatic camera positioning and zoom based on scene bounds
 */

import * as THREE from 'three';

export interface CameraFrameParams {
  productWidth: number;
  productHeight: number;
  productDepth: number;
  fov?: number;
}

/**
 * Calculate hero camera position for 3/4 view
 * Positions camera at optimal angle to view entire product
 * Returns: { position, target }
 */
export function calculateHeroCamera(params: CameraFrameParams) {
  const { productWidth, productHeight, productDepth, fov = 45 } = params;

  // Calculate maximum dimension for scaling
  const maxDim = Math.max(productWidth, productHeight, productDepth);

  // Target is at product center, but slightly lower (60% of height)
  const targetY = productHeight * 0.15;

  // Hero angle: 3/4 perspective
  // Position: right side (60%), elevated (35%), back (150%)
  const distance = maxDim * 1.5;
  const posX = productWidth * 0.6;
  const posY = productHeight * 0.35;
  const posZ = productDepth * 1.5;

  return {
    position: [posX, posY, posZ] as [number, number, number],
    target: [0, targetY, 0] as [number, number, number],
    fov,
  };
}

/**
 * Calculate dynamic OrbitControls distance limits
 * Based on product dimensions in millimeters with safer clamped values
 * Ensures sufficient zoom-out capability while maintaining reasonable min distance
 */
export function calculateDistanceLimits(
  productWidth: number,
  productHeight: number,
  productDepth: number
) {
  const maxDim = Math.max(productWidth, productHeight, productDepth);
  
  // Safer clamped values: allow zoom-out up to 25x the product dimension
  const minDistance = Math.max(100, maxDim * 0.35);
  const maxDistance = Math.max(minDistance * 3, maxDim * 25);

  return {
    minDistance,
    maxDistance,
  };
}

/**
 * Calculate far plane for camera
 * Ensures all content is visible with significant margin
 */
export function calculateCameraFarPlane(
  productWidth: number,
  productHeight: number,
  productDepth: number
) {
  const maxDim = Math.max(productWidth, productHeight, productDepth);
  // Large far plane to accommodate extreme zoom-outs
  return Math.max(20000, maxDim * 80);
}

/**
 * Calculate orthographic camera zoom limits
 * Returns { minZoom, maxZoom } for use with <OrbitControls />
 * baseZoom: the "fit" zoom value (typically from calculateOrthoZoom)
 */
export function calculateZoomLimits(baseZoom: number) {
  // Allow zoom from 0.2x (far out) to 5x (close in) the base fit zoom
  const minZoom = Math.max(0.1, baseZoom * 0.2);
  const maxZoom = Math.max(baseZoom * 5, baseZoom * 10);

  return {
    minZoom,
    maxZoom,
  };
}

/**
 * Fit camera to show entire bounding box
 * Useful for auto-zoom when components change
 */
export function fitCameraToBox(
  box: THREE.Box3,
  camera: THREE.Camera,
  controls?: any,
  padding: number = 1.2
) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (!maxDim) return; // Empty box

  // For perspective camera
  if (camera instanceof THREE.PerspectiveCamera) {
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * padding;

    // Position camera at hero angle
    const posX = center.x + size.x * 0.6 * padding;
    const posY = center.y + size.y * 0.35 * padding;
    const posZ = center.z + cameraDistance;

    camera.position.set(posX, posY, posZ);
    camera.lookAt(center);

    // Update controls target if provided
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }
}
