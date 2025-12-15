/**
 * Window Configurator Types
 * Comprehensive type system for parametric window configuration
 */

export interface WindowConfiguration {
  dimensions: WindowDimensions;
  windowType: 'sash' | 'casement' | 'alu-clad';
  style: WindowStyle;
  color: WindowColor;
  glazing: GlazingOption;
  hardware: WindowHardware;
  features: WindowFeatures;
}

export interface WindowDimensions {
  width: number;  // mm
  height: number; // mm
  columns: number; // Number of window units side by side
  rows: number;    // Number of window units stacked vertically
}

export interface WindowStyle {
  id: string;
  name: string;
  type: 'sash' | 'casement' | 'alu-clad';
  description: string;
  panes: PaneConfiguration;
  priceMultiplier: number;
}

export interface WindowColor {
  id: string;
  name: string;
  hexColor: string;
  finishType: 'natural' | 'stained' | 'painted';
  priceMultiplier: number;
  availableForTypes: ('sash' | 'casement' | 'alu-clad')[];
}

export interface GlazingOption {
  id: string;
  name: string;
  description: string;
  uValue: number; // Thermal performance
  priceMultiplier: number;
  features: string[];
}

export interface WindowHardware {
  locks: 'standard' | 'security' | 'premium';
  handles: 'traditional' | 'contemporary';
  restrictors?: boolean; // Safety restrictors for upper floors
  trickleVents?: boolean; // Ventilation
}

export interface WindowFeatures {
  doubleGlazing: boolean;
  tripleGlazing: boolean;
  lowE: boolean; // Low-E coating
  argonFilled: boolean;
  Georgian: boolean; // Georgian bars
  leaded: boolean; // Leaded lights
  tiltIn: boolean; // Tilt-in for easy cleaning (sash only)
  restrictorStays: boolean; // Safety stays (casement only)
}

export interface PaneConfiguration {
  horizontal: number; // Panes across
  vertical: number;   // Panes down
  moveable?: 'top' | 'bottom' | 'both' | 'side' | 'all'; // Which panes open
}

export interface WindowPricingMatrix {
  basePricePerSqM: number;
  windowTypeMultipliers: {
    sash: number;
    casement: number;
    'alu-clad': number;
  };
  styleMultipliers: {
    [styleId: string]: number;
  };
  colorMultipliers: {
    [colorId: string]: number;
  };
  glazingMultipliers: {
    [glazingId: string]: number;
  };
  hardwareAddons: {
    securityLocks: number;
    premiumLocks: number;
    contemporaryHandles: number;
    restrictors: number;
    trickleVents: number;
  };
  featureAddons: {
    tripleGlazing: number;
    lowE: number;
    argonFilled: number;
    georgian: number;
    leaded: number;
    tiltIn: number;
    restrictorStays: number;
  };
  sizeMultipliers: {
    standard: number;  // Up to 1200mm x 1500mm
    large: number;     // Up to 1500mm x 1800mm
    extraLarge: number; // Above 1500mm x 1800mm
  };
  multiUnitDiscount: {
    twoUnits: number;    // 5% discount
    threeUnits: number;  // 10% discount
    fourPlusUnits: number; // 15% discount
  };
}

export interface PriceBreakdown {
  basePrice: number;
  windowTypeMultiplier: number;
  styleMultiplier: number;
  colorMultiplier: number;
  glazingMultiplier: number;
  sizeMultiplier: number;
  multiUnitDiscount: number;
  hardwarePrice: number;
  featuresPrice: number;
  subtotal: number;
  vat: number;
  total: number;
}

export interface ParametricWindowElements {
  frameWidth: number;      // mm - Fixed frame width
  sashWidth: number;       // mm - Sash frame width
  muntinWidth: number;     // mm - Glazing bar width
  sillDepth: number;       // mm - Window sill projection
  minPaneWidth: number;    // mm - Minimum pane width
  minPaneHeight: number;   // mm - Minimum pane height
}
