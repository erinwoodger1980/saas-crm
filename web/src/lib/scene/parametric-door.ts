/**
 * Parametric Door Builder
 * Generates door component trees from parametric inputs
 * Supports E01 (2 panels), E02 (4 panels), E03 (glazed top)
 */

import {
  ParametricBuilder,
  ProductParams,
  BuildResult,
  ComponentEdit,
  EditableAttribute,
  ProfileDefinition,
} from '@/types/parametric-builder';
import { ComponentNode, MaterialDefinition } from '@/types/scene-config';
import * as THREE from 'three';
import { resolveDoorLayout } from '@/lib/scene/layout';
import { deriveMaterialRoleMap, resolveMaterialId } from '@/lib/scene/material-role-map';

/**
 * Door-specific defaults
 */
const DOOR_DEFAULTS = {
  thickness: 58, // mm
  stileWidth: 114, // mm
  topRail: 114, // mm
  midRail: 200, // mm
  bottomRail: 200, // mm
  panelThickness: 18, // mm
  glazingThickness: 24, // Double glazed unit
  beadWidth: 20, // mm
  mouldingWidth: 25, // mm
  mouldingProjection: 12, // mm
};

function buildProfileLookup(profiles?: ProfileDefinition[]): Record<string, ProfileDefinition> {
  if (!profiles) return {};
  return profiles.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {} as Record<string, ProfileDefinition>);
}

function buildProfileGeometry(params: {
  kind: 'vertical' | 'horizontal';
  width: number;
  height: number;
  depth: number;
  position: [number, number, number];
  profile?: ProfileDefinition;
}): ComponentNode['geometry'] {
  const { kind, width, height, depth, position, profile } = params;

  if (!profile || (!profile.shape2D?.points && !profile.svgText) || (profile.shape2D?.points?.length ?? 0) < 2) {
    return {
      type: 'box',
      dimensions: [width, height, depth],
      position,
    };
  }

  let points = profile.shape2D?.points;
  if (!points && profile.svgText) {
    try {
      const { SVGLoader } = require('three/examples/jsm/loaders/SVGLoader.js');
      const loader = new SVGLoader();
      const data = loader.parse(profile.svgText);
      const firstShape = data.paths?.[0]?.toShapes(true)?.[0];
      if (firstShape) {
        points = firstShape.getPoints().map((p: any) => [p.x, p.y]);
      }
    } catch (error) {
      console.warn('[buildProfileGeometry] Failed to parse SVG profile, falling back to box:', error);
    }
  }

  if (!points || points.length < 2) {
    return {
      type: 'box',
      dimensions: [width, height, depth],
      position,
    };
  }

  const path = kind === 'vertical'
    ? [
        [0, -height / 2, 0],
        [0, height / 2, 0],
      ]
    : [
        [-width / 2, 0, 0],
        [width / 2, 0, 0],
      ];

  return {
    type: 'profileExtrude' as any,
    dimensions: [width, height, depth],
    position,
    customData: {
      profile: { points } as any,
      path: path as any,
      closed: profile.shape2D?.closed ?? true,
      fallbackBox: { width, height, depth },
    },
  };
}

/**
 * Build door component tree
 */
