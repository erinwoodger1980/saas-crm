/**
 * Parametric Builder Registry
 * Central registration and selection of product-specific builders
 * New Flow Spec:
 *  - ConfiguratorMode: 'TEMPLATE' vs 'INSTANCE'
 *  - initializeConfiguratorState(mode, source): unified scene init
 *  - persistConfiguratorState(mode, config, context): unified save
 */

import {
  ParametricBuilder,
  BuilderRegistry,
  ProductParams,
  BuildResult,
} from '@/types/parametric-builder';
import { doorBuilder } from './parametric-door';
import { windowBuilder } from './parametric-window';
import { SceneConfig } from '@/types/scene-config';
import { ConfiguratorMode } from '@/types/parametric-builder';
import { calculateHeroCamera } from './fit-camera';
import { normalizeLightingConfig } from './normalize-lighting';

/**
 * Global builder registry
 * Maps product category to builder implementation
 */
export const builderRegistry: BuilderRegistry = {
  doors: doorBuilder,
  windows: windowBuilder,
};

/**
 * Get builder for product type
 */
export function getBuilder(category: string): ParametricBuilder | null {
  if (!category || typeof category !== 'string') {
    console.warn('[getBuilder] Invalid category:', category);
    return null;
  }
  return builderRegistry[category.toLowerCase()] || null;
}

/**
 * Build scene from parametric inputs
 * This is the main entry point for all parametric generation
 */
export function buildScene(params: ProductParams): BuildResult | null {
  const builder = getBuilder(params.productType.category);
  if (!builder) {
    console.error(`No builder found for category: ${params.productType.category}`);
    return null;
  }
  
  // Validate params
  const errors = builder.validate(params);
  if (errors && errors.length > 0) {
    console.error('Parameter validation failed:', errors);
    console.error('Failed params:', JSON.stringify(params, null, 2));
    return null;
  }
  
  // Build
  return builder.build(params);
}

/**
 * Rebuild scene config from parametric data
 * Updates components, materials, lighting while preserving camera/visibility
 */
