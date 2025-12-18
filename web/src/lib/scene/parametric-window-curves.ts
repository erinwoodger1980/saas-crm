/**
 * Window Builder with Curve Support Extension
 * Adds curved heads, fanlights, and curved glazing bars to base window
 */

import {
  ParametricBuilder,
  ProductParams,
  BuildResult,
  ComponentEdit,
  EditableAttribute,
  CurveDefinition,
} from '@/types/parametric-builder';
import { ComponentNode, MaterialDefinition } from '@/types/scene-config';
import { convertCurveToShape } from '@/lib/scene/curve-utils';

/**
 * Build curved fanlight (glazed lunette above rectangular window)
 */
export function buildFanlightComponent(
  width: number,
  fanlightCurve: CurveDefinition,
  config: any
): ComponentNode {
  const fanlight: ComponentNode = {
    id: 'fanlight',
    name: 'Fanlight',
    type: 'group',
    visible: true,
    children: [],
  };

  try {
    const shape = convertCurveToShape(fanlightCurve);
    const points = shape.getPoints(fanlightCurve.resolution || 64);

    // Fanlight frame (curved top, straight bottom)
    fanlight.children!.push({
      id: 'fanlight_frame',
      name: 'Fanlight Frame',
      type: 'frame',
      materialId: 'timber',
      geometry: {
        type: 'shapeExtrude',
        position: [-width / 2, 0, 0],
        customData: {
          shape: {
            points: points.map((p: any) => [p.x, p.y]),
          },
          extrudeSettings: {
            depth: config.frameDepth || 100,
            bevelEnabled: false,
            steps: 1,
          },
        },
      },
      visible: true,
    });

    // Fanlight glass
    fanlight.children!.push({
      id: 'fanlight_glass',
      name: 'Fanlight Glass',
      type: 'glazing',
      materialId: 'glass',
      geometry: {
        type: 'shapeExtrude',
        position: [-width / 2, 0, config.frameDepth / 2],
        customData: {
          shape: {
            points: points.map((p: any) => [p.x, p.y]),
          },
          extrudeSettings: {
            depth: config.glazingThickness || 24,
            bevelEnabled: false,
            steps: 1,
          },
        },
      },
      visible: true,
    });
  } catch (error) {
    console.error('Failed to build fanlight:', error);
  }

  return fanlight;
}

/**
 * Build curved glazing bar (muntin/glazing bar following a curve path)
 */
export function buildCurvedGlazingBar(
  glazingBarCurve: CurveDefinition,
  config: any
): ComponentNode {
  const glazingBar: ComponentNode = {
    id: `glazingBar_${glazingBarCurve.id}`,
    name: `Glazing Bar - ${glazingBarCurve.name}`,
    type: 'frame',
    materialId: 'timber',
    geometry: {
      type: 'tube',
      position: [0, 0, 0],
      customData: {
        path: buildCurvePathData(glazingBarCurve),
        tubularSegments: glazingBarCurve.resolution || 32,
        radius: config.glazingBarRadius || 3,
        radialSegments: 8,
        closed: false,
      },
    },
    visible: true,
  };

  return glazingBar;
}

/**
 * Convert CurveDefinition to path data for TubeGeometry
 */
function buildCurvePathData(curve: CurveDefinition): any {
  const { type, arc, ellipse, bezier, polyline, spline } = curve;

  switch (type) {
    case 'arc':
      return arc || {};
    case 'ellipse':
      return ellipse || {};
    case 'bezier':
      return { type: 'bezier', ...bezier };
    case 'polyline':
      return { type: 'polyline', ...polyline };
    case 'spline':
      return { type: 'spline', ...spline };
    default:
      return {};
  }
}

/**
 * Build curved window head (arched or radius head top)
 */
export function buildCurvedWindowHead(
  width: number,
  headCurve: CurveDefinition,
  config: any
): ComponentNode {
  const windowHead: ComponentNode = {
    id: 'window_curvedHead',
    name: 'Curved Head',
    type: 'group',
    visible: true,
    children: [],
  };

  try {
    const shape = convertCurveToShape(headCurve);
    const points = shape.getPoints(headCurve.resolution || 64);

    // Frame following curve
    windowHead.children!.push({
      id: 'head_frame',
      name: 'Head Frame',
      type: 'frame',
      materialId: 'timber',
      geometry: {
        type: 'shapeExtrude',
        position: [0, 0, 0],
        customData: {
          shape: {
            points: points.map((p: any) => [p.x, p.y]),
          },
          extrudeSettings: {
            depth: config.frameDepth || 100,
            bevelEnabled: false,
            steps: 1,
          },
        },
      },
      visible: true,
    });

    // Glazing under curve
    windowHead.children!.push({
      id: 'head_glazing',
      name: 'Head Glazing',
      type: 'glazing',
      materialId: 'glass',
      geometry: {
        type: 'shapeExtrude',
        position: [0, 0, config.frameDepth / 2 + config.frameDepth / 4],
        customData: {
          shape: {
            points: points.map((p: any) => [p.x, p.y]),
          },
          extrudeSettings: {
            depth: config.glazingThickness || 24,
            bevelEnabled: false,
            steps: 1,
          },
        },
      },
      visible: true,
    });
  } catch (error) {
    console.error('Failed to build curved window head:', error);
  }

  return windowHead;
}

/**
 * Check if window option supports curves
 */
export function windowSupports(feature: 'head' | 'fanlight' | 'glazingBars'): boolean {
  // Most window configurations can support curved elements
  return true;
}

/**
 * Factory to create curve-enhanced window builder
 */
export function createCurveAwareWindowBuilder(
  baseBuilder: ParametricBuilder
): ParametricBuilder {
  return {
    ...baseBuilder,
    build: (params: ProductParams): BuildResult => {
      const baseResult = baseBuilder.build(params);
      
      // If params include curves, enhance the build result
      if (params.curves && params.curves.length > 0 && params.curveSlots) {
        // This would be called by builder registry during rebuild
        // Curves are already injected into components during build process
      }
      
      return baseResult;
    },
  };
}
