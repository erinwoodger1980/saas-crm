/**
 * SVG Profile Generator
 * Creates estimated SVG profile geometry for joinery components
 * Based on component type and dimensions
 */

interface SVGProfileDefinition {
  svg: string;
  name: string;
  widthMm: number;
  depthMm: number;
  estimatedFrom?: string;
}

/**
 * Generate estimated SVG profile for a component type
 */
export function generateEstimatedProfile(
  componentType: string,
  widthMm: number,
  depthMm: number
): SVGProfileDefinition {
  const svg = generateProfileSVG(componentType, widthMm, depthMm);
  
  return {
    svg,
    name: `${componentType} profile (${widthMm}×${depthMm}mm)`,
    widthMm,
    depthMm,
    estimatedFrom: componentType,
  };
}

/**
 * Generate SVG path based on component type
 */
function generateProfileSVG(type: string, width: number, depth: number): string {
  const viewBox = `0 0 ${width} ${depth}`;
  
  switch (type.toLowerCase()) {
    case 'stile':
      return generateStileProfile(width, depth, viewBox);
    case 'rail':
      return generateRailProfile(width, depth, viewBox);
    case 'mullion':
    case 'transom':
      return generateDividerProfile(width, depth, viewBox);
    case 'glazingbar':
    case 'glazing_bar':
      return generateGlazingBarProfile(width, depth, viewBox);
    case 'panel':
      return generatePanelProfile(width, depth, viewBox);
    default:
      return generateSimpleProfile(width, depth, viewBox);
  }
}

/**
 * Stile profile - robust outer vertical frame
 */
function generateStileProfile(width: number, depth: number, viewBox: string): string {
  const chamfer = Math.min(width * 0.15, depth * 0.15, 8);
  const rebate = Math.min(width * 0.3, 12);
  const rebateDepth = Math.min(depth * 0.4, 15);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="M 0 0 
    L ${width - chamfer} 0 
    L ${width} ${chamfer} 
    L ${width} ${depth - rebateDepth}
    L ${width - rebate} ${depth - rebateDepth}
    L ${width - rebate} ${depth}
    L 0 ${depth} Z" 
    fill="#8B4513" stroke="#654321" stroke-width="0.5"/>
</svg>`;
}

/**
 * Rail profile - horizontal frame member
 */
function generateRailProfile(width: number, depth: number, viewBox: string): string {
  const chamfer = Math.min(width * 0.1, depth * 0.15, 8);
  const rebate = Math.min(depth * 0.35, 12);
  const rebateWidth = Math.min(width * 0.25, 15);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="M 0 ${chamfer}
    L ${chamfer} 0
    L ${width - rebateWidth} 0
    L ${width - rebateWidth} ${depth - rebate}
    L ${width} ${depth - rebate}
    L ${width} ${depth}
    L 0 ${depth} Z"
    fill="#8B4513" stroke="#654321" stroke-width="0.5"/>
</svg>`;
}

/**
 * Mullion/Transom profile - intermediate divider
 */
function generateDividerProfile(width: number, depth: number, viewBox: string): string {
  const chamfer = Math.min(width * 0.12, depth * 0.12, 5);
  const centerGroove = Math.min(width * 0.2, 8);
  const grooveDepth = Math.min(depth * 0.3, 10);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="M 0 ${chamfer}
    L ${chamfer} 0
    L ${width / 2 - centerGroove / 2} 0
    L ${width / 2 - centerGroove / 2} ${grooveDepth}
    L ${width / 2 + centerGroove / 2} ${grooveDepth}
    L ${width / 2 + centerGroove / 2} 0
    L ${width - chamfer} 0
    L ${width} ${chamfer}
    L ${width} ${depth - chamfer}
    L ${width - chamfer} ${depth}
    L ${chamfer} ${depth}
    L 0 ${depth - chamfer} Z"
    fill="#8B4513" stroke="#654321" stroke-width="0.5"/>
</svg>`;
}

/**
 * Glazing bar profile - narrow decorative divider
 */
function generateGlazingBarProfile(width: number, depth: number, viewBox: string): string {
  const bevel = Math.min(width * 0.3, depth * 0.3, 4);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="M ${width / 2} 0
    L ${width} ${bevel}
    L ${width} ${depth - bevel}
    L ${width / 2} ${depth}
    L 0 ${depth - bevel}
    L 0 ${bevel} Z"
    fill="#8B4513" stroke="#654321" stroke-width="0.3"/>
</svg>`;
}

/**
 * Panel profile - flat or slightly raised
 */
function generatePanelProfile(width: number, depth: number, viewBox: string): string {
  const raise = Math.min(depth * 0.2, 3);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="M 0 ${raise}
    L ${raise} 0
    L ${width - raise} 0
    L ${width} ${raise}
    L ${width} ${depth}
    L 0 ${depth} Z"
    fill="#A0826D" stroke="#654321" stroke-width="0.5"/>
</svg>`;
}

/**
 * Simple rectangular profile - fallback
 */
function generateSimpleProfile(width: number, depth: number, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <rect x="0" y="0" width="${width}" height="${depth}" 
    fill="#8B4513" stroke="#654321" stroke-width="0.5"/>
</svg>`;
}
