/**
 * Estimated Profile Generator
 * Creates simple estimated SVG profiles for components when real SVG/DXF not available
 * Used as placeholder until user uploads real profile
 * 
 * Presets:
 * - Rectangle: flat board profile
 * - Bead: beveled edge profile
 * - Bolection: raised trim profile
 * - T-section: T-shaped section (glass beads)
 */

import { ComponentProfile, ComponentRole } from '@/types/scene-config';

/**
 * Generate estimated profile for a component role
 */
export function generateEstimatedProfile(
  role: ComponentRole,
  widthMm: number,
  depthMm: number,
  profilePreset: 'rectangle' | 'bead' | 'bolection' | 't-section' = 'rectangle'
): ComponentProfile {
  const svgText = generateProfileSvg(profilePreset, widthMm, depthMm);

  return {
    sourceType: 'estimated',
    svgText,
    depthMm,
    scale: 1.0, // 1:1 scale for SVG in mm
  };
}

/**
 * Generate SVG text for profile preset
 * All SVG coordinates are in millimeters (viewBox uses mm scale)
 */
function generateProfileSvg(preset: string, widthMm: number, depthMm: number): string {
  switch (preset) {
    case 'bead':
      return createBeadProfileSvg(widthMm, depthMm);

    case 'bolection':
      return createBolectionProfileSvg(widthMm, depthMm);

    case 't-section':
      return createTSectionProfileSvg(widthMm, depthMm);

    case 'rectangle':
    default:
      return createRectangleProfileSvg(widthMm, depthMm);
  }
}

/**
 * Flat rectangular profile (default for stiles, rails, panels)
 */
function createRectangleProfileSvg(widthMm: number, depthMm: number): string {
  const w = widthMm / 2; // Half width from center
  const d = depthMm;

  return `<svg viewBox="${-w} 0 ${widthMm} ${d}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${-w}" y="0" width="${widthMm}" height="${d}" fill="black"/>
  </svg>`;
}

/**
 * Beveled edge profile (rounded bead, common in windows)
 */
function createBeadProfileSvg(widthMm: number, depthMm: number): string {
  const w = widthMm / 2;
  const d = depthMm;
  const radius = Math.min(widthMm * 0.15, 8); // Max 8mm radius

  // Create path with rounded corners
  return `<svg viewBox="${-w} 0 ${widthMm} ${d}" xmlns="http://www.w3.org/2000/svg">
    <path d="M ${-w} 0 L ${-w + radius} 0 Q ${-w + radius * 1.5} 0 ${-w + radius * 1.5} ${radius} L ${w - radius * 1.5} ${radius} Q ${w - radius * 1.5} 0 ${w - radius} 0 L ${w} 0 L ${w} ${d} L ${-w} ${d} Z" fill="black"/>
  </svg>`;
}

/**
 * Raised trim profile (bolection molding style)
 */
function createBolectionProfileSvg(widthMm: number, depthMm: number): string {
  const w = widthMm / 2;
  const d = depthMm;
  const lip = widthMm * 0.2; // 20% lip
  const raise = depthMm * 0.3; // 30% raise

  return `<svg viewBox="${-w} 0 ${widthMm} ${d}" xmlns="http://www.w3.org/2000/svg">
    <!-- Raised section -->
    <rect x="${-w + lip}" y="0" width="${widthMm - 2 * lip}" height="${raise}" fill="black"/>
    <!-- Main body -->
    <rect x="${-w}" y="${raise}" width="${widthMm}" height="${d - raise}" fill="black"/>
  </svg>`;
}

/**
 * T-section profile (glass bead or mullion)
 */
function createTSectionProfileSvg(widthMm: number, depthMm: number): string {
  const w = widthMm / 2;
  const d = depthMm;
  const stem = widthMm * 0.4;
  const headHeight = depthMm * 0.4;

  return `<svg viewBox="${-w} 0 ${widthMm} ${d}" xmlns="http://www.w3.org/2000/svg">
    <!-- Head -->
    <rect x="${-w}" y="0" width="${widthMm}" height="${headHeight}" fill="black"/>
    <!-- Stem -->
    <rect x="${-stem / 2}" y="${headHeight}" width="${stem}" height="${d - headHeight}" fill="black"/>
  </svg>`;
}

/**
 * Suggest profile preset based on component role
 */
export function suggestProfilePreset(role: string): 'rectangle' | 'bead' | 'bolection' | 't-section' {
  switch (role) {
    case 'stile':
    case 'rail':
      return 'rectangle'; // Simple flat boards

    case 'glass':
      return 't-section'; // Glass bead/mullion

    case 'panel':
      return 'bolection'; // Raised panel effect

    default:
      return 'rectangle';
  }
}

/**
 * Generate multiple estimated profiles for a standard door
 */
export function generateStandardDoorProfiles(): Record<string, ComponentProfile> {
  return {
    stile: generateEstimatedProfile('stile', 45, 45, 'rectangle'),
    rail: generateEstimatedProfile('rail', 45, 45, 'rectangle'),
    glazingBead: generateEstimatedProfile('glass', 20, 35, 't-section'),
    panel: generateEstimatedProfile('panel', 60, 35, 'bolection'),
  };
}
