/**
 * Door Presets from Elevation Options
 * Pre-configured door designs with specific dimensions from DXF
 */

export interface DoorPreset {
  id: string;
  name: string;
  description: string;
  style: string; // references DOOR_STYLES id
  dimensions: {
    width: number;  // mm
    height: number; // mm
  };
  cutOutSize: number;   // mm - opening dimension
  beadSize: number;     // mm - glazing bead
  glassSize: number;    // mm - glass panel
  category: 'large' | 'medium' | 'small';
}

/**
 * Door elevation options from ELEVATION OPTIONS 2023.dxf
 * Organized by size category with corresponding measurements
 */
export const DOOR_PRESETS: DoorPreset[] = [
  // LARGE DOORS
  {
    id: 'large-1659',
    name: 'Large Door 1659',
    description: 'Large elevation door with 1659mm cut out, 1687mm bead, 1625mm glass',
    style: 'four-panel-victorian',
    dimensions: { width: 1200, height: 2100 },
    cutOutSize: 1659,
    beadSize: 1687,
    glassSize: 1625,
    category: 'large',
  },
  {
    id: 'large-1253',
    name: 'Large Door 1253',
    description: 'Large elevation door with 1253mm cut out, 1281mm bead, 1219mm glass',
    style: 'six-panel-georgian',
    dimensions: { width: 1050, height: 2100 },
    cutOutSize: 1253,
    beadSize: 1281,
    glassSize: 1219,
    category: 'large',
  },

  // MEDIUM DOORS - 946mm series
  {
    id: 'medium-946',
    name: 'Medium Door 946',
    description: 'Medium elevation door with 946mm cut out, 974mm bead, 912mm glass',
    style: 'four-panel-victorian',
    dimensions: { width: 900, height: 2000 },
    cutOutSize: 946,
    beadSize: 974,
    glassSize: 912,
    category: 'medium',
  },

  // MEDIUM DOORS - 639mm series
  {
    id: 'medium-639',
    name: 'Medium Door 639',
    description: 'Medium elevation door with 639mm cut out, 667mm bead, 605mm glass',
    style: 'four-panel-victorian',
    dimensions: { width: 750, height: 1900 },
    cutOutSize: 639,
    beadSize: 667,
    glassSize: 605,
    category: 'medium',
  },

  // MEDIUM DOORS - 618mm series
  {
    id: 'medium-618',
    name: 'Medium Door 618',
    description: 'Medium elevation door with 618mm cut out, 646mm bead, 584mm glass',
    style: 'six-panel-georgian',
    dimensions: { width: 750, height: 1900 },
    cutOutSize: 618,
    beadSize: 646,
    glassSize: 584,
    category: 'medium',
  },

  // SMALL DOORS - 501mm series
  {
    id: 'small-501',
    name: 'Small Door 501',
    description: 'Small elevation door with 501mm cut out, 529mm bead, 467mm glass',
    style: 'four-panel-victorian',
    dimensions: { width: 650, height: 1800 },
    cutOutSize: 501,
    beadSize: 529,
    glassSize: 467,
    category: 'small',
  },

  // SMALL DOORS - 288mm series
  {
    id: 'small-288',
    name: 'Small Door 288',
    description: 'Small elevation door with 288mm cut out, 316mm bead, 254mm glass',
    style: 'franklin-glazed',
    dimensions: { width: 600, height: 1700 },
    cutOutSize: 288,
    beadSize: 316,
    glassSize: 254,
    category: 'small',
  },

  // SMALL DOORS - 237mm series
  {
    id: 'small-237',
    name: 'Small Door 237',
    description: 'Small elevation door with 237mm cut out, 265mm bead, 203mm glass',
    style: 'franklin-glazed',
    dimensions: { width: 600, height: 1700 },
    cutOutSize: 237,
    beadSize: 265,
    glassSize: 203,
    category: 'small',
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): DoorPreset | undefined {
  return DOOR_PRESETS.find(preset => preset.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(
  category: 'large' | 'medium' | 'small'
): DoorPreset[] {
  return DOOR_PRESETS.filter(preset => preset.category === category);
}

/**
 * Get all available preset names for UI
 */
export function getPresetNames(): Array<{ id: string; name: string }> {
  return DOOR_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
  }));
}

/**
 * Get presets grouped by category for organized display
 */
export function getPresetsGroupedByCategory() {
  return {
    large: getPresetsByCategory('large'),
    medium: getPresetsByCategory('medium'),
    small: getPresetsByCategory('small'),
  };
}
