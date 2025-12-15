/**
 * Technical Drawing Renderer
 * Generates clean architectural line drawings for door configurations
 * Professional CAD-style appearance with dimensions and annotations
 */

import type { DoorConfiguration } from './types';

interface DrawingElement {
  type: 'line' | 'dimension' | 'annotation' | 'centerline';
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSize?: number;
}

const SCALE = 0.25; // Scale factor: 1mm = 0.25px for typical door sizes
const LINE_WIDTH = 1.5;
const THIN_LINE_WIDTH = 0.75;
const DIMENSION_LINE_WIDTH = 1;
const DIMENSION_OFFSET = 60; // Offset for dimension lines
const FONT_SIZE = 12;
const DIMENSION_ARROW_SIZE = 8;

/**
 * Generate technical drawing SVG for a door configuration
 */
export function generateTechnicalDrawing(config: DoorConfiguration): string {
  const { dimensions, style } = config;
  const elements: DrawingElement[] = [];
  
  // Calculate scaled dimensions
  const width = dimensions.width * SCALE;
  const height = dimensions.height * SCALE;
  const viewBoxWidth = width + DIMENSION_OFFSET * 4;
  const viewBoxHeight = height + DIMENSION_OFFSET * 4;
  const offsetX = DIMENSION_OFFSET * 2;
  const offsetY = DIMENSION_OFFSET * 2;
  
  // Draw main door outline (thick line)
  addRectangle(elements, offsetX, offsetY, width, height);
  
  // Draw internal elements based on style
  if (style.id === 'joplin-board' || style.id === 'franklin-glazed') {
    drawBoardStyleTechnical(elements, offsetX, offsetY, width, height, config);
  } else if (style.id === 'four-panel-victorian') {
    drawFourPanelTechnical(elements, offsetX, offsetY, width, height);
  } else if (style.id === 'six-panel-georgian') {
    drawSixPanelTechnical(elements, offsetX, offsetY, width, height);
  } else if (style.panelCount === 2) {
    drawTwoPanelTechnical(elements, offsetX, offsetY, width, height, config);
  } else if (style.panelCount === 1) {
    drawSinglePanelTechnical(elements, offsetX, offsetY, width, height, config);
  }
  
  // Add dimensions
  addDimensions(elements, offsetX, offsetY, width, height, dimensions);
  
  // Add annotations
  addAnnotations(elements, offsetX, offsetY, width, height, config);
  
  // Generate SVG
  return generateSVG(elements, viewBoxWidth, viewBoxHeight);
}

/**
 * Draw board-style cottage door technical drawing
 */
function drawBoardStyleTechnical(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  config: DoorConfiguration
): void {
  const boardWidth = 120 * SCALE;
  const ledgeHeight = 150 * SCALE;
  const numBoards = Math.floor(width / boardWidth);
  const actualBoardWidth = width / numBoards;
  
  // Draw vertical boards
  for (let i = 1; i < numBoards; i++) {
    const boardX = x + i * actualBoardWidth;
    addLine(elements, boardX, y, boardX, y + height, THIN_LINE_WIDTH);
  }
  
  // Draw horizontal ledges (top, middle, bottom)
  const ledgePositions = [
    y + ledgeHeight / 2,
    y + height / 2,
    y + height - ledgeHeight / 2
  ];
  
  ledgePositions.forEach(ledgeY => {
    addLine(elements, x, ledgeY, x + width, ledgeY, LINE_WIDTH);
    // Ledge boundaries
    addLine(elements, x, ledgeY - ledgeHeight / 2, x + width, ledgeY - ledgeHeight / 2, THIN_LINE_WIDTH);
    addLine(elements, x, ledgeY + ledgeHeight / 2, x + width, ledgeY + ledgeHeight / 2, THIN_LINE_WIDTH);
  });
  
  // Draw diagonal brace (dashed line to indicate behind)
  addDashedLine(
    elements,
    x,
    y + height - ledgeHeight,
    x + width,
    y + height / 2,
    THIN_LINE_WIDTH
  );
  
  // If Franklin style with glass
  if (config.style.id === 'franklin-glazed' && config.selectedGlass.id !== 'none') {
    const glassWidth = width * 0.35;
    const glassHeight = height * 0.4;
    const glassX = x + (width - glassWidth) / 2;
    const glassY = y + height * 0.3;
    
    // Glass panel outline
    addRectangle(elements, glassX, glassY, glassWidth, glassHeight, LINE_WIDTH);
    
    // Glass diagonal hatch pattern
    const hatchSpacing = 20;
    for (let i = 0; i < glassHeight; i += hatchSpacing) {
      const hatchY = glassY + i;
      addLine(elements, glassX, hatchY, glassX + glassWidth, hatchY, THIN_LINE_WIDTH * 0.5);
    }
  }
}

