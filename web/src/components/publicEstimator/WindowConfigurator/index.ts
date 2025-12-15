/**
 * Window Configurator Module Exports
 */

export { WindowConfigurator } from './WindowConfigurator';

export type {
  WindowConfiguration,
  WindowDimensions,
  WindowStyle,
  WindowColor,
  GlazingOption,
  WindowHardware,
  WindowFeatures,
  PaneConfiguration,
  WindowPricingMatrix,
  PriceBreakdown,
  ParametricWindowElements,
} from './types';

export {
  WINDOW_ELEMENTS,
  SASH_WINDOW_STYLES,
  CASEMENT_WINDOW_STYLES,
  ALU_CLAD_WINDOW_STYLES,
  ALL_WINDOW_STYLES,
  WINDOW_COLORS,
  GLAZING_OPTIONS,
  STANDARD_WINDOW_SIZES,
  PRICING_MATRIX,
} from './constants';

export {
  calculateWindowPrice,
  formatPrice,
  getPriceDescription,
} from './pricing';

export { generateWindowSVG } from './renderer';
