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

type RailPositions = {
  topRailY: number;
  bottomRailY: number;
  midRailY: number;
  railYById: Record<string, number>;
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

  if (!profile || !profile.shape2D?.points || profile.shape2D.points.length < 2) {
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
      profile: { points: profile.shape2D.points } as any,
      path: path as any,
      closed: profile.shape2D.closed,
      fallbackBox: { width, height, depth },
    },
  };
}

function computeRailPositions(height: number, config: any, overrides?: ProductParams['construction']['layoutOverrides']): RailPositions {
  const minSpacing = 80;
  const topDefault = height - config.topRail / 2;
  const bottomDefault = config.bottomRail / 2;

  let bottomRailY = overrides?.bottomRailY ?? bottomDefault;
  bottomRailY = THREE.MathUtils.clamp(bottomRailY, config.bottomRail / 2, height - config.bottomRail / 2);

  let topRailY = overrides?.topRailY ?? topDefault;
  topRailY = THREE.MathUtils.clamp(topRailY, config.topRail / 2, height - config.topRail / 2);

  if (topRailY - config.topRail / 2 < bottomRailY + config.bottomRail / 2 + minSpacing) {
    topRailY = bottomRailY + config.bottomRail / 2 + minSpacing + config.topRail / 2;
    topRailY = Math.min(topRailY, height - config.topRail / 2);
  }

  if (bottomRailY + config.bottomRail / 2 > topRailY - config.topRail / 2 - minSpacing) {
    bottomRailY = Math.max(config.bottomRail / 2, topRailY - config.topRail / 2 - minSpacing - config.bottomRail / 2);
  }

  const midDefault = (bottomRailY + topRailY) / 2;
  let midRailY = overrides?.midRailY ?? midDefault;
  const midMin = bottomRailY + config.bottomRail / 2 + minSpacing;
  const midMax = topRailY - config.topRail / 2 - minSpacing;
  midRailY = THREE.MathUtils.clamp(midRailY, midMin, midMax);

  const railYById: Record<string, number> = { ...(overrides?.railYById || {}) };
  Object.keys(railYById).forEach((id) => {
    railYById[id] = THREE.MathUtils.clamp(railYById[id], midMin, midMax);
  });

  return { topRailY, bottomRailY, midRailY, railYById };
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
  const materials: MaterialDefinition[] = createDoorMaterials(config);

  const railPositions = computeRailPositions(height, config, construction?.layoutOverrides);
  const profileLookup = buildProfileLookup(params.profiles);
  
  // Root product node
  const product: ComponentNode = {
    id: 'product',
    name: 'Door Leaf',
    type: 'group',
    geometry: {
      type: 'box',
      dimensions: [width, height, config.thickness],
      position: [0, 0, 0],
    },
    visible: true,
    children: [],
  };
  
  // Build frame
  const frame = buildDoorFrame(width, height, config, railPositions, profileLookup, construction?.profileIds);
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
        const bottomPanels = buildPanelLayout(width, height * 0.4, config, 2, 1, railPositions, profileLookup, construction?.profileIds);
        product.children!.push(...bottomPanels);
      }
    } else {
      // Curve not found, fall back to regular infill
      const infill = buildDoorInfill(width, height, config, productType.option, railPositions, profileLookup, construction?.profileIds);
      product.children!.push(infill);
    }
  } else {
    // No arch - build standard infill based on option
    const infill = buildDoorInfill(width, height, config, productType.option, railPositions, profileLookup, construction?.profileIds);
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
          dimensions: part.params?.dimensions || [50, height * 0.5, depth],
          position: part.position || [0, 0, 0],
        },
        visible: true,
      };
      components.push(addedPartComponent);
    });
  }
  
  // Calculate lighting bounds
  const lighting = {
    boundsX: [-width / 2 * 1.5, width / 2 * 1.5] as [number, number],
    boundsZ: [-config.thickness / 2 * 1.5, config.thickness / 2 * 1.5] as [number, number],
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
 * Build door frame (stiles and rails)
 * Y=0 is at door base, Y=height is at door top
 */
function buildDoorFrame(
  width: number,
  height: number,
  config: any,
  railPositions: RailPositions,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>
): ComponentNode {
  const { stileWidth, topRail, bottomRail, thickness } = config;
  
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
    materialId: 'timber',
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
    materialId: 'timber',
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
    materialId: 'timber',
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: topRailWidth,
      height: topRail,
      depth: thickness,
      position: [0, railPositions.topRailY, 0],
      profile: profileIds?.topRail ? profileLookup[profileIds.topRail] : undefined,
    }),
    visible: true,
  });
  
  // Bottom rail (at bottom of door, sitting on Y=0)
  frame.children!.push({
    id: 'frame_bottomRail',
    name: 'Bottom Rail',
    type: 'frame',
    materialId: 'timber',
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: topRailWidth,
      height: bottomRail,
      depth: thickness,
      position: [0, railPositions.bottomRailY, 0],
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
  width: number,
  height: number,
  config: any,
  option: string,
  railPositions: RailPositions,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>
): ComponentNode {
  const infill: ComponentNode = {
    id: 'infill',
    name: 'Infill',
    type: 'group',
    visible: true,
    children: [],
  };
  
  switch (option) {
    case 'E01':
      // 2 panels (1x2 layout)
      infill.children = buildPanelLayout(width, height, config, 1, 2, railPositions, profileLookup, profileIds);
      break;
      
    case 'E02':
      // 4 panels (2x2 layout)
      infill.children = buildPanelLayout(width, height, config, 2, 2, railPositions, profileLookup, profileIds);
      break;
      
    case 'E03':
      // Glazed top 35%, panels bottom 65%
      infill.children = buildGlazedTopLayout(width, height, config, 35, 65, railPositions, profileLookup, profileIds);
      break;
      
    default:
      // Unknown option - default to 2 panels
      infill.children = buildPanelLayout(width, height, config, 1, 2, railPositions, profileLookup, profileIds);
  }
  
  return infill;
}

/**
 * Build panel layout (rows x cols)
 * Y=0 is at door base, Y=height is at door top
 */
function buildPanelLayout(
  width: number,
  height: number,
  config: any,
  cols: number,
  rows: number,
  railPositions: RailPositions,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>
): ComponentNode[] {
  const { stileWidth, topRail, bottomRail, midRail, thickness, panelThickness, mouldingWidth, mouldingProjection } = config;
  
  const panels: ComponentNode[] = [];
  const topBoundary = railPositions.topRailY - topRail / 2;
  const bottomBoundary = railPositions.bottomRailY + bottomRail / 2;
  
  // Available area for panels (between stiles and between top/bottom rails)
  const panelAreaWidth = width - 2 * stileWidth;
  const panelAreaHeight = topBoundary - bottomBoundary - (rows - 1) * midRail;
  
  // Y range: from bottomBoundary to topBoundary
  const panelAreaYStart = bottomBoundary;
  const panelAreaYEnd = topBoundary;
  
  // Panel dimensions
  const panelWidth = panelAreaWidth / cols;
  const panelHeight = panelAreaHeight / rows;
  
  // Actual panel size (subtract moulding clearance)
  const actualPanelWidth = panelWidth - 2 * mouldingWidth;
  const actualPanelHeight = panelHeight - 2 * mouldingWidth;
  
  // Generate panels
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const panelId = `panel_r${row + 1}c${col + 1}`;
      
      // Calculate position from bottom-left
      const xOffset = -panelAreaWidth / 2 + col * panelWidth + panelWidth / 2;
      // Y position: start from panelAreaYEnd and go down for each row
      const yOffset = panelAreaYEnd - row * panelHeight - panelHeight / 2;
      
      // Panel group
      const panelGroup: ComponentNode = {
        id: panelId,
        name: `Panel R${row + 1}C${col + 1}`,
        type: 'group',
        visible: true,
        children: [],
      };
      
      // Flat timber panel
      panelGroup.children!.push({
        id: `${panelId}_timber`,
        name: 'Timber Panel',
        type: 'panel',
        materialId: 'timber',
        geometry: {
          type: 'box',
          dimensions: [actualPanelWidth, actualPanelHeight, panelThickness],
          position: [xOffset, yOffset, 0],
        },
        visible: true,
      });
      
      // Bolection moulding (raised on both sides)
      panelGroup.children!.push({
        id: `${panelId}_moulding_front`,
        name: 'Moulding Front',
        type: 'panel',
        materialId: 'timber',
        geometry: {
          type: 'box',
          dimensions: [actualPanelWidth + mouldingWidth, actualPanelHeight + mouldingWidth, mouldingProjection],
          position: [xOffset, yOffset, thickness / 2 - mouldingProjection / 2],
        },
        visible: true,
      });
      
      panelGroup.children!.push({
        id: `${panelId}_moulding_back`,
        name: 'Moulding Back',
        type: 'panel',
        materialId: 'timber',
        geometry: {
          type: 'box',
          dimensions: [actualPanelWidth + mouldingWidth, actualPanelHeight + mouldingWidth, mouldingProjection],
          position: [xOffset, yOffset, -thickness / 2 + mouldingProjection / 2],
        },
        visible: true,
      });
      
      panels.push(panelGroup);
    }
  }
  
  // Add mid rails if multiple rows
  if (rows > 1) {
    for (let i = 0; i < rows - 1; i++) {
      // Mid rail position with override support
      const defaultRailY = panelAreaYEnd - (i + 1) * panelHeight - i * midRail - midRail / 2;
      const railId = `midRail_${i + 1}`;
      const railY = railPositions.railYById[railId] ?? railPositions.midRailY ?? defaultRailY;
      panels.push({
        id: railId,
        name: `Mid Rail ${i + 1}`,
        type: 'frame',
        materialId: 'timber',
        geometry: buildProfileGeometry({
          kind: 'horizontal',
          width: panelAreaWidth,
          height: midRail,
          depth: thickness,
          position: [0, railY, 0],
          profile: profileIds?.midRail ? profileLookup[profileIds.midRail] : undefined,
        }),
        visible: true,
      });
    }
  }
  
  return panels;
}

