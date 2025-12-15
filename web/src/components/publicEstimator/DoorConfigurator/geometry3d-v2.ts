/**
 * Component-Based 3D Door Geometry System
 * Builds doors from individual components: stiles, rails, panels, glass, etc.
 * Each component is positioned correctly with realistic joinery
 */

import * as THREE from 'three';
import { DoorConfiguration } from './types';

export interface DoorComponent {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  material?: 'wood' | 'glass' | 'brass';
  name: string;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface DoorModel {
  components: DoorComponent[];
  bounds: {
    width: number;
    height: number;
    depth: number;
  };
}

/**
 * Dimension constants (mm)
 */
const DIMENSIONS = {
  stileWidth: 65,
  stileDepth: 45,
  railHeight: 70,
  railDepth: 45,
  panelThickness: 22,
  panelBevelDepth: 8,
  panelRaiseDepth: 18,
  glassThickness: 4,
  glazingBeadWidth: 16,
  glazingBeadDepth: 12,
};

/**
 * Create a stile (vertical frame member) component
 */
function createStile(height: number): DoorComponent {
  const geometry = new THREE.BoxGeometry(
    DIMENSIONS.stileWidth,
    height,
    DIMENSIONS.stileDepth
  );

  // Apply wood texture mapping UVs
  const uvAttribute = geometry.getAttribute('uv');
  const uvArray = uvAttribute.array as Float32Array;
  for (let i = 0; i < uvArray.length; i += 2) {
    uvArray[i] *= height / 2000;
    uvArray[i + 1] *= DIMENSIONS.stileDepth / 500;
  }
  uvAttribute.needsUpdate = true;

  return {
    geometry,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'stile',
    castShadow: true,
    receiveShadow: true,
  };
}

/**
 * Create a rail (horizontal frame member) component
 */
function createRail(width: number): DoorComponent {
  const geometry = new THREE.BoxGeometry(
    width,
    DIMENSIONS.railHeight,
    DIMENSIONS.railDepth
  );

  const uvAttribute = geometry.getAttribute('uv');
  const uvArray = uvAttribute.array as Float32Array;
  for (let i = 0; i < uvArray.length; i += 2) {
    uvArray[i] *= width / 2000;
    uvArray[i + 1] *= DIMENSIONS.railHeight / 500;
  }
  uvAttribute.needsUpdate = true;

  return {
    geometry,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail',
    castShadow: true,
    receiveShadow: true,
  };
}

/**
 * Create a raised panel with proper bevel and relief
 */
function createRaisedPanel(width: number, height: number): DoorComponent {
  const group = new THREE.Group();

  // Main panel body - slightly recessed
  const panelGeometry = new THREE.BoxGeometry(
    width - DIMENSIONS.panelBevelDepth * 2,
    height - DIMENSIONS.panelBevelDepth * 2,
    DIMENSIONS.panelThickness
  );

  // Apply bevel using a custom geometry with beveled edges
  const beveled = addBevelToGeometry(panelGeometry, DIMENSIONS.panelBevelDepth);

  return {
    geometry: beveled,
    position: new THREE.Vector3(0, 0, -DIMENSIONS.panelRaiseDepth),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'panel',
    castShadow: true,
    receiveShadow: true,
  };
}

/**
 * Add bevel effect to panel geometry
 */
function addBevelToGeometry(
  geometry: THREE.BoxGeometry,
  bevelSize: number
): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const posArray = positions.array as Float32Array;
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const normArray = normals.array as Float32Array;

  // Get bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < posArray.length; i += 3) {
    minX = Math.min(minX, posArray[i]);
    maxX = Math.max(maxX, posArray[i]);
    minY = Math.min(minY, posArray[i + 1]);
    maxY = Math.max(maxY, posArray[i + 1]);
    minZ = Math.min(minZ, posArray[i + 2]);
    maxZ = Math.max(maxZ, posArray[i + 2]);
  }

  // Apply bevel to edges
  const tolerance = 0.1;
  for (let i = 0; i < posArray.length; i += 3) {
    const x = posArray[i];
    const y = posArray[i + 1];
    const z = posArray[i + 2];

    // Check if vertex is on an edge
    const onEdge = [
      Math.abs(x - minX) < tolerance,
      Math.abs(x - maxX) < tolerance,
      Math.abs(y - minY) < tolerance,
      Math.abs(y - maxY) < tolerance,
      Math.abs(z - minZ) < tolerance,
      Math.abs(z - maxZ) < tolerance,
    ].filter(Boolean).length >= 2;

    if (onEdge) {
      // Smooth normals for beveled appearance
      normArray[i] = (normArray[i] + 0.3) * 0.8;
      normArray[i + 1] = (normArray[i + 1] + 0.3) * 0.8;
      normArray[i + 2] = (normArray[i + 2] + 0.3) * 0.8;
    }
  }

  normals.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Create a glass panel with glazing beads
 */
