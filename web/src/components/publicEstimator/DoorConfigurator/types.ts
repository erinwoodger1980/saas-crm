/**
 * Door Configurator Types
 * Parametric door system with visual representation and pricing
 */

export interface DoorDimensions {
  width: number;  // mm
  height: number; // mm
}

export interface DoorStyle {
  id: string;
  name: string;
  description: string;
  category: 'traditional' | 'contemporary' | 'cottage';
  // Panel configuration
  panelCount: number; // 1, 2, 4, 6, etc.
  panelLayout: 'horizontal' | 'vertical' | 'grid';
  // Glass options
  glassOptions: GlassOption[];
  // Price multiplier for this style
  baseMultiplier: number;
}

export interface GlassOption {
  id: string;
  name: string;
  type: 'clear' | 'obscure' | 'leaded' | 'stained' | 'none';
  priceMultiplier: number;
}

export interface DoorColor {
  id: string;
  name: string;
  hex: string;
  finish: 'painted' | 'stained' | 'natural';
  priceMultiplier: number;
}

export interface PanelConfiguration {
  topPanelHeight?: number; // mm - for top panels
  bottomPanelHeight?: number; // mm - for bottom panels
  middleRailHeight?: number; // mm - height of middle rail
  glassInTop: boolean;
  glassInMiddle: boolean;
  glassInBottom: boolean;
}

export interface SideLight {
  enabled: boolean;
  position: 'left' | 'right' | 'both';
  width: number; // mm
  hasGlass: boolean;
  glassOption?: GlassOption;
}

export interface TopLight {
  enabled: boolean;
  height: number; // mm
  style: 'rectangular' | 'arched' | 'curved';
  hasGlass: boolean;
  glassOption?: GlassOption;
}

export interface DoorConfiguration {
  // Core dimensions
  dimensions: DoorDimensions;
  
  // Style & appearance
  style: DoorStyle;
  color: DoorColor;
  
  // Panel configuration
  panelConfig: PanelConfiguration;
  
  // Glass
  selectedGlass: GlassOption;
  
  // Additional elements
  sideLight: SideLight;
  topLight: TopLight;
  
  // Hardware
  hardware: {
    handleStyle: 'traditional' | 'contemporary';
    letterPlate: boolean;
    knocker: boolean;
  };
  
  // Preset glazing dimensions (from DXF elevation options)
  glazingDimensions?: {
    cutOutSize: number;  // mm - opening height in door
    beadSize: number;    // mm - bead sight line (outer edge to outer edge)
    glassSize: number;   // mm - actual glass dimension
  };
}

export interface DoorPricingMatrix {
  // Base price per square meter
  basePricePerSqM: number;
  
  // Size-based multipliers
  sizeMultipliers: {
    standard: number;    // 762-914mm x 1981-2134mm
    large: number;       // > 914mm or > 2134mm
    extraLarge: number;  // > 1200mm or > 2400mm
  };
  
  // Additional costs
  sideLight: {
    basePricePerUnit: number;
    widthMultiplier: number; // per 100mm
  };
  
  topLight: {
    basePrice: number;
    styleMultipliers: {
      rectangular: number;
      arched: number;
      curved: number;
    };
  };
  
  hardware: {
    handleUpgrade: number;
    letterPlate: number;
    knocker: number;
  };
}

export interface ParametricDoorElements {
  // Fixed dimensions (don't scale with door size)
  stileWidth: number;      // 95mm typical
  topRailHeight: number;   // 190mm typical
  bottomRailHeight: number; // 240mm typical
  middleRailHeight: number; // 95mm typical
  muntinWidth: number;     // 60mm typical
  
  // Minimum clearances
  minPanelHeight: number;  // 150mm
  minPanelWidth: number;   // 150mm
}
