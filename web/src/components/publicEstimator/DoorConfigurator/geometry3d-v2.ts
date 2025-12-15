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
 * Dimension constants (mm) - UK External Door Standard Profiles
 */
const DIMENSIONS = {
  // Frame components (proper UK external door sizing)
  stileWidth: 120,      // Vertical frame width
  stileDepth: 57,       // Frame thickness (depth into door)
  railHeight: 120,      // Top/bottom rail height
  railDepth: 57,        // Rail thickness
  midRailHeight: 140,   // Middle rail (typically taller)
  muntinWidth: 95,      // Vertical center mullion width
  
  // Panel details
  panelThickness: 22,
  panelBevelDepth: 12,
  panelRaiseDepth: 28,
  panelBevelRadius: 4,
  
  // Glass and glazing
  glassThickness: 4,
  glazingBeadWidth: 22,    // Bead profile width (covers glass edge)
  glazingBeadDepth: 16,    // Bead thickness
  glazingBeadInset: 8,     // Depth from front face
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
  // Create panel with lathe geometry for smooth bevel curves
  const panelInnerWidth = width - DIMENSIONS.panelBevelDepth * 2;
  const panelInnerHeight = height - DIMENSIONS.panelBevelDepth * 2;
  
  // Use LatheGeometry for smooth bevel profile
  const points = [];
  const profileRadius = DIMENSIONS.panelBevelRadius;
  
  // Create a profile for beveled edge (cross-section)
  points.push(new THREE.Vector2(0, 0)); // Center bottom
  points.push(new THREE.Vector2(0, DIMENSIONS.panelThickness / 2)); // Top flat
  points.push(new THREE.Vector2(profileRadius, DIMENSIONS.panelThickness / 2 + profileRadius)); // Bevel curve
  points.push(new THREE.Vector2(DIMENSIONS.panelBevelDepth, DIMENSIONS.panelThickness / 2 + DIMENSIONS.panelBevelDepth)); // Bevel edge
  
  // Main panel body - with improved depth
  const panelGeometry = new THREE.BoxGeometry(
    panelInnerWidth,
    panelInnerHeight,
    DIMENSIONS.panelThickness
  );

  // Apply smooth bevel
  const beveled = addBevelToGeometry(panelGeometry, DIMENSIONS.panelBevelDepth);

  return {
    geometry: beveled,
    position: new THREE.Vector3(0, 0, -DIMENSIONS.panelRaiseDepth),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'panel-raised',
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
 * @param width - Opening width (cutout width in frame)
 * @param height - Opening height (cutout height in frame)
 * @param glassWidth - Actual glass width (optional, defaults to calculated from beads)
 * @param glassHeight - Actual glass height (optional, defaults to calculated from beads)
 */
function createGlassPanel(
  width: number, 
  height: number,
  glassWidth?: number,
  glassHeight?: number
): DoorComponent[] {
  const components: DoorComponent[] = [];

  // Calculate glass dimensions
  // If explicit glass dimensions provided, use them; otherwise calculate from opening
  const actualGlassWidth = glassWidth || (width - DIMENSIONS.glazingBeadWidth * 2);
  const actualGlassHeight = glassHeight || (height - DIMENSIONS.glazingBeadWidth * 2);

  // Main glass
  const glassGeometry = new THREE.BoxGeometry(
    actualGlassWidth,
    actualGlassHeight,
    DIMENSIONS.glassThickness
  );

  components.push({
    geometry: glassGeometry,
    position: new THREE.Vector3(0, 0, -DIMENSIONS.glazingBeadInset),
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

  // Bead positions are based on glass dimensions plus bead width
  const beadSpan = actualGlassHeight + beadWidth;  // Total height covered by beads
  
  // Top bead (horizontal)
  const topBeadGeometry = new THREE.BoxGeometry(
    width,  // Full opening width
    beadWidth,
    beadThickness
  );
  components.push({
    geometry: topBeadGeometry,
    position: new THREE.Vector3(0, beadSpan / 2, -DIMENSIONS.glazingBeadInset + beadThickness / 2),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-top',
    castShadow: true,
    receiveShadow: true,
  });

  // Bottom bead (horizontal)
  components.push({
    geometry: topBeadGeometry.clone(),
    position: new THREE.Vector3(0, -beadSpan / 2, -DIMENSIONS.glazingBeadInset + beadThickness / 2),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-bottom',
    castShadow: true,
    receiveShadow: true,
  });

  // Left bead (vertical)
  const sideBeadGeometry = new THREE.BoxGeometry(
    beadWidth,
    actualGlassHeight,  // Glass height only (horizontals cover the corners)
    beadThickness
  );
  components.push({
    geometry: sideBeadGeometry,
    position: new THREE.Vector3(-width / 2 + beadWidth / 2, 0, -DIMENSIONS.glazingBeadInset + beadThickness / 2),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'glazing-bead-left',
    castShadow: true,
    receiveShadow: true,
  });

  // Right bead (vertical)
  components.push({
    geometry: sideBeadGeometry.clone(),
    position: new THREE.Vector3(width / 2 - beadWidth / 2, 0, -DIMENSIONS.glazingBeadInset + beadThickness / 2),
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
  // Middle horizontal rail (use taller mid-rail height)
  const midRailGeometry = new THREE.BoxGeometry(
    frameWidth,
    DIMENSIONS.midRailHeight,
    DIMENSIONS.railDepth
  );
  
  // Apply UV mapping for wood texture
  const uvAttribute = midRailGeometry.getAttribute('uv');
  const uvArray = uvAttribute.array as Float32Array;
  for (let i = 0; i < uvArray.length; i += 2) {
    uvArray[i] *= frameWidth / 2000;
    uvArray[i + 1] *= DIMENSIONS.midRailHeight / 500;
  }
  uvAttribute.needsUpdate = true;

  components.push({
    geometry: midRailGeometry,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle',
    castShadow: true,
    receiveShadow: true,
  });

  // Middle vertical muntin
  const muntinGeometry = new THREE.BoxGeometry(
    DIMENSIONS.muntinWidth,
    frameHeight,
    DIMENSIONS.stileDepth
  );
  
  // Apply UV mapping
  const muntinUv = muntinGeometry.getAttribute('uv');
  const muntinUvArray = muntinUv.array as Float32Array;
  for (let i = 0; i < muntinUvArray.length; i += 2) {
    muntinUvArray[i] *= DIMENSIONS.muntinWidth / 2000;
    muntinUvArray[i + 1] *= frameHeight / 500;
  }
  muntinUv.needsUpdate = true;
  
  components.push({
    geometry: muntinGeometry,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'muntin-vertical',
    castShadow: true,
    receiveShadow: true,
  });

  // Calculate panel/glass opening dimensions
  // Subtract muntins/rails to get available space for each quadrant
  const openingWidth = (frameWidth - DIMENSIONS.muntinWidth) / 2;
  const openingHeight = (frameHeight - DIMENSIONS.midRailHeight) / 2;
  
  // Panel/glass dimensions (slightly smaller than opening to fit with clearance)
  const panelWidth = openingWidth - 30;
  const panelHeight = openingHeight - 30;

  const hasGlass = config.selectedGlass && config.selectedGlass.id !== 'none';
  
  // Define positions for 4 quadrants
  const panelPositions = [
    { pos: new THREE.Vector3(-openingWidth / 2, openingHeight / 2, 0), name: 'top-left' },
    { pos: new THREE.Vector3(openingWidth / 2, openingHeight / 2, 0), name: 'top-right' },
    { pos: new THREE.Vector3(-openingWidth / 2, -openingHeight / 2, 0), name: 'bottom-left' },
    { pos: new THREE.Vector3(openingWidth / 2, -openingHeight / 2, 0), name: 'bottom-right' },
  ];

  panelPositions.forEach(({ pos, name }, i) => {
    const isTopPanel = i < 2;
    const shouldHaveGlass = hasGlass && (
      (isTopPanel && config.panelConfig.glassInTop) ||
      (!isTopPanel && config.panelConfig.glassInBottom)
    );

    if (shouldHaveGlass) {
      // Add glass panel with beads
      const glassComponents = createGlassPanel(
        panelWidth,
        panelHeight,
        config.glazingDimensions?.glassSize ? config.glazingDimensions.glassSize / 2 : undefined,
        config.glazingDimensions?.glassSize ? config.glazingDimensions.glassSize / 2 : undefined
      );
      glassComponents.forEach((comp, idx) => {
        components.push({
          ...comp,
          position: new THREE.Vector3(
            pos.x + comp.position.x,
            pos.y + comp.position.y,
            comp.position.z
          ),
          name: `${name}-glass-${idx}`,
        });
      });
    } else {
      // Add raised panel
      const panelComp = createRaisedPanel(panelWidth, panelHeight);
      components.push({
        ...panelComp,
        position: pos,
        name: `panel-${name}`,
      });
    }
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
  // Two middle horizontal rails (standard rail height for Georgian)
  const midRailGeometry = new THREE.BoxGeometry(
    frameWidth,
    DIMENSIONS.railHeight,
    DIMENSIONS.railDepth
  );
  
  const uvAttribute = midRailGeometry.getAttribute('uv');
  const uvArray = uvAttribute.array as Float32Array;
  for (let i = 0; i < uvArray.length; i += 2) {
    uvArray[i] *= frameWidth / 2000;
    uvArray[i + 1] *= DIMENSIONS.railHeight / 500;
  }
  uvAttribute.needsUpdate = true;

  components.push({
    geometry: midRailGeometry,
    position: new THREE.Vector3(0, frameHeight / 3, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle-1',
    castShadow: true,
    receiveShadow: true,
  });

  components.push({
    geometry: midRailGeometry.clone(),
    position: new THREE.Vector3(0, -frameHeight / 3, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'rail-middle-2',
    castShadow: true,
    receiveShadow: true,
  });

  // Middle vertical muntin
  const muntinGeometry = new THREE.BoxGeometry(
    DIMENSIONS.muntinWidth,
    frameHeight,
    DIMENSIONS.stileDepth
  );
  
  const muntinUv = muntinGeometry.getAttribute('uv');
  const muntinUvArray = muntinUv.array as Float32Array;
  for (let i = 0; i < muntinUvArray.length; i += 2) {
    muntinUvArray[i] *= DIMENSIONS.muntinWidth / 2000;
    muntinUvArray[i + 1] *= frameHeight / 500;
  }
  muntinUv.needsUpdate = true;

  components.push({
    geometry: muntinGeometry,
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: 'wood',
    name: 'muntin-vertical',
    castShadow: true,
    receiveShadow: true,
  });

  // Six panels (3 rows × 2 columns)
  const openingWidth = (frameWidth - DIMENSIONS.muntinWidth) / 2;
  const openingHeight = frameHeight / 3 - DIMENSIONS.railHeight;
  
  const panelWidth = openingWidth - 30;
  const panelHeight = openingHeight - 20;

  const hasGlass = config.selectedGlass && config.selectedGlass.id !== 'none';

  let panelIndex = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = col === 0 ? -openingWidth / 2 : openingWidth / 2;
      const y = frameHeight / 3 - row * (frameHeight / 3);

      const isTopRow = row === 0;
      const shouldHaveGlass = hasGlass && isTopRow && config.panelConfig.glassInTop;

      if (shouldHaveGlass) {
        // Add glass panel with beads
        const glassComponents = createGlassPanel(panelWidth, panelHeight);
        glassComponents.forEach((comp, idx) => {
          components.push({
            ...comp,
            position: new THREE.Vector3(
              x + comp.position.x,
              y + comp.position.y,
              comp.position.z
            ),
            name: `panel-${panelIndex}-glass-${idx}`,
          });
        });
      } else {
        // Add raised panel
        const panelComp = createRaisedPanel(panelWidth, panelHeight);
        components.push({
          ...panelComp,
          position: new THREE.Vector3(x, y, 0),
          name: `panel-${panelIndex}`,
        });
      }
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
  // Use preset glazing dimensions if available, otherwise calculate
  const openingWidth = config.glazingDimensions?.cutOutSize 
    ? Math.min(frameWidth - 50, frameWidth * 0.85)
    : frameWidth - 50;
  const openingHeight = config.glazingDimensions?.cutOutSize 
    ? config.glazingDimensions.cutOutSize
    : frameHeight - 50;

  if (
    config.selectedGlass &&
    config.selectedGlass.id !== 'none' &&
    config.panelConfig.glassInTop
  ) {
    // Add glass panels with preset dimensions
    const glassPanels = createGlassPanel(
      openingWidth,
      openingHeight,
      config.glazingDimensions?.glassSize,
      config.glazingDimensions?.glassSize
    );
    components.push(...glassPanels);
  } else {
    // Add raised panel
    const panelComp = createRaisedPanel(openingWidth, openingHeight);
    components.push({
      ...panelComp,
      position: new THREE.Vector3(0, 0, 0),
      name: 'panel-main',
    });
  }
}