function createGlassPanel(width: number, height: number): DoorComponent[] {
  const components: DoorComponent[] = [];

  // Main glass
  const glassGeometry = new THREE.BoxGeometry(
    width - DIMENSIONS.glazingBeadWidth * 2,
    height - DIMENSIONS.glazingBeadWidth * 2,
    DIMENSIONS.glassThickness
  );

  components.push({
    geometry: glassGeometry,
    position: new THREE.Vector3(0, 0, -DIMENSIONS.panelRaiseDepth),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'glass',
    name: 'glass',
    castShadow: false,
    receiveShadow: false,
  });

  // Glazing beads (4 pieces around glass)
  const beadThickness = DIMENSIONS.glazingBeadDepth;
  const beadWidth = DIMENSIONS.glazingBeadWidth;
  const glassInnerWidth = width - beadWidth * 2;
  const glassInnerHeight = height - beadWidth * 2;

  // Top bead
  const topBeadGeometry = new THREE.BoxGeometry(
    width,
    beadWidth,
    beadThickness
  );
  components.push({
    geometry: topBeadGeometry,
    position: new THREE.Vector3(0, glassInnerHeight / 2, -DIMENSIONS.panelRaiseDepth + 3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-top',
    castShadow: true,
    receiveShadow: true,
  });

  // Bottom bead
  components.push({
    geometry: topBeadGeometry.clone(),
    position: new THREE.Vector3(0, -glassInnerHeight / 2, -DIMENSIONS.panelRaiseDepth + 3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-bottom',
    castShadow: true,
    receiveShadow: true,
  });

  // Left bead
  const sideBeadGeometry = new THREE.BoxGeometry(
    beadWidth,
    glassInnerHeight,
    beadThickness
  );
  components.push({
    geometry: sideBeadGeometry,
    position: new THREE.Vector3(-glassInnerWidth / 2, 0, -DIMENSIONS.panelRaiseDepth + 3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-left',
    castShadow: true,
    receiveShadow: true,
  });

  // Right bead
  components.push({
    geometry: sideBeadGeometry.clone(),
    position: new THREE.Vector3(glassInnerWidth / 2, 0, -DIMENSIONS.panelRaiseDepth + 3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-right',
    castShadow: true,
    receiveShadow: true,
  });

  return components;
}

/**
 * Build a complete door model from configuration
 */
export function buildDoorModel(config: DoorConfiguration): DoorModel {
  const components: DoorComponent[] = [];
  const doorWidth = config.dimensions.width;
  const doorHeight = config.dimensions.height;

  // Calculate frame dimensions
  const frameInnerWidth = doorWidth - DIMENSIONS.stileWidth * 2;
  const frameInnerHeight = doorHeight - DIMENSIONS.railHeight * 2;

  // Left stile
  components.push({
    ...createStile(doorHeight),
    position: new THREE.Vector3(-doorWidth / 2 + DIMENSIONS.stileWidth / 2, 0, 0),
    name: 'stile-left',
  });

  // Right stile
  components.push({
    ...createStile(doorHeight),
    position: new THREE.Vector3(doorWidth / 2 - DIMENSIONS.stileWidth / 2, 0, 0),
    name: 'stile-right',
  });

  // Top rail
  components.push({
    ...createRail(frameInnerWidth),
    position: new THREE.Vector3(0, doorHeight / 2 - DIMENSIONS.railHeight / 2, 0),
    name: 'rail-top',
  });

  // Bottom rail
  components.push({
    ...createRail(frameInnerWidth),
    position: new THREE.Vector3(0, -doorHeight / 2 + DIMENSIONS.railHeight / 2, 0),
    name: 'rail-bottom',
  });

  // Generate panels or glass based on style
  if (config.style.id === 'joplin-board') {
    addBoardPanels(components, config, frameInnerWidth, frameInnerHeight);
  } else if (config.style.id === 'four-panel-victorian') {
    addFourPanels(components, config, frameInnerWidth, frameInnerHeight);
  } else if (config.style.id === 'six-panel-georgian') {
    addSixPanels(components, config, frameInnerWidth, frameInnerHeight);
  } else {
    // Default: single panel or glass
    addDefaultPanel(components, config, frameInnerWidth, frameInnerHeight);
  }

  return {
    components,
    bounds: {
      width: doorWidth,
      height: doorHeight,
      depth: DIMENSIONS.stileDepth,
    },
  };
}

/**
 * Add vertical boards for cottage style
 */
function addBoardPanels(
  components: DoorComponent[],
  config: DoorConfiguration,
  frameWidth: number,
  frameHeight: number
): void {
  const boardWidth = 130;
  const boardDepth = 22;
  const numBoards = Math.ceil(frameWidth / boardWidth);
  const actualWidth = frameWidth / numBoards;

  for (let i = 0; i < numBoards; i++) {
    const x =
      -frameWidth / 2 +
      actualWidth / 2 +
      i * actualWidth -
      DIMENSIONS.stileWidth;

    const boardGeom = new THREE.BoxGeometry(
      actualWidth - 3,
      frameHeight,
      boardDepth
    );

    components.push({
      geometry: boardGeom,
      position: new THREE.Vector3(x, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      material: 'wood',
      name: `board-${i}`,
      castShadow: true,
      receiveShadow: true,
    });
  }
}

/**
 * Add four-panel Victorian layout
 */
function addFourPanels(
  components: DoorComponent[],
  config: DoorConfiguration,
  frameWidth: number,
  frameHeight: number
): void {
  // Middle horizontal rail
  const middleRailGeom = createRail(frameWidth).geometry;
  components.push({
    geometry: middleRailGeom,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle',
    castShadow: true,
    receiveShadow: true,
  });

  // Middle vertical muntin
  const muntinGeom = createStile(frameHeight).geometry;
  components.push({
    geometry: muntinGeom,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'muntin-vertical',
    castShadow: true,
    receiveShadow: true,
  });

  // Four panels
  const panelWidth = (frameWidth - DIMENSIONS.stileWidth) / 2 - 40;
  const panelHeight = (frameHeight - DIMENSIONS.railHeight) / 2 - 40;

  const panelPositions = [
    // Top left
    new THREE.Vector3(
      -frameWidth / 4 - DIMENSIONS.stileWidth / 4,
      frameHeight / 4,
      0
    ),
    // Top right
    new THREE.Vector3(
      frameWidth / 4 + DIMENSIONS.stileWidth / 4,
      frameHeight / 4,
      0
    ),
    // Bottom left
    new THREE.Vector3(
      -frameWidth / 4 - DIMENSIONS.stileWidth / 4,
      -frameHeight / 4,
      0
    ),
    // Bottom right
    new THREE.Vector3(
      frameWidth / 4 + DIMENSIONS.stileWidth / 4,
      -frameHeight / 4,
      0
    ),
  ];

  panelPositions.forEach((pos, i) => {
    const panelComp = createRaisedPanel(panelWidth, panelHeight);
    components.push({
      ...panelComp,
      position: pos,
      name: `panel-${i}`,
    });
  });
}

/**
 * Add six-panel Georgian layout
 */
function addSixPanels(
  components: DoorComponent[],
  config: DoorConfiguration,
  frameWidth: number,
  frameHeight: number
): void {
  // Two middle horizontal rails
  const rail1Geom = createRail(frameWidth).geometry;
  components.push({
    geometry: rail1Geom,
    position: new THREE.Vector3(0, frameHeight / 3, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle-1',
    castShadow: true,
    receiveShadow: true,
  });

  components.push({
    geometry: rail1Geom.clone(),
    position: new THREE.Vector3(0, -frameHeight / 3, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle-2',
    castShadow: true,
    receiveShadow: true,
  });

  // Middle vertical muntin
  const muntinGeom = createStile(frameHeight).geometry;
  components.push({
    geometry: muntinGeom,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'muntin-vertical',
    castShadow: true,
    receiveShadow: true,
  });

  // Six panels (3 rows × 2 columns)
  const panelWidth = (frameWidth - DIMENSIONS.stileWidth) / 2 - 40;
  const panelHeight = (frameHeight - DIMENSIONS.railHeight * 2) / 3 - 30;

  let panelIndex = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x =
        col === 0
          ? -frameWidth / 4 - DIMENSIONS.stileWidth / 4
          : frameWidth / 4 + DIMENSIONS.stileWidth / 4;
      const y = frameHeight / 3 - row * (panelHeight + DIMENSIONS.railHeight / 2);

      const panelComp = createRaisedPanel(panelWidth, panelHeight);
      components.push({
        ...panelComp,
        position: new THREE.Vector3(x, y, 0),
        name: `panel-${panelIndex}`,
      });
      panelIndex++;
    }
  }
}

/**
 * Add default single panel or glass
 */
function addDefaultPanel(
  components: DoorComponent[],
  config: DoorConfiguration,
  frameWidth: number,
  frameHeight: number
): void {
  const panelWidth = frameWidth - 50;
  const panelHeight = frameHeight - 50;

  if (
    config.selectedGlass &&
    config.selectedGlass.id !== 'none' &&
    config.panelConfig.glassInTop
  ) {
    // Add glass panels
    const glassPanels = createGlassPanel(panelWidth, panelHeight);
    components.push(...glassPanels);
  } else {
    // Add raised panel
    const panelComp = createRaisedPanel(panelWidth, panelHeight);
    components.push({
      ...panelComp,
      position: new THREE.Vector3(0, 0, 0),
      name: 'panel-main',
    });
  }
}
