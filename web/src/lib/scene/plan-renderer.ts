import {
  ProductPlanV1,
  ComponentInstance,
  ProfileSlot
} from '@/types/product-plan';
import { ComponentNode } from '@/types/scene-config';

/**
 * buildSceneFromPlan(plan)
 * 
 * Generates a ComponentNode list from a ProductPlanV1.
 * 
 * Handles:
 * - profileExtrude: loads SVG profile if uploaded, else renders rectangular fallback
 * - box: creates simple BoxGeometry with dimensions from expressions
 * - gltf: renders model if available, else creates a lightweight placeholder mesh
 * 
 * All geometry sizes are computed by evaluating expressions with plan.variables.
 */

export interface RenderContext {
  textureMap?: Record<string, any>; // for material textures
  profileCache?: Record<string, SVGPathData>; // for cached profile geometry
}

interface VariableValues {
  [key: string]: number;
}

/**
 * Build ComponentNode list from ProductPlanV1
 */
export function buildSceneFromPlan(
  plan: ProductPlanV1,
  context?: RenderContext
): ComponentNode[] {
  // Pre-compute variable values
  const varValues = computeVariableValues(plan);

  // Log render context
  console.log('[AI2SCENE] Building scene from ProductPlan', {
    componentCount: plan.components.length,
    variables: varValues,
    profilesAvailable: Object.keys(plan.profileSlots).length,
    profilesWithGeometry: Object.values(plan.profileSlots).filter(p => p.uploadedSvg).length
  });

  const nodes: ComponentNode[] = [];

  for (const planComponent of plan.components) {
    // Compute quantity
    const quantity = evaluateExpression(planComponent.quantityExpr, varValues);

    // Create one or more component instances
    for (let i = 0; i < quantity; i++) {
      const node = buildComponentNode(planComponent, varValues, i, context);
      if (node) {
        nodes.push(node);
      }
    }
  }

  console.log('[AI2SCENE] Scene generation complete:', {
    totalComponents: nodes.length,
    byGeometryType: nodes.reduce((acc, n) => {
      const type = n.geometry?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  return nodes;
}

/**
 * Compute all variable values from plan.variables
 */
function computeVariableValues(plan: ProductPlanV1): VariableValues {
  const values: VariableValues = {};

  for (const [key, variable] of Object.entries(plan.variables)) {
    values[key] = variable.defaultValue;
  }

  return values;
}

/**
 * Build a single ComponentNode from a plan component instance
 */
function buildComponentNode(
  planComponent: ComponentInstance,
  varValues: VariableValues,
  index: number,
  context?: RenderContext
): ComponentNode | null {
  try {
    // Compute transform (position and rotation)
    const position: [number, number, number] = [
      evaluateExpression(planComponent.transform.xExpr, varValues),
      evaluateExpression(planComponent.transform.yExpr, varValues),
      evaluateExpression(planComponent.transform.zExpr, varValues)
    ];

    const rotation: [number, number, number] = [
      ((planComponent.transform.rotXDeg || 0) * Math.PI) / 180,
      ((planComponent.transform.rotYDeg || 0) * Math.PI) / 180,
      ((planComponent.transform.rotZDeg || 0) * Math.PI) / 180
    ];

    // Build geometry based on type
    let geometry: any = null;

    if (planComponent.geometry.type === 'profileExtrude') {
      geometry = buildProfileExtrudeGeometry(planComponent, varValues, context);
    } else if (planComponent.geometry.type === 'box') {
      geometry = buildBoxGeometry(planComponent, varValues);
    } else if (planComponent.geometry.type === 'gltf') {
      geometry = buildGltfGeometry(planComponent, varValues, context);
    }

    if (!geometry) {
      console.warn(`[AI2SCENE] Failed to build geometry for component ${planComponent.id}`);
      return null;
    }

    const node: ComponentNode = {
      id: `${planComponent.id}_${index}`,
      parentId: 'root',
      type: 'group',
      name: planComponent.id,
      visible: true,
      position,
      rotation,
      geometry: geometry as any,
      materialId: planComponent.materialRole, // will be mapped to real material ID later
      role: 'other'
    };

    return node;
  } catch (error) {
    console.error(`[AI2SCENE] Error building component ${planComponent.id}:`, error);
    return null;
  }
}

/**
 * Build geometry for a profileExtrude component
 * 
 * If an SVG profile is uploaded, parse it and extrude.
 * Otherwise, create a rectangular fallback based on profileHint.
 */
function buildProfileExtrudeGeometry(
  planComponent: ComponentInstance,
  varValues: VariableValues,
  context?: RenderContext
): any {
  const geometry = planComponent.geometry;
  const profileSlot = geometry.profileSlot;

  if (!profileSlot) {
    console.error(`[AI2SCENE] profileExtrude missing profileSlot for ${planComponent.id}`);
    return null;
  }

  // TODO: In full implementation, parse SVG profile here
  // For now, render as rectangular extrusion with fallback dimensions

  const length = evaluateExpression(geometry.lengthExpr || '100', varValues);
  const axis = geometry.extrudeAxis || 'z';

  // Create a rectangular fallback (e.g., 35mm × 50mm profile extruded along axis)
  // In real implementation, would load SVG from profileCache or uploadedSvg
  const width = 35;
  const height = 50;

  return {
    type: 'profileExtrude',
    profileSlot,
    width,
    height,
    length,
    axis,
    // SVG path would be loaded from context.profileCache or plan.profileSlots[profileSlot].uploadedSvg
    svgPath: null // TODO: load if available
  };
}

/**
 * Build geometry for a box component
 */
function buildBoxGeometry(
  planComponent: ComponentInstance,
  varValues: VariableValues
): any {
  const geometry = planComponent.geometry;

  const width = evaluateExpression(geometry.widthExpr || '50', varValues);
  const height = evaluateExpression(geometry.heightExpr || '100', varValues);
  const depth = evaluateExpression(geometry.depthExpr || '20', varValues);

  return {
    type: 'box',
    width: Math.max(1, width),
    height: Math.max(1, height),
    depth: Math.max(1, depth)
  };
}

/**
 * Build geometry for a gltf component
 * 
 * If gltfRef is set and available, load the model.
 * Otherwise, create a lightweight placeholder (small box or sphere).
 */
function buildGltfGeometry(
  planComponent: ComponentInstance,
  varValues: VariableValues,
  context?: RenderContext
): any {
  const geometry = planComponent.geometry;
  const gltfRef = geometry.gltfRef;

  if (gltfRef) {
    return {
      type: 'gltf',
      url: gltfRef,
      scale: 1.0
    };
  }

  // No model available; create a placeholder
  // Small box for hardware (handle, lock, hinge)
  console.log(`[AI2SCENE] No gltf model for ${planComponent.id}; using placeholder`);

  return {
    type: 'placeholder',
    role: planComponent.role,
    width: 20,
    height: 20,
    depth: 10
  };
}

/**
 * Evaluate a mathematical expression string with variable substitution
 * 
 * Examples:
 *   "pw" → value of pw variable
 *   "ph - 100" → height minus 100
 *   "(pw - stileW - stileW) / 2" → (width minus two stile widths) divided by 2
 *   "2" → literal 2
 * 
 * Uses simple regex-based substitution; eval should never be used in production.
 * For safety, we use a restricted evaluator or mathematical expression parser.
 */
function evaluateExpression(expr: string, varValues: VariableValues): number {
  try {
    let evaluated = expr;

    // Substitute all variables
    for (const [key, value] of Object.entries(varValues)) {
      // Replace word boundaries to avoid partial replacements
      evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
    }

    // Simple safety check: ensure only math operators are present
    if (!/^[\d\s+\-*/.()]*$/.test(evaluated)) {
      console.warn(`[AI2SCENE] Expression contains invalid characters: ${expr}`);
      return 0;
    }

    // Evaluate the expression using Function (safer than eval, but still restricted)
    // In production, use a proper math expression parser library
    const result = new Function(`return ${evaluated}`)();
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error(`[AI2SCENE] Failed to evaluate expression "${expr}":`, error);
    return 0;
  }
}

/**
 * Parse an SVG path and extract profile dimensions
 * (Placeholder; full implementation would parse actual SVG)
 */
interface SVGPathData {
  width: number;
  height: number;
  path: string;
}

function parseSVGProfile(svgText: string): SVGPathData | null {
  try {
    // TODO: Parse viewBox, extract path data, compute bounding box
    return null;
  } catch (error) {
    console.error('[AI2SCENE] Failed to parse SVG profile:', error);
    return null;
  }
}
