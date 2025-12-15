/**
 * Parametric Door Renderer
 * Generates SVG representation with fixed stile/rail dimensions
 */

import { DoorConfiguration, ParametricDoorElements } from './types';
import { DOOR_ELEMENTS } from './constants';

interface DoorSVGProps {
  config: DoorConfiguration;
  width?: number; // SVG viewport width in pixels
  height?: number; // SVG viewport height in pixels
  showDimensions?: boolean;
}

export function generateDoorSVG({
  config,
  width = 400,
  height = 600,
  showDimensions = false,
}: DoorSVGProps): string {
  const { dimensions, style, color, panelConfig, selectedGlass, sideLight, topLight } = config;
  const elements = DOOR_ELEMENTS;

  // Calculate total width including side lights
  let totalWidth = dimensions.width;
  if (sideLight.enabled) {
    if (sideLight.position === 'both') {
      totalWidth += sideLight.width * 2;
    } else {
      totalWidth += sideLight.width;
    }
  }

  // Calculate total height including top light
  let totalHeight = dimensions.height;
  if (topLight.enabled) {
    totalHeight += topLight.height;
  }

  // SVG scale factor
  const scaleX = width / totalWidth;
  const scaleY = height / totalHeight;
  const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding

  const svgWidth = totalWidth * scale;
  const svgHeight = totalHeight * scale;

  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svgContent += `<rect width="${width}" height="${height}" fill="#f8f9fa"/>`;

  // Center the door assembly
  const offsetX = (width - svgWidth) / 2;
  const offsetY = (height - svgHeight) / 2;

  svgContent += `<g transform="translate(${offsetX}, ${offsetY})">`;

  // Render top light if enabled
  let doorOffsetY = 0;
  if (topLight.enabled) {
    svgContent += renderTopLight(topLight, totalWidth, scale, color.hex);
    doorOffsetY = topLight.height * scale;
  }

  svgContent += `<g transform="translate(0, ${doorOffsetY})">`;

  // Render side lights if enabled
  let doorOffsetX = 0;
  if (sideLight.enabled && (sideLight.position === 'left' || sideLight.position === 'both')) {
    svgContent += renderSideLight(sideLight, 'left', dimensions.height, scale, color.hex);
    doorOffsetX = sideLight.width * scale;
  }

  // Render main door
  svgContent += `<g transform="translate(${doorOffsetX}, 0)">`;
  svgContent += renderDoor(config, scale, elements);
  svgContent += `</g>`;

  // Render right side light
  if (sideLight.enabled && (sideLight.position === 'right' || sideLight.position === 'both')) {
    const rightX = (doorOffsetX + dimensions.width * scale);
    svgContent += `<g transform="translate(${rightX}, 0)">`;
    svgContent += renderSideLight(sideLight, 'right', dimensions.height, scale, color.hex);
    svgContent += `</g>`;
  }

  svgContent += `</g>`; // Close door assembly group
  svgContent += `</g>`; // Close main group

  // Add dimensions if requested
  if (showDimensions) {
    svgContent += renderDimensions(config, offsetX, offsetY, scale);
  }

  svgContent += `</svg>`;

  return svgContent;
}

function renderDoor(
  config: DoorConfiguration,
  scale: number,
  elements: ParametricDoorElements
): string {
  const { dimensions, style, color, panelConfig, selectedGlass } = config;
  let svg = '';

  const doorWidth = dimensions.width * scale;
  const doorHeight = dimensions.height * scale;

  // Door frame (outer rectangle)
  svg += `<rect x="0" y="0" width="${doorWidth}" height="${doorHeight}" 
    fill="${color.hex}" stroke="#2d3748" stroke-width="2"/>`;

  // Stiles (vertical members) - fixed width
  const stileWidth = elements.stileWidth * scale;
  svg += `<rect x="0" y="0" width="${stileWidth}" height="${doorHeight}" 
    fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;
  svg += `<rect x="${doorWidth - stileWidth}" y="0" width="${stileWidth}" height="${doorHeight}" 
    fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

  // Rails (horizontal members) - fixed heights
  const topRailHeight = elements.topRailHeight * scale;
  const bottomRailHeight = elements.bottomRailHeight * scale;
  const middleRailHeight = elements.middleRailHeight * scale;

  // Top rail
  svg += `<rect x="0" y="0" width="${doorWidth}" height="${topRailHeight}" 
    fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

  // Bottom rail
  svg += `<rect x="0" y="${doorHeight - bottomRailHeight}" width="${doorWidth}" height="${bottomRailHeight}" 
    fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

  // Render panels based on style
  svg += renderPanels(style, config, scale, elements);

  // Render door furniture
  svg += renderDoorFurniture(config, scale);

  return svg;
}

