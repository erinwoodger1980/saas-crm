/**
 * Geometry Builders for Professional 3D Rendering
 * Creates geometries with beveled edges, profiles, and curves
 */

import * as THREE from 'three';

export interface RoundedBoxParams {
  width: number;
  height: number;
  depth: number;
  radius?: number;
  smoothness?: number;
}

export interface ProfileExtrudeParams {
  profile: [number, number][];
  path: [number, number, number][];
  closed?: boolean;
  /** Optional dimensions for fallback box if profile/path invalid */
  fallbackBox?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface CurveParams {
  type: 'arc' | 'ellipse' | 'bezier' | 'spline';
  points?: [number, number][];
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  centerX?: number;
  centerY?: number;
}

/**
 * Create box geometry with beveled/rounded edges
 * Essential for catching highlights on mouldings
 */
export function createRoundedBox(params: RoundedBoxParams): THREE.BufferGeometry {
  const { width, height, depth, radius = 2, smoothness = 8 } = params;
  
  // Use THREE.js native rounded box if available, otherwise create custom
  const shape = new THREE.Shape();
  const r = Math.min(radius, Math.min(width, height, depth) / 2);
  
  const hw = width / 2;
  const hh = height / 2;
  
  // Create rounded rectangle profile
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  
  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: smoothness,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Create bolection moulding profile
 * Traditional raised panel profile
 */
export function createBolectionProfile(width: number, depth: number): [number, number][] {
  const profile: [number, number][] = [];
  const steps = 12;
  
  // Ogee-style bolection profile
  profile.push([0, 0]);
  profile.push([depth * 0.2, 0]);
  profile.push([depth * 0.4, depth * 0.15]);
  profile.push([depth * 0.6, depth * 0.4]);
  profile.push([depth * 0.75, depth * 0.65]);
  profile.push([depth * 0.85, depth * 0.85]);
  profile.push([depth, depth]);
  
  return profile;
}

/**
 * Create bead moulding profile
 * Simple half-round or quarter-round
 */
export function createBeadProfile(radius: number, type: 'half' | 'quarter' = 'quarter'): [number, number][] {
  const profile: [number, number][] = [];
  const steps = 16;
  const angleRange = type === 'half' ? Math.PI : Math.PI / 2;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = angleRange * t;
    profile.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ]);
  }
  
  return profile;
}

/**
 * Extrude a 2D profile along a 3D path
 * Used for curved mouldings, glazing bars
 */
export function createProfileExtrude(params: ProfileExtrudeParams): THREE.BufferGeometry {
  const { profile, path, closed = false } = params;
  
  if (!Array.isArray(profile) || profile.length < 2 || !Array.isArray(path) || path.length < 2) {
    return createProfileFallback(params);
  }

  try {
    const shape = new THREE.Shape();
    profile.forEach((p, i) => {
      if (i === 0) {
        shape.moveTo(p[0], p[1]);
      } else {
        shape.lineTo(p[0], p[1]);
      }
    });
    if (params.closed) shape.closePath();
    
    const pathPoints = path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pathPoints, closed);
    
    const extrudeSettings = {
      steps: Math.max(20, path.length * 2),
      bevelEnabled: false,
      extrudePath: curve,
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  } catch (err) {
    console.warn('[geometry] Failed profile extrude, using fallback box:', err);
    return createProfileFallback(params);
  }
}

function createProfileFallback(params: ProfileExtrudeParams): THREE.BufferGeometry {
  const fallback = params.fallbackBox || { width: 50, height: 50, depth: 20 };
  return createRoundedBox({
    width: fallback.width,
    height: fallback.height,
    depth: fallback.depth,
    radius: Math.min(fallback.width, fallback.height, fallback.depth) * 0.05,
    smoothness: 4,
  });
}

/**
 * Create tube geometry for curved glazing bars
 */
export function createTubeFromCurve(curve: CurveParams, radius: number, segments: number = 32): THREE.BufferGeometry {
  let path: THREE.Curve<THREE.Vector3>;
  
  switch (curve.type) {
    case 'arc':
      path = createArcCurve(curve);
      break;
    case 'ellipse':
      path = createEllipseCurve(curve);
      break;
    case 'bezier':
      path = createBezierCurve(curve);
      break;
    case 'spline':
      path = createSplineCurve(curve);
      break;
    default:
      throw new Error(`Unknown curve type: ${curve.type}`);
  }
  
  return new THREE.TubeGeometry(path, segments, radius, 8, false);
}

function createArcCurve(params: CurveParams): THREE.Curve<THREE.Vector3> {
  const { radius = 100, startAngle = 0, endAngle = Math.PI, centerX = 0, centerY = 0 } = params;
  
  const arc2D = new THREE.ArcCurve(centerX, centerY, radius, startAngle, endAngle);
  const points2D = arc2D.getPoints(50);
  const points3D = points2D.map(p => new THREE.Vector3(p.x, p.y, 0));
  
  return new THREE.CatmullRomCurve3(points3D);
}

function createEllipseCurve(params: CurveParams): THREE.Curve<THREE.Vector3> {
  const { points = [] } = params;
  const points3D = points.map(p => new THREE.Vector3(p[0], p[1], 0));
  return new THREE.CatmullRomCurve3(points3D);
}

function createBezierCurve(params: CurveParams): THREE.Curve<THREE.Vector3> {
  const { points = [] } = params;
  if (points.length < 4) {
    throw new Error('Bezier curve requires 4 control points');
  }
  
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(points[0][0], points[0][1], 0),
    new THREE.Vector3(points[1][0], points[1][1], 0),
    new THREE.Vector3(points[2][0], points[2][1], 0),
    new THREE.Vector3(points[3][0], points[3][1], 0)
  );
}

function createSplineCurve(params: CurveParams): THREE.Curve<THREE.Vector3> {
  const { points = [] } = params;
  const closed = (params as any).closed ?? false;
  const points3D = points.map(p => new THREE.Vector3(p[0], p[1], 0));
  return new THREE.CatmullRomCurve3(points3D, closed as boolean);
}

/**
 * Create cyclorama backdrop (curved infinite background)
 */
export function createCycloramaBackdrop(width: number, height: number, curveRadius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  
  // Start at bottom left
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height - curveRadius);
  
  // Curved transition at top
  shape.quadraticCurveTo(-width / 2, height, -width / 2 + curveRadius, height);
  shape.lineTo(width / 2 - curveRadius, height);
  shape.quadraticCurveTo(width / 2, height, width / 2, height - curveRadius);
  
  // Down to bottom right
  shape.lineTo(width / 2, 0);
  shape.lineTo(-width / 2, 0);
  
  return new THREE.ShapeGeometry(shape);
}
