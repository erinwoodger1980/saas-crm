import type { DimensionRules, LeafConfiguration } from "./derived-dimensions";

/**
 * Sample dimension rules based on typical door frame configurations.
 * In production, these would come from database tables or configuration files.
 */

interface FrameConfig {
  frameType: string;
  configuration: LeafConfiguration;
  totalGapWidth: number;
  soOffsetWidth: number;
  soOffsetHeight: number;
}

// Sample lookup table for frame sizing rules
const FRAME_SIZING_TABLE: FrameConfig[] = [
  // Standard Frame - Single configurations
  { frameType: "Standard", configuration: "Single", totalGapWidth: 25, soOffsetWidth: 100, soOffsetHeight: 100 },
  { frameType: "Standard", configuration: "Double", totalGapWidth: 30, soOffsetWidth: 100, soOffsetHeight: 100 },
  { frameType: "Standard", configuration: "Leaf & a Half", totalGapWidth: 30, soOffsetWidth: 100, soOffsetHeight: 100 },
  { frameType: "Standard", configuration: "Leaf Only", totalGapWidth: 0, soOffsetWidth: 0, soOffsetHeight: 0 },
  
  // Rebated Frame configurations
  { frameType: "Rebated", configuration: "Single", totalGapWidth: 20, soOffsetWidth: 90, soOffsetHeight: 90 },
  { frameType: "Rebated", configuration: "Double", totalGapWidth: 25, soOffsetWidth: 90, soOffsetHeight: 90 },
  { frameType: "Rebated", configuration: "Leaf & a Half", totalGapWidth: 25, soOffsetWidth: 90, soOffsetHeight: 90 },
  { frameType: "Rebated", configuration: "Leaf Only", totalGapWidth: 0, soOffsetWidth: 0, soOffsetHeight: 0 },
  
  // Face-Fixed Frame configurations
  { frameType: "Face-Fixed", configuration: "Single", totalGapWidth: 30, soOffsetWidth: 110, soOffsetHeight: 110 },
  { frameType: "Face-Fixed", configuration: "Double", totalGapWidth: 35, soOffsetWidth: 110, soOffsetHeight: 110 },
  { frameType: "Face-Fixed", configuration: "Leaf & a Half", totalGapWidth: 35, soOffsetWidth: 110, soOffsetHeight: 110 },
  { frameType: "Face-Fixed", configuration: "Leaf Only", totalGapWidth: 0, soOffsetWidth: 0, soOffsetHeight: 0 },
  
  // Flush Frame configurations
  { frameType: "Flush", configuration: "Single", totalGapWidth: 22, soOffsetWidth: 95, soOffsetHeight: 95 },
  { frameType: "Flush", configuration: "Double", totalGapWidth: 28, soOffsetWidth: 95, soOffsetHeight: 95 },
  { frameType: "Flush", configuration: "Leaf & a Half", totalGapWidth: 28, soOffsetWidth: 95, soOffsetHeight: 95 },
  { frameType: "Flush", configuration: "Leaf Only", totalGapWidth: 0, soOffsetWidth: 0, soOffsetHeight: 0 },
];

/**
 * Sample implementation of DimensionRules using lookup tables.
 * This provides realistic default values for door frame calculations.
 */
export class SampleDimensionRules implements DimensionRules {
  private findConfig(frameType: string, config: LeafConfiguration): FrameConfig | null {
    const normalizedType = frameType.trim().toLowerCase();
    return FRAME_SIZING_TABLE.find(
      (row) =>
        row.frameType.toLowerCase() === normalizedType &&
        row.configuration === config
    ) || null;
  }

  getTotalGapWidth(frameType: string, config: LeafConfiguration): number | null {
    const found = this.findConfig(frameType, config);
    return found ? found.totalGapWidth : null;
  }

  getSoOffsetWidth(frameType: string, config: LeafConfiguration): number | null {
    const found = this.findConfig(frameType, config);
    return found ? found.soOffsetWidth : null;
  }

  getSoOffsetHeight(frameType: string, config: LeafConfiguration): number | null {
    const found = this.findConfig(frameType, config);
    return found ? found.soOffsetHeight : null;
  }
}

/**
 * Available frame types for the UI
 */
export const FRAME_TYPES = [
  { value: "Standard", label: "Standard Frame" },
  { value: "Rebated", label: "Rebated Frame" },
  { value: "Face-Fixed", label: "Face-Fixed Frame" },
  { value: "Flush", label: "Flush Frame" },
];

/**
 * Available frame materials for the UI
 */
export const FRAME_MATERIALS = [
  { value: "MDF", label: "MDF" },
  { value: "Softwood", label: "Softwood" },
  { value: "Hardwood", label: "Hardwood" },
  { value: "Oak", label: "Oak" },
  { value: "Ash", label: "Ash" },
  { value: "Maple", label: "Maple" },
  { value: "Sapele", label: "Sapele" },
  { value: "Walnut", label: "Walnut" },
  { value: "Beech", label: "Beech" },
  { value: "Steel", label: "Steel" },
  { value: "Stainless Steel", label: "Stainless Steel" },
  { value: "Engineered_Softwood", label: "Engineered Softwood" },
];

/**
 * Available fire ratings
 */
export const FIRE_RATINGS = [
  { value: "", label: "None" },
  { value: "FD30", label: "FD30 (30 min)" },
  { value: "FD60", label: "FD60 (60 min)" },
  { value: "FD60S", label: "FD60S (60 min with smoke seals)" },
  { value: "FD90", label: "FD90 (90 min)" },
  { value: "FD90S", label: "FD90S (90 min with smoke seals)" },
  { value: "FD120", label: "FD120 (120 min)" },
  { value: "FD120S", label: "FD120S (120 min with smoke seals)" },
];

/**
 * Available core types
 */
export const CORE_TYPES = [
  { value: "", label: "No Core" },
  { value: "Chipboard", label: "Chipboard" },
  { value: "MDF", label: "MDF Core" },
  { value: "Solid Timber", label: "Solid Timber" },
  { value: "Honeycomb", label: "Honeycomb" },
  { value: "Fire Core", label: "Fire-Rated Core" },
];