export function rebuildSceneConfig(
  config: SceneConfig,
  params: ProductParams
): SceneConfig {
  const result = buildScene(params);
  if (!result) {
    return config; // Return unchanged if build fails
  }
  
  return {
    ...config,
    dimensions: {
      width: params.dimensions.width,
      height: params.dimensions.height,
      depth: params.dimensions.depth,
      bounds: {
        min: [-params.dimensions.width / 2, -params.dimensions.height / 2, -params.dimensions.depth / 2],
        max: [params.dimensions.width / 2, params.dimensions.height / 2, params.dimensions.depth / 2],
      },
    },
    components: result.components,
    materials: result.materials,
    lighting: {
      ...config.lighting,
      boundsX: result.lighting.boundsX,
      boundsZ: result.lighting.boundsZ,
      shadowCatcherDiameter: result.lighting.shadowCatcherDiameter,
    },
    customData: params,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Initialize scene config from parametric params
 * Creates a complete new scene
 */
export function initializeSceneFromParams(
  params: ProductParams,
  tenantId: string,
  entityType: string,
  entityId: string
): SceneConfig | null {
  const result = buildScene(params);
  if (!result) {
    return null;
  }
  
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    dimensions: {
      width: params.dimensions.width,
      height: params.dimensions.height,
      depth: params.dimensions.depth,
      bounds: {
        min: [-params.dimensions.width / 2, 0, -params.dimensions.depth / 2],
        max: [params.dimensions.width / 2, params.dimensions.height, params.dimensions.depth / 2],
      },
    },
    components: result.components,
    materials: result.materials,
    camera: {
      mode: 'Perspective',
      ...calculateHeroCamera({
        productWidth: params.dimensions.width,
        productHeight: params.dimensions.height,
        productDepth: params.dimensions.depth,
      }),
      rotation: [0, 0, 0],
      zoom: 1,
      fov: 45,
    },
    visibility: buildVisibilityMap(result.components),
    lighting: normalizeLightingConfig({
      boundsX: result.lighting.boundsX,
      boundsZ: result.lighting.boundsZ,
      intensity: 3.5,
      shadowCatcherDiameter: result.lighting.shadowCatcherDiameter,
      ambientIntensity: 1.2,
      castShadows: true,
    }),
    ui: {
      guides: false,
      axis: false,
      componentList: true,
      dimensions: false,
    },
    customData: params,
    metadata: {
      productName: `${params.productType.category} - ${params.productType.type} - ${params.productType.option}`,
    },
  };
}

/**
 * Unified initialization for configurator
 * TEMPLATE: build from productType defaults (depth from builder)
 * INSTANCE: build from lineItem (dimensions from lineStandard/meta)
 */
export function initializeConfiguratorState(
  mode: ConfiguratorMode,
  source: {
    tenantId: string;
    entityType: string;
    entityId: string;
    productType?: { category: string; type: string; option: string };
    lineItem?: any;
  }
): SceneConfig | null {
  const { tenantId, entityType, entityId, productType, lineItem } = source;
  if (mode === 'TEMPLATE') {
    if (!productType) return null;
    const width = productType.category === 'doors' ? 914 : 1200;
    const height = productType.category === 'doors' ? 2032 : 1200;
    const depth = 0; // builder default thickness/depth
    const builder = getBuilder(productType.category);
    if (!builder) return null;
    const params = builder.getDefaults(productType, { width, height, depth });
    return initializeSceneFromParams(params, tenantId, entityType, entityId);
  }
  // INSTANCE
  const params = getOrCreateParams(lineItem || {});
  if (!params) return null;
  return initializeSceneFromParams(params, tenantId, entityType, entityId);
}

/**
 * Unified persistence for configurator
 * TEMPLATE: save ProductParams to product type record (templateConfig)
 * INSTANCE: save SceneConfig to scene-state and patch quote line
 */
export async function persistConfiguratorState(
  mode: ConfiguratorMode,
  config: SceneConfig,
  context: {
    tenantId: string;
    entityType: string;
    entityId: string;
    templateId?: string;
    lineItem?: any;
    saveDisabled?: boolean;
  }
): Promise<{ success: boolean; shouldDisable: boolean }> {
  const params = config.customData as ProductParams | undefined;
  if (mode === 'TEMPLATE') {
    if (!params || !context.templateId) {
      console.warn('[persistConfiguratorState] Missing params or templateId');
      return { success: false, shouldDisable: false };
    }
    try {
      const res = await fetch('/api/product-type/template-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId: context.templateId, templateConfig: params }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, shouldDisable: true };
      }
      return { success: res.ok, shouldDisable: false };
    } catch (e) {
      console.error('[persistConfiguratorState] TEMPLATE save error', e);
      return { success: false, shouldDisable: false };
    }
  }

  // INSTANCE persistence: write to /api/scene-state
  try {
    const response = await fetch('/api/scene-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tenantId: context.tenantId,
        entityType: context.entityType,
        entityId: context.entityId,
        config,
      }),
    });
    if (response.status === 401 || response.status === 403) {
      return { success: false, shouldDisable: true };
    }
    return { success: response.ok, shouldDisable: false };
  } catch (e) {
    console.error('[persistConfiguratorState] INSTANCE save error', e);
    return { success: false, shouldDisable: false };
  }
}

/**
 * Build visibility map from component tree
 */