export function buildDoorComponentTree(params: ProductParams): BuildResult {
  const { dimensions, construction, productType, curves, curveSlots } = params;
  const { width, height, depth } = dimensions;
  
  // Merge with defaults
  const config = {
    ...DOOR_DEFAULTS,
    thickness: depth || DOOR_DEFAULTS.thickness,
    ...construction,
  };
  
  // Build components based on option
  const components: ComponentNode[] = [];
  const roleMap = params.materialRoleMap || deriveMaterialRoleMap(params);
  const materials: MaterialDefinition[] = createDoorMaterials(config);
  const resolvedParams: ProductParams = {
    ...params,
    materialRoleMap: roleMap,
  };

  const layout = resolveDoorLayout(resolvedParams);
  const layoutWidth = layout.width;
  const layoutHeight = layout.height;
  const layoutDepth = layout.depth;
  const profileLookup = buildProfileLookup(params.profiles);
  
  // Root product node
  const product: ComponentNode = {
    id: 'product',
    name: 'Door Leaf',
    type: 'group',
    geometry: {
      type: 'box',
      dimensions: [layoutWidth, layoutHeight, config.thickness],
      position: [0, 0, 0],
    },
    visible: true,
    children: [],
  };
  
  // Build frame
  const frame = buildDoorFrame(layout, config, profileLookup, construction?.profileIds, roleMap, params.materialOverrides);
  product.children!.push(frame);
  
  // Check if door has curved head (arch support)
  const hasArch = curves && curves.length > 0 && curveSlots?.headProfileCurveId;
  
  if (hasArch && supportsArches(productType.option)) {
    // Find the head curve
    const headCurveId = curveSlots.headProfileCurveId;
    const headCurve = curves.find(c => c.id === headCurveId);
    
    if (headCurve) {
      // Build arched head instead of regular infill
      const archHead = buildArchedDoorHead(width, height, config, headCurve, productType.option);
      product.children!.push(archHead);
      
      // For E03 arched, add bottom panels
      if (productType.option === 'E03') {
        const bottomPanels = buildPanelsFromLayout(layout, config, profileLookup, construction?.profileIds, roleMap, params.materialOverrides);
        product.children!.push(...bottomPanels);
      }
    } else {
      // Curve not found, fall back to regular infill
      const infill = buildDoorInfill(layout, config, profileLookup, construction?.profileIds, roleMap, params.materialOverrides);
      product.children!.push(infill);
    }
  } else {
    // No arch - build standard infill based on option
    const infill = buildDoorInfill(layout, config, profileLookup, construction?.profileIds, roleMap, params.materialOverrides);
    product.children!.push(infill);
  }
  
  components.push(product);
  
  // Process added parts (user-inserted mullions, transoms, glazing bars)
  if (params.addedParts && params.addedParts.length > 0) {
    params.addedParts.forEach((part, index) => {
      const addedPartComponent: ComponentNode = {
        id: `addedPart_${part.id || index}`,
        name: `${part.componentTypeCode} ${index + 1}`,
        type: 'ironmongery' as any, // addedPart not in union, using ironmongery
        materialId: part.params?.materialId || 'timber',
        geometry: {
          type: 'box',
          dimensions: part.params?.dimensions || [50, layoutHeight * 0.5, layoutDepth],
          position: part.position || [0, 0, 0],
        },
        visible: true,
      };
      components.push(addedPartComponent);
    });
  }
  
  // Calculate lighting bounds
  const lighting = {
    boundsX: [-layoutWidth / 2 * 1.5, layoutWidth / 2 * 1.5] as [number, number],
    boundsZ: [-config.thickness / 2 * 1.5, config.thickness / 2 * 1.5] as [number, number],
    shadowCatcherDiameter: Math.max(layoutWidth, layoutHeight) * 2,
  };
  
  return {
    components,
    materials,
    lighting,
    params: resolvedParams,
    editableAttributes: buildEditableAttributes(resolvedParams, layout, components),
  };
}

/**
 * Build door frame (stiles and rails)
 * Y=0 is at door base, Y=height is at door top
 */
