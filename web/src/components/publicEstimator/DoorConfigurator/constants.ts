/**
 * Door Configurator Constants
 * Predefined styles, colors, and pricing data
 */

import { DoorStyle, DoorColor, GlassOption, DoorPricingMatrix, ParametricDoorElements } from './types';

// Parametric door construction constants
export const DOOR_ELEMENTS: ParametricDoorElements = {
  stileWidth: 95,
  topRailHeight: 190,
  bottomRailHeight: 240,
  middleRailHeight: 95,
  muntinWidth: 60,
  minPanelHeight: 150,
  minPanelWidth: 150,
};

// Glass options
export const GLASS_OPTIONS: GlassOption[] = [
  {
    id: 'none',
    name: 'No Glass',
    type: 'none',
    priceMultiplier: 1.0,
  },
  {
    id: 'clear',
    name: 'Clear Glass',
    type: 'clear',
    priceMultiplier: 1.1,
  },
  {
    id: 'obscure-reeded',
    name: 'Obscure Reeded',
    type: 'obscure',
    priceMultiplier: 1.15,
  },
  {
    id: 'obscure-frosted',
    name: 'Obscure Frosted',
    type: 'obscure',
    priceMultiplier: 1.15,
  },
  {
    id: 'leaded-diamond',
    name: 'Leaded Diamond',
    type: 'leaded',
    priceMultiplier: 1.4,
  },
  {
    id: 'leaded-traditional',
    name: 'Leaded Traditional',
    type: 'leaded',
    priceMultiplier: 1.5,
  },
  {
    id: 'stained-custom',
    name: 'Stained Glass (Custom)',
    type: 'stained',
    priceMultiplier: 2.0,
  },
];

// Door styles
export const DOOR_STYLES: DoorStyle[] = [
  {
    id: 'joplin-board',
    name: 'Joplin',
    description: 'Solid vertical tongue-and-groove boards - cottage style',
    category: 'cottage',
    panelCount: 0,
    panelLayout: 'vertical',
    glassOptions: GLASS_OPTIONS.filter(g => g.id === 'none'),
    baseMultiplier: 1.0,
  },
  {
    id: 'franklin-glazed',
    name: 'Franklin',
    description: 'Vertical boards with central glazed panel',
    category: 'cottage',
    panelCount: 1,
    panelLayout: 'vertical',
    glassOptions: GLASS_OPTIONS,
    baseMultiplier: 1.15,
  },
  {
    id: 'four-panel-victorian',
    name: 'Four Panel Victorian',
    description: 'Classic Victorian style with 4 raised panels',
    category: 'traditional',
    panelCount: 4,
    panelLayout: 'grid',
    glassOptions: GLASS_OPTIONS.filter(g => ['none', 'obscure', 'leaded'].includes(g.type)),
    baseMultiplier: 1.0,
  },
  {
    id: 'six-panel-georgian',
    name: 'Six Panel Georgian',
    description: 'Traditional Georgian style with 6 panels',
    category: 'traditional',
    panelCount: 6,
    panelLayout: 'grid',
    glassOptions: GLASS_OPTIONS.filter(g => g.id === 'none'),
    baseMultiplier: 1.1,
  },
  {
    id: 'cottage-stable',
    name: 'Cottage Stable Door',
    description: 'Split stable door with top opening section',
    category: 'cottage',
    panelCount: 2,
    panelLayout: 'horizontal',
    glassOptions: GLASS_OPTIONS,
    baseMultiplier: 1.3,
  },
  {
    id: 'glazed-half',
    name: 'Half Glazed',
    description: 'Modern style with glass in top half',
    category: 'contemporary',
    panelCount: 2,
    panelLayout: 'horizontal',
    glassOptions: GLASS_OPTIONS,
    baseMultiplier: 1.15,
  },
  {
    id: 'glazed-full',
    name: 'Full Glazed',
    description: 'Contemporary full-height glazed door',
    category: 'contemporary',
    panelCount: 1,
    panelLayout: 'vertical',
    glassOptions: GLASS_OPTIONS.filter(g => g.id !== 'none'),
    baseMultiplier: 1.25,
  },
  {
    id: 'two-panel-flat',
    name: 'Two Panel Contemporary',
    description: 'Modern flat panel design',
    category: 'contemporary',
    panelCount: 2,
    panelLayout: 'horizontal',
    glassOptions: GLASS_OPTIONS.filter(g => ['none', 'clear', 'obscure'].includes(g.type)),
    baseMultiplier: 1.05,
  },
];

// Color options
export const DOOR_COLORS: DoorColor[] = [
  {
    id: 'natural-oak',
    name: 'Natural Oak',
    hex: '#D4A574',
    finish: 'natural',
    priceMultiplier: 1.0,
  },
  {
    id: 'dark-oak',
    name: 'Dark Oak Stain',
    hex: '#6B4423',
    finish: 'stained',
    priceMultiplier: 1.05,
  },
  {
    id: 'walnut',
    name: 'Walnut Stain',
    hex: '#5C4033',
    finish: 'stained',
    priceMultiplier: 1.05,
  },
  {
    id: 'white-painted',
    name: 'White Painted',
    hex: '#F8F8F8',
    finish: 'painted',
    priceMultiplier: 1.1,
  },
  {
    id: 'cream-painted',
    name: 'Cream Painted',
    hex: '#F4F0E6',
    finish: 'painted',
    priceMultiplier: 1.1,
  },
  {
    id: 'grey-painted',
    name: 'Grey Painted',
    hex: '#8B8D8E',
    finish: 'painted',
    priceMultiplier: 1.1,
  },
  {
    id: 'blue-painted',
    name: 'Blue Painted',
    hex: '#2C5F7C',
    finish: 'painted',
    priceMultiplier: 1.15,
  },
  {
    id: 'green-painted',
    name: 'Heritage Green',
    hex: '#2F4538',
    finish: 'painted',
    priceMultiplier: 1.15,
  },
  {
    id: 'black-painted',
    name: 'Black Painted',
    hex: '#1A1A1A',
    finish: 'painted',
    priceMultiplier: 1.1,
  },
];

// Standard door sizes (width x height in mm)
export const STANDARD_SIZES = [
  { width: 762, height: 1981, label: '2\'6" x 6\'6"' },
  { width: 838, height: 1981, label: '2\'9" x 6\'6"' },
  { width: 914, height: 2032, label: '3\'0" x 6\'8"' },
  { width: 838, height: 2134, label: '2\'9" x 7\'0"' },
  { width: 914, height: 2134, label: '3\'0" x 7\'0"' },
];

// Pricing matrix
export const PRICING_MATRIX: DoorPricingMatrix = {
  basePricePerSqM: 1200, // £1200 per square meter
  
  sizeMultipliers: {
    standard: 1.0,    // Standard residential sizes
    large: 1.15,      // Larger than standard
    extraLarge: 1.3,  // Extra large/commercial
  },
  
  sideLight: {
    basePricePerUnit: 450,
    widthMultiplier: 2.5, // £2.50 per mm width
  },
  
  topLight: {
    basePrice: 350,
    styleMultipliers: {
      rectangular: 1.0,
      arched: 1.3,
      curved: 1.5,
    },
  },
  
  hardware: {
    handleUpgrade: 150,
    letterPlate: 85,
    knocker: 95,
  },
};
