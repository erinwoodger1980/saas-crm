/**
 * Parametric Window Builder
 * Generates window component trees from parametric inputs
 * Supports casements, sashes, mullions, transoms
 */

import {
  ParametricBuilder,
  ProductParams,
  BuildResult,
  ComponentEdit,
  EditableAttribute,
} from '@/types/parametric-builder';
import { ComponentNode, MaterialDefinition } from '@/types/scene-config';
import { resolveWindowLayout } from '@/lib/scene/layout';
import { deriveMaterialRoleMap, resolveMaterialId } from '@/lib/scene/material-role-map';

/**
 * Window-specific defaults
 */
const WINDOW_DEFAULTS = {
  frameDepth: 100, // mm - overall frame depth
  sashDepth: 68, // mm - sash thickness
  frameWidth: 68, // mm - frame member width
  sashStileWidth: 58, // mm
  sashRailHeight: 58, // mm
  mullionWidth: 68, // mm
  transomHeight: 68, // mm
  glazingThickness: 24, // Double glazed unit
  glazingGap: 10, // mm - gap between glass and frame
  beadWidth: 15, // mm
};

/**
 * Build window component tree
 */
export function buildWindowComponentTree(params: ProductParams): BuildResult {
  const { dimensions, construction } = params;
  const { width, height, depth } = dimensions;
  
  // Merge with defaults
  const config = {
    ...WINDOW_DEFAULTS,
    frameDepth: depth || WINDOW_DEFAULTS.frameDepth,
    ...construction,
    materialRoleMap: params.materialRoleMap,
  };
  
  const components: ComponentNode[] = [];
  const roleMap = params.materialRoleMap || deriveMaterialRoleMap(params);
  const materials: MaterialDefinition[] = createWindowMaterials(config);
  const resolvedParams: ProductParams = {
    ...params,
    materialRoleMap: roleMap,
  };
  const overrides = params.materialOverrides || {};
  const layout = resolveWindowLayout(resolvedParams);
  const layoutWidth = layout.width;
  const layoutHeight = layout.height;
  
  // Root product node
  const product: ComponentNode = {
    id: 'product',
    name: 'Window',
    type: 'group',
    geometry: {
      type: 'box',
      dimensions: [layoutWidth, layoutHeight, config.frameDepth],
      position: [0, 0, 0],
    },
    visible: true,
    children: [],
  };
  
  // Build outer frame
  const outerFrame = buildWindowOuterFrame(layout, config, roleMap, overrides);
  product.children!.push(outerFrame);
  
  // Build sashes/casements based on layout
  const sashes = buildWindowSashes(layout, config, roleMap, overrides);
  product.children!.push(...sashes);
  
  // Build mullions if specified
  const mullions = buildMullions(layout, config, roleMap, overrides);
  if (mullions.length > 0) product.children!.push(...mullions);
  
  // Build transoms if specified
  const transoms = buildTransoms(layout, config, roleMap, overrides);
  if (transoms.length > 0) product.children!.push(...transoms);
  
  components.push(product);
  
  // Calculate lighting bounds
  const lighting = {
    boundsX: [-layoutWidth / 2 * 1.5, layoutWidth / 2 * 1.5] as [number, number],
    boundsZ: [-config.frameDepth / 2 * 1.5, config.frameDepth / 2 * 1.5] as [number, number],
    shadowCatcherDiameter: Math.max(layoutWidth, layoutHeight) * 2,
  };
  
  return {
    components,
    materials,
    lighting,
    params: resolvedParams,
    editableAttributes: buildEditableAttributes(resolvedParams, components),
  };
}

/**
 * Build outer window frame
 */
