/**
 * Door Configurator Module
 * Export all public APIs
 */

export { DoorConfigurator } from './DoorConfigurator';
export type {
  DoorConfiguration,
  DoorDimensions,
  DoorStyle,
  DoorColor,
  GlassOption,
  PanelConfiguration,
  SideLight,
  TopLight,
  DoorPricingMatrix,
} from './types';
export {
  DOOR_STYLES,
  DOOR_COLORS,
  GLASS_OPTIONS,
  STANDARD_SIZES,
  PRICING_MATRIX,
} from './constants';
export {
  calculateDoorPrice,
  formatPrice,
  getPriceDescription,
} from './pricing';
export { generateDoorSVG } from './renderer';
