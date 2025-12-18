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
  const { dimensions, construction, productType } = params;
  const { width, height, depth } = dimensions;
  
  // Merge with defaults
  const config = {
    ...WINDOW_DEFAULTS,
    frameDepth: depth || WINDOW_DEFAULTS.frameDepth,
    ...construction,
  };
  
  const components: ComponentNode[] = [];
  const materials: MaterialDefinition[] = createWindowMaterials(config);
  
  // Root product node
  const product: ComponentNode = {
    id: 'product',
    name: 'Window',
    type: 'group',
    geometry: {
      type: 'box',
      dimensions: [width, height, config.frameDepth],
      position: [0, 0, 0],
    },
    visible: true,
    children: [],
  };
  
  // Build outer frame
  const outerFrame = buildWindowOuterFrame(width, height, config);
  product.children!.push(outerFrame);
  
  // Build sashes/casements based on layout
  const layout = construction.layout || { mullions: 0, transoms: 0 };
  const sashes = buildWindowSashes(width, height, config, layout);
  product.children!.push(...sashes);
  
  // Build mullions if specified
  if (layout.mullions > 0) {
    const mullions = buildMullions(width, height, config, layout.mullions);
    product.children!.push(...mullions);
  }
  
  // Build transoms if specified
  if (layout.transoms > 0) {
    const transoms = buildTransoms(width, height, config, layout.transoms);
    product.children!.push(...transoms);
  }
  
  components.push(product);
  
  // Calculate lighting bounds
  const lighting = {
    boundsX: [-width / 2 * 1.5, width / 2 * 1.5] as [number, number],
    boundsZ: [-config.frameDepth / 2 * 1.5, config.frameDepth / 2 * 1.5] as [number, number],
    shadowCatcherDiameter: Math.max(width, height) * 2,
  };
  
  return {
    components,
    materials,
    lighting,
    params,
    editableAttributes: buildEditableAttributes(params, components),
  };
}

/**
 * Build outer window frame
 */
function buildWindowOuterFrame(width: number, height: number, config: any): ComponentNode {
  const { frameWidth, frameDepth } = config;
  
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'timber',
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
  width: number,
  height: number,
  config: any,
  layout: { mullions: number; transoms: number }
): ComponentNode[] {
  const { frameWidth, sashStileWidth, sashRailHeight, sashDepth } = config;
  
  const sashes: ComponentNode[] = [];
  
  // Calculate available space
  const availableWidth = width - 2 * frameWidth - layout.mullions * config.mullionWidth;
  const availableHeight = height - 2 * frameWidth - layout.transoms * config.transomHeight;
  
  // Number of sashes = (mullions + 1) * (transoms + 1)
  const horizontalSashes = layout.mullions + 1;
  const verticalSashes = layout.transoms + 1;
  
  const sashWidth = availableWidth / horizontalSashes;
  const sashHeight = availableHeight / verticalSashes;
  
  // Generate sashes
  for (let row = 0; row < verticalSashes; row++) {
    for (let col = 0; col < horizontalSashes; col++) {
      const sashId = `sash_r${row + 1}c${col + 1}`;
      
      // Calculate position
      const xStart = -width / 2 + frameWidth;
      const yStart = height / 2 - frameWidth;
      
      const xOffset = xStart + col * (sashWidth + config.mullionWidth) + sashWidth / 2;
      const yOffset = yStart - row * (sashHeight + config.transomHeight) - sashHeight / 2;
      
      const sash = buildSingleSash(
        sashId,
        `Sash R${row + 1}C${col + 1}`,
        sashWidth,
        sashHeight,
        config,
        [xOffset, yOffset, 0]
      );
      
      sashes.push(sash);
    }
  }
  
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
  position: [number, number, number]
): ComponentNode {
  const { sashStileWidth, sashRailHeight, sashDepth, glazingThickness, glazingGap, beadWidth } = config;
  
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'glass',
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
      materialId: 'timber',
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
  width: number,
  height: number,
  config: any,
  count: number
): ComponentNode[] {
  const { frameWidth, mullionWidth, frameDepth } = config;
  
  const mullions: ComponentNode[] = [];
  const availableWidth = width - 2 * frameWidth;
  const spacing = availableWidth / (count + 1);
  const mullionHeight = height - 2 * frameWidth;
  
  for (let i = 0; i < count; i++) {
    const xPos = -width / 2 + frameWidth + (i + 1) * spacing;
    
    mullions.push({
      id: `mullion_${i + 1}`,
      name: `Mullion ${i + 1}`,
      type: 'frame',
      materialId: 'timber',
      geometry: {
        type: 'box',
        dimensions: [mullionWidth, mullionHeight, frameDepth],
        position: [xPos, 0, 0],
      },
      visible: true,
    });
  }
  
  return mullions;
}

/**
 * Build transoms (horizontal dividers)
 */
function buildTransoms(
  width: number,
  height: number,
  config: any,
  count: number
): ComponentNode[] {
  const { frameWidth, transomHeight, frameDepth } = config;
  
  const transoms: ComponentNode[] = [];
  const availableHeight = height - 2 * frameWidth;
  const spacing = availableHeight / (count + 1);
  const transomWidth = width - 2 * frameWidth;
  
  for (let i = 0; i < count; i++) {
    const yPos = height / 2 - frameWidth - (i + 1) * spacing;
    
    transoms.push({
      id: `transom_${i + 1}`,
      name: `Transom ${i + 1}`,
      type: 'frame',
      materialId: 'timber',
      geometry: {
        type: 'box',
        dimensions: [transomWidth, transomHeight, frameDepth],
        position: [0, yPos, 0],
      },
      visible: true,
    });
  }
  
  return transoms;
}

/**
 * Create window materials
 */
function createWindowMaterials(config: any): MaterialDefinition[] {
  return [
    {
      id: 'timber',
      name: config.timber || 'Sapele',
      type: 'wood',
      baseColor: '#8b5a3c',
      roughness: 0.7,
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
      id: 'paint',
      name: config.finish || 'White Paint',
      type: 'painted',
      baseColor: '#f8f8f8',
      roughness: 0.25,
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
  
  const layout = params.construction.layout || { mullions: 0, transoms: 0 };
  
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
      key: 'mullions',
      label: 'Mullions',
      type: 'number',
      value: layout.mullions,
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
      value: layout.transoms,
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
    if (key !== 'mullions' && key !== 'transoms') {
      if (updated.construction) {
        updated.construction[key] = edit.changes[key];
      }
    }
  });
  
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
  
  return {
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
    },
    addedParts: [],
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
