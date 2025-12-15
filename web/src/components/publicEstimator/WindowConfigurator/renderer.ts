/**
 * Window Configurator SVG Renderer
 * Generates parametric SVG representations of windows
 */

import type { WindowConfiguration, ParametricWindowElements } from './types';
import { WINDOW_ELEMENTS } from './constants';

interface RenderOptions {
  config: WindowConfiguration;
  width?: number;
  height?: number;
  showDimensions?: boolean;
}

export function generateWindowSVG({
  config,
  width = 600,
  height = 800,
  showDimensions = false,
}: RenderOptions): string {
  const scale = Math.min(
    width / (config.dimensions.width * config.dimensions.columns),
    height / (config.dimensions.height * config.dimensions.rows)
  ) * 0.85;
  
  const scaledElements: ParametricWindowElements = {
    frameWidth: WINDOW_ELEMENTS.frameWidth * scale,
    sashWidth: WINDOW_ELEMENTS.sashWidth * scale,
    muntinWidth: WINDOW_ELEMENTS.muntinWidth * scale,
    sillDepth: WINDOW_ELEMENTS.sillDepth * scale,
    minPaneWidth: WINDOW_ELEMENTS.minPaneWidth * scale,
    minPaneHeight: WINDOW_ELEMENTS.minPaneHeight * scale,
  };
  
  const totalWidth = config.dimensions.width * config.dimensions.columns * scale;
  const totalHeight = config.dimensions.height * config.dimensions.rows * scale;
  
  const offsetX = (width - totalWidth) / 2;
  const offsetY = (height - totalHeight) / 2;
  
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="#f8fafc"/>`;
  
  // Render grid of windows
  for (let row = 0; row < config.dimensions.rows; row++) {
    for (let col = 0; col < config.dimensions.columns; col++) {
      const x = offsetX + (col * config.dimensions.width * scale);
      const y = offsetY + (row * config.dimensions.height * scale);
      const w = config.dimensions.width * scale;
      const h = config.dimensions.height * scale;
      
      svg += renderWindow(config, x, y, w, h, scaledElements);
    }
  }
  
  // Dimensions (if requested)
  if (showDimensions) {
    svg += renderDimensions(config, offsetX, offsetY, totalWidth, totalHeight);
  }
  
  svg += '</svg>';
  
  return svg;
}

function renderWindow(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number,
  elements: ParametricWindowElements
): string {
  let svg = '';
  
  // Determine color
  const frameColor = config.color.hexColor;
  const frameDark = darkenColor(frameColor, 20);
  const frameLight = lightenColor(frameColor, 20);
  
  // Outer frame
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
    fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
  
  // Frame depth effect
  svg += `<rect x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${height - 10}" 
    fill="none" stroke="${frameLight}" stroke-width="1" opacity="0.5"/>`;
  
  // Sill (bottom projection)
  const sillY = y + height - elements.frameWidth;
  svg += `<rect x="${x - 10}" y="${sillY}" width="${width + 20}" height="${elements.frameWidth + 10}" 
    fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
  svg += `<rect x="${x - 10}" y="${sillY}" width="${width + 20}" height="5" 
    fill="${frameLight}" opacity="0.7"/>`;
  
  // Window type specific rendering
  if (config.windowType === 'sash') {
    svg += renderSashWindow(config, x, y, width, height, elements, frameColor, frameDark);
  } else if (config.windowType === 'casement') {
    svg += renderCasementWindow(config, x, y, width, height, elements, frameColor, frameDark);
  } else if (config.windowType === 'alu-clad') {
    svg += renderAluCladWindow(config, x, y, width, height, elements, frameColor);
  }
  
  return svg;
}

