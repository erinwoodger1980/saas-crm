/**
 * Enhanced Parametric Door Renderer
 * Generates realistic SVG representations with wood grain and depth effects
 */

import { DoorConfiguration, ParametricDoorElements } from './types';
import { DOOR_ELEMENTS } from './constants';

interface DoorSVGProps {
  config: DoorConfiguration;
  width?: number;
  height?: number;
  showDimensions?: boolean;
}

export function generateDoorSVG({
  config,
  width = 400,
  height = 600,
  showDimensions = false,
}: DoorSVGProps): string {
  const { dimensions, style, color, panelConfig, selectedGlass, sideLight, topLight } = config;

  let totalWidth = dimensions.width;
  if (sideLight.enabled) {
    totalWidth += sideLight.position === 'both' ? sideLight.width * 2 : sideLight.width;
  }

  let totalHeight = dimensions.height;
  if (topLight.enabled) {
    totalHeight += topLight.height;
  }

  const scale = Math.min(width / totalWidth, height / totalHeight) * 0.85;
  const svgWidth = totalWidth * scale;
  const svgHeight = totalHeight * scale;
  const offsetX = (width - svgWidth) / 2;
  const offsetY = (height - svgHeight) / 2;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add SVG definitions for gradients, patterns, and filters
  svg += generateSVGDefs(color.hex);
  
  // Soft shadow background
  svg += `<rect width="${width}" height="${height}" fill="#e8e9ed"/>`;
  
  // Drop shadow for the entire door assembly
  svg += `<rect x="${offsetX - 8}" y="${offsetY - 8}" width="${svgWidth + 16}" height="${svgHeight + 16}" 
    fill="rgba(0,0,0,0.15)" rx="4" filter="url(#doorShadow)"/>`;

  svg += `<g transform="translate(${offsetX}, ${offsetY})">`;

  let doorOffsetY = 0;
  if (topLight.enabled) {
    svg += renderTopLight(topLight, totalWidth, scale, color.hex);
    doorOffsetY = topLight.height * scale;
  }

  svg += `<g transform="translate(0, ${doorOffsetY})">`;

  let doorOffsetX = 0;
  if (sideLight.enabled && (sideLight.position === 'left' || sideLight.position === 'both')) {
    svg += renderSideLight(sideLight, 'left', dimensions.height, scale, color.hex);
    doorOffsetX = sideLight.width * scale;
  }

  svg += `<g transform="translate(${doorOffsetX}, 0)">`;
  svg += renderRealisticDoor(config, scale);
  svg += `</g>`;

  if (sideLight.enabled && (sideLight.position === 'right' || sideLight.position === 'both')) {
    svg += `<g transform="translate(${doorOffsetX + dimensions.width * scale}, 0)">`;
    svg += renderSideLight(sideLight, 'right', dimensions.height, scale, color.hex);
    svg += `</g>`;
  }

  svg += `</g></g></svg>`;
  return svg;
}

function generateSVGDefs(baseColor: string): string {
  const darker = darkenColor(baseColor, 20);
  const lighter = lightenColor(baseColor, 15);
  const highlight = lightenColor(baseColor, 30);
  
  return `<defs>
    <!-- Soft drop shadow -->
    <filter id="doorShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
      <feOffset dx="0" dy="4" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    
    <!-- Panel depth shadow -->
    <filter id="panelDepth" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="2" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    
    <!-- Inner shadow for recessed panels -->
    <filter id="innerShadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="1"/>
      <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1"/>
      <feColorMatrix values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.4 0"/>
    </filter>
    
    <!-- Wood grain texture pattern -->
    <pattern id="woodGrain" x="0" y="0" width="100" height="200" patternUnits="userSpaceOnUse">
      <rect width="100" height="200" fill="${baseColor}"/>
      <path d="M0,20 Q25,18 50,20 T100,20" stroke="${darker}" stroke-width="0.5" opacity="0.3" fill="none"/>
      <path d="M0,45 Q25,43 50,45 T100,45" stroke="${darker}" stroke-width="0.5" opacity="0.25" fill="none"/>
      <path d="M0,80 Q25,78 50,80 T100,80" stroke="${darker}" stroke-width="0.5" opacity="0.2" fill="none"/>
      <path d="M0,120 Q25,118 50,120 T100,120" stroke="${darker}" stroke-width="0.5" opacity="0.3" fill="none"/>
      <path d="M0,160 Q25,158 50,160 T100,160" stroke="${darker}" stroke-width="0.5" opacity="0.25" fill="none"/>
    </pattern>
    
    <!-- Frame gradient (top-lit effect) -->
    <linearGradient id="frameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${highlight}"/>
      <stop offset="50%" stop-color="${baseColor}"/>
      <stop offset="100%" stop-color="${darker}"/>
    </linearGradient>
    
    <!-- Panel raised effect gradient -->
    <linearGradient id="panelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${lighter}"/>
      <stop offset="50%" stop-color="${baseColor}"/>
      <stop offset="100%" stop-color="${darker}"/>
    </linearGradient>
    
    <!-- Glass effect -->
    <linearGradient id="glassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e3f2fd" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#bbdefb" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#90caf9" stop-opacity="0.5"/>
    </linearGradient>
    
    <!-- Brass handle gradient -->
    <linearGradient id="brassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f4e4c1"/>
      <stop offset="50%" stop-color="#d4a574"/>
      <stop offset="100%" stop-color="#b8935f"/>
    </linearGradient>
  </defs>`;
}

