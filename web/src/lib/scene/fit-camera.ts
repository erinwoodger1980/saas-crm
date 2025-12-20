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
 * Based on product dimensions in millimeters
 */
export function calculateDistanceLimits(
  productWidth: number,
  productHeight: number,
  productDepth: number
) {
  const maxDim = Math.max(productWidth, productHeight, productDepth);

  return {
    minDistance: maxDim * 0.25,
    maxDistance: maxDim * 6,
  };
}

/**
 * Calculate far plane for camera
 * Ensures all content is visible
 */
export function calculateCameraFarPlane(
  productWidth: number,
  productHeight: number,
  productDepth: number
) {
  const maxDim = Math.max(productWidth, productHeight, productDepth);
  return maxDim * 20;
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
