/**
 * Parametric 3D Door Geometry Generator
 * Creates accurate joinery components as separate meshes
 */

import * as THREE from 'three';
import { DoorConfiguration, ParametricDoorElements } from './types';
import { DOOR_ELEMENTS } from './constants';

export interface DoorGeometry {
  stiles: THREE.BoxGeometry[];
  rails: THREE.BoxGeometry[];
  panels: THREE.BoxGeometry[];
  glazingBeads: THREE.BoxGeometry[];
  glass: THREE.BoxGeometry[];
  boards?: THREE.BoxGeometry[]; // For cottage-style vertical boards
  positions: {
    stiles: THREE.Vector3[];
    rails: THREE.Vector3[];
    panels: THREE.Vector3[];
    glazingBeads: THREE.Vector3[];
    glass: THREE.Vector3[];
    boards?: THREE.Vector3[]; // For cottage-style vertical boards
  };
  isBoardStyle?: boolean;
}

// Depth constants (mm) for realistic joinery
const DEPTHS = {
  stile: 45,        // Stile depth
  rail: 45,         // Rail depth
  panel: 18,        // Panel thickness (raised)
  panelRecess: 10,  // Panel recess from frame face
  glazingBead: 12,  // Beading profile depth
  glass: 4,         // Glass thickness
  beadRecess: 8,    // Bead recess from frame face
};

/**
 * Create stile (vertical frame member) geometry
 */
function createStile(width: number, height: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, DEPTHS.stile);
}

/**
 * Create rail (horizontal frame member) geometry
 */
function createRail(width: number, height: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, DEPTHS.rail);
}

/**
 * Create raised panel geometry with realistic beveled edges
 */
function createPanel(width: number, height: number, bevel: number = 12): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  
  // Inner panel area (after bevel)
  const innerWidth = width - bevel * 2;
  const innerHeight = height - bevel * 2;
  
  shape.moveTo(-innerWidth / 2, -innerHeight / 2);
  shape.lineTo(innerWidth / 2, -innerHeight / 2);
  shape.lineTo(innerWidth / 2, innerHeight / 2);
  shape.lineTo(-innerWidth / 2, innerHeight / 2);
  shape.lineTo(-innerWidth / 2, -innerHeight / 2);
  
  const extrudeSettings = {
    steps: 1,
    depth: DEPTHS.panel,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 8, // Smooth rounded bevel like in reference photo
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create glazing bead (small profiled timber around glass)
 */
function createGlazingBead(length: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(length, DEPTHS.glazingBead, DEPTHS.glazingBead);
}

/**
 * Create glass panel with proper thickness
 */
function createGlass(width: number, height: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, DEPTHS.glass);
}

/**
 * Generate complete door geometry for a configuration
 */
export function generateDoorGeometry(config: DoorConfiguration): DoorGeometry {
  const { dimensions, style } = config;
  const elements = DOOR_ELEMENTS;
  
  // Check if this is a board-style cottage door
  if (style.id === 'joplin-board' || style.id === 'franklin-glazed') {
    return generateBoardStyleGeometry(config);
  }
  
  const geometry: DoorGeometry = {
    stiles: [],
    rails: [],
    panels: [],
    glazingBeads: [],
    glass: [],
    positions: {
      stiles: [],
      rails: [],
      panels: [],
      glazingBeads: [],
      glass: [],
    },
  };
  
  // Dimensions in mm
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const stileWidth = elements.stileWidth;
  const topRailHeight = elements.topRailHeight;
  const bottomRailHeight = elements.bottomRailHeight;
  const middleRailHeight = elements.middleRailHeight;
  
  // Left stile
  geometry.stiles.push(createStile(stileWidth, doorHeight));
  geometry.positions.stiles.push(new THREE.Vector3(-doorWidth / 2 + stileWidth / 2, 0, 0));
  
  // Right stile
  geometry.stiles.push(createStile(stileWidth, doorHeight));
  geometry.positions.stiles.push(new THREE.Vector3(doorWidth / 2 - stileWidth / 2, 0, 0));
  
  // Top rail
  const topRailWidth = doorWidth - stileWidth * 2;
  geometry.rails.push(createRail(topRailWidth, topRailHeight));
  geometry.positions.rails.push(
    new THREE.Vector3(0, doorHeight / 2 - topRailHeight / 2, 0)
  );
  
  // Bottom rail
  geometry.rails.push(createRail(topRailWidth, bottomRailHeight));
  geometry.positions.rails.push(
    new THREE.Vector3(0, -doorHeight / 2 + bottomRailHeight / 2, 0)
  );
  
  // Generate panels based on style
  if (style.id === 'four-panel-victorian') {
    generateFourPanelGeometry(geometry, dimensions, elements);
  } else if (style.id === 'six-panel-georgian') {
    generateSixPanelGeometry(geometry, dimensions, elements);
  } else if (style.panelCount === 2) {
    generateTwoPanelGeometry(geometry, dimensions, elements, config);
  } else if (style.panelCount === 1) {
    generateSinglePanelGeometry(geometry, dimensions, elements, config);
  }
  
  return geometry;
}