function renderRealisticDoor(config: DoorConfiguration, scale: number): string {
  const { dimensions, style, color, panelConfig, selectedGlass } = config;
  const elements = DOOR_ELEMENTS;
  
  const doorWidth = dimensions.width * scale;
  const doorHeight = dimensions.height * scale;
  const stileWidth = elements.stileWidth * scale;
  const topRailHeight = elements.topRailHeight * scale;
  const bottomRailHeight = elements.bottomRailHeight * scale;
  const middleRailHeight = elements.middleRailHeight * scale;

  let svg = '';

  // Outer frame shadow
  svg += `<rect x="-2" y="-2" width="${doorWidth + 4}" height="${doorHeight + 4}" 
    fill="rgba(0,0,0,0.2)" rx="3" filter="url(#doorShadow)"/>`;

  // Main door background with wood grain
  svg += `<rect x="0" y="0" width="${doorWidth}" height="${doorHeight}" 
    fill="url(#woodGrain)" stroke="${darkenColor(color.hex, 30)}" stroke-width="3" rx="2"/>`;

  // Frame members with gradient
  // Left stile
  svg += `<rect x="0" y="0" width="${stileWidth}" height="${doorHeight}" 
    fill="url(#frameGradient)" opacity="0.95"/>`;
  svg += `<line x1="${stileWidth}" y1="0" x2="${stileWidth}" y2="${doorHeight}" 
    stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;
  
  // Right stile
  svg += `<rect x="${doorWidth - stileWidth}" y="0" width="${stileWidth}" height="${doorHeight}" 
    fill="url(#frameGradient)" opacity="0.95"/>`;
  svg += `<line x1="${doorWidth - stileWidth}" y1="0" x2="${doorWidth - stileWidth}" y2="${doorHeight}" 
    stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

  // Top rail
  svg += `<rect x="0" y="0" width="${doorWidth}" height="${topRailHeight}" 
    fill="url(#frameGradient)" opacity="0.95"/>`;
  svg += `<line x1="0" y1="${topRailHeight}" x2="${doorWidth}" y2="${topRailHeight}" 
    stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

  // Bottom rail
  svg += `<rect x="0" y="${doorHeight - bottomRailHeight}" width="${doorWidth}" height="${bottomRailHeight}" 
    fill="url(#frameGradient)" opacity="0.95"/>`;
  svg += `<line x1="0" y1="${doorHeight - bottomRailHeight}" x2="${doorWidth}" y2="${doorHeight - bottomRailHeight}" 
    stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

  // Render panels based on door style
  svg += renderRealisticPanels(style, config, scale, elements);

  // Door furniture (handle, knocker, etc.)
  svg += renderDoorFurniture(config, scale);

  return svg;
}

