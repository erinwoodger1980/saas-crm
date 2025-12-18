/**
 * Curve Utility Functions
 * Convert between joinery-friendly presets and Three.js-compatible curve definitions
 * Handles parametric curve geometry generation
 */

import * as THREE from 'three';
import {
  CurveDefinition,
  CurvePreset,
  ArcCurve,
  EllipseCurve,
  CurveType,
} from '@/types/parametric-builder';

/**
 * Convert a CurveDefinition to THREE.Shape (2D profile)
 * Used for extrusion and other operations
 */
export function convertCurveToShape(curve: CurveDefinition): THREE.Shape {
  const shape = new THREE.Shape();

  switch (curve.type) {
    case 'arc': {
      if (!curve.arc) throw new Error('Arc curve missing arc parameters');
      const { cx, cy, r, startAngle, endAngle, clockwise } = curve.arc;
      
      // Move to start of arc
      const startX = cx + r * Math.cos(startAngle);
      const startY = cy + r * Math.sin(startAngle);
      shape.moveTo(startX, startY);
      
      // Add arc
      shape.arc(
        cx,
        cy,
        r,
        startAngle,
        endAngle,
        clockwise ?? false
      );
      break;
    }

    case 'ellipse': {
      if (!curve.ellipse) throw new Error('Ellipse curve missing ellipse parameters');
      const {
        cx,
        cy,
        rx,
        ry,
        rotation = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
        clockwise = false,
      } = curve.ellipse;

      // Create ellipse curve
      const ellipse = new THREE.EllipseCurve(
        cx,
        cy,
        rx,
        ry,
        startAngle,
        endAngle,
        clockwise,
        rotation
      );

      const points = ellipse.getPoints(curve.resolution ?? 64);
      if (points.length > 0) {
        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
      }
      break;
    }

    case 'bezier': {
      if (!curve.bezier) throw new Error('Bezier curve missing bezier parameters');
      const { p0, p1, p2, p3 } = curve.bezier;

      shape.moveTo(p0[0], p0[1]);
      shape.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      break;
    }

    case 'polyline': {
      if (!curve.polyline) throw new Error('Polyline curve missing polyline parameters');
      const { points, closed = false } = curve.polyline;

      if (points.length === 0) break;
      shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
      }
      if (closed) {
        shape.lineTo(points[0][0], points[0][1]);
      }
      break;
    }

    case 'spline': {
      if (!curve.spline) throw new Error('Spline curve missing spline parameters');
      const { points, closed = false, tension = 0.5 } = curve.spline;

      if (points.length === 0) break;

      // Use CatmullRom for spline
      const splineCurve = new THREE.CatmullRomCurve3(
        points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
        closed,
        'centripetal',
        tension
      );

      const splinePoints = splineCurve.getPoints(curve.resolution ?? 64);
      if (splinePoints.length > 0) {
        shape.moveTo(splinePoints[0].x, splinePoints[0].y);
        for (let i = 1; i < splinePoints.length; i++) {
          shape.lineTo(splinePoints[i].x, splinePoints[i].y);
        }
      }
      break;
    }

    default:
      throw new Error(`Unknown curve type: ${curve.type}`);
  }

  return shape;
}

/**
 * Convert a CurveDefinition to THREE.Curve (for TubeGeometry, etc.)
 * Used for paths followed by tubes/bars
 */