function renderPanels(
  style: any,
  config: DoorConfiguration,
  scale: number,
  elements: ParametricDoorElements
): string {
  let svg = '';
  const { dimensions, color, panelConfig, selectedGlass } = config;

  const doorWidth = dimensions.width * scale;
  const doorHeight = dimensions.height * scale;
  const stileWidth = elements.stileWidth * scale;
  const topRailHeight = elements.topRailHeight * scale;
  const bottomRailHeight = elements.bottomRailHeight * scale;
  const middleRailHeight = elements.middleRailHeight * scale;

  const innerWidth = doorWidth - (stileWidth * 2);
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;

  if (style.panelCount === 4) {
    // Four panel grid
    const midRailY = topRailHeight + (innerHeight / 2) - (middleRailHeight / 2);
    svg += `<rect x="${stileWidth}" y="${midRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

    const panelWidth = (innerWidth - elements.muntinWidth * scale) / 2;
    const panelHeight = (innerHeight - middleRailHeight) / 2;

    // Top panels
    svg += renderPanel(stileWidth, topRailHeight, panelWidth, panelHeight, panelConfig.glassInTop, selectedGlass, color.hex);
    svg += renderPanel(stileWidth + panelWidth + elements.muntinWidth * scale, topRailHeight, panelWidth, panelHeight, panelConfig.glassInTop, selectedGlass, color.hex);

    // Bottom panels
    const bottomY = midRailY + middleRailHeight;
    svg += renderPanel(stileWidth, bottomY, panelWidth, panelHeight, panelConfig.glassInBottom, selectedGlass, color.hex);
    svg += renderPanel(stileWidth + panelWidth + elements.muntinWidth * scale, bottomY, panelWidth, panelHeight, panelConfig.glassInBottom, selectedGlass, color.hex);

    // Vertical muntin
    svg += `<rect x="${doorWidth / 2 - elements.muntinWidth * scale / 2}" y="${topRailHeight}" 
      width="${elements.muntinWidth * scale}" height="${innerHeight}" 
      fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

  } else if (style.panelCount === 6) {
    // Six panel grid (3x2)
    const upperRailY = topRailHeight + (innerHeight / 3) - (middleRailHeight / 2);
    const lowerRailY = topRailHeight + (innerHeight * 2 / 3) - (middleRailHeight / 2);

    svg += `<rect x="${stileWidth}" y="${upperRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;
    svg += `<rect x="${stileWidth}" y="${lowerRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

    const panelHeight = (innerHeight - middleRailHeight * 2) / 3;

    // Top row panels
    svg += renderPanel(stileWidth, topRailHeight, innerWidth, panelHeight, false, selectedGlass, color.hex);
    
    // Middle row panels
    const midY = upperRailY + middleRailHeight;
    svg += renderPanel(stileWidth, midY, innerWidth, panelHeight, false, selectedGlass, color.hex);
    
    // Bottom row panels
    const bottomY = lowerRailY + middleRailHeight;
    svg += renderPanel(stileWidth, bottomY, innerWidth, panelHeight, false, selectedGlass, color.hex);

  } else if (style.panelCount === 2) {
    // Two horizontal panels (half glazed typical)
    const midRailY = topRailHeight + (innerHeight / 2) - (middleRailHeight / 2);
    svg += `<rect x="${stileWidth}" y="${midRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="${darkenColor(color.hex, 0.1)}" stroke="#2d3748" stroke-width="1"/>`;

    const panelHeight = (innerHeight - middleRailHeight) / 2;

    // Top panel (often glass)
    svg += renderPanel(stileWidth, topRailHeight, innerWidth, panelHeight, panelConfig.glassInTop, selectedGlass, color.hex);
    
    // Bottom panel
    const bottomY = midRailY + middleRailHeight;
    svg += renderPanel(stileWidth, bottomY, innerWidth, panelHeight, panelConfig.glassInBottom, selectedGlass, color.hex);

  } else if (style.panelCount === 1) {
    // Single panel (full glazed typical)
    svg += renderPanel(stileWidth, topRailHeight, innerWidth, innerHeight, true, selectedGlass, color.hex);
  }

  return svg;
}

function renderPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  hasGlass: boolean,
  glassOption: any,
  doorColor: string
): string {
  const padding = 8;
  const innerX = x + padding;
  const innerY = y + padding;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  if (hasGlass && glassOption.type !== 'none') {
    // Glass panel
    let glassColor = '#b0d4f1';
    let glassPattern = '';

    if (glassOption.type === 'obscure') {
      glassPattern = `<pattern id="obscure" patternUnits="userSpaceOnUse" width="4" height="4">
        <rect width="4" height="4" fill="#b0d4f1" opacity="0.6"/>
        <line x1="0" y1="0" x2="4" y2="4" stroke="#8ab0d1" stroke-width="0.5"/>
      </pattern>`;
      glassColor = 'url(#obscure)';
    } else if (glassOption.type === 'leaded') {
      glassPattern = `<pattern id="leaded" patternUnits="userSpaceOnUse" width="40" height="40">
        <rect width="40" height="40" fill="#b0d4f1" opacity="0.7"/>
        <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke="#4a5568" stroke-width="2"/>
      </pattern>`;
      glassColor = 'url(#leaded)';
    }

    return `${glassPattern}<rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" 
      fill="${glassColor}" stroke="#4a5568" stroke-width="1" opacity="0.8"/>`;
  } else {
    // Solid panel with bevel effect
    return `<rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" 
      fill="${lightenColor(doorColor, 0.1)}" stroke="${darkenColor(doorColor, 0.2)}" stroke-width="2"/>
      <rect x="${innerX + 4}" y="${innerY + 4}" width="${innerWidth - 8}" height="${innerHeight - 8}" 
      fill="${doorColor}" stroke="${darkenColor(doorColor, 0.1)}" stroke-width="1"/>`;
  }
}