function renderRealisticPanels(
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
  const muntinWidth = elements.muntinWidth * scale;

  const innerWidth = doorWidth - (stileWidth * 2);
  const innerHeight = doorHeight - topRailHeight - bottomRailHeight;

  if (style.panelCount === 4) {
    // Four panel Victorian style
    const midRailY = topRailHeight + (innerHeight / 2) - (middleRailHeight / 2);
    
    // Middle rail
    svg += `<rect x="${stileWidth}" y="${midRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="url(#frameGradient)" opacity="0.95"/>`;
    svg += `<line x1="${stileWidth}" y1="${midRailY}" x2="${doorWidth - stileWidth}" y2="${midRailY}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;
    svg += `<line x1="${stileWidth}" y1="${midRailY + middleRailHeight}" x2="${doorWidth - stileWidth}" y2="${midRailY + middleRailHeight}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

    // Vertical muntin
    const muntinX = doorWidth / 2 - muntinWidth / 2;
    svg += `<rect x="${muntinX}" y="${topRailHeight}" width="${muntinWidth}" height="${innerHeight}" 
      fill="url(#frameGradient)" opacity="0.95"/>`;
    svg += `<line x1="${muntinX}" y1="${topRailHeight}" x2="${muntinX}" y2="${doorHeight - bottomRailHeight}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;
    svg += `<line x1="${muntinX + muntinWidth}" y1="${topRailHeight}" x2="${muntinX + muntinWidth}" y2="${doorHeight - bottomRailHeight}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

    const panelWidth = (innerWidth - muntinWidth) / 2;
    const panelHeight = (innerHeight - middleRailHeight) / 2;
    const margin = 8;

    // Top panels
    svg += renderRaisedPanel(
      stileWidth + margin,
      topRailHeight + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInTop,
      selectedGlass,
      color.hex
    );
    svg += renderRaisedPanel(
      stileWidth + panelWidth + muntinWidth + margin,
      topRailHeight + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInTop,
      selectedGlass,
      color.hex
    );

    // Bottom panels
    const bottomY = midRailY + middleRailHeight;
    svg += renderRaisedPanel(
      stileWidth + margin,
      bottomY + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInBottom,
      selectedGlass,
      color.hex
    );
    svg += renderRaisedPanel(
      stileWidth + panelWidth + muntinWidth + margin,
      bottomY + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInBottom,
      selectedGlass,
      color.hex
    );

  } else if (style.panelCount === 6) {
    // Six panel Georgian style
    const upperRailY = topRailHeight + (innerHeight / 3) - (middleRailHeight / 2);
    const lowerRailY = topRailHeight + (innerHeight * 2 / 3) - (middleRailHeight / 2);

    // Horizontal rails
    [upperRailY, lowerRailY].forEach(y => {
      svg += `<rect x="${stileWidth}" y="${y}" width="${innerWidth}" height="${middleRailHeight}" 
        fill="url(#frameGradient)" opacity="0.95"/>`;
      svg += `<line x1="${stileWidth}" y1="${y}" x2="${doorWidth - stileWidth}" y2="${y}" 
        stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;
      svg += `<line x1="${stileWidth}" y1="${y + middleRailHeight}" x2="${doorWidth - stileWidth}" y2="${y + middleRailHeight}" 
        stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;
    });

    // Vertical muntins
    const colWidth = innerWidth / 2;
    const muntinX = stileWidth + colWidth - muntinWidth / 2;
    svg += `<rect x="${muntinX}" y="${topRailHeight}" width="${muntinWidth}" height="${innerHeight}" 
      fill="url(#frameGradient)" opacity="0.95"/>`;
    svg += `<line x1="${muntinX}" y1="${topRailHeight}" x2="${muntinX}" y2="${doorHeight - bottomRailHeight}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

    const panelWidth = colWidth - muntinWidth / 2;
    const panelHeight = (innerHeight - middleRailHeight * 2) / 3;
    const margin = 8;

    // Render all 6 panels
    for (let row = 0; row < 3; row++) {
      const y = topRailHeight + row * (panelHeight + middleRailHeight) + margin;
      const hasGlass = (row === 0 && panelConfig.glassInTop) || (row === 2 && panelConfig.glassInBottom);
      
      for (let col = 0; col < 2; col++) {
        const x = stileWidth + col * colWidth + (col === 0 ? margin : muntinWidth / 2 + margin);
        svg += renderRaisedPanel(x, y, panelWidth - margin * 2, panelHeight - margin * 2, hasGlass, selectedGlass, color.hex);
      }
    }

  } else if (style.panelCount === 2) {
    // Two panel horizontal
    const midRailY = topRailHeight + (innerHeight / 2) - (middleRailHeight / 2);
    
    svg += `<rect x="${stileWidth}" y="${midRailY}" width="${innerWidth}" height="${middleRailHeight}" 
      fill="url(#frameGradient)" opacity="0.95"/>`;
    svg += `<line x1="${stileWidth}" y1="${midRailY}" x2="${doorWidth - stileWidth}" y2="${midRailY}" 
      stroke="${darkenColor(color.hex, 35)}" stroke-width="2"/>`;

    const panelWidth = innerWidth;
    const panelHeight = (innerHeight - middleRailHeight) / 2;
    const margin = 10;

    svg += renderRaisedPanel(
      stileWidth + margin,
      topRailHeight + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInTop,
      selectedGlass,
      color.hex
    );
    svg += renderRaisedPanel(
      stileWidth + margin,
      midRailY + middleRailHeight + margin,
      panelWidth - margin * 2,
      panelHeight - margin * 2,
      panelConfig.glassInBottom,
      selectedGlass,
      color.hex
    );

  } else if (style.panelCount === 1) {
    // Single panel (full glazed or flat)
    const margin = 10;
    svg += renderRaisedPanel(
      stileWidth + margin,
      topRailHeight + margin,
      innerWidth - margin * 2,
      innerHeight - margin * 2,
      panelConfig.glassInTop || panelConfig.glassInMiddle || panelConfig.glassInBottom,
      selectedGlass,
      color.hex
    );
  }

  return svg;
}

function renderRaisedPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  hasGlass: boolean,
  glassOption: any,
  baseColor: string
): string {
  let svg = '';
  
  if (hasGlass && glassOption.id !== 'none') {
    // Glazed panel
    // Recessed frame for glass
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
      fill="${darkenColor(baseColor, 15)}" stroke="${darkenColor(baseColor, 35)}" stroke-width="2" rx="2"/>`;
    
    // Glass pane with subtle gradient
    const glassInset = 6;
    svg += `<rect x="${x + glassInset}" y="${y + glassInset}" 
      width="${width - glassInset * 2}" height="${height - glassInset * 2}" 
      fill="url(#glassGradient)" stroke="#90caf9" stroke-width="1" rx="1"/>`;
    
    // Glass highlight reflection
    svg += `<rect x="${x + glassInset + 5}" y="${y + glassInset + 5}" 
      width="${width * 0.3}" height="${height * 0.25}" 
      fill="white" opacity="0.3" rx="2"/>`;
    
    // Glass option specific patterns
    if (glassOption.id === 'obscure-reeded') {
      for (let i = 0; i < width / 8; i++) {
        svg += `<line x1="${x + glassInset + i * 8}" y1="${y + glassInset}" 
          x2="${x + glassInset + i * 8}" y2="${y + height - glassInset}" 
          stroke="white" stroke-width="1" opacity="0.3"/>`;
      }
    }
  } else {
    // Solid raised panel with depth
    const bevelSize = 12;
    
    // Panel shadow (recessed look)
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
      fill="url(#panelGradient)" stroke="${darkenColor(baseColor, 35)}" stroke-width="2" rx="3"/>`;
    
    // Panel bevel effect (inner raised section)
    svg += `<path d="M${x + bevelSize},${y + bevelSize} 
      L${x + width - bevelSize},${y + bevelSize} 
      L${x + width - bevelSize},${y + height - bevelSize} 
      L${x + bevelSize},${y + height - bevelSize} Z" 
      fill="url(#woodGrain)" stroke="${lightenColor(baseColor, 20)}" stroke-width="1"/>`;
    
    // Inner highlight for depth
    svg += `<line x1="${x + bevelSize}" y1="${y + bevelSize}" 
      x2="${x + width - bevelSize}" y2="${y + bevelSize}" 
      stroke="${lightenColor(baseColor, 30)}" stroke-width="2" opacity="0.6"/>`;
    svg += `<line x1="${x + bevelSize}" y1="${y + bevelSize}" 
      x2="${x + bevelSize}" y2="${y + height - bevelSize}" 
      stroke="${lightenColor(baseColor, 30)}" stroke-width="2" opacity="0.6"/>`;
    
    // Bottom/right shadow for depth
    svg += `<line x1="${x + bevelSize}" y1="${y + height - bevelSize}" 
      x2="${x + width - bevelSize}" y2="${y + height - bevelSize}" 
      stroke="${darkenColor(baseColor, 40)}" stroke-width="2" opacity="0.5"/>`;
    svg += `<line x1="${x + width - bevelSize}" y1="${y + bevelSize}" 
      x2="${x + width - bevelSize}" y2="${y + height - bevelSize}" 
      stroke="${darkenColor(baseColor, 40)}" stroke-width="2" opacity="0.5"/>`;
  }

  return svg;
}

function renderDoorFurniture(config: DoorConfiguration, scale: number): string {
  let svg = '';
  const doorWidth = config.dimensions.width * scale;
  const doorHeight = config.dimensions.height * scale;

  // Handle position (right side, middle height)
  const handleX = doorWidth - 80;
  const handleY = doorHeight / 2;

  // Modern lever handle with brass finish
  svg += `<g transform="translate(${handleX}, ${handleY})">`;
  
  // Handle backplate
  svg += `<rect x="-8" y="-35" width="16" height="70" rx="3" 
    fill="url(#brassGradient)" stroke="#8B7355" stroke-width="1"/>`;
  svg += `<circle cx="0" cy="-20" r="2" fill="#9d8560"/>`;
  svg += `<circle cx="0" cy="20" r="2" fill="#9d8560"/>`;
  
  // Lever handle
  svg += `<ellipse cx="25" cy="0" rx="35" ry="8" 
    fill="url(#brassGradient)" stroke="#8B7355" stroke-width="1.5"/>`;
  svg += `<ellipse cx="20" cy="-1" rx="30" ry="6" 
    fill="#f4e4c1" opacity="0.3"/>`;
  
  svg += `</g>`;

  // Add letter plate if configured
  if (config.hardware.letterPlate) {
    const plateY = doorHeight * 0.45;
    svg += `<rect x="${doorWidth / 2 - 60}" y="${plateY}" width="120" height="30" rx="2" 
      fill="url(#brassGradient)" stroke="#8B7355" stroke-width="1.5"/>`;
    svg += `<rect x="${doorWidth / 2 - 50}" y="${plateY + 8}" width="100" height="14" 
      fill="#1a1a1a" opacity="0.8" rx="1"/>`;
  }

  // Add door knocker if configured
  if (config.hardware.knocker) {
    const knockerY = doorHeight * 0.35;
    svg += `<g transform="translate(${doorWidth / 2}, ${knockerY})">`;
    // Knocker backplate
    svg += `<circle cx="0" cy="0" r="20" fill="url(#brassGradient)" stroke="#8B7355" stroke-width="1.5"/>`;
    // Knocker ring
    svg += `<circle cx="0" cy="15" r="12" fill="none" stroke="url(#brassGradient)" stroke-width="4"/>`;
    svg += `<circle cx="0" cy="15" r="12" fill="none" stroke="#f4e4c1" stroke-width="1" opacity="0.5"/>`;
    svg += `</g>`;
  }

  return svg;
}

function renderSideLight(
  sideLight: any,
  position: 'left' | 'right',
  doorHeight: number,
  scale: number,
  baseColor: string
): string {
  let svg = '';
  const width = sideLight.width * scale;
  const height = doorHeight * scale;

  svg += `<rect x="0" y="0" width="${width}" height="${height}" 
    fill="url(#woodGrain)" stroke="${darkenColor(baseColor, 30)}" stroke-width="2"/>`;

  if (sideLight.glazed) {
    const margin = 15;
    svg += `<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" 
      fill="url(#glassGradient)" stroke="#90caf9" stroke-width="1"/>`;
    svg += `<rect x="${margin + 5}" y="${margin + 5}" width="${width * 0.4}" height="${height * 0.3}" 
      fill="white" opacity="0.3"/>`;
  }

  return svg;
}

function renderTopLight(
  topLight: any,
  totalWidth: number,
  scale: number,
  baseColor: string
): string {
  let svg = '';
  const width = totalWidth * scale;
  const height = topLight.height * scale;

  if (topLight.style === 'arched') {
    const archRadius = width / 2;
    svg += `<path d="M0,${height} L0,${archRadius} A${archRadius},${archRadius} 0 0,1 ${width},${archRadius} L${width},${height} Z" 
      fill="url(#woodGrain)" stroke="${darkenColor(baseColor, 30)}" stroke-width="2"/>`;
  } else {
    svg += `<rect x="0" y="0" width="${width}" height="${height}" 
      fill="url(#woodGrain)" stroke="${darkenColor(baseColor, 30)}" stroke-width="2"/>`;
  }

  if (topLight.glazed) {
    const margin = 15;
    if (topLight.style === 'arched') {
      const archRadius = width / 2 - margin;
      svg += `<path d="M${margin},${height - margin} L${margin},${archRadius + margin} 
        A${archRadius},${archRadius} 0 0,1 ${width - margin},${archRadius + margin} 
        L${width - margin},${height - margin} Z" 
        fill="url(#glassGradient)" stroke="#90caf9" stroke-width="1"/>`;
    } else {
      svg += `<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" 
        fill="url(#glassGradient)" stroke="#90caf9" stroke-width="1"/>`;
    }
  }

  return svg;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min((num >> 16) + amt, 255);
  const G = Math.min(((num >> 8) & 0x00FF) + amt, 255);
  const B = Math.min((num & 0x0000FF) + amt, 255);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