function buildWindowOuterFrame(
  layout: ReturnType<typeof resolveWindowLayout>,
  config: any,
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string>
): ComponentNode {
  const { frameWidth, width, height } = layout;
  const frameDepth = config.frameDepth;
  
  const frame: ComponentNode = {
    id: 'outerFrame',
    name: 'Outer Frame',
    type: 'frame',
    visible: true,
    children: [],
  };
  
  // Head (top)
  frame.children!.push({
    id: 'frame_head',
    name: 'Head',
    type: 'frame',
    role: 'rail',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_head', roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [width, frameWidth, frameDepth],
      position: [0, height / 2 - frameWidth / 2, 0],
    },
    visible: true,
  });
  
  // Sill (bottom)
  frame.children!.push({
    id: 'frame_sill',
    name: 'Sill',
    type: 'frame',
    role: 'rail',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_sill', roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [width, frameWidth, frameDepth],
      position: [0, -height / 2 + frameWidth / 2, 0],
    },
    visible: true,
  });
  
  // Left jamb
  const jambHeight = height - 2 * frameWidth;
  frame.children!.push({
    id: 'frame_leftJamb',
    name: 'Left Jamb',
    type: 'frame',
    role: 'stile',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_leftJamb', roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [frameWidth, jambHeight, frameDepth],
      position: [-width / 2 + frameWidth / 2, 0, 0],
    },
    visible: true,
  });
  
  // Right jamb
  frame.children!.push({
    id: 'frame_rightJamb',
    name: 'Right Jamb',
    type: 'frame',
    role: 'stile',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_rightJamb', roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [frameWidth, jambHeight, frameDepth],
      position: [width / 2 - frameWidth / 2, 0, 0],
    },
    visible: true,
  });
  
  return frame;
}

/**
 * Build window sashes
 */
function buildWindowSashes(
  layout: ReturnType<typeof resolveWindowLayout>,
  config: any,
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string>
): ComponentNode[] {
  const sashes: ComponentNode[] = [];

  layout.sashes.forEach((slot) => {
    const sash = buildSingleSash(
      slot.id,
      `Sash ${slot.id}`,
      slot.rect.width,
      slot.rect.height,
      config,
      [slot.rect.x, slot.rect.y, 0],
      roleMap,
      overrides
    );
    sashes.push(sash);
  });

  return sashes;
}

/**
 * Build single sash with frame and glazing
 */
function buildSingleSash(
  id: string,
  name: string,
  width: number,
  height: number,
  config: any,
  position: [number, number, number],
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string>
): ComponentNode {
  const { sashStileWidth, sashRailHeight, sashDepth, glazingThickness, glazingGap, beadWidth } = config;
  const frameMaterialId = resolveMaterialId('FRAME_TIMBER', `${id}_frame`, roleMap, overrides);
  const glassMaterialId = resolveMaterialId('GLASS', `${id}_glass`, roleMap, overrides);
  
  const sash: ComponentNode = {
    id,
    name,
    type: 'group',
    visible: true,
    children: [],
  };
  
  // Sash frame members
  const frameMembers: ComponentNode = {
    id: `${id}_frame`,
    name: 'Sash Frame',
    type: 'frame',
    visible: true,
    children: [],
  };
  
  // Top rail
  frameMembers.children!.push({
    id: `${id}_topRail`,
    name: 'Top Rail',
    type: 'frame',
    role: 'rail',
    materialId: frameMaterialId,
    geometry: {
      type: 'box',
      dimensions: [width, sashRailHeight, sashDepth],
      position: [position[0], position[1] + height / 2 - sashRailHeight / 2, position[2]],
    },
    visible: true,
  });
  
  // Bottom rail
  frameMembers.children!.push({
    id: `${id}_bottomRail`,
    name: 'Bottom Rail',
    type: 'frame',
    role: 'rail',
    materialId: frameMaterialId,
    geometry: {
      type: 'box',
      dimensions: [width, sashRailHeight, sashDepth],
      position: [position[0], position[1] - height / 2 + sashRailHeight / 2, position[2]],
    },
    visible: true,
  });
  
  // Left stile
  const stileHeight = height - 2 * sashRailHeight;
  frameMembers.children!.push({
    id: `${id}_leftStile`,
    name: 'Left Stile',
    type: 'frame',
    role: 'stile',
    materialId: frameMaterialId,
    geometry: {
      type: 'box',
      dimensions: [sashStileWidth, stileHeight, sashDepth],
      position: [position[0] - width / 2 + sashStileWidth / 2, position[1], position[2]],
    },
    visible: true,
  });
  
  // Right stile
  frameMembers.children!.push({
    id: `${id}_rightStile`,
    name: 'Right Stile',
    type: 'frame',
    role: 'stile',
    materialId: frameMaterialId,
    geometry: {
      type: 'box',
      dimensions: [sashStileWidth, stileHeight, sashDepth],
      position: [position[0] + width / 2 - sashStileWidth / 2, position[1], position[2]],
    },
    visible: true,
  });
  
  sash.children!.push(frameMembers);
  
  // Glazing unit
  const glazingWidth = width - 2 * sashStileWidth - 2 * glazingGap;
  const glazingHeight = height - 2 * sashRailHeight - 2 * glazingGap;
  
  const glazing: ComponentNode = {
    id: `${id}_glazing`,
    name: 'Glazing',
    type: 'group',
    visible: true,
    children: [],
  };
  
  // Glass
  glazing.children!.push({
    id: `${id}_glass`,
    name: 'Glass Unit',
    type: 'glazing',
    role: 'glass',
    materialId: glassMaterialId,
    geometry: {
      type: 'box',
      dimensions: [glazingWidth, glazingHeight, glazingThickness],
      position: [position[0], position[1], position[2]],
    },
    visible: true,
  });
  
  // Glazing beads (simplified - just 4 sides)
  const beadPositions = [
    { id: `${id}_bead_top`, pos: [position[0], position[1] + glazingHeight / 2 + beadWidth / 2, position[2]], dims: [glazingWidth, beadWidth, sashDepth] },
    { id: `${id}_bead_bottom`, pos: [position[0], position[1] - glazingHeight / 2 - beadWidth / 2, position[2]], dims: [glazingWidth, beadWidth, sashDepth] },
    { id: `${id}_bead_left`, pos: [position[0] - glazingWidth / 2 - beadWidth / 2, position[1], position[2]], dims: [beadWidth, glazingHeight, sashDepth] },
    { id: `${id}_bead_right`, pos: [position[0] + glazingWidth / 2 + beadWidth / 2, position[1], position[2]], dims: [beadWidth, glazingHeight, sashDepth] },
  ];
  
  beadPositions.forEach(({ id: beadId, pos, dims }) => {
    glazing.children!.push({
      id: beadId,
      name: 'Bead',
      type: 'glazing',
      role: 'rail',
      materialId: frameMaterialId,
      geometry: {
        type: 'box',
        dimensions: dims as [number, number, number],
        position: pos as [number, number, number],
      },
      visible: true,
    });
  });
  
  sash.children!.push(glazing);
  
  return sash;
}

