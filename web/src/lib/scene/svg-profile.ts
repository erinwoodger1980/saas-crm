/**
 * SVG Profile Extrusion Pipeline
 * Converts SVG strings → Three.js extruded meshes
 * Supports both estimated (AI-generated) and verified (uploaded) profiles
 */

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

export interface ProfileMetadata {
  source: 'estimated' | 'verified' | 'uploaded';
  confidence?: number; // 0–1 for estimated profiles
  estimatedFrom?: string; // component type used for estimation
  notes?: string;
}

export interface SVGProfileDefinition {
  id: string;
  name: string;
  svgText: string; // inline SVG string
  viewBoxWidth: number; // original viewBox width in SVG units
  viewBoxHeight: number; // original viewBox height in SVG units
  extrudeDepthMm: number; // depth for extrusion in mm
  scale: number; // scale factor: mm per SVG unit
  metadata: ProfileMetadata;
}

/**
 * Parse SVG and extract closed paths
 * Returns array of Shape objects ready for extrusion
 */
function parseSVGToShapes(svgText: string): THREE.Shape[] {
  try {
    const loader = new SVGLoader();
    const paths = loader.parse(svgText);
    const shapes: THREE.Shape[] = [];

    paths.paths.forEach((path: any) => {
      const fillShapes = path.toShapes(true);
      shapes.push(...fillShapes);
    });

    if (shapes.length === 0) {
      console.warn('[svg-profile] No shapes extracted from SVG');
      return [];
    }

    return shapes;
  } catch (error) {
    console.error('[svg-profile] Failed to parse SVG:', error);
    return [];
  }
}

/**
 * Create extruded profile mesh from SVG
 * Matches FileMaker behavior:
 * - Rotate -90° on X axis (SVG XY → 3D XZ plane)
 * - Apply scale from viewBox → mm
 * - Extrude depth in mm
 * - Return mesh with PBR material
 */
export function createExtrudedProfileMesh(
  svgText: string,
  extrudeDepthMm: number,
  scale: number,
  material: THREE.Material
): THREE.Mesh | null {
  const shapes = parseSVGToShapes(svgText);
  if (shapes.length === 0) return null;

  // Use first shape; could combine if needed
  const shape = shapes[0];

  // Extrude settings: no bevels, clean profile
  const extrudeSettings = {
    depth: extrudeDepthMm,
    bevelEnabled: false,
    steps: 1,
  };

  try {
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Scale from SVG units to mm
    geometry.scale(scale, scale, 1);

    // Rotate -90° on X to convert SVG XY plane → 3D XZ plane
    geometry.rotateX(-Math.PI / 2);

    // Center geometry
    geometry.center();

    // Compute normals for correct lighting
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  } catch (error) {
    console.error('[svg-profile] Failed to create extruded geometry:', error);
    return null;
  }
}

/**
 * Generate estimated SVG profile for a component
 * Simple rectilinear timber profiles with rebates and shadow gaps
 */
export function generateEstimatedProfile(
  componentType: string,
  widthMm: number,
  depthMm: number
): SVGProfileDefinition {
  const estimatedSvg = generateRectilinearProfile(widthMm, depthMm);

  return {
    id: `est_${componentType}_${Date.now()}`,
    name: `Estimated ${componentType} profile`,
    svgText: estimatedSvg,
    viewBoxWidth: widthMm,
    viewBoxHeight: depthMm,
    extrudeDepthMm: depthMm * 0.8, // 80% of profile depth for extrude
    scale: 1.0, // 1:1 mm scale
    metadata: {
      source: 'estimated',
      confidence: 0.6,
      estimatedFrom: componentType,
      notes: `Auto-generated placeholder for ${componentType}`,
    },
  };
}

/**
 * Generate simple rectilinear timber profile with rebates
 * Returns SVG string
 */
function generateRectilinearProfile(widthMm: number, depthMm: number): string {
  // Simple rect with shadow gap
  const margin = Math.max(2, widthMm * 0.05);
  const rebateDepth = Math.max(1, depthMm * 0.1);

  const x1 = margin;
  const y1 = margin;
  const x2 = widthMm - margin;
  const y2 = depthMm - margin;

  // Outer rect with rebate
  const path = `
    M ${x1} ${y1}
    L ${x2} ${y1}
    L ${x2 - rebateDepth} ${y1 + rebateDepth}
    L ${x2 - rebateDepth} ${y2 - rebateDepth}
    L ${x2} ${y2}
    L ${x2} ${y2}
    L ${x1} ${y2}
    L ${x1 + rebateDepth} ${y2 - rebateDepth}
    L ${x1 + rebateDepth} ${y1 + rebateDepth}
    L ${x1} ${y1}
    Z
  `;

  return `
    <svg viewBox="0 0 ${widthMm} ${depthMm}" xmlns="http://www.w3.org/2000/svg">
      <path d="${path}" fill="black" stroke="none"/>
    </svg>
  `;
}

/**
 * Store profile in database (stub for future implementation)
 * TODO: Implement actual DB storage with profiles table
 */
export async function storeProfileDefinition(
  tenantId: string,
  profile: SVGProfileDefinition
): Promise<boolean> {
  try {
    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tenantId,
        profile,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[svg-profile] Failed to store profile:', error);
    return false;
  }
}

/**
 * Load profile from database (stub for future implementation)
 */
export async function loadProfileDefinition(
  tenantId: string,
  profileId: string
): Promise<SVGProfileDefinition | null> {
  try {
    const response = await fetch(`/api/profiles/${profileId}?tenantId=${tenantId}`, {
      credentials: 'include',
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.profile || null;
  } catch (error) {
    console.error('[svg-profile] Failed to load profile:', error);
    return null;
  }
}

/**
 * Swap profile in existing component
 * Replaces SVG but keeps component ID, transforms, and metadata
 */
export function swapProfileDefinition(
  profile: SVGProfileDefinition,
  newSvgText: string,
  newMetadata: Partial<ProfileMetadata>
): SVGProfileDefinition {
  return {
    ...profile,
    svgText: newSvgText,
    metadata: {
      ...profile.metadata,
      ...newMetadata,
    },
  };
}