function buildDoorFrame(
  layout: ReturnType<typeof resolveDoorLayout>,
  config: any,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>,
  materialRoleMap?: ProductParams['materialRoleMap'],
  materialOverrides?: Record<string, string>
): ComponentNode {
  const { stileWidth } = layout;
  const { top: topRail, bottom: bottomRail } = layout.railSizes;
  const thickness = config.thickness;
  const width = layout.width;
  const height = layout.height;
  
  const frame: ComponentNode = {
    id: 'frame',
    name: 'Frame',
    type: 'group',
    visible: true,
    children: [],
  };
  
  // Center Y position (halfway up the door)
  const centerY = height / 2;
  
  // Left stile (full height, from Y=0 to Y=height, centered at height/2)
  frame.children!.push({
    id: 'frame_leftStile',
    name: 'Left Stile',
    type: 'frame',
    role: 'stile',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_leftStile', materialRoleMap, materialOverrides),
    geometry: buildProfileGeometry({
      kind: 'vertical',
      width: stileWidth,
      height,
      depth: thickness,
      position: [-width / 2 + stileWidth / 2, centerY, 0],
      profile: profileIds?.stile ? profileLookup[profileIds.stile] : undefined,
    }),
    visible: true,
  });
  
  // Right stile (full height)
  frame.children!.push({
    id: 'frame_rightStile',
    name: 'Right Stile',
    type: 'frame',
    role: 'stile',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_rightStile', materialRoleMap, materialOverrides),
    geometry: buildProfileGeometry({
      kind: 'vertical',
      width: stileWidth,
      height,
      depth: thickness,
      position: [width / 2 - stileWidth / 2, centerY, 0],
      profile: profileIds?.stile ? profileLookup[profileIds.stile] : undefined,
    }),
    visible: true,
  });
  
  // Top rail (at top of door)
  const topRailWidth = width - 2 * stileWidth;
  frame.children!.push({
    id: 'frame_topRail',
    name: 'Top Rail',
    type: 'frame',
    role: 'rail',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_topRail', materialRoleMap, materialOverrides),
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: topRailWidth,
      height: topRail,
      depth: thickness,
      position: [0, layout.rails.find((rail) => rail.role === 'top')?.y ?? height - topRail / 2, 0],
      profile: profileIds?.topRail ? profileLookup[profileIds.topRail] : undefined,
    }),
    visible: true,
  });
  
  // Bottom rail (at bottom of door, sitting on Y=0)
  frame.children!.push({
    id: 'frame_bottomRail',
    name: 'Bottom Rail',
    type: 'frame',
    role: 'rail',
    materialId: resolveMaterialId('FRAME_TIMBER', 'frame_bottomRail', materialRoleMap, materialOverrides),
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: topRailWidth,
      height: bottomRail,
      depth: thickness,
      position: [0, layout.rails.find((rail) => rail.role === 'bottom')?.y ?? bottomRail / 2, 0],
      profile: profileIds?.bottomRail ? profileLookup[profileIds.bottomRail] : undefined,
    }),
    visible: true,
  });
  
  return frame;
}

/**
 * Build door infill (panels/glazing based on option)
 */
function buildDoorInfill(
  layout: ReturnType<typeof resolveDoorLayout>,
  config: any,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>,
  materialRoleMap?: ProductParams['materialRoleMap'],
  materialOverrides?: Record<string, string>
): ComponentNode {
  const infill: ComponentNode = {
    id: 'infill',
    name: 'Infill',
    type: 'group',
    visible: true,
    children: [],
  };

  infill.children = [
    ...buildPanelsFromLayout(layout, config, profileLookup, profileIds, materialRoleMap, materialOverrides),
    ...buildGlazingFromLayout(layout, config, materialRoleMap, materialOverrides),
    ...buildMidRailsFromLayout(layout, config, profileLookup, profileIds, materialRoleMap, materialOverrides),
  ];

  return infill;
}

