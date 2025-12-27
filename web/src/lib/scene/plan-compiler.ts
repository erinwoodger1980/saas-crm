import {
  ProductPlanV1,
  ComponentRole,
  MaterialRole,
  ProfileSlot
} from '@/types/product-plan';
import { ProductParams } from '@/types/parametric-builder';

/**
 * compileProductPlanToProductParams(plan)
 * 
 * Converts a ProductPlanV1 into a ProductParams object that can be used by builders.
 * 
 * Maps:
 * - plan.variables → ProductParams.dimensions (pw, ph, sd)
 * - plan.materialRoles → ProductParams.materialRoleMap (semantic → material id)
 * - plan.profileSlots → stored in customData for profile resolution
 * - plan.components → stored in customData as component metadata
 * 
 * Includes comprehensive [AI2SCENE] debug logging.
 */

export interface PlanCompileContext {
  templateId?: string; // for tracking which template this came from
  source?: 'estimate' | 'upload' | 'fallback';
}

export function compileProductPlanToProductParams(
  plan: ProductPlanV1,
  context?: PlanCompileContext
): ProductParams {
  // Extract dimensions from variables
  const pw = plan.variables['pw']?.defaultValue || plan.dimensions.widthMm || 914;
  const ph = plan.variables['ph']?.defaultValue || plan.dimensions.heightMm || 2032;
  const sd = plan.variables['sd']?.defaultValue || plan.dimensions.depthMm || 45;

  // Build materialRoleMap from plan.materialRoles
  // plan.materialRoles is a dict like { frame: 'TIMBER_PRIMARY', panel: 'PANEL_CORE' }
  // We need to convert to a dict like { TIMBER_PRIMARY: 'timber_oak', PANEL_CORE: 'plywood_birch' }
  // For now, we'll use placeholder IDs; they can be overridden later
  const materialRoleMap = buildMaterialRoleMapFromPlan(plan);

  // Build construction from plan dimensions
  const construction = {
    stileWidth: plan.variables['stileW']?.defaultValue || 50,
    stileDepth: plan.variables['railH']?.defaultValue || 50,
    panelThickness: detectPanelThickness(plan),
    frameDepth: sd,
    // Add more construction fields as needed based on detected type
    ...extractConstructionFromPlan(plan)
  };

  // Store plan metadata in customData
  const customData = {
    plan,
    profileSlots: plan.profileSlots,
    componentMetadata: plan.components,
    variables: plan.variables,
    compiledAt: new Date().toISOString(),
    source: context?.source || 'estimate'
  };

  const params: ProductParams = {
    productType: {
      id: context?.templateId || 'generated',
      category: plan.detected.category as any,
      subcategory: plan.detected.type,
      displayName: `${plan.detected.type} (${plan.detected.option || 'auto'})`,
      defaultWidth: pw,
      defaultHeight: ph,
      defaultDepth: sd,
      availableOptions: plan.detected.option ? [plan.detected.option] : [],
      defaultOption: plan.detected.option || ''
    },
    dimensions: {
      widthMm: pw,
      heightMm: ph,
      depthMm: sd
    },
    construction,
    materialRoleMap,
    materialOverrides: {},
    customData
  };

  // Log compilation summary
  logCompilationSummary(plan, params, context);

  return params;
}

/**
 * Build materialRoleMap from plan.materialRoles
 * Maps semantic roles (e.g., TIMBER_PRIMARY) to placeholder material IDs
 */
function buildMaterialRoleMapFromPlan(plan: ProductPlanV1): Record<string, string> {
  const roleMap: Record<string, string> = {};

  // Map plan.materialRoles (which has arbitrary keys like 'frame', 'panel')
  // to standard material role names
  for (const [key, value] of Object.entries(plan.materialRoles)) {
    // key is semantic (frame, panel, glass, etc.)
    // value is the MaterialRole enum (TIMBER_PRIMARY, PANEL_CORE, etc.)
    
    // Map to placeholder material IDs based on role
    const materialId = mapMaterialRoleToId(value);
    roleMap[value] = materialId;
  }

  return roleMap;
}

/**
 * Maps a MaterialRole to a concrete material ID
 * Placeholders for now; can be replaced with real texture/material IDs
 */
function mapMaterialRoleToId(role: MaterialRole): string {
  const roleIdMap: Record<MaterialRole, string> = {
    TIMBER_PRIMARY: 'timber_oak',
    TIMBER_SECONDARY: 'timber_pine',
    PANEL_CORE: 'plywood_birch',
    SEAL_RUBBER: 'seal_rubber_black',
    SEAL_FOAM: 'seal_foam_white',
    METAL_CHROME: 'metal_chrome_polished',
    METAL_STEEL: 'metal_steel_satin',
    GLASS_CLEAR: 'glass_float_clear_3mm',
    GLASS_LEADED: 'glass_leaded_diamond',
    GLASS_FROSTED: 'glass_frosted_satin',
    PAINT_FINISH: 'paint_white_matte',
    STAIN_FINISH: 'stain_walnut_satin'
  };

  return roleIdMap[role] || `material_${role.toLowerCase()}`;
}

/**
 * Detect panel thickness from components
 */
function detectPanelThickness(plan: ProductPlanV1): number {
  const panelComponent = plan.components.find(c => c.role === 'PANEL');
  if (panelComponent && panelComponent.geometry.depthExpr) {
    const expr = panelComponent.geometry.depthExpr;
    // Try to parse simple numeric values
    const num = parseFloat(expr);
    if (!isNaN(num)) return num;
  }
  return 18; // default
}

/**
 * Extract construction parameters from plan
 */