/**
 * Generate vertical board-style cottage door geometry
 */
function generateBoardStyleGeometry(config: DoorConfiguration): DoorGeometry {
  const { dimensions, style, selectedGlass } = config;
  
  const geometry: DoorGeometry = {
    stiles: [],
    rails: [],
    panels: [],
    glazingBeads: [],
    glass: [],
    boards: [],
    positions: {
      stiles: [],
      rails: [],
      panels: [],
      glazingBeads: [],
      glass: [],
      boards: [],
    },
    isBoardStyle: true,
  };
  
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const boardWidth = 120; // Typical board width
  const boardDepth = 25; // Board thickness
  const ledgeHeight = 150; // Ledge/brace height
  
  // Create vertical boards
  const numBoards = Math.floor(doorWidth / boardWidth);
  const actualBoardWidth = doorWidth / numBoards;
  
  for (let i = 0; i < numBoards; i++) {
    const boardX = -doorWidth / 2 + actualBoardWidth / 2 + i * actualBoardWidth;
    
    geometry.boards!.push(new THREE.BoxGeometry(actualBoardWidth - 2, doorHeight, boardDepth));
    geometry.positions.boards!.push(new THREE.Vector3(boardX, 0, 0));
  }
  
  // Add horizontal ledges (3 ledges - top, middle, bottom)
  const ledgePositions = [
    doorHeight / 2 - ledgeHeight / 2,  // Top
    0,                                  // Middle
    -doorHeight / 2 + ledgeHeight / 2   // Bottom
  ];
  
  ledgePositions.forEach(y => {
    geometry.rails.push(new THREE.BoxGeometry(doorWidth, ledgeHeight, boardDepth * 0.8));
    geometry.positions.rails.push(new THREE.Vector3(0, y, -boardDepth * 0.4));
  });
  
  // Add diagonal brace
  const braceWidth = 120;
  const braceLength = Math.sqrt(doorWidth * doorWidth + (doorHeight / 2) * (doorHeight / 2));
  const braceAngle = Math.atan2(doorHeight / 2, doorWidth);
  
  geometry.rails.push(new THREE.BoxGeometry(braceLength, braceWidth, boardDepth * 0.7));
  geometry.positions.rails.push(new THREE.Vector3(0, doorHeight / 4, -boardDepth * 0.5));
  
  // If Franklin style with glass
  if (style.id === 'franklin-glazed' && selectedGlass.id !== 'none') {
    const glassWidth = doorWidth * 0.35;
    const glassHeight = doorHeight * 0.4;
    
    addGlassPanel(
      geometry,
      glassWidth,
      glassHeight,
      new THREE.Vector3(0, doorHeight * 0.1, boardDepth / 2)
    );
  }
  
  return geometry;
}

/**
 * Generate four panel Victorian style geometry
 */