function buildPanelsFromLayout(
  layout: ReturnType<typeof resolveDoorLayout>,
  config: any,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>,
  materialRoleMap?: ProductParams['materialRoleMap'],
  materialOverrides?: Record<string, string>
): ComponentNode[] {
  const { panelThickness, mouldingWidth, mouldingProjection, thickness } = config;

  return layout.panels.map((slot) => {
    const panelId = slot.id;
    const actualPanelWidth = slot.rect.width - 2 * mouldingWidth;
    const actualPanelHeight = slot.rect.height - 2 * mouldingWidth;

    const panelGroup: ComponentNode = {
      id: panelId,
      name: `Panel ${panelId}`,
      type: 'group',
      visible: true,
      children: [],
    };

    panelGroup.children!.push({
      id: `${panelId}_timber`,
      name: 'Timber Panel',
      type: 'panel',
      role: 'panel',
      materialId: resolveMaterialId('PANEL_TIMBER', `${panelId}_timber`, materialRoleMap, materialOverrides),
      geometry: {
        type: 'box',
        dimensions: [actualPanelWidth, actualPanelHeight, panelThickness],
        position: [slot.rect.x, slot.rect.y, 0],
      },
      visible: true,
    });

    panelGroup.children!.push({
      id: `${panelId}_moulding_front`,
      name: 'Moulding Front',
      type: 'panel',
      role: 'panel',
      materialId: resolveMaterialId('PANEL_TIMBER', `${panelId}_moulding_front`, materialRoleMap, materialOverrides),
      geometry: {
        type: 'box',
        dimensions: [actualPanelWidth + mouldingWidth, actualPanelHeight + mouldingWidth, mouldingProjection],
        position: [slot.rect.x, slot.rect.y, thickness / 2 - mouldingProjection / 2],
      },
      visible: true,
    });

    panelGroup.children!.push({
      id: `${panelId}_moulding_back`,
      name: 'Moulding Back',
      type: 'panel',
      role: 'panel',
      materialId: resolveMaterialId('PANEL_TIMBER', `${panelId}_moulding_back`, materialRoleMap, materialOverrides),
      geometry: {
        type: 'box',
        dimensions: [actualPanelWidth + mouldingWidth, actualPanelHeight + mouldingWidth, mouldingProjection],
        position: [slot.rect.x, slot.rect.y, -thickness / 2 + mouldingProjection / 2],
      },
      visible: true,
    });

    return panelGroup;
  });
}

function buildGlazingFromLayout(
  layout: ReturnType<typeof resolveDoorLayout>,
  config: any,
  materialRoleMap?: ProductParams['materialRoleMap'],
  materialOverrides?: Record<string, string>
): ComponentNode[] {
  const { glazingThickness, beadWidth, thickness } = config;

  return layout.glazing.map((slot) => {
    const glazingGroup: ComponentNode = {
      id: slot.id,
      name: 'Glazing',
      type: 'group',
      visible: true,
      children: [],
    };

    glazingGroup.children!.push({
      id: `${slot.id}_glass`,
      name: 'Glass Unit',
      type: 'glazing',
      role: 'glass',
      materialId: resolveMaterialId('GLASS', `${slot.id}_glass`, materialRoleMap, materialOverrides),
      geometry: {
        type: 'box',
        dimensions: [slot.rect.width - 2 * beadWidth, slot.rect.height - 2 * beadWidth, glazingThickness],
        position: [slot.rect.x, slot.rect.y, 0],
      },
      visible: true,
    });

    const beadPositions = [
      { id: `${slot.id}_bead_left`, pos: [slot.rect.x - slot.rect.width / 2 + beadWidth / 2, slot.rect.y, 0], dims: [beadWidth, slot.rect.height, thickness] },
      { id: `${slot.id}_bead_right`, pos: [slot.rect.x + slot.rect.width / 2 - beadWidth / 2, slot.rect.y, 0], dims: [beadWidth, slot.rect.height, thickness] },
      { id: `${slot.id}_bead_top`, pos: [slot.rect.x, slot.rect.y + slot.rect.height / 2 - beadWidth / 2, 0], dims: [slot.rect.width, beadWidth, thickness] },
      { id: `${slot.id}_bead_bottom`, pos: [slot.rect.x, slot.rect.y - slot.rect.height / 2 + beadWidth / 2, 0], dims: [slot.rect.width, beadWidth, thickness] },
    ];

    beadPositions.forEach(({ id, pos, dims }) => {
      glazingGroup.children!.push({
        id,
        name: 'Bead',
        type: 'glazing',
        role: 'rail',
        materialId: resolveMaterialId('FRAME_TIMBER', id, materialRoleMap, materialOverrides),
        geometry: {
          type: 'box',
          dimensions: dims as [number, number, number],
          position: pos as [number, number, number],
        },
        visible: true,
      });
    });

    return glazingGroup;
  });
}