export function convertCurveTo3DPath(curve: CurveDefinition): THREE.Curve<THREE.Vector3> {
  switch (curve.type) {
    case 'arc': {
      if (!curve.arc) throw new Error('Arc curve missing arc parameters');
      const { cx, cy, r, startAngle, endAngle, clockwise } = curve.arc;

      return new THREE.ArcCurve(
        cx,
        cy,
        r,
        startAngle,
        endAngle,
        clockwise ?? false
      ) as any;
    }

    case 'ellipse': {
      if (!curve.ellipse) throw new Error('Ellipse curve missing ellipse parameters');
      const {
        cx,
        cy,
        rx,
        ry,
        rotation = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
        clockwise = false,
      } = curve.ellipse;

      return new THREE.EllipseCurve(
        cx,
        cy,
        rx,
        ry,
        startAngle,
        endAngle,
        clockwise,
        rotation
      ) as any;
    }

    case 'bezier': {
      if (!curve.bezier) throw new Error('Bezier curve missing bezier parameters');
      const { p0, p1, p2, p3 } = curve.bezier;

      return new THREE.CubicBezierCurve3(
        new THREE.Vector3(p0[0], p0[1], 0),
        new THREE.Vector3(p1[0], p1[1], 0),
        new THREE.Vector3(p2[0], p2[1], 0),
        new THREE.Vector3(p3[0], p3[1], 0)
      );
    }

    case 'polyline': {
      if (!curve.polyline) throw new Error('Polyline curve missing polyline parameters');
      const { points } = curve.polyline;

      return new THREE.LineCurve3(
        new THREE.Vector3(points[0][0], points[0][1], 0),
        new THREE.Vector3(points[points.length - 1][0], points[points.length - 1][1], 0)
      );
    }

    case 'spline': {
      if (!curve.spline) throw new Error('Spline curve missing spline parameters');
      const { points, closed = false, tension = 0.5 } = curve.spline;

      return new THREE.CatmullRomCurve3(
        points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
        closed,
        'centripetal',
        tension
      );
    }

    default:
      throw new Error(`Unknown curve type: ${curve.type}`);
  }
}

/**
 * Generate segmental arch curve from span and rise
 * Joinery-friendly: user inputs width and height above spring line
 *
 * Formula: For a segmental arch, find the radius and center
 * that passes through (0,0), (span, 0) and peaks at (span/2, rise)
 */
export function segmentalArchToCurve(
  span: number,
  rise: number,
  resolution: number = 64
): CurveDefinition {
  // Calculate radius using segmental arch formula
  // For a point at (span/2, rise) on circle with center at (span/2, cy)
  // radius² = (span/2)² + (radius - rise)²
  // solving: radius = (span² + 4*rise²) / (8*rise)

  const radius = (span * span + 4 * rise * rise) / (8 * rise);

  // Center of circle
  const cy = radius - rise;
  const cx = span / 2;

  // Calculate start and end angles
  const halfSpan = span / 2;
  const startAngle = Math.PI - Math.asin(halfSpan / radius);
  const endAngle = Math.asin(halfSpan / radius);

  return {
    id: `segmental-arch-${span}x${rise}`,
    name: `Segmental arch ${span}mm × ${rise}mm`,
    type: 'arc',
    plane: 'XY',
    units: 'mm',
    arc: {
      cx,
      cy: -cy, // Invert for proper orientation
      r: radius,
      startAngle,
      endAngle: Math.PI - endAngle,
      clockwise: true,
    },
    usage: 'head',
    resolution,
  };
}

/**
 * Generate radius head (circular) arch from radius and spring line height
 */
export function radiusHeadToCurve(
  radius: number,
  springLineHeight: number,
  span: number,
  resolution: number = 64
): CurveDefinition {
  // Radius head is a simple circular arc
  // Center is at (span/2, springLineHeight - radius)
  const cx = span / 2;
  const cy = springLineHeight - radius;

  // Calculate angles: arc spans from left to right of opening
  const halfSpan = span / 2;
  const startAngle = Math.PI - Math.acos(halfSpan / radius);
  const endAngle = Math.acos(halfSpan / radius);

  return {
    id: `radius-head-r${radius}`,
    name: `Radius head R${radius}mm`,
    type: 'arc',
    plane: 'XY',
    units: 'mm',
    arc: {
      cx,
      cy,
      r: radius,
      startAngle,
      endAngle,
      clockwise: false,
    },
    usage: 'head',
    resolution,
  };
}

/**
 * Generate gothic/pointed arch from apex height and shoulder radius
 * If shoulderRadius is omitted, creates two-point gothic (pointed arch)
 */