function generateFourPanelGeometry(
  geometry: DoorGeometry,
  dimensions: any,
  elements: ParametricDoorElements
) {
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const stileWidth = elements.stileWidth;
  const topRailHeight = elements.topRailHeight;
  const bottomRailHeight = elements.bottomRailHeight;
  const middleRailHeight = elements.middleRailHeight;
  const muntinWidth = elements.muntinWidth;
  
  const innerWidth = doorWidth - stileWidth * 2;
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;
  
  // Middle rail
  geometry.rails.push(createRail(innerWidth, middleRailHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, 0, 0));
  
  // Vertical muntin
  geometry.rails.push(createRail(muntinWidth, innerHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, 0, 0));
  
  // Four panels
  const panelWidth = (innerWidth - muntinWidth) / 2 - 20;
  const panelHeight = (innerHeight - middleRailHeight) / 2 - 20;
  
  const panelPositions = [
    new THREE.Vector3(-innerWidth / 4 - muntinWidth / 4, innerHeight / 4 + middleRailHeight / 4, -DEPTHS.panelRecess),
    new THREE.Vector3(innerWidth / 4 + muntinWidth / 4, innerHeight / 4 + middleRailHeight / 4, -DEPTHS.panelRecess),
    new THREE.Vector3(-innerWidth / 4 - muntinWidth / 4, -innerHeight / 4 - middleRailHeight / 4, -DEPTHS.panelRecess),
    new THREE.Vector3(innerWidth / 4 + muntinWidth / 4, -innerHeight / 4 - middleRailHeight / 4, -DEPTHS.panelRecess),
  ];
  
  panelPositions.forEach(pos => {
    geometry.panels.push(new THREE.BoxGeometry(panelWidth, panelHeight, DEPTHS.panel));
    geometry.positions.panels.push(pos);
  });
}

/**
 * Generate six panel Georgian style geometry
 */
function generateSixPanelGeometry(
  geometry: DoorGeometry,
  dimensions: any,
  elements: ParametricDoorElements
) {
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const stileWidth = elements.stileWidth;
  const topRailHeight = elements.topRailHeight;
  const bottomRailHeight = elements.bottomRailHeight;
  const middleRailHeight = elements.middleRailHeight;
  
  const innerWidth = doorWidth - stileWidth * 2;
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;
  
  // Two middle rails
  const upperRailY = innerHeight / 3;
  const lowerRailY = -innerHeight / 3;
  
  geometry.rails.push(createRail(innerWidth, middleRailHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, upperRailY, 0));
  
  geometry.rails.push(createRail(innerWidth, middleRailHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, lowerRailY, 0));
  
  // Vertical muntin
  geometry.rails.push(createRail(elements.muntinWidth, innerHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, 0, 0));
  
  // Six panels (3 rows × 2 columns)
  const panelWidth = (innerWidth - elements.muntinWidth) / 2 - 20;
  const panelHeight = (innerHeight - middleRailHeight * 2) / 3 - 20;
  
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = col === 0 
        ? -innerWidth / 4 - elements.muntinWidth / 4
        : innerWidth / 4 + elements.muntinWidth / 4;
      const y = innerHeight / 3 - row * (panelHeight + middleRailHeight + 20);
      
      geometry.panels.push(new THREE.BoxGeometry(panelWidth, panelHeight, DEPTHS.panel));
      geometry.positions.panels.push(new THREE.Vector3(x, y, -DEPTHS.panelRecess));
    }
  }
}

/**
 * Generate two panel geometry (half glazed or horizontal split)
 */
function generateTwoPanelGeometry(
  geometry: DoorGeometry,
  dimensions: any,
  elements: ParametricDoorElements,
  config: DoorConfiguration
) {
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const stileWidth = elements.stileWidth;
  const topRailHeight = elements.topRailHeight;
  const bottomRailHeight = elements.bottomRailHeight;
  const middleRailHeight = elements.middleRailHeight;
  
  const innerWidth = doorWidth - stileWidth * 2;
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;
  
  // Middle rail
  geometry.rails.push(createRail(innerWidth, middleRailHeight));
  geometry.positions.rails.push(new THREE.Vector3(0, 0, 0));
  
  const panelWidth = innerWidth - 20;
  const panelHeight = (innerHeight - middleRailHeight) / 2 - 20;
  
  // Top panel/glass
  if (config.panelConfig.glassInTop && config.selectedGlass.id !== 'none') {
    addGlassPanel(
      geometry,
      panelWidth,
      panelHeight,
      new THREE.Vector3(0, innerHeight / 4 + middleRailHeight / 4, -DEPTHS.beadRecess)
    );
  } else {
    geometry.panels.push(new THREE.BoxGeometry(panelWidth, panelHeight, DEPTHS.panel));
    geometry.positions.panels.push(
      new THREE.Vector3(0, innerHeight / 4 + middleRailHeight / 4, -DEPTHS.panelRecess)
    );
  }
  
  // Bottom panel
  geometry.panels.push(new THREE.BoxGeometry(panelWidth, panelHeight, DEPTHS.panel));
  geometry.positions.panels.push(
    new THREE.Vector3(0, -innerHeight / 4 - middleRailHeight / 4, -DEPTHS.panelRecess)
  );
}

