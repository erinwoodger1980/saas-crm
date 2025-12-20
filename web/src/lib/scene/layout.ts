/**
 * Parametric Layout Engine
 * Calculates component positions for doors and windows
 * Based on product type and dimensions
 */

export interface LayoutParams {
  productType: string; // E01, E02, E03, etc.
  width: number; // Overall width in mm
  height: number; // Overall height in mm
  depth?: number; // Overall depth in mm
  stileWidth?: number; // Default 114mm
  topRailHeight?: number; // Default 114mm
  midRailHeight?: number; // Default 200mm
  bottomRailHeight?: number; // Default 200mm
  thickness?: number; // Leaf thickness, default 58mm
}

export interface ComponentLayout {
  id: string;
  name: string;
  type: 'frame' | 'leaf' | 'panel' | 'glazing' | 'ironmongery';
  position: [number, number, number];
  rotation?: [number, number, number];
  dimensions: [number, number, number];
  materialType?: string;
}

/**
 * Main layout calculator
 * Returns positioned components based on product type
 */
export function calculateLayout(params: LayoutParams): ComponentLayout[] {
  const productCode = params.productType.toUpperCase();
  
  // E01, E02, E03 are entrance door types
  if (productCode.startsWith('E')) {
    return calculateDoorLayout(params);
  }
  
  // W-prefix for windows
  if (productCode.startsWith('W')) {
    return calculateWindowLayout(params);
  }
  
  // Generic fallback
  return calculateGenericLayout(params);
}

/**
 * Door layout calculator
 * E01: 1x2 panel arrangement
 * E02: 2x2 panel arrangement  
 * E03: Top glazing + 1x2 bottom panels
 */