/**
 * Build mullions (vertical dividers)
 */
function buildMullions(
  layout: ReturnType<typeof resolveWindowLayout>,
  config: any,
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string>
): ComponentNode[] {
  const { frameDepth } = config;

  return layout.mullions.map((slot) => ({
    id: slot.id,
    name: slot.id.replace(/_/g, ' '),
    type: 'frame',
    role: 'other',
    materialId: resolveMaterialId('FRAME_TIMBER', slot.id, roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [slot.rect.width, slot.rect.height, frameDepth],
      position: [slot.rect.x, slot.rect.y, 0],
    },
    visible: true,
  }));
}

/**
 * Build transoms (horizontal dividers)
 */
function buildTransoms(
  layout: ReturnType<typeof resolveWindowLayout>,
  config: any,
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string>
): ComponentNode[] {
  const { frameDepth } = config;

  return layout.transoms.map((slot) => ({
    id: slot.id,
    name: slot.id.replace(/_/g, ' '),
    type: 'frame',
    role: 'other',
    materialId: resolveMaterialId('FRAME_TIMBER', slot.id, roleMap, overrides),
    geometry: {
      type: 'box',
      dimensions: [slot.rect.width, slot.rect.height, frameDepth],
      position: [slot.rect.x, slot.rect.y, 0],
    },
    visible: true,
  }));
}

/**
 * Create window materials
 */