function renderSashWindow(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number,
  elements: ParametricWindowElements,
  frameColor: string,
  frameDark: string
): string {
  let svg = '';
  
  const innerX = x + elements.frameWidth;
  const innerY = y + elements.frameWidth;
  const innerWidth = width - (elements.frameWidth * 2);
  const innerHeight = height - (elements.frameWidth * 2);
  
  // Top sash
  const topSashHeight = innerHeight / 2;
  svg += `<g opacity="0.95">`;
  svg += `<rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${topSashHeight}" 
    fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
  svg += renderPanes(
    config,
    innerX + elements.sashWidth,
    innerY + elements.sashWidth,
    innerWidth - (elements.sashWidth * 2),
    topSashHeight - (elements.sashWidth * 2),
    config.style.panes.horizontal,
    config.style.panes.vertical / 2,
    elements
  );
  svg += `</g>`;
  
  // Bottom sash
  const bottomSashY = innerY + topSashHeight;
  svg += `<g opacity="0.95">`;
  svg += `<rect x="${innerX}" y="${bottomSashY}" width="${innerWidth}" height="${topSashHeight}" 
    fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
  svg += renderPanes(
    config,
    innerX + elements.sashWidth,
    bottomSashY + elements.sashWidth,
    innerWidth - (elements.sashWidth * 2),
    topSashHeight - (elements.sashWidth * 2),
    config.style.panes.horizontal,
    config.style.panes.vertical / 2,
    elements
  );
  svg += `</g>`;
  
  // Meeting rail (where sashes meet)
  const meetingRailY = innerY + topSashHeight - elements.sashWidth;
  svg += `<rect x="${innerX}" y="${meetingRailY}" width="${innerWidth}" height="${elements.sashWidth * 2}" 
    fill="${frameColor}" stroke="${frameDark}" stroke-width="1"/>`;
  
  // Sash locks
  const lockX = x + width / 2;
  const lockY = meetingRailY + elements.sashWidth;
  svg += `<circle cx="${lockX}" cy="${lockY}" r="4" fill="#C5A572" stroke="#8B7355" stroke-width="1"/>`;
  
  return svg;
}