function buildVisibilityMap(components: any[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  
  function traverse(node: any) {
    map[node.id] = node.visible !== false;
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  components.forEach(traverse);
  return map;
}

/**
 * Apply component edit to scene
 * Returns updated scene config
 */
export function applyEditToScene(
  config: SceneConfig,
  componentId: string,
  changes: Record<string, any>
): SceneConfig {
  const params = config.customData as ProductParams;
  if (!params) {
    console.error('No customData found in scene config');
    return config;
  }
  
  const builder = getBuilder(params.productType.category);
  if (!builder) {
    console.error(`No builder found for category: ${params.productType.category}`);
    return config;
  }
  
  // Apply edit to params
  const updatedParams = builder.applyEdit(params, { componentId, changes });
  
  // Rebuild scene
  return rebuildSceneConfig(config, updatedParams);
}

/**
 * Detect product type from quote line item
 * Returns null if cannot be determined
 */
export function detectProductType(
  lineItem: any
): { category: string; type: string; option: string } | null {
  // Try configuredProduct first
  if (lineItem.configuredProduct?.productType) {
    const pt = lineItem.configuredProduct.productType;
    return {
      category: pt.category || 'doors',
      type: pt.type || 'standard',
      option: pt.option || 'E01',
    };
  }
  
  // Try to infer from meta or description
  const desc = (lineItem.description || '').toLowerCase();
  const meta = lineItem.meta || {};
  
  // Detect category
  let category = 'doors'; // Default
  if (desc.includes('window') || meta.productCategory === 'windows') {
    category = 'windows';
  }
  
  // Detect type and option from description patterns
  let type = 'standard';
  let option = 'E01';
  
  if (category === 'doors') {
    if (desc.includes('entrance')) type = 'entrance';
    if (desc.includes('french')) type = 'french';
    if (desc.includes('bifold')) type = 'bifold';
    
    // Detect panel options
    if (desc.match(/4\s*panel/i)) option = 'E02';
    if (desc.match(/glazed.*top/i)) option = 'E03';
  } else if (category === 'windows') {
    if (desc.includes('casement')) type = 'casement';
    if (desc.includes('sash')) type = 'sash';
    if (desc.includes('bay')) type = 'bay';
    
    // Detect layout from description (e.g., "2x2", "3x1")
    const layoutMatch = desc.match(/(\d+)\s*x\s*(\d+)/i);
    if (layoutMatch) {
      option = `${layoutMatch[1]}x${layoutMatch[2]}`;
    }
  }
  
  return { category, type, option };
}

/**
 * Can this line item use the 3D configurator?
 */
export function canConfigure(lineItem: any): boolean {
  const productType = detectProductType(lineItem);
  if (!productType) return false;
  
  const builder = getBuilder(productType.category);
  return builder !== null;
}

/**
 * Get or create parametric params for line item
 */
export function getOrCreateParams(lineItem: any): ProductParams | null {
  const productType = detectProductType(lineItem);
  if (!productType) return null;
  
  const builder = getBuilder(productType.category);
  if (!builder) return null;
  
  // Try to load existing params from configuredProduct
  if (lineItem.configuredProduct?.customData) {
    return lineItem.configuredProduct.customData as ProductParams;
  }

  const templateParams =
    lineItem.configuredProduct?.templateParams ||
    lineItem.meta?.configuredProductTemplateParams;
  const overrides = lineItem.meta?.configuredProductOverrides;

  if (templateParams && overrides) {
    return {
      ...templateParams,
      ...overrides,
      productType: overrides.productType || templateParams.productType,
      dimensions: overrides.dimensions ? { ...templateParams.dimensions, ...overrides.dimensions } : templateParams.dimensions,
      construction: overrides.construction ? { ...templateParams.construction, ...overrides.construction } : templateParams.construction,
      materialRoleMap: overrides.materialRoleMap || templateParams.materialRoleMap,
      materialOverrides: overrides.materialOverrides || templateParams.materialOverrides,
    } as ProductParams;
  }
  
  // Extract dimensions
  const width = lineItem.lineStandard?.widthMm || lineItem.meta?.widthMm || 914;
  const height = lineItem.lineStandard?.heightMm || lineItem.meta?.heightMm || 2032;
  const depth =
    lineItem.lineStandard?.thicknessMm ||
    lineItem.meta?.depthMm ||
    lineItem.meta?.thicknessMm ||
    (productType.category === 'doors' ? 45 : 100);
  
  // Get defaults from builder
  return builder.getDefaults(productType, { width, height, depth });
}