function createWindowMaterials(config: any): MaterialDefinition[] {
  return [
    {
      id: 'timber',
      name: config.timber || 'Timber',
      type: 'wood',
      baseColor: '#8b5a3c',
      roughness: 0.7,
      metalness: 0.0,
    },
    {
      id: 'oak',
      name: 'Oak',
      type: 'wood',
      baseColor: '#d4a574',
      roughness: 0.7,
      metalness: 0.0,
    },
    {
      id: 'oak-veneer',
      name: 'Oak Veneered Ply',
      type: 'wood',
      baseColor: '#c9a16b',
      roughness: 0.75,
      metalness: 0.0,
    },
    {
      id: 'accoya',
      name: 'Accoya',
      type: 'wood',
      baseColor: '#c7a47d',
      roughness: 0.65,
      metalness: 0.0,
    },
    {
      id: 'painted-wood',
      name: config.finish || 'Painted Timber',
      type: 'painted',
      baseColor: '#f2f2f2',
      roughness: 0.4,
      metalness: 0.0,
    },
    {
      id: 'painted-accoya',
      name: 'Painted Accoya',
      type: 'painted',
      baseColor: '#f0f0f0',
      roughness: 0.4,
      metalness: 0.0,
    },
    {
      id: 'glass',
      name: config.glazingType || 'Low-E Double Glazed',
      type: 'glass',
      baseColor: '#d0e8f0',
      roughness: 0.05,
      metalness: 0.0,
    },
    {
      id: 'chrome',
      name: 'Chrome',
      type: 'metal',
      baseColor: '#d9d9d9',
      roughness: 0.25,
      metalness: 1.0,
    },
    {
      id: 'rubber',
      name: 'Rubber Seal',
      type: 'painted',
      baseColor: '#2f2f2f',
      roughness: 0.9,
      metalness: 0.0,
    },
  ];
}

/**
 * Build editable attributes for inspector
 */
function buildEditableAttributes(
  params: ProductParams,
  components: ComponentNode[]
): Record<string, EditableAttribute[]> {
  const attrs: Record<string, EditableAttribute[]> = {};
  const layout = resolveWindowLayout(params);
  
  // Frame attributes
  attrs['outerFrame'] = [
    {
      key: 'frameWidth',
      label: 'Frame Width',
      type: 'number',
      value: params.construction.frameWidth || WINDOW_DEFAULTS.frameWidth,
      unit: 'mm',
      min: 40,
      max: 150,
      step: 1,
    },
    {
      key: 'frameDepth',
      label: 'Frame Depth',
      type: 'number',
      value: params.construction.frameDepth || WINDOW_DEFAULTS.frameDepth,
      unit: 'mm',
      min: 60,
      max: 150,
      step: 1,
    },
  ];
  
  // Layout attributes
  attrs['product'] = [
    {
      key: 'width',
      label: 'Overall Width',
      type: 'number',
      value: params.dimensions.width,
      unit: 'mm',
      min: 400,
      max: 4000,
      step: 1,
      helpText: 'Window overall width',
    },
    {
      key: 'height',
      label: 'Overall Height',
      type: 'number',
      value: params.dimensions.height,
      unit: 'mm',
      min: 400,
      max: 3000,
      step: 1,
      helpText: 'Window overall height',
    },
    {
      key: 'depth',
      label: 'Frame Depth',
      type: 'number',
      value: params.dimensions.depth,
      unit: 'mm',
      min: 60,
      max: 200,
      step: 1,
      helpText: 'Overall frame depth (syncs frameDepth)',
    },
    {
      key: 'mullions',
      label: 'Mullions',
      type: 'number',
      value: Math.max(0, layout.mullions.length),
      unit: 'count',
      min: 0,
      max: 4,
      step: 1,
      helpText: 'Vertical dividers',
    },
    {
      key: 'transoms',
      label: 'Transoms',
      type: 'number',
      value: Math.max(0, layout.transoms.length),
      unit: 'count',
      min: 0,
      max: 4,
      step: 1,
      helpText: 'Horizontal dividers',
    },
    {
      key: 'timber',
      label: 'Timber Species',
      type: 'select',
      value: params.construction.timber || 'Sapele',
      options: [
        { value: 'Sapele', label: 'Sapele' },
        { value: 'Oak', label: 'Oak' },
        { value: 'Accoya', label: 'Accoya' },
        { value: 'Meranti', label: 'Meranti' },
      ],
    },
    {
      key: 'glazingType',
      label: 'Glazing',
      type: 'select',
      value: params.construction.glazingType || 'Low-E Double Glazed',
      options: [
        { value: 'Low-E Double Glazed', label: 'Low-E Double Glazed' },
        { value: 'Triple Glazed', label: 'Triple Glazed' },
        { value: 'Acoustic', label: 'Acoustic' },
        { value: 'Obscured', label: 'Obscured' },
      ],
    },
  ];
  
  return attrs;
}

/**
 * Apply edit to parameters
 */