/**
 * Draw four-panel Victorian technical drawing
 */
function drawFourPanelTechnical(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const stileWidth = 45 * SCALE;
  const topRailHeight = 150 * SCALE;
  const bottomRailHeight = 200 * SCALE;
  const middleRailHeight = 100 * SCALE;
  
  // Stiles
  addLine(elements, x + stileWidth, y, x + stileWidth, y + height);
  addLine(elements, x + width - stileWidth, y, x + width - stileWidth, y + height);
  
  // Rails
  addLine(elements, x, y + topRailHeight, x + width, y + topRailHeight);
  addLine(elements, x, y + height - bottomRailHeight, x + width, y + height - bottomRailHeight);
  
  // Middle rail
  const middleY = y + (height - bottomRailHeight - topRailHeight) / 2 + topRailHeight;
  addLine(elements, x, middleY, x + width, middleY);
  
  // Center stile (vertical divider)
  addLine(elements, x + width / 2, y + topRailHeight, x + width / 2, y + height - bottomRailHeight);
  
  // Panel outlines (thin lines)
  const panelInset = 15 * SCALE;
  const leftPanelX = x + stileWidth + panelInset;
  const rightPanelX = x + width / 2 + panelInset;
  const topPanelY = y + topRailHeight + panelInset;
  const bottomPanelY = middleY + panelInset;
  const panelWidth = (width - stileWidth * 2 - panelInset * 3) / 2;
  const topPanelHeight = middleY - topRailHeight - panelInset * 2;
  const bottomPanelHeight = height - bottomRailHeight - middleY - panelInset * 2;
  
  // Four panels
  addRectangle(elements, leftPanelX, topPanelY, panelWidth, topPanelHeight, THIN_LINE_WIDTH);
  addRectangle(elements, rightPanelX, topPanelY, panelWidth, topPanelHeight, THIN_LINE_WIDTH);
  addRectangle(elements, leftPanelX, bottomPanelY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
  addRectangle(elements, rightPanelX, bottomPanelY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
}

/**
 * Draw six-panel Georgian technical drawing
 */
function drawSixPanelTechnical(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const stileWidth = 45 * SCALE;
  const topRailHeight = 150 * SCALE;
  const bottomRailHeight = 200 * SCALE;
  
  // Stiles
  addLine(elements, x + stileWidth, y, x + stileWidth, y + height);
  addLine(elements, x + width - stileWidth, y, x + width - stileWidth, y + height);
  
  // Rails (4 horizontal rails)
  const topPanelHeight = (height - bottomRailHeight - topRailHeight) / 3;
  const rail1Y = y + topRailHeight;
  const rail2Y = rail1Y + topPanelHeight;
  const rail3Y = rail2Y + topPanelHeight;
  
  addLine(elements, x, rail1Y, x + width, rail1Y);
  addLine(elements, x, rail2Y, x + width, rail2Y);
  addLine(elements, x, rail3Y, x + width, rail3Y);
  addLine(elements, x, y + height - bottomRailHeight, x + width, y + height - bottomRailHeight);
  
  // Center stile
  addLine(elements, x + width / 2, rail1Y, x + width / 2, rail3Y);
  
  // Six panel outlines
  const panelInset = 15 * SCALE;
  const leftX = x + stileWidth + panelInset;
  const rightX = x + width / 2 + panelInset;
  const panelWidth = (width - stileWidth * 2 - panelInset * 3) / 2;
  const panelHeight = topPanelHeight - panelInset * 2;
  const bottomPanelHeight = height - bottomRailHeight - rail3Y - panelInset * 2;
  
  // Top four panels
  for (let row = 0; row < 2; row++) {
    const panelY = rail1Y + panelInset + row * topPanelHeight;
    addRectangle(elements, leftX, panelY, panelWidth, panelHeight, THIN_LINE_WIDTH);
    addRectangle(elements, rightX, panelY, panelWidth, panelHeight, THIN_LINE_WIDTH);
  }
  
  // Bottom two panels
  const bottomY = rail3Y + panelInset;
  addRectangle(elements, leftX, bottomY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
  addRectangle(elements, rightX, bottomY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
}

/**
 * Draw two-panel technical drawing
 */
function drawTwoPanelTechnical(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  config: DoorConfiguration
): void {
  const stileWidth = 45 * SCALE;
  const topRailHeight = 150 * SCALE;
  const bottomRailHeight = 150 * SCALE;
  
  // Stiles
  addLine(elements, x + stileWidth, y, x + stileWidth, y + height);
  addLine(elements, x + width - stileWidth, y, x + width - stileWidth, y + height);
  
  // Rails
  addLine(elements, x, y + topRailHeight, x + width, y + topRailHeight);
  addLine(elements, x, y + height - bottomRailHeight, x + width, y + height - bottomRailHeight);
  
  // Middle rail
  const middleY = y + height / 2;
  addLine(elements, x, middleY, x + width, middleY);
  
  // Panel outlines
  const panelInset = 15 * SCALE;
  const panelX = x + stileWidth + panelInset;
  const panelWidth = width - stileWidth * 2 - panelInset * 2;
  const topPanelY = y + topRailHeight + panelInset;
  const bottomPanelY = middleY + panelInset;
  const topPanelHeight = middleY - topRailHeight - panelInset * 2;
  const bottomPanelHeight = height - bottomRailHeight - middleY - panelInset * 2;
  
  if (config.selectedGlass.id === 'none') {
    // Two solid panels
    addRectangle(elements, panelX, topPanelY, panelWidth, topPanelHeight, THIN_LINE_WIDTH);
    addRectangle(elements, panelX, bottomPanelY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
  } else {
    // Top glass, bottom panel
    addRectangle(elements, panelX, topPanelY, panelWidth, topPanelHeight, LINE_WIDTH);
    addGlassHatch(elements, panelX, topPanelY, panelWidth, topPanelHeight);
    addRectangle(elements, panelX, bottomPanelY, panelWidth, bottomPanelHeight, THIN_LINE_WIDTH);
  }
}

/**
 * Draw single-panel technical drawing
 */
function drawSinglePanelTechnical(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  config: DoorConfiguration
): void {
  const stileWidth = 45 * SCALE;
  const topRailHeight = 150 * SCALE;
  const bottomRailHeight = 150 * SCALE;
  
  // Stiles
  addLine(elements, x + stileWidth, y, x + stileWidth, y + height);
  addLine(elements, x + width - stileWidth, y, x + width - stileWidth, y + height);
  
  // Rails
  addLine(elements, x, y + topRailHeight, x + width, y + topRailHeight);
  addLine(elements, x, y + height - bottomRailHeight, x + width, y + height - bottomRailHeight);
  
  // Panel outline
  const panelInset = 15 * SCALE;
  const panelX = x + stileWidth + panelInset;
  const panelY = y + topRailHeight + panelInset;
  const panelWidth = width - stileWidth * 2 - panelInset * 2;
  const panelHeight = height - topRailHeight - bottomRailHeight - panelInset * 2;
  
  if (config.selectedGlass.id === 'none') {
    // Solid panel
    addRectangle(elements, panelX, panelY, panelWidth, panelHeight, THIN_LINE_WIDTH);
  } else {
    // Glass panel
    addRectangle(elements, panelX, panelY, panelWidth, panelHeight, LINE_WIDTH);
    addGlassHatch(elements, panelX, panelY, panelWidth, panelHeight);
  }
}

/**
 * Add glass hatch pattern (diagonal lines)
 */
function addGlassHatch(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const hatchSpacing = 30;
  const hatchAngle = Math.PI / 4; // 45 degrees
  
  // Diagonal lines from top-left to bottom-right
  for (let i = -height; i < width; i += hatchSpacing) {
    const startX = x + i;
    const startY = y;
    const endX = startX + height / Math.tan(hatchAngle);
    const endY = y + height;
    
    // Clip to glass bounds
    const clippedStart = clipLineToRect(startX, startY, endX, endY, x, y, width, height);
    if (clippedStart) {
      addLine(elements, clippedStart.x1, clippedStart.y1, clippedStart.x2, clippedStart.y2, THIN_LINE_WIDTH * 0.5);
    }
  }
}

/**
 * Clip line to rectangle bounds
 */
function clipLineToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  // Simple clipping - just check if line intersects rect
  const minX = Math.max(Math.min(x1, x2), rectX);
  const maxX = Math.min(Math.max(x1, x2), rectX + rectWidth);
  const minY = Math.max(Math.min(y1, y2), rectY);
  const maxY = Math.min(Math.max(y1, y2), rectY + rectHeight);
  
  if (minX <= maxX && minY <= maxY) {
    return {
      x1: Math.max(x1, rectX),
      y1: y1 < rectY ? rectY : Math.min(y1, rectY + rectHeight),
      x2: Math.min(x2, rectX + rectWidth),
      y2: y2 > rectY + rectHeight ? rectY + rectHeight : Math.max(y2, rectY),
    };
  }
  return null;
}

/**
 * Add dimension lines and text
 */
function addDimensions(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  dimensions: { width: number; height: number }
): void {
  // Width dimension (bottom)
  const dimY = y + height + DIMENSION_OFFSET;
  addDimensionLine(elements, x, dimY, x + width, dimY, `${dimensions.width}mm`);
  
  // Height dimension (right)
  const dimX = x + width + DIMENSION_OFFSET;
  addDimensionLine(elements, dimX, y, dimX, y + height, `${dimensions.height}mm`, true);
}

/**
 * Add annotations (title block)
 */
function addAnnotations(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  config: DoorConfiguration
): void {
  const titleX = x;
  const titleY = y - DIMENSION_OFFSET / 2;
  
  elements.push({
    type: 'annotation',
    x1: titleX,
    y1: titleY,
    text: `${config.style.name}`,
    fontSize: FONT_SIZE + 2,
  });
  
  // Finish annotation
  if (config.color.id !== 'natural') {
    elements.push({
      type: 'annotation',
      x1: titleX,
      y1: titleY + 20,
      text: `Finish: ${config.color.name}`,
      fontSize: FONT_SIZE - 1,
    });
  }
  
  // Glass annotation
  if (config.selectedGlass.id !== 'none') {
    elements.push({
      type: 'annotation',
      x1: titleX,
      y1: titleY + 35,
      text: `Glass: ${config.selectedGlass.name}`,
      fontSize: FONT_SIZE - 1,
    });
  }
}

/**
 * Helper functions to add drawing elements
 */
function addLine(
  elements: DrawingElement[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number = LINE_WIDTH
): void {
  elements.push({ type: 'line', x1, y1, x2, y2 });
}

function addDashedLine(
  elements: DrawingElement[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number = LINE_WIDTH
): void {
  elements.push({ type: 'centerline', x1, y1, x2, y2 });
}

function addRectangle(
  elements: DrawingElement[],
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = LINE_WIDTH
): void {
  addLine(elements, x, y, x + width, y, lineWidth);
  addLine(elements, x + width, y, x + width, y + height, lineWidth);
  addLine(elements, x + width, y + height, x, y + height, lineWidth);
  addLine(elements, x, y + height, x, y, lineWidth);
}

function addDimensionLine(
  elements: DrawingElement[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  vertical: boolean = false
): void {
  elements.push({
    type: 'dimension',
    x1,
    y1,
    x2,
    y2,
    text,
  });
}

/**
 * Generate final SVG markup
 */
function generateSVG(elements: DrawingElement[], width: number, height: number): string {
  const lines: string[] = [];
  
  elements.forEach(el => {
    if (el.type === 'line') {
      lines.push(
        `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" ` +
        `stroke="#000" stroke-width="${LINE_WIDTH}" stroke-linecap="square"/>`
      );
    } else if (el.type === 'centerline') {
      lines.push(
        `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" ` +
        `stroke="#000" stroke-width="${THIN_LINE_WIDTH}" stroke-dasharray="5,5" stroke-linecap="round"/>`
      );
    } else if (el.type === 'dimension') {
      const isVertical = Math.abs((el.x2! - el.x1)) < Math.abs((el.y2! - el.y1));
      const midX = (el.x1 + el.x2!) / 2;
      const midY = (el.y1 + el.y2!) / 2;
      
      // Dimension line
      lines.push(
        `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" ` +
        `stroke="#000" stroke-width="${DIMENSION_LINE_WIDTH}"/>`
      );
      
      // Arrows
      if (isVertical) {
        lines.push(
          `<path d="M ${el.x1 - DIMENSION_ARROW_SIZE / 2} ${el.y1 + DIMENSION_ARROW_SIZE} ` +
          `L ${el.x1} ${el.y1} L ${el.x1 + DIMENSION_ARROW_SIZE / 2} ${el.y1 + DIMENSION_ARROW_SIZE}" ` +
          `fill="none" stroke="#000" stroke-width="${DIMENSION_LINE_WIDTH}"/>`
        );
        lines.push(
          `<path d="M ${el.x2! - DIMENSION_ARROW_SIZE / 2} ${el.y2! - DIMENSION_ARROW_SIZE} ` +
          `L ${el.x2} ${el.y2} L ${el.x2! + DIMENSION_ARROW_SIZE / 2} ${el.y2! - DIMENSION_ARROW_SIZE}" ` +
          `fill="none" stroke="#000" stroke-width="${DIMENSION_LINE_WIDTH}"/>`
        );
      } else {
        lines.push(
          `<path d="M ${el.x1 + DIMENSION_ARROW_SIZE} ${el.y1 - DIMENSION_ARROW_SIZE / 2} ` +
          `L ${el.x1} ${el.y1} L ${el.x1 + DIMENSION_ARROW_SIZE} ${el.y1 + DIMENSION_ARROW_SIZE / 2}" ` +
          `fill="none" stroke="#000" stroke-width="${DIMENSION_LINE_WIDTH}"/>`
        );
        lines.push(
          `<path d="M ${el.x2! - DIMENSION_ARROW_SIZE} ${el.y2! - DIMENSION_ARROW_SIZE / 2} ` +
          `L ${el.x2} ${el.y2} L ${el.x2! - DIMENSION_ARROW_SIZE} ${el.y2! + DIMENSION_ARROW_SIZE / 2}" ` +
          `fill="none" stroke="#000" stroke-width="${DIMENSION_LINE_WIDTH}"/>`
        );
      }
      
      // Text
      const textAnchor = 'middle';
      const textRotate = isVertical ? -90 : 0;
      lines.push(
        `<text x="${midX}" y="${midY - 5}" text-anchor="${textAnchor}" ` +
        `font-family="Arial, sans-serif" font-size="${FONT_SIZE}" fill="#000" ` +
        `transform="rotate(${textRotate}, ${midX}, ${midY})">${el.text}</text>`
      );
    } else if (el.type === 'annotation') {
      lines.push(
        `<text x="${el.x1}" y="${el.y1}" text-anchor="start" ` +
        `font-family="Arial, sans-serif" font-size="${el.fontSize || FONT_SIZE}" ` +
        `fill="#000" font-weight="${el.fontSize && el.fontSize > FONT_SIZE ? 'bold' : 'normal'}">${el.text}</text>`
      );
    }
  });
  
  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" 
         style="background: white; width: 100%; height: 100%;">
      ${lines.join('\n      ')}
    </svg>
  `;
}
