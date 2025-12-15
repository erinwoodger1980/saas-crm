/**
 * Window Configurator Constants
 * Product catalog and parametric window elements
 */

import type {
  WindowStyle,
  WindowColor,
  GlazingOption,
  WindowPricingMatrix,
  ParametricWindowElements,
} from './types';

// Parametric window elements - these dimensions stay fixed regardless of window size
export const WINDOW_ELEMENTS: ParametricWindowElements = {
  frameWidth: 95,       // External frame width
  sashWidth: 45,        // Moveable sash frame width
  muntinWidth: 25,      // Glazing bar width
  sillDepth: 150,       // Sill projection
  minPaneWidth: 300,    // Minimum viable pane width
  minPaneHeight: 400,   // Minimum viable pane height
};

// Sash Window Styles
export const SASH_WINDOW_STYLES: WindowStyle[] = [
  {
    id: 'sash-two-over-two',
    name: 'Two Over Two',
    type: 'sash',
    description: 'Traditional two panes over two panes',
    panes: { horizontal: 2, vertical: 2, moveable: 'both' },
    priceMultiplier: 1.0,
  },
  {
    id: 'sash-six-over-six',
    name: 'Six Over Six',
    type: 'sash',
    description: 'Georgian style with six panes each sash',
    panes: { horizontal: 3, vertical: 4, moveable: 'both' },
    priceMultiplier: 1.15,
  },
  {
    id: 'sash-one-over-one',
    name: 'One Over One',
    type: 'sash',
    description: 'Modern single pane each sash',
    panes: { horizontal: 1, vertical: 2, moveable: 'both' },
    priceMultiplier: 0.95,
  },
  {
    id: 'sash-victorian',
    name: 'Victorian',
    type: 'sash',
    description: 'One pane over two panes',
    panes: { horizontal: 1, vertical: 2, moveable: 'both' },
    priceMultiplier: 1.05,
  },
];

// Casement Window Styles
export const CASEMENT_WINDOW_STYLES: WindowStyle[] = [
  {
    id: 'casement-side-hung',
    name: 'Side Hung',
    type: 'casement',
    description: 'Opens outward from side hinges',
    panes: { horizontal: 2, vertical: 1, moveable: 'side' },
    priceMultiplier: 1.0,
  },
  {
    id: 'casement-top-hung',
    name: 'Top Hung',
    type: 'casement',
    description: 'Opens outward from top hinges',
    panes: { horizontal: 1, vertical: 1, moveable: 'top' },
    priceMultiplier: 1.05,
  },
  {
    id: 'casement-fixed',
    name: 'Fixed',
    type: 'casement',
    description: 'Non-opening picture window',
    panes: { horizontal: 1, vertical: 1 },
    priceMultiplier: 0.85,
  },
  {
    id: 'casement-combination',
    name: 'Combination',
    type: 'casement',
    description: 'Fixed center with side opening casements',
    panes: { horizontal: 3, vertical: 1, moveable: 'side' },
    priceMultiplier: 1.2,
  },
];

// Alu-Clad Window Styles
export const ALU_CLAD_WINDOW_STYLES: WindowStyle[] = [
  {
    id: 'alu-clad-sash',
    name: 'Alu-Clad Sash',
    type: 'alu-clad',
    description: 'Traditional sash with aluminum exterior cladding',
    panes: { horizontal: 2, vertical: 2, moveable: 'both' },
    priceMultiplier: 1.4,
  },
  {
    id: 'alu-clad-casement',
    name: 'Alu-Clad Casement',
    type: 'alu-clad',
    description: 'Casement window with aluminum exterior cladding',
    panes: { horizontal: 2, vertical: 1, moveable: 'side' },
    priceMultiplier: 1.35,
  },
  {
    id: 'alu-clad-tilt-turn',
    name: 'Tilt & Turn',
    type: 'alu-clad',
    description: 'European style tilt and turn with alu-cladding',
    panes: { horizontal: 1, vertical: 1, moveable: 'all' },
    priceMultiplier: 1.5,
  },
];

export const ALL_WINDOW_STYLES: WindowStyle[] = [
  ...SASH_WINDOW_STYLES,
  ...CASEMENT_WINDOW_STYLES,
  ...ALU_CLAD_WINDOW_STYLES,
];