function buildMidRailsFromLayout(
  layout: ReturnType<typeof resolveDoorLayout>,
  config: any,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>,
  materialRoleMap?: ProductParams['materialRoleMap'],
  materialOverrides?: Record<string, string>
): ComponentNode[] {
  const { thickness } = config;
  const midRails = layout.rails.filter((rail) => rail.role === 'mid');

  return midRails.map((rail) => ({
    id: rail.id,
    name: rail.id.replace(/_/g, ' '),
    type: 'frame',
    role: 'rail',
    materialId: resolveMaterialId('FRAME_TIMBER', rail.id, materialRoleMap, materialOverrides),
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: layout.width - 2 * layout.stileWidth,
      height: rail.height,
      depth: thickness,
      position: [0, rail.y, 0],
      profile: profileIds?.midRail ? profileLookup[profileIds.midRail] : undefined,
    }),
    visible: true,
  }));
}

/**
 * Create door materials
 */
function createDoorMaterials(config: any): MaterialDefinition[] {
  return [
    {
      id: 'timber',
      name: config.timber || 'Timber',
      type: 'wood',
      baseColor: '#d4a574',
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
      name: config.glazingType || 'Clear Double Glazed',
      type: 'glass',
      baseColor: '#e0f0ff',
      roughness: 0.1,
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
  layout: ReturnType<typeof resolveDoorLayout>,
  components: ComponentNode[]
): Record<string, EditableAttribute[]> {
  const attrs: Record<string, EditableAttribute[]> = {};
  const railConstraints = layout.constraints.railY;
  
  // Frame attributes
  attrs['frame'] = [
    {
      key: 'stileWidth',
      label: 'Stile Width',
      type: 'number',
      value: params.construction.stileWidth || DOOR_DEFAULTS.stileWidth,
      unit: 'mm',
      min: 50,
      max: 200,
      step: 1,
    },
    {
      key: 'topRail',
      label: 'Top Rail Height',
      type: 'number',
      value: params.construction.topRail || DOOR_DEFAULTS.topRail,
      unit: 'mm',
      min: 50,
      max: 300,
      step: 1,
    },
    {
      key: 'bottomRail',
      label: 'Bottom Rail Height',
      type: 'number',
      value: params.construction.bottomRail || DOOR_DEFAULTS.bottomRail,
      unit: 'mm',
      min: 50,
      max: 300,
      step: 1,
    },
    {
      key: 'midRail',
      label: 'Mid Rail Height',
      type: 'number',
      value: params.construction.midRail || DOOR_DEFAULTS.midRail,
      unit: 'mm',
      min: 50,
      max: 300,
      step: 1,
    },
  ];
  
  // Material attributes
  attrs['product'] = [
    {
      key: 'width',
      label: 'Overall Width',
      type: 'number',
      value: params.dimensions.width,
      unit: 'mm',
      min: 500,
      max: 3000,
      step: 1,
      helpText: 'Door leaf width in millimetres',
    },
    {
      key: 'height',
      label: 'Overall Height',
      type: 'number',
      value: params.dimensions.height,
      unit: 'mm',
      min: 1500,
      max: 3000,
      step: 1,
      helpText: 'Door leaf height in millimetres',
    },
    {
      key: 'depth',
      label: 'Thickness',
      type: 'number',
      value: params.dimensions.depth,
      unit: 'mm',
      min: 35,
      max: 100,
      step: 1,
      helpText: 'Door leaf thickness (also sets construction thickness)',
    },
    {
      key: 'timber',
      label: 'Timber Species',
      type: 'select',
      value: params.construction.timber || 'Oak',
      options: [
        { value: 'Oak', label: 'Oak' },
        { value: 'Sapele', label: 'Sapele' },
        { value: 'Accoya', label: 'Accoya' },
        { value: 'Iroko', label: 'Iroko' },
      ],
    },
    {
      key: 'finish',
      label: 'Finish',
      type: 'select',
      value: params.construction.finish || 'Clear Lacquer',
      options: [
        { value: 'Clear Lacquer', label: 'Clear Lacquer' },
        { value: 'White Paint', label: 'White Paint' },
        { value: 'Stain', label: 'Stain' },
        { value: 'Oiled', label: 'Oiled' },
      ],
    },
  ];

  // Rail position attributes (one entry per rail component)
  const railComponents = components.filter(c => c.id.includes('Rail') && c.geometry?.position);
  railComponents.forEach((rail) => {
    const value = rail.geometry?.position?.[1] || 0;
    const constraint = railConstraints[rail.id] || { min: 0, max: params.dimensions.height };

    attrs[rail.id] = [
      {
        key: 'positionY',
        label: 'Height from bottom',
        type: 'number',
        value,
        unit: 'mm',
        min: constraint.min,
        max: constraint.max,
        step: 1,
      },
    ];
  });

  layout.panels.forEach((panel) => {
    attrs[panel.id] = [
      {
        key: 'panelThickness',
        label: 'Panel Thickness',
        type: 'number',
        value: params.construction.panelThickness || DOOR_DEFAULTS.panelThickness,
        unit: 'mm',
        min: 8,
        max: 40,
        step: 1,
      },
    ];
  });

  layout.glazing.forEach((glazing) => {
    attrs[glazing.id] = [
      {
        key: 'glazingThickness',
        label: 'Glazing Thickness',
        type: 'number',
        value: params.construction.glazingThickness || DOOR_DEFAULTS.glazingThickness,
        unit: 'mm',
        min: 12,
        max: 60,
        step: 1,
      },
    ];
  });
  
  return attrs;
}

/**
 * Apply edit to parameters
 */
export function applyDoorEdit(params: ProductParams, edit: ComponentEdit): ProductParams {
  const updated: ProductParams = {
    ...params,
    construction: {
      ...params.construction,
      layoutOverrides: {
        ...(params.construction.layoutOverrides || {}),
      },
    },
  };

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

    // Keep construction thickness in sync with depth if provided
    if (typeof nextDepth === 'number') {
      updated.construction = {
        ...updated.construction,
        thickness: nextDepth,
      };
    }
  }

  // Handle positional edits for rails
  if (typeof edit.changes.positionY === 'number') {
    const snapped = Math.round(edit.changes.positionY);
    const overrides = updated.construction.layoutOverrides!;

    if (edit.componentId.includes('topRail')) {
      overrides.topRailY = snapped;
    } else if (edit.componentId.includes('bottomRail')) {
      overrides.bottomRailY = snapped;
    } else if (edit.componentId.includes('midRail')) {
      overrides.midRailY = snapped;
      overrides.railYById = { ...(overrides.railYById || {}), [edit.componentId]: snapped };
    }
  }

  // Update construction values (non-positional)
  Object.keys(edit.changes).forEach(key => {
    if (key === 'positionY') return;
    if (key === 'width' || key === 'height' || key === 'depth') return; // handled above when componentId === 'product'
    if (updated.construction) {
      updated.construction[key] = edit.changes[key];
    }
  });

  if (edit.changes.timber !== undefined || edit.changes.finish !== undefined) {
    updated.materialRoleMap = deriveMaterialRoleMap(updated);
  }

  return updated;
}

/**
 * Validate door parameters
 */
export function validateDoorParams(params: ProductParams): string[] | null {
  const errors: string[] = [];
  
  const { width, height, depth } = params.dimensions;
  
  if (width < 500) errors.push('Width must be at least 500mm');
  if (width > 3000) errors.push('Width must not exceed 3000mm');
  if (height < 1500) errors.push('Height must be at least 1500mm');
  if (height > 3000) errors.push('Height must not exceed 3000mm');
  if (depth < 35) errors.push('Thickness must be at least 35mm');
  if (depth > 100) errors.push('Thickness must not exceed 100mm');
  
  return errors.length > 0 ? errors : null;
}

/**
 * Get default door parameters
 */
export function getDefaultDoorParams(
  productType: { category: string; type: string; option: string },
  dimensions: { width: number; height: number; depth: number }
): ProductParams {
  const base: ProductParams = {
    productType,
    dimensions,
    construction: {
      stileWidth: DOOR_DEFAULTS.stileWidth,
      topRail: DOOR_DEFAULTS.topRail,
      midRail: DOOR_DEFAULTS.midRail,
      bottomRail: DOOR_DEFAULTS.bottomRail,
      thickness: dimensions.depth || DOOR_DEFAULTS.thickness,
      timber: 'oak',
      finish: 'clear',
      glazingType: 'double',
      panelLayout: productType.option === 'E02' ? { rows: 2, cols: 2 } : { rows: 2, cols: 1 },
      glazingArea: productType.option === 'E03' ? { topPercent: 35, bottomPercent: 65 } : undefined,
    },
    addedParts: [],
  };
  return {
    ...base,
    materialRoleMap: deriveMaterialRoleMap(base),
  };
}

/**
 * Build arched top rail using curve
 * Creates panel/glass infill under arch
 */
export function buildArchedDoorHead(
  width: number,
  height: number,
  config: any,
  headCurve: any,
  option: string
): ComponentNode {
  // Import curve utilities dynamically to avoid circular deps
  const convertCurveToShape = require('@/lib/scene/curve-utils').convertCurveToShape;
  
  const archHead: ComponentNode = {
    id: 'archHead',
    name: 'Arched Head',
    type: 'group',
    visible: true,
    children: [],
  };
  
  try {
    const shape = convertCurveToShape(headCurve);
    
    // Top rail following arch
    archHead.children!.push({
      id: 'arch_topRail',
      name: 'Arch Top Rail',
      type: 'frame',
      materialId: 'timber',
      geometry: {
        type: 'shapeExtrude',
        position: [0, 0, 0],
        customData: {
          shape: {
            points: shape.getPoints(headCurve.resolution || 64).map((p: any) => [p.x, p.y]),
          },
          extrudeSettings: {
            depth: config.thickness,
            bevelEnabled: false,
            steps: 1,
          },
        },
      },
      visible: true,
    });
    
    // Arched panels or glazing under curve
    if (option === 'E03') {
      // Glazed top
      archHead.children!.push({
        id: 'arch_glazing',
        name: 'Arched Glazing',
        type: 'glazing',
        materialId: 'glass',
        geometry: {
          type: 'shapeExtrude',
          position: [0, 0, config.thickness / 2],
          customData: {
            shape: {
              points: shape.getPoints(headCurve.resolution || 64).map((p: any) => [p.x, p.y]),
            },
            extrudeSettings: {
              depth: config.glazingThickness,
              bevelEnabled: false,
              steps: 1,
            },
          },
        },
        visible: true,
      });
      
      // Glazing beads
      archHead.children!.push({
        id: 'arch_glazingBeads',
        name: 'Glazing Beads',
        type: 'frame',
        materialId: 'timber',
        geometry: {
          type: 'shapeExtrude',
          position: [0, 0, config.thickness / 2 + config.glazingThickness + 2],
          customData: {
            shape: {
              points: shape.getPoints(headCurve.resolution || 64).map((p: any) => [p.x, p.y]),
            },
            extrudeSettings: {
              depth: config.beadWidth,
              bevelEnabled: false,
              steps: 1,
            },
          },
        },
        visible: true,
      });
    }
  } catch (error) {
    console.error('Failed to build arched head:', error);
  }
  
  return archHead;
}

/**
 * Detect if product type supports arches
 */
export function supportsArches(option: string): boolean {
  return ['E01', 'E02', 'E03'].includes(option);
}

/**
 * Door builder implementation
 */
export const doorBuilder: ParametricBuilder = {
  type: 'door',
  build: buildDoorComponentTree,
  applyEdit: applyDoorEdit,
  validate: validateDoorParams,
  getDefaults: getDefaultDoorParams,
};