function extractConstructionFromPlan(plan: ProductPlanV1): Partial<any> {
  const construction: any = {};

  // Add fields based on detected category/type
  if (plan.detected.category === 'door') {
    const railTopComponent = plan.components.find(c => c.role === 'RAIL_TOP');
    const railMidComponent = plan.components.find(c => c.role === 'RAIL_MID');

    construction.doorType = plan.detected.option || 'E02'; // E01, E02, E03, etc.
    construction.hasGlazing = plan.components.some(c => c.role === 'GLASS');
    construction.hasMidRail = !!railMidComponent;
  } else if (plan.detected.category === 'window') {
    const mullionCount = plan.components.filter(c => c.role === 'GLAZING_BAR').length;
    const transom = plan.components.find(c => c.role === 'RAIL_MID');

    construction.windowType = plan.detected.type || 'casement';
    construction.mullionCount = mullionCount;
    construction.hasTransom = !!transom;
    construction.glassThickness = 3.2; // standard float glass
  }

  return construction;
}

/**
 * Log a comprehensive compilation summary with [AI2SCENE] prefix
 */
function logCompilationSummary(
  plan: ProductPlanV1,
  params: ProductParams,
  context?: PlanCompileContext
): void {
  // Count components by role
  const componentsByRole: Record<string, number> = {};
  plan.components.forEach(c => {
    componentsByRole[c.role] = (componentsByRole[c.role] || 0) + 1;
  });

  // Profile source breakdown
  const profilesEstimated = Object.values(plan.profileSlots).filter(p => p.source === 'estimated').length;
  const profilesUploaded = Object.values(plan.profileSlots).filter(p => p.source === 'uploaded').length;

  // Material role breakdown
  const materialsAssigned = Object.keys(plan.materialRoles).length;
  const materialsPlaceholder = Object.values(plan.materialRoles).length;

  // Check for GLTF components without models
  const gltfMissing = plan.components.filter(
    c => c.geometry.type === 'gltf' && !c.geometry.gltfRef
  ).length;

  console.log('[AI2SCENE] ProductPlan Compilation Summary', {
    kind: plan.kind,
    detected: plan.detected,
    source: context?.source || 'unknown',
    templateId: context?.templateId,
    dimensions: {
      width: params.dimensions.widthMm,
      height: params.dimensions.heightMm,
      depth: params.dimensions.depthMm
    },
    componentCounts: {
      total: plan.components.length,
      byRole: componentsByRole
    },
    profileSlots: {
      estimated: profilesEstimated,
      uploaded: profilesUploaded,
      total: Object.keys(plan.profileSlots).length
    },
    materials: {
      rolesAssigned: materialsAssigned,
      placeholdersCount: materialsPlaceholder
    },
    gltf: {
      missingModels: gltfMissing,
      total: plan.components.filter(c => c.geometry.type === 'gltf').length
    },
    variables: Object.keys(plan.variables).length,
    rationale: plan.rationale
  });
}

/**
 * Validate ProductPlan structure and return errors if any
 */
export function validateProductPlan(plan: ProductPlanV1): string[] {
  const errors: string[] = [];

  // Check that plan has components
  if (!plan.components || plan.components.length === 0) {
    errors.push('Plan must have at least one component');
  }

  // For doors, check minimum components
  if (plan.detected.category === 'door') {
    const hasStiles = plan.components.some(c => c.role === 'STILE');
    const hasTopRail = plan.components.some(c => c.role === 'RAIL_TOP');
    const hasBottomRail = plan.components.some(c => c.role === 'RAIL_BOTTOM');
    const hasInfill = plan.components.some(c => c.role === 'PANEL' || c.role === 'GLASS');

    if (!hasStiles) errors.push('Door must have at least one STILE component');
    if (!hasTopRail) errors.push('Door must have at least one RAIL_TOP component');
    if (!hasBottomRail) errors.push('Door must have at least one RAIL_BOTTOM component');
    if (!hasInfill) errors.push('Door must have infill (PANEL or GLASS) component');

    // If glazed, check for beads
    if (hasInfill && plan.components.some(c => c.role === 'GLASS')) {
      const hasBeads = plan.components.some(c => c.role === 'BEAD');
      if (!hasBeads) {
        console.warn('[AI2SCENE] Warning: glazed door without BEAD components (glass may not be retained)');
      }
    }
  }

  // For windows, check minimum components
  if (plan.detected.category === 'window') {
    const hasFrame = plan.components.some(c => c.role === 'FRAME_HEAD' || c.role === 'FRAME_JAMB_L');
    const hasGlass = plan.components.some(c => c.role === 'GLASS');

    if (!hasFrame) errors.push('Window must have at least one FRAME component');
    if (!hasGlass) errors.push('Window must have at least one GLASS component');
  }

  // Check that all components have required fields
  plan.components.forEach((comp, idx) => {
    if (!comp.id) errors.push(`Component ${idx}: missing id`);
    if (!comp.role) errors.push(`Component ${idx}: missing role`);
    if (!comp.geometry) errors.push(`Component ${idx}: missing geometry`);
    if (!comp.transform) errors.push(`Component ${idx}: missing transform`);
    if (!comp.materialRole) errors.push(`Component ${idx}: missing materialRole`);

    if (comp.geometry.type === 'profileExtrude' && !comp.geometry.profileSlot) {
      errors.push(`Component ${comp.id}: profileExtrude requires profileSlot`);
    }
  });

  // Log validation result
  if (errors.length > 0) {
    console.error('[AI2SCENE] ProductPlan validation errors:', errors);
  } else {
    console.log('[AI2SCENE] ProductPlan validation passed');
  }

  return errors;
}