function calculateDoorLayout(params: LayoutParams): ComponentLayout[] {
  const {
    productType,
    width,
    height,
    stileWidth = 114,
    topRailHeight = 114,
    midRailHeight = 200,
    bottomRailHeight = 200,
    thickness = 58,
  } = params;
  
  const components: ComponentLayout[] = [];
  const code = productType.toUpperCase();
  
  // Frame components (simplified - full frame would have head, jambs, threshold)
  const frameDepth = 150; // Frame projection
  components.push({
    id: 'frame-head',
    name: 'Frame Head',
    type: 'frame',
    position: [0, height / 2 + 50, 0],
    dimensions: [width + 200, 100, frameDepth],
    materialType: 'painted',
  });
  
  // Door leaf plane - centered at origin
  const leafW = width;
  const leafH = height;
  
  // Stiles (vertical members)
  const leftStileX = -leafW / 2 + stileWidth / 2;
  const rightStileX = leafW / 2 - stileWidth / 2;
  
  components.push({
    id: 'left-stile',
    name: 'Left Stile',
    type: 'leaf',
    position: [leftStileX, 0, 0],
    dimensions: [stileWidth, leafH, thickness],
    materialType: 'painted',
  });
  
  components.push({
    id: 'right-stile',
    name: 'Right Stile',
    type: 'leaf',
    position: [rightStileX, 0, 0],
    dimensions: [stileWidth, leafH, thickness],
    materialType: 'painted',
  });
  
  // Rails (horizontal members)
  const topRailY = leafH / 2 - topRailHeight / 2;
  const bottomRailY = -leafH / 2 + bottomRailHeight / 2;
  
  components.push({
    id: 'top-rail',
    name: 'Top Rail',
    type: 'leaf',
    position: [0, topRailY, 0],
    dimensions: [leafW - 2 * stileWidth, topRailHeight, thickness],
    materialType: 'painted',
  });
  
  components.push({
    id: 'bottom-rail',
    name: 'Bottom Rail',
    type: 'leaf',
    position: [0, bottomRailY, 0],
    dimensions: [leafW - 2 * stileWidth, bottomRailHeight, thickness],
    materialType: 'painted',
  });
  
  // Internal opening calculations
  const openingWidth = leafW - 2 * stileWidth;
  const topEdge = topRailY - topRailHeight / 2;
  const bottomEdge = bottomRailY + bottomRailHeight / 2;
  const openingHeight = topEdge - bottomEdge;
  
  if (code === 'E01') {
    // 1 row x 2 columns of panels
    const panelW = openingWidth / 2;
    const panelH = openingHeight;
    const panelDepth = thickness - 20; // Recessed panels
    
    const leftPanelX = -openingWidth / 4;
    const rightPanelX = openingWidth / 4;
    const panelY = (topEdge + bottomEdge) / 2;
    
    components.push({
      id: 'panel-left',
      name: 'Left Panel',
      type: 'panel',
      position: [leftPanelX, panelY, 5],
      dimensions: [panelW - 20, panelH - 20, panelDepth],
      materialType: 'painted',
    });
    
    components.push({
      id: 'panel-right',
      name: 'Right Panel',
      type: 'panel',
      position: [rightPanelX, panelY, 5],
      dimensions: [panelW - 20, panelH - 20, panelDepth],
      materialType: 'painted',
    });
    
    // Add mid-stile between panels
    components.push({
      id: 'mid-stile',
      name: 'Mid Stile',
      type: 'leaf',
      position: [0, panelY, 0],
      dimensions: [stileWidth, openingHeight, thickness],
      materialType: 'painted',
    });
  } else if (code === 'E02') {
    // 2 rows x 2 columns of panels
    // Add middle rail
    const midRailY = 0; // Centered
    components.push({
      id: 'mid-rail',
      name: 'Mid Rail',
      type: 'leaf',
      position: [0, midRailY, 0],
      dimensions: [openingWidth, midRailHeight, thickness],
      materialType: 'painted',
    });
    
    // Top row panels
    const topRowY = (topEdge + midRailY + midRailHeight / 2) / 2;
    const topRowH = topEdge - (midRailY + midRailHeight / 2);
    
    // Bottom row panels
    const bottomRowY = (bottomEdge + midRailY - midRailHeight / 2) / 2;
    const bottomRowH = (midRailY - midRailHeight / 2) - bottomEdge;
    
    const panelW = openingWidth / 2;
    const panelDepth = thickness - 20;
    
    ['top', 'bottom'].forEach((row, rowIdx) => {
      const panelY = row === 'top' ? topRowY : bottomRowY;
      const panelH = row === 'top' ? topRowH : bottomRowH;
      
      ['left', 'right'].forEach((side, colIdx) => {
        const panelX = side === 'left' ? -openingWidth / 4 : openingWidth / 4;
        
        components.push({
          id: `panel-${row}-${side}`,
          name: `${row.charAt(0).toUpperCase() + row.slice(1)} ${side.charAt(0).toUpperCase() + side.slice(1)} Panel`,
          type: 'panel',
          position: [panelX, panelY, 5],
          dimensions: [panelW - 20, panelH - 20, panelDepth],
          materialType: 'painted',
        });
      });
    });
    
    // Mid-stile
    components.push({
      id: 'mid-stile',
      name: 'Mid Stile',
      type: 'leaf',
      position: [0, 0, 0],
      dimensions: [stileWidth, openingHeight, thickness],
      materialType: 'painted',
    });
  } else if (code === 'E03') {
    // Top 35% glazing, bottom 65% with 1x2 panels
    const glazingRatio = 0.35;
    const glazingHeight = openingHeight * glazingRatio;
    const panelAreaHeight = openingHeight * (1 - glazingRatio);
    
    // Glazing bar to separate
    const glazingBarY = topEdge - glazingHeight - topRailHeight / 2;
    components.push({
      id: 'glazing-bar',
      name: 'Glazing Bar',
      type: 'leaf',
      position: [0, glazingBarY, 0],
      dimensions: [openingWidth, topRailHeight, thickness],
      materialType: 'painted',
    });
    
    // Glazing area
    const glazingY = (topEdge + glazingBarY + topRailHeight / 2) / 2;
    components.push({
      id: 'glazing',
      name: 'Glazing',
      type: 'glazing',
      position: [0, glazingY, 0],
      dimensions: [openingWidth - 40, glazingHeight - 40, 24],
      materialType: 'glass',
    });
    
    // Bottom panels (1x2)
    const panelY = (bottomEdge + glazingBarY - topRailHeight / 2) / 2;
    const panelH = panelAreaHeight - topRailHeight;
    const panelW = openingWidth / 2;
    const panelDepth = thickness - 20;
    
    ['left', 'right'].forEach((side) => {
      const panelX = side === 'left' ? -openingWidth / 4 : openingWidth / 4;
      
      components.push({
        id: `panel-${side}`,
        name: `${side.charAt(0).toUpperCase() + side.slice(1)} Panel`,
        type: 'panel',
        position: [panelX, panelY, 5],
        dimensions: [panelW - 20, panelH - 20, panelDepth],
        materialType: 'painted',
      });
    });
    
    // Mid-stile for bottom panels
    components.push({
      id: 'mid-stile',
      name: 'Mid Stile',
      type: 'leaf',
      position: [0, panelY, 0],
      dimensions: [stileWidth, panelH, thickness],
      materialType: 'painted',
    });
  }
  
  // Threshold
  components.push({
    id: 'threshold',
    name: 'Threshold',
    type: 'frame',
    position: [0, -height / 2 - 20, 0],
    dimensions: [width + 200, 40, frameDepth],
    materialType: 'painted',
  });
  
  return components;
}

/**
 * Window layout calculator
 */
function calculateWindowLayout(params: LayoutParams): ComponentLayout[] {
  // Simplified window layout
  const { width, height, thickness = 68 } = params;
  const components: ComponentLayout[] = [];
  
  // Frame
  const frameWidth = 100;
  components.push({
    id: 'frame',
    name: 'Window Frame',
    type: 'frame',
    position: [0, 0, 0],
    dimensions: [width, height, frameWidth],
    materialType: 'painted',
  });
  
  // Glazing
  components.push({
    id: 'glazing',
    name: 'Glazing',
    type: 'glazing',
    position: [0, 0, 0],
    dimensions: [width - 200, height - 200, 24],
    materialType: 'glass',
  });
  
  return components;
}

/**
 * Generic fallback layout
 */
function calculateGenericLayout(params: LayoutParams): ComponentLayout[] {
  const { width, height, depth = 100 } = params;
  
  return [{
    id: 'main-body',
    name: 'Main Body',
    type: 'panel',
    position: [0, 0, 0],
    dimensions: [width, height, depth],
    materialType: 'painted',
  }];
}
