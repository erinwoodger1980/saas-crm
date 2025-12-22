/**
 * AI Profile Estimation Engine
 * Generates reasonable initial SVG profiles for joinery components
 * These serve as placeholders until real profiles are uploaded
 */

import { SVGProfileDefinition, generateEstimatedProfile } from './svg-profile';

export interface ComponentProfile {
  componentId: string;
  componentType: 'stile' | 'rail' | 'mullion' | 'transom' | 'glazing_bar' | 'panel';
  profileDefinition: SVGProfileDefinition;
  position?: {
    offsetFromTopMm?: number;
    offsetFromLeftMm?: number;
  };
}

/**
 * Estimate profiles for a complete door or window assembly
 * Returns map of componentId → SVGProfileDefinition
 */
export function estimateProfilesForAssembly(
  componentList: Array<{
    id: string;
    type: 'stile' | 'rail' | 'mullion' | 'transom' | 'glazing_bar' | 'panel';
    widthMm: number;
    depthMm: number;
  }>
): Map<string, SVGProfileDefinition> {
  const profileMap = new Map<string, SVGProfileDefinition>();

  componentList.forEach((component) => {
    // Generate profile specific to component type
    const profile = generateTypeSpecificProfile(
      component.type,
      component.widthMm,
      component.depthMm
    );

    profileMap.set(component.id, profile);
  });

  return profileMap;
}

/**
 * Generate type-specific profile with sensible defaults
 */
function generateTypeSpecificProfile(
  componentType: string,
  widthMm: number,
  depthMm: number
): SVGProfileDefinition {
  const baseProfile = generateEstimatedProfile(componentType, widthMm, depthMm);

  // Adjust confidence and notes based on component type
  const typeConfig = getTypeSpecificConfig(componentType);

  return {
    ...baseProfile,
    name: `${typeConfig.label} profile (${widthMm}×${depthMm}mm)`,
    metadata: {
      ...baseProfile.metadata,
      confidence: typeConfig.confidence,
      notes: typeConfig.notes,
    },
  };
}

/**
 * Get type-specific configuration for profile generation
 */
function getTypeSpecificConfig(componentType: string): {
  label: string;
  confidence: number;
  notes: string;
} {
  const configs: Record<string, any> = {
    stile: {
      label: 'Stile (vertical frame member)',
      confidence: 0.7,
      notes: 'Vertical frame component; typically wider cross-section for structural strength',
    },
    rail: {
      label: 'Rail (horizontal frame member)',
      confidence: 0.7,
      notes: 'Horizontal frame component; typical height 50–80mm',
    },
    mullion: {
      label: 'Mullion (vertical divider)',
      confidence: 0.6,
      notes: 'Vertical component between panes; narrower than stiles',
    },
    transom: {
      label: 'Transom (horizontal divider)',
      confidence: 0.6,
      notes: 'Horizontal component between panes; narrower than rails',
    },
    glazing_bar: {
      label: 'Glazing Bar (narrow divider)',
      confidence: 0.5,
      notes: 'Very narrow component (10–20mm); typically bevelled or decorative',
    },
    panel: {
      label: 'Panel (fill component)',
      confidence: 0.4,
      notes: 'Flat panel or glass; placeholder until actual material specified',
    },
  };

  return configs[componentType] || configs.panel;
}

/**
 * Generate AI component list with profiles
 * This is called after OpenAI generates a basic component tree
 * Returns enhanced list with profile definitions
 */
export function enhanceComponentListWithProfiles(
  componentList: Array<{
    id: string;
    type: string;
    widthMm: number;
    depthMm: number;
    lengthMm?: number;
  }>
): ComponentProfile[] {
  const profileMap = estimateProfilesForAssembly(componentList as any);

  return componentList.map((component) => ({
    componentId: component.id,
    componentType: component.type as any,
    profileDefinition: profileMap.get(component.id)!,
    position: {
      offsetFromTopMm: component.lengthMm ? component.lengthMm * 0.1 : undefined,
    },
  }));
}

/**
 * Validate profile before use
 * Ensures SVG is parseable and has correct structure
 */
export function validateProfile(profile: SVGProfileDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!profile.svgText || profile.svgText.trim().length === 0) {
    errors.push('SVG text is empty');
  }

  if (!profile.svgText.includes('<svg') || !profile.svgText.includes('</svg>')) {
    errors.push('SVG text does not contain valid SVG tags');
  }

  if (!profile.svgText.includes('<path') && !profile.svgText.includes('<rect')) {
    errors.push('SVG does not contain path or rect elements');
  }

  if (profile.extrudeDepthMm <= 0) {
    errors.push('Extrude depth must be positive');
  }

  if (profile.scale <= 0) {
    errors.push('Scale factor must be positive');
  }

  if (profile.viewBoxWidth <= 0 || profile.viewBoxHeight <= 0) {
    errors.push('ViewBox dimensions must be positive');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge multiple profiles into a composite
 * Useful for complex shapes or laminated timber
 */
export function mergeProfiles(
  profiles: SVGProfileDefinition[],
  newId: string,
  newName: string
): SVGProfileDefinition {
  // Combine all SVG paths into single viewBox
  const combinedSvg = `
    <svg viewBox="0 0 ${profiles[0]?.viewBoxWidth || 100} ${profiles[0]?.viewBoxHeight || 100}" xmlns="http://www.w3.org/2000/svg">
      ${profiles.map((p) => extractPathsFromSvg(p.svgText)).join('\n')}
    </svg>
  `;

  return {
    id: newId,
    name: newName,
    svgText: combinedSvg,
    viewBoxWidth: profiles[0]?.viewBoxWidth || 100,
    viewBoxHeight: profiles[0]?.viewBoxHeight || 100,
    extrudeDepthMm: profiles.reduce((sum, p) => sum + p.extrudeDepthMm, 0) / profiles.length,
    scale: profiles[0]?.scale || 1.0,
    metadata: {
      source: 'estimated',
      confidence: Math.min(...profiles.map((p) => p.metadata.confidence || 0.5)),
      notes: `Composite profile merged from ${profiles.length} components`,
    },
  };
}

/**
 * Extract paths from SVG string
 */
function extractPathsFromSvg(svgText: string): string {
  const pathMatch = svgText.match(/<path[^>]*\/?>.*?<\/path>/gs);
  const rectMatch = svgText.match(/<rect[^>]*\/>/g);

  const paths = pathMatch ? pathMatch.join('\n') : '';
  const rects = rectMatch ? rectMatch.join('\n') : '';

  return paths + '\n' + rects;
}