// Window Colors
export const WINDOW_COLORS: WindowColor[] = [
  {
    id: 'natural-oak',
    name: 'Natural Oak',
    hexColor: '#D4A574',
    finishType: 'natural',
    priceMultiplier: 1.0,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'dark-oak',
    name: 'Dark Oak',
    hexColor: '#6B4423',
    finishType: 'stained',
    priceMultiplier: 1.05,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'walnut',
    name: 'Walnut',
    hexColor: '#5C4033',
    finishType: 'stained',
    priceMultiplier: 1.1,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'white-painted',
    name: 'White',
    hexColor: '#F8F8F8',
    finishType: 'painted',
    priceMultiplier: 1.05,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'cream-painted',
    name: 'Cream',
    hexColor: '#F5F5DC',
    finishType: 'painted',
    priceMultiplier: 1.05,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'grey-painted',
    name: 'Grey',
    hexColor: '#808080',
    finishType: 'painted',
    priceMultiplier: 1.08,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
  {
    id: 'anthracite-grey',
    name: 'Anthracite Grey',
    hexColor: '#293133',
    finishType: 'painted',
    priceMultiplier: 1.15,
    availableForTypes: ['alu-clad'],
  },
  {
    id: 'black-painted',
    name: 'Black',
    hexColor: '#1a1a1a',
    finishType: 'painted',
    priceMultiplier: 1.1,
    availableForTypes: ['sash', 'casement', 'alu-clad'],
  },
];

// Glazing Options
export const GLAZING_OPTIONS: GlazingOption[] = [
  {
    id: 'double-standard',
    name: 'Double Glazed (Standard)',
    description: '4-16-4mm double glazed unit',
    uValue: 1.6,
    priceMultiplier: 1.0,
    features: ['Energy efficient', 'Noise reduction'],
  },
  {
    id: 'double-low-e',
    name: 'Double Glazed (Low-E)',
    description: '4-16-4mm with low-emissivity coating',
    uValue: 1.2,
    priceMultiplier: 1.15,
    features: ['Enhanced energy efficiency', 'UV protection', 'Noise reduction'],
  },
  {
    id: 'double-argon',
    name: 'Double Glazed (Argon)',
    description: '4-16-4mm argon filled with Low-E',
    uValue: 1.1,
    priceMultiplier: 1.25,
    features: ['Superior insulation', 'Argon gas filled', 'Low-E coating'],
  },
  {
    id: 'triple-standard',
    name: 'Triple Glazed',
    description: '4-12-4-12-4mm triple glazed',
    uValue: 0.8,
    priceMultiplier: 1.5,
    features: ['Excellent insulation', 'Maximum noise reduction', 'Condensation resistance'],
  },
  {
    id: 'triple-argon',
    name: 'Triple Glazed (Argon)',
    description: '4-12-4-12-4mm argon filled with Low-E',
    uValue: 0.6,
    priceMultiplier: 1.7,
    features: ['Best thermal performance', 'Passive house standard', 'Maximum comfort'],
  },
  {
    id: 'acoustic',
    name: 'Acoustic Glazing',
    description: 'Specialist noise reduction glazing',
    uValue: 1.4,
    priceMultiplier: 1.8,
    features: ['Superior noise reduction', 'Different pane thicknesses', 'Urban locations'],
  },
];

// Standard Window Sizes (single unit)
export const STANDARD_WINDOW_SIZES = [
  { width: 600, height: 900, label: '600 × 900mm' },
  { width: 630, height: 1050, label: '630 × 1050mm' },
  { width: 915, height: 1200, label: '915 × 1200mm' },
  { width: 1200, height: 1200, label: '1200 × 1200mm' },
  { width: 1200, height: 1500, label: '1200 × 1500mm' },
];

// Pricing Matrix
export const PRICING_MATRIX: WindowPricingMatrix = {
  basePricePerSqM: 800, // Base price per square meter
  
  windowTypeMultipliers: {
    sash: 1.3,      // Sash windows are more expensive due to mechanism
    casement: 1.0,  // Baseline
    'alu-clad': 1.5, // Alu-clad is premium
  },
  
  styleMultipliers: {
    'sash-two-over-two': 1.0,
    'sash-six-over-six': 1.15,
    'sash-one-over-one': 0.95,
    'sash-victorian': 1.05,
    'casement-side-hung': 1.0,
    'casement-top-hung': 1.05,
    'casement-fixed': 0.85,
    'casement-combination': 1.2,
    'alu-clad-sash': 1.4,
    'alu-clad-casement': 1.35,
    'alu-clad-tilt-turn': 1.5,
  },
  
  colorMultipliers: {
    'natural-oak': 1.0,
    'dark-oak': 1.05,
    'walnut': 1.1,
    'white-painted': 1.05,
    'cream-painted': 1.05,
    'grey-painted': 1.08,
    'anthracite-grey': 1.15,
    'black-painted': 1.1,
  },
  
  glazingMultipliers: {
    'double-standard': 1.0,
    'double-low-e': 1.15,
    'double-argon': 1.25,
    'triple-standard': 1.5,
    'triple-argon': 1.7,
    'acoustic': 1.8,
  },
  
  hardwareAddons: {
    securityLocks: 45,       // Per window
    premiumLocks: 95,        // Per window
    contemporaryHandles: 35, // Per window
    restrictors: 25,         // Per window
    trickleVents: 30,        // Per window
  },
  
  featureAddons: {
    tripleGlazing: 0,     // Already in glazing multiplier
    lowE: 0,              // Already in glazing multiplier
    argonFilled: 0,       // Already in glazing multiplier
    georgian: 85,         // Georgian bars per window
    leaded: 150,          // Leaded lights per window
    tiltIn: 120,          // Tilt-in mechanism for sash
    restrictorStays: 35,  // Restrictor stays for casement
  },
  
  sizeMultipliers: {
    standard: 1.0,    // Up to 1200mm x 1500mm
    large: 1.15,      // Up to 1500mm x 1800mm
    extraLarge: 1.35, // Above 1500mm x 1800mm
  },
  
  multiUnitDiscount: {
    twoUnits: 0.95,    // 5% discount
    threeUnits: 0.90,  // 10% discount
    fourPlusUnits: 0.85, // 15% discount
  },
};