/**
 * Build glazed top + panel bottom layout
 * Y=0 is at door base, Y=height is at door top
 */
function buildGlazedTopLayout(
  width: number,
  height: number,
  config: any,
  glazedPercent: number,
  panelPercent: number,
  railPositions: RailPositions,
  profileLookup: Record<string, ProfileDefinition>,
  profileIds?: Record<string, string>
): ComponentNode[] {
  const { stileWidth, topRail, bottomRail, midRail, thickness, glazingThickness, beadWidth, mouldingWidth } = config;
  
  const components: ComponentNode[] = [];
  
  // Available area between frame
  const areaWidth = width - 2 * stileWidth;
  const topBoundary = railPositions.topRailY - topRail / 2;
  const bottomBoundary = railPositions.bottomRailY + bottomRail / 2;
  const areaHeight = topBoundary - bottomBoundary - midRail;
  
  // Split heights
  const glazedHeight = areaHeight * (glazedPercent / 100);
  const panelHeight = areaHeight * (panelPercent / 100);
  
  // Y range for glazed area: from (height - topRail) down
  const glazedAreaYStart = topBoundary;
  const glazedAreaYEnd = glazedAreaYStart - glazedHeight;
  
  // Glazed unit (top)
  const glazingGroup: ComponentNode = {
    id: 'glazing_top',
    name: 'Glazing',
    type: 'group',
    visible: true,
    children: [],
  };
  
  // Center Y of glazed area
  const glazedCenterY = glazedAreaYStart - glazedHeight / 2;
  
  // Glass
  glazingGroup.children!.push({
    id: 'glass_top',
    name: 'Glass Unit',
    type: 'glazing',
    materialId: 'glass',
    geometry: {
      type: 'box',
      dimensions: [areaWidth - 2 * beadWidth, glazedHeight - 2 * beadWidth, glazingThickness],
      position: [0, glazedCenterY, 0],
    },
    visible: true,
  });
  
  // Timber beads
  const beadPositions = [
    { id: 'bead_top_left', pos: [-(areaWidth - beadWidth) / 2, glazedCenterY, 0], dims: [beadWidth, glazedHeight, thickness] },
    { id: 'bead_top_right', pos: [(areaWidth - beadWidth) / 2, glazedCenterY, 0], dims: [beadWidth, glazedHeight, thickness] },
    { id: 'bead_top_top', pos: [0, glazedAreaYStart - beadWidth / 2, 0], dims: [areaWidth, beadWidth, thickness] },
  ];
  
  beadPositions.forEach(({ id, pos, dims }) => {
    glazingGroup.children!.push({
      id,
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
  
  components.push(glazingGroup);
  
  // Mid rail between glazing and panels
  components.push({
    id: 'midRail_glazing',
    name: 'Mid Rail',
    type: 'frame',
    materialId: 'timber',
    geometry: buildProfileGeometry({
      kind: 'horizontal',
      width: areaWidth,
      height: midRail,
      depth: thickness,
      position: [0, railPositions.railYById['midRail_glazing'] ?? railPositions.midRailY ?? glazedAreaYEnd - midRail / 2, 0],
      profile: profileIds?.midRail ? profileLookup[profileIds.midRail] : undefined,
    }),
    visible: true,
  });
  
  // Bottom panels (2 panels side by side)
  // Panels span from bottom rail to mid rail
  const panelAreaHeight = height - topRail - bottomRail - midRail;
  const bottomPanels = buildPanelLayout(width, panelAreaHeight, config, 2, 1, railPositions, profileLookup, profileIds);
  
  // Note: buildPanelLayout already positions panels correctly, just add them
  components.push(...bottomPanels);
  
  return components;
}

/**
 * Create door materials
 */
function createDoorMaterials(config: any): MaterialDefinition[] {
  return [
    {
      id: 'timber',
      name: config.timber || 'Oak',
      type: 'wood',
      baseColor: '#d4a574',
      roughness: 0.7,
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
      id: 'paint',
      name: config.finish || 'White Paint',
      type: 'painted',
      baseColor: '#f5f5f5',
      roughness: 0.3,
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
  const railPositions = computeRailPositions(
    params.dimensions.height,
    { ...DOOR_DEFAULTS, thickness: params.dimensions.depth, ...params.construction },
    params.construction?.layoutOverrides
  );
  
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
    const height = rail.geometry?.dimensions?.[1] || 0;
    const isTop = rail.id.includes('top');
    const isBottom = rail.id.includes('bottom');
    const value = rail.geometry?.position?.[1] || 0;
    const minSpacing = 80;

    let min = height / 2;
    let max = params.dimensions.height - height / 2;

    if (isTop) {
      min = railPositions.bottomRailY + (params.construction.bottomRail || DOOR_DEFAULTS.bottomRail) / 2 + minSpacing;
    } else if (isBottom) {
      max = railPositions.topRailY - (params.construction.topRail || DOOR_DEFAULTS.topRail) / 2 - minSpacing;
    } else {
      min = railPositions.bottomRailY + (params.construction.bottomRail || DOOR_DEFAULTS.bottomRail) / 2 + minSpacing;
      max = railPositions.topRailY - (params.construction.topRail || DOOR_DEFAULTS.topRail) / 2 - minSpacing;
    }

    attrs[rail.id] = [
      {
        key: 'positionY',
        label: 'Height from bottom',
        type: 'number',
        value,
        unit: 'mm',
        min,
        max,
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
    if (updated.construction) {
      updated.construction[key] = edit.changes[key];
    }
  });

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
  return {
    productType,
    dimensions,
    construction: {
      stileWidth: DOOR_DEFAULTS.stileWidth,
      topRail: DOOR_DEFAULTS.topRail,
      midRail: DOOR_DEFAULTS.midRail,
      bottomRail: DOOR_DEFAULTS.bottomRail,
      thickness: dimensions.depth || DOOR_DEFAULTS.thickness,
      panelLayout: productType.option === 'E02' ? { rows: 2, cols: 2 } : { rows: 2, cols: 1 },
      glazingArea: productType.option === 'E03' ? { topPercent: 35, bottomPercent: 65 } : undefined,
    },
    addedParts: [],
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