export function gothicArchToCurve(
  span: number,
  apexHeight: number,
  shoulderRadius?: number,
  resolution: number = 64
): CurveDefinition {
  // Two-point gothic (simple pointed arch)
  if (!shoulderRadius) {
    const p0: [number, number] = [0, 0];
    const p1: [number, number] = [span / 4, apexHeight / 2];
    const p2: [number, number] = [span * 0.75, apexHeight / 2];
    const p3: [number, number] = [span, 0];

    return {
      id: `gothic-arch-${span}x${apexHeight}`,
      name: `Gothic arch ${span}mm × ${apexHeight}mm`,
      type: 'bezier',
      plane: 'XY',
      units: 'mm',
      bezier: {
        p0,
        p1,
        p2,
        p3,
      },
      usage: 'head',
      resolution,
    };
  }

  // Segmental gothic with shoulders
  const radius = shoulderRadius;
  const cy = -radius;
  const cx = span / 2;

  return {
    id: `gothic-arch-shoulder-${span}x${apexHeight}`,
    name: `Gothic arch with shoulders ${span}mm × ${apexHeight}mm`,
    type: 'arc',
    plane: 'XY',
    units: 'mm',
    arc: {
      cx,
      cy,
      r: radius,
      startAngle: Math.PI * 0.25,
      endAngle: Math.PI * 0.75,
      clockwise: true,
    },
    usage: 'head',
    resolution,
  };
}

/**
 * Generate offset curve (parallel at distance)
 * Useful for rebates, moulding offset
 */
export function offsetCurve(curve: CurveDefinition, offset: number): CurveDefinition {
  // Clone and modify offset
  const offsetCurve = { ...curve };
  offsetCurve.id = `${curve.id}-offset-${offset}`;
  offsetCurve.name = `${curve.name} (offset ${offset}mm)`;

  // Apply offset to specific geometry based on type
  if (curve.arc && offset !== 0) {
    offsetCurve.arc = {
      ...curve.arc,
      r: curve.arc.r + offset, // Expand radius
    };
  } else if (curve.ellipse && offset !== 0) {
    offsetCurve.ellipse = {
      ...curve.ellipse,
      rx: curve.ellipse.rx + offset,
      ry: curve.ellipse.ry + offset,
    };
  }

  // For bezier/polyline/spline, offset requires more complex calculation
  // Store as metadata for now
  offsetCurve.offset = offset;

  return offsetCurve;
}

/**
 * Get sampled points from a curve for visualization/layout
 */
export function sampleCurvePoints(
  curve: CurveDefinition,
  count: number = 64
): [number, number][] {
  try {
    const shape = convertCurveToShape(curve);
    const points = shape.getPoints(count);
    return points.map(p => [p.x, p.y]);
  } catch {
    return [];
  }
}

/**
 * Calculate bounds of a curve
 */
export function calculateCurveBounds(
  curve: CurveDefinition
): { minX: number; maxX: number; minY: number; maxY: number } {
  const points = sampleCurvePoints(curve, 128);

  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  points.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  return { minX, maxX, minY, maxY };
}

/**
 * Convert CurvePreset to CurveDefinition
 */
export function presetToCurveDefinition(preset: CurvePreset): CurveDefinition {
  switch (preset.type) {
    case 'segmentalArch': {
      if (!preset.segmentalArch) throw new Error('Missing segmentalArch parameters');
      return segmentalArchToCurve(
        preset.segmentalArch.span,
        preset.segmentalArch.rise
      );
    }

    case 'radiusHead': {
      if (!preset.radiusHead) throw new Error('Missing radiusHead parameters');
      return radiusHeadToCurve(
        preset.radiusHead.radius,
        preset.radiusHead.springLineHeight,
        preset.radiusHead.radius * 2 // Approximate span
      );
    }

    case 'gothicArch': {
      if (!preset.gothicArch) throw new Error('Missing gothicArch parameters');
      return gothicArchToCurve(
        preset.gothicArch.span,
        preset.gothicArch.apexHeight,
        preset.gothicArch.shoulderRadius
      );
    }

    default:
      throw new Error(`Unknown preset type: ${preset.type}`);
  }
}