export function applyWindowEdit(params: ProductParams, edit: ComponentEdit): ProductParams {
  const updated = { ...params };
  
  // Handle global dimension edits when editing the root product
  if (edit.componentId === 'product') {
    const nextWidth = typeof edit.changes.width === 'number' ? Math.round(edit.changes.width) : undefined;
    const nextHeight = typeof edit.changes.height === 'number' ? Math.round(edit.changes.height) : undefined;
    const nextDepth = typeof edit.changes.depth === 'number' ? Math.round(edit.changes.depth) : undefined;

    updated.dimensions = {
      width: nextWidth ?? updated.dimensions.width,
      height: nextHeight ?? updated.dimensions.height,
      depth: nextDepth ?? updated.dimensions.depth,
    };

    // Sync construction.frameDepth with overall depth
    if (typeof nextDepth === 'number') {
      updated.construction = {
        ...updated.construction,
        frameDepth: nextDepth,
      } as any;
    }
  }

  // Handle layout changes specially
  if (edit.changes.mullions !== undefined || edit.changes.transoms !== undefined) {
    if (!updated.construction.layout) {
      updated.construction.layout = { mullions: 0, transoms: 0 };
    }
    if (edit.changes.mullions !== undefined) {
      updated.construction.layout.mullions = edit.changes.mullions;
    }
    if (edit.changes.transoms !== undefined) {
      updated.construction.layout.transoms = edit.changes.transoms;
    }
  }
  
  // Update other construction values
  Object.keys(edit.changes).forEach(key => {
    if (key !== 'mullions' && key !== 'transoms' && key !== 'width' && key !== 'height' && key !== 'depth') {
      if (updated.construction) {
        updated.construction[key] = edit.changes[key];
      }
    }
  });

  if (edit.changes.timber !== undefined || edit.changes.finish !== undefined) {
    updated.materialRoleMap = deriveMaterialRoleMap(updated);
  }
  
  return updated;
}

/**
 * Validate window parameters
 */
export function validateWindowParams(params: ProductParams): string[] | null {
  const errors: string[] = [];
  
  const { width, height, depth } = params.dimensions;
  
  if (width < 400) errors.push('Width must be at least 400mm');
  if (width > 4000) errors.push('Width must not exceed 4000mm');
  if (height < 400) errors.push('Height must be at least 400mm');
  if (height > 3000) errors.push('Height must not exceed 3000mm');
  if (depth < 60) errors.push('Frame depth must be at least 60mm');
  if (depth > 200) errors.push('Frame depth must not exceed 200mm');
  
  const layout = params.construction.layout;
  if (layout) {
    if (layout.mullions < 0 || layout.mullions > 4) {
      errors.push('Mullions must be between 0 and 4');
    }
    if (layout.transoms < 0 || layout.transoms > 4) {
      errors.push('Transoms must be between 0 and 4');
    }
  }
  
  return errors.length > 0 ? errors : null;
}

/**
 * Get default window parameters
 */
export function getDefaultWindowParams(
  productType: { category: string; type: string; option: string },
  dimensions: { width: number; height: number; depth: number }
): ProductParams {
  // Parse option for layout hints (e.g., "2x2" = 1 mullion, 1 transom)
  let mullions = 0;
  let transoms = 0;
  
  if (productType.option) {
    const match = productType.option.match(/(\d+)x(\d+)/);
    if (match) {
      mullions = parseInt(match[1]) - 1;
      transoms = parseInt(match[2]) - 1;
    }
  }
  
  const base: ProductParams = {
    productType,
    dimensions,
    construction: {
      frameWidth: WINDOW_DEFAULTS.frameWidth,
      frameDepth: dimensions.depth || WINDOW_DEFAULTS.frameDepth,
      sashStileWidth: WINDOW_DEFAULTS.sashStileWidth,
      sashRailHeight: WINDOW_DEFAULTS.sashRailHeight,
      mullionWidth: WINDOW_DEFAULTS.mullionWidth,
      transomHeight: WINDOW_DEFAULTS.transomHeight,
      layout: { mullions, transoms },
      timber: 'oak',
      finish: 'clear',
      glazingType: 'double',
    },
    addedParts: [],
  };
  return {
    ...base,
    materialRoleMap: deriveMaterialRoleMap(base),
  };
}

/**
 * Window builder implementation
 */
export const windowBuilder: ParametricBuilder = {
  type: 'window',
  build: buildWindowComponentTree,
  applyEdit: applyWindowEdit,
  validate: validateWindowParams,
  getDefaults: getDefaultWindowParams,
};