function renderDoorFurniture(config: DoorConfiguration, scale: number): string {
  let svg = '';
  const doorWidth = config.dimensions.width * scale;
  const doorHeight = config.dimensions.height * scale;

  // Door handle (at standard height ~1000mm from bottom)
  const handleY = doorHeight - (1000 * scale);
  const handleX = doorWidth - (150 * scale);

  svg += `<circle cx="${handleX}" cy="${handleY}" r="${12 * scale}" 
    fill="#d4af37" stroke="#8b7355" stroke-width="1"/>`;
  svg += `<rect x="${handleX - 30 * scale}" y="${handleY - 4 * scale}" 
    width="${60 * scale}" height="${8 * scale}" 
    fill="#d4af37" stroke="#8b7355" stroke-width="1" rx="2"/>`;

  // Letter plate if enabled
  if (config.hardware.letterPlate) {
    const letterPlateY = doorHeight / 2;
    const letterPlateX = doorWidth / 2;
    svg += `<rect x="${letterPlateX - 60 * scale}" y="${letterPlateY - 15 * scale}" 
      width="${120 * scale}" height="${30 * scale}" 
      fill="#8b7355" stroke="#4a5568" stroke-width="1" rx="3"/>`;
  }

  // Knocker if enabled
  if (config.hardware.knocker) {
    const knockerY = doorHeight / 3;
    const knockerX = doorWidth / 2;
    svg += `<circle cx="${knockerX}" cy="${knockerY}" r="${15 * scale}" 
      fill="#d4af37" stroke="#8b7355" stroke-width="2"/>`;
    svg += `<circle cx="${knockerX}" cy="${knockerY + 25 * scale}" r="${8 * scale}" 
      fill="#d4af37" stroke="#8b7355" stroke-width="1"/>`;
  }

  return svg;
}

function renderSideLight(
  sideLight: any,
  position: 'left' | 'right',
  doorHeight: number,
  scale: number,
  color: string
): string {
  const width = sideLight.width * scale;
  const height = doorHeight * scale;

  let svg = `<rect x="0" y="0" width="${width}" height="${height}" 
    fill="${color}" stroke="#2d3748" stroke-width="2"/>`;

  if (sideLight.hasGlass) {
    const padding = 20 * scale;
    svg += `<rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" 
      fill="#b0d4f1" stroke="#4a5568" stroke-width="1" opacity="0.7"/>`;
  }

  return svg;
}

function renderTopLight(
  topLight: any,
  totalWidth: number,
  scale: number,
  color: string
): string {
  const width = totalWidth * scale;
  const height = topLight.height * scale;

  let svg = '';

  if (topLight.style === 'arched') {
    svg += `<path d="M 0 ${height} L 0 ${height / 2} Q ${width / 2} 0 ${width} ${height / 2} L ${width} ${height} Z" 
      fill="${color}" stroke="#2d3748" stroke-width="2"/>`;
    if (topLight.hasGlass) {
      svg += `<path d="M ${20 * scale} ${height - 10 * scale} L ${20 * scale} ${height / 2} Q ${width / 2} ${20 * scale} ${width - 20 * scale} ${height / 2} L ${width - 20 * scale} ${height - 10 * scale} Z" 
        fill="#b0d4f1" stroke="#4a5568" stroke-width="1" opacity="0.7"/>`;
    }
  } else {
    svg += `<rect x="0" y="0" width="${width}" height="${height}" 
      fill="${color}" stroke="#2d3748" stroke-width="2"/>`;
    if (topLight.hasGlass) {
      const padding = 20 * scale;
      svg += `<rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" 
        fill="#b0d4f1" stroke="#4a5568" stroke-width="1" opacity="0.7"/>`;
    }
  }

  return svg;
}

function renderDimensions(
  config: DoorConfiguration,
  offsetX: number,
  offsetY: number,
  scale: number
): string {
  let svg = '';
  const { dimensions } = config;
  // Add dimension lines and labels
  // This would show width and height with extension lines
  return svg;
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount * 255);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount * 255);
  const b = Math.max(0, (num & 0x0000FF) - amount * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount * 255);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount * 255);
  const b = Math.min(255, (num & 0x0000FF) + amount * 255);
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
}