/**
 * Generate single panel geometry (full glazed)
 */
function generateSinglePanelGeometry(
  geometry: DoorGeometry,
  dimensions: any,
  elements: ParametricDoorElements,
  config: DoorConfiguration
) {
  const doorWidth = dimensions.width;
  const doorHeight = dimensions.height;
  const stileWidth = elements.stileWidth;
  const topRailHeight = elements.topRailHeight;
  const bottomRailHeight = elements.bottomRailHeight;
  
  const innerWidth = doorWidth - stileWidth * 2;
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;
  
  const panelWidth = innerWidth - 20;
  const panelHeight = innerHeight - 20;
  
  if (config.selectedGlass.id !== 'none') {
    addGlassPanel(
      geometry,
      panelWidth,
      panelHeight,
      new THREE.Vector3(0, 0, -DEPTHS.beadRecess)
    );
  } else {
    geometry.panels.push(new THREE.BoxGeometry(panelWidth, panelHeight, DEPTHS.panel));
    geometry.positions.panels.push(new THREE.Vector3(0, 0, -DEPTHS.panelRecess));
  }
}

/**
 * Add glass panel with glazing beads
 */
function addGlassPanel(
  geometry: DoorGeometry,
  width: number,
  height: number,
  position: THREE.Vector3
) {
  // Glass
  geometry.glass.push(createGlass(width - 40, height - 40));
  geometry.positions.glass.push(position);
  
  // Glazing beads (4 sides)
  const beadMargin = 20;
  
  // Top bead
  geometry.glazingBeads.push(createGlazingBead(width - beadMargin * 2));
  geometry.positions.glazingBeads.push(
    new THREE.Vector3(position.x, position.y + height / 2 - beadMargin, position.z + DEPTHS.glass / 2)
  );
  
  // Bottom bead
  geometry.glazingBeads.push(createGlazingBead(width - beadMargin * 2));
  geometry.positions.glazingBeads.push(
    new THREE.Vector3(position.x, position.y - height / 2 + beadMargin, position.z + DEPTHS.glass / 2)
  );
  
  // Left bead (rotated)
  const leftBead = createGlazingBead(height - beadMargin * 2);
  geometry.glazingBeads.push(leftBead);
  geometry.positions.glazingBeads.push(
    new THREE.Vector3(position.x - width / 2 + beadMargin, position.y, position.z + DEPTHS.glass / 2)
  );
  
  // Right bead (rotated)
  const rightBead = createGlazingBead(height - beadMargin * 2);
  geometry.glazingBeads.push(rightBead);
  geometry.positions.glazingBeads.push(
    new THREE.Vector3(position.x + width / 2 - beadMargin, position.y, position.z + DEPTHS.glass / 2)
  );
}

/**
 * Create hardware geometry (handle, knocker, etc.)
 */
export function createHardwareGeometry() {
  return {
    handle: {
      backplate: new THREE.BoxGeometry(16, 70, 8),
      lever: new THREE.CapsuleGeometry(8, 35, 4, 8),
    },
    letterPlate: new THREE.BoxGeometry(120, 30, 8),
    knocker: {
      backplate: new THREE.CylinderGeometry(20, 20, 8, 32),
      ring: new THREE.TorusGeometry(12, 2, 16, 32),
    },
  };
}