function renderCasementWindow(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number,
  elements: ParametricWindowElements,
  frameColor: string,
  frameDark: string
): string {
  let svg = '';
  
  const innerX = x + elements.frameWidth;
  const innerY = y + elements.frameWidth;
  const innerWidth = width - (elements.frameWidth * 2);
  const innerHeight = height - (elements.frameWidth * 2);
  
  const paneWidth = innerWidth / config.style.panes.horizontal;
  
  for (let i = 0; i < config.style.panes.horizontal; i++) {
    const paneX = innerX + (i * paneWidth);
    
    // Casement frame
    svg += `<rect x="${paneX}" y="${innerY}" width="${paneWidth}" height="${innerHeight}" 
      fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
    
    // Glass area
    svg += renderPanes(
      config,
      paneX + elements.sashWidth,
      innerY + elements.sashWidth,
      paneWidth - (elements.sashWidth * 2),
      innerHeight - (elements.sashWidth * 2),
      1,
      1,
      elements
    );
    
    // Hinges (left side for opening windows)
    if (config.style.panes.moveable === 'side' && i > 0) {
      svg += `<rect x="${paneX + 5}" y="${innerY + 30}" width="8" height="20" 
        fill="#4A4A4A" stroke="#2A2A2A" stroke-width="1" rx="2"/>`;
      svg += `<rect x="${paneX + 5}" y="${innerY + innerHeight - 50}" width="8" height="20" 
        fill="#4A4A4A" stroke="#2A2A2A" stroke-width="1" rx="2"/>`;
      
      // Handle (right side)
      svg += `<circle cx="${paneX + paneWidth - 20}" cy="${innerY + innerHeight / 2}" r="5" 
        fill="#C5A572" stroke="#8B7355" stroke-width="1"/>`;
      svg += `<rect x="${paneX + paneWidth - 22}" y="${innerY + innerHeight / 2 - 1}" width="15" height="2" 
        fill="#C5A572"/>`;
    }
  }
  
  return svg;
}

function renderAluCladWindow(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number,
  elements: ParametricWindowElements,
  frameColor: string
): string {
  let svg = '';
  
  // Aluminum cladding (external frame)
  const aluColor = '#8B8B8B';
  const aluDark = '#5A5A5A';
  const aluLight = '#B8B8B8';
  
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
    fill="${aluColor}" stroke="${aluDark}" stroke-width="2"/>`;
  
  // Aluminum highlights
  svg += `<line x1="${x + 5}" y1="${y + 5}" x2="${x + width - 5}" y2="${y + 5}" 
    stroke="${aluLight}" stroke-width="2" opacity="0.6"/>`;
  svg += `<line x1="${x + 5}" y1="${y + 5}" x2="${x + 5}" y2="${y + height - 5}" 
    stroke="${aluLight}" stroke-width="2" opacity="0.6"/>`;
  
  // Inner timber frame
  const innerX = x + elements.frameWidth;
  const innerY = y + elements.frameWidth;
  const innerWidth = width - (elements.frameWidth * 2);
  const innerHeight = height - (elements.frameWidth * 2);
  
  const frameDark = darkenColor(frameColor, 20);
  
  // Render based on style
  if (config.style.id === 'alu-clad-sash') {
    svg += renderSashWindow(config, x, y, width, height, elements, frameColor, frameDark);
  } else if (config.style.id === 'alu-clad-casement') {
    svg += renderCasementWindow(config, x, y, width, height, elements, frameColor, frameDark);
  } else if (config.style.id === 'alu-clad-tilt-turn') {
    // Tilt & turn special rendering
    svg += `<rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" 
      fill="${frameColor}" stroke="${frameDark}" stroke-width="2"/>`;
    svg += renderPanes(config, innerX + elements.sashWidth, innerY + elements.sashWidth,
      innerWidth - (elements.sashWidth * 2), innerHeight - (elements.sashWidth * 2), 1, 1, elements);
    
    // Tilt & turn handle (center right)
    svg += `<rect x="${innerX + innerWidth - 30}" y="${innerY + innerHeight / 2 - 25}" 
      width="15" height="50" fill="#4A4A4A" stroke="#2A2A2A" stroke-width="1" rx="3"/>`;
    svg += `<circle cx="${innerX + innerWidth - 22}" cy="${innerY + innerHeight / 2}" r="6" 
      fill="#C5A572" stroke="#8B7355" stroke-width="1"/>`;
  }
  
  return svg;
}

function renderPanes(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number,
  cols: number,
  rows: number,
  elements: ParametricWindowElements
): string {
  let svg = '';
  
  const paneWidth = width / cols;
  const paneHeight = height / rows;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const paneX = x + (col * paneWidth);
      const paneY = y + (row * paneHeight);
      
      // Glass pane
      svg += `<rect x="${paneX}" y="${paneY}" width="${paneWidth}" height="${paneHeight}" 
        fill="#E3F2FD" fill-opacity="0.3" stroke="#90CAF9" stroke-width="0.5"/>`;
      
      // Glass reflection
      svg += `<rect x="${paneX + 5}" y="${paneY + 5}" width="${paneWidth * 0.3}" height="${paneHeight * 0.4}" 
        fill="white" opacity="0.2"/>`;
      
      // Georgian bars (if enabled)
      if (config.features.Georgian && (cols > 1 || rows > 1)) {
        if (col < cols - 1) {
          const barX = paneX + paneWidth - elements.muntinWidth / 2;
          svg += `<rect x="${barX}" y="${y}" width="${elements.muntinWidth}" height="${height}" 
            fill="${config.color.hexColor}" stroke="${darkenColor(config.color.hexColor, 20)}" stroke-width="1"/>`;
        }
        if (row < rows - 1) {
          const barY = paneY + paneHeight - elements.muntinWidth / 2;
          svg += `<rect x="${x}" y="${barY}" width="${width}" height="${elements.muntinWidth}" 
            fill="${config.color.hexColor}" stroke="${darkenColor(config.color.hexColor, 20)}" stroke-width="1"/>`;
        }
      }
    }
  }
  
  return svg;
}

function renderDimensions(
  config: WindowConfiguration,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  let svg = '';
  
  const totalWidth = config.dimensions.width * config.dimensions.columns;
  const totalHeight = config.dimensions.height * config.dimensions.rows;
  
  // Width dimension
  svg += `<line x1="${x}" y1="${y - 30}" x2="${x + width}" y2="${y - 30}" 
    stroke="#475569" stroke-width="1" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>`;
  svg += `<text x="${x + width / 2}" y="${y - 35}" text-anchor="middle" 
    font-family="Arial" font-size="12" fill="#475569">${totalWidth}mm</text>`;
  
  // Height dimension
  svg += `<line x1="${x - 30}" y1="${y}" x2="${x - 30}" y2="${y + height}" 
    stroke="#475569" stroke-width="1" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>`;
  svg += `<text x="${x - 35}" y="${y + height / 2}" text-anchor="middle" 
    font-family="Arial" font-size="12" fill="#475569" transform="rotate(-90, ${x - 35}, ${y + height / 2})">${totalHeight}mm</text>`;
  
  return svg;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent / 100));
  const b = Math.max(0, (num & 0xff) * (1 - percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * (percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * (percent / 100));
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * (percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
