/**
 * Material Resolver for Door Pricing Engine
 * 
 * Enriches MaterialRequirement objects with specific materialCode values
 * based on door specifications (fire rating, core type, glass type, etc.)
 * 
 * This module maps high-level door specifications to specific MaterialItem codes
 * that exist in the database for pricing lookups.
 */

// Import types from parent door-pricing-engine module
// Note: DoorCostingContext is defined in door-pricing-engine.ts but not exported yet
// We'll need to add the export there or redefine it here
interface DoorCostingInput {
  quantity: number;
  leafConfiguration: string;
  frameWidthMm: number;
  frameHeightMm: number;
  numberOfLeaves: number;
  masterLeafWidthMm?: number | null;
  coreType?: string | null;
  coreThicknessMm?: number | null;
  lippingMaterialSelected?: boolean | null;
  frameMaterial?: string | null;
  fireRating?: string | null;
  acousticRatingDb?: number | null;
  glassType?: string | null;
}

interface DerivedDimensions {
  coreSizeStatus?: string | null;
  coreWidthMm?: number | null;
  coreHeightMm?: number | null;
  lippingWidthMm?: number | null;
  leafHeightMm?: number | null;
  frameThicknessMm?: number | null;
}

interface ApertureAndGlassResult {
  totalGlassAreaM2?: number | null;
}

interface CostingWarnings {
  coreSizeStatus?: string | null;
  glassTypeRequired?: boolean | null;
  hasVisionPanels?: boolean | null;
}

interface DoorCostingContext {
  input: DoorCostingInput;
  dimensions: DerivedDimensions;
  apertures: ApertureAndGlassResult;
  warnings: CostingWarnings;
}

// Import MaterialRequirement from parent module
import type { MaterialRequirement } from '../door-pricing-engine';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for resolving material codes based on door specifications
 */
export interface MaterialResolverConfig {
  /**
   * Core material mapping rules
   * Key format: "${fireRating}:${thicknessMm}" → MaterialItem code
   * Example: "FD30:44" → "CORE-FD30-44"
   */
  core: {
    [key: string]: string;
  };

  /**
   * Glass material mapping rules
   * Key format: "${fireRating}:${glassType}" → MaterialItem code
   * Example: "FD30:FR Clear" → "GLASS-FR-CLEAR"
   */
  glass: {
    [key: string]: string;
  };

  /**
   * Ironmongery pack mapping rules
   * Key format: packKey → MaterialItem code
   * Example: "STD-FD30" → "IRON-PACK-STD-FD"
   */
  ironmongery: {
    [packKey: string]: string;
  };

  /**
   * Default lipping material code
   * Used when lipping is required but no specific code is specified
   */
  lippingDefaultCode: string;
}

/**
 * Context for material code resolution
 */
export interface ResolveContext {
  /**
   * Tenant slug (e.g., "laj-joinery")
   * Future: could be used to load tenant-specific configs
   */
  tenantSlug: string;

  /**
   * Door costing context containing specifications
   */
  doorContext: DoorCostingContext;
}

// ============================================================================
// DEFAULT CONFIGURATION FOR LAJ JOINERY
// ============================================================================

/**
 * Default material resolver configuration for LAJ Joinery
 * Maps door specifications to specific MaterialItem codes
 */
export const lajMaterialResolverConfig: MaterialResolverConfig = {
  core: {
    // FD30 fire rating with 44mm thickness
    'FD30:44': 'CORE-FD30-44',
    
    // FD60 fire rating with 54mm thickness
    'FD60:54': 'CORE-FD60-54',
  },

  glass: {
    // Fire-rated clear glass for FD30 and FD60
    'FD30:FR Clear': 'GLASS-FR-CLEAR',
    'FD60:FR Clear': 'GLASS-FR-CLEAR',
    
    // Add more glass types as MaterialItems are added
    // 'FD30:FR Obscure': 'GLASS-FR-OBSCURE',
    // 'FD30:FR Wired': 'GLASS-FR-WIRED',
  },

  ironmongery: {
    // Standard ironmongery packs for fire doors
    'STD-FD30': 'IRON-PACK-STD-FD',
    'STD-FD60': 'IRON-PACK-STD-FD',
    
    // Future: add premium/specialist packs
    // 'PREMIUM-FD30': 'IRON-PACK-PREMIUM-FD',
  },

  lippingDefaultCode: 'LIP-SOFTWOOD',
};

// ============================================================================
// RESOLVER FUNCTIONS
// ============================================================================

/**
 * Resolves core material code based on fire rating and thickness
 * 
 * @param ctx - Resolution context with door specifications
 * @param config - Material resolver configuration
 * @returns Material code or undefined if not found
 * 
 * @example
 * // For FD30 door with 44mm core:
 * resolveCoreCode(ctx, config) // Returns "CORE-FD30-44"
 */
export function resolveCoreCode(
  ctx: ResolveContext,
  config: MaterialResolverConfig = lajMaterialResolverConfig,
): string | undefined {
  const { fireRating, coreThicknessMm } = ctx.doorContext.input;

  // Need both fire rating and thickness to resolve core code
  if (!fireRating || !coreThicknessMm) {
    return undefined;
  }

  // Build lookup key: "FD30:44" or "FD60:54"
  const key = `${fireRating}:${coreThicknessMm}`;
  
  return config.core[key];
}

/**
 * Resolves glass material code based on fire rating and glass type
 * 
 * @param ctx - Resolution context with door specifications
 * @param config - Material resolver configuration
 * @returns Material code or undefined if not found or no glass needed
 * 
 * @example
 * // For FD30 door with FR Clear glass:
 * resolveGlassCode(ctx, config) // Returns "GLASS-FR-CLEAR"
 */
export function resolveGlassCode(
  ctx: ResolveContext,
  config: MaterialResolverConfig = lajMaterialResolverConfig,
): string | undefined {
  const { fireRating, glassType } = ctx.doorContext.input;

  // No glass required if no glass type specified
  if (!glassType) {
    return undefined;
  }

  // Need fire rating to ensure glass meets fire resistance requirements
  if (!fireRating) {
    return undefined;
  }

  // Build lookup key: "FD30:FR Clear" or "FD60:FR Clear"
  const key = `${fireRating}:${glassType}`;
  
  return config.glass[key];
}

/**
 * Resolves ironmongery pack code based on fire rating and optional pack key
 * 
 * @param ctx - Resolution context with door specifications
 * @param packKey - Optional specific pack key from MaterialRequirement meta
 * @param config - Material resolver configuration
 * @returns Material code or undefined if not found
 * 
 * @example
 * // With explicit pack key:
 * resolveIronmongeryCode(ctx, "STD-FD30", config) // Returns "IRON-PACK-STD-FD"
 * 
 * // Auto-derived from fire rating:
 * resolveIronmongeryCode(ctx, null, config) // Returns "IRON-PACK-STD-FD" for FD30
 */
export function resolveIronmongeryCode(
  ctx: ResolveContext,
  packKey?: string | null,
  config: MaterialResolverConfig = lajMaterialResolverConfig,
): string | undefined {
  const { fireRating } = ctx.doorContext.input;

  let effectivePackKey = packKey;

  // If no explicit pack key provided, derive from fire rating
  if (!effectivePackKey && fireRating) {
    // Standard pack selection based on fire rating
    if (fireRating.startsWith('FD30')) {
      effectivePackKey = 'STD-FD30';
    } else if (fireRating.startsWith('FD60')) {
      effectivePackKey = 'STD-FD60';
    }
  }

  // No pack key could be determined
  if (!effectivePackKey) {
    return undefined;
  }

  return config.ironmongery[effectivePackKey];
}

/**
 * Resolves lipping material code
 * 
 * @param ctx - Resolution context with door specifications
 * @param config - Material resolver configuration
 * @returns Material code or undefined if lipping not required
 * 
 * @example
 * resolveLippingCode(ctx, config) // Returns "LIP-SOFTWOOD"
 */
export function resolveLippingCode(
  ctx: ResolveContext,
  config: MaterialResolverConfig = lajMaterialResolverConfig,
): string | undefined {
  const { coreThicknessMm } = ctx.doorContext.input;

  // Only provide lipping code if core thickness is specified
  // (indicates a door is being manufactured)
  if (!coreThicknessMm) {
    return undefined;
  }

  // Return default lipping code
  // Future: could be enhanced to select different lipping types
  // based on finish requirements, edge profile, etc.
  return config.lippingDefaultCode;
}

// ============================================================================
// ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enriches material requirements with specific material codes based on door context
 * 
 * This is the main entry point for material code resolution. It takes a list of
 * MaterialRequirement objects (which may have generic descriptions but no materialCode)
 * and enriches them with specific codes that can be looked up in the MaterialItem table.
 * 
 * @param ctx - Resolution context containing tenant and door specifications
 * @param requirements - Array of material requirements to enrich
 * @param config - Material resolver configuration (defaults to LAJ Joinery config)
 * @returns New array of enriched material requirements (original not mutated)
 * 
 * @example
 * ```typescript
 * const ctx: ResolveContext = {
 *   tenantSlug: "laj-joinery",
 *   doorContext: context,
 * };
 * 
 * const requirements = buildMaterialRequirements(context);
 * const enriched = enrichMaterialCodesForDoor(ctx, requirements);
 * 
 * // enriched now has materialCode populated where possible:
 * // { category: "core", materialCode: "CORE-FD30-44", ... }
 * // { category: "glass", materialCode: "GLASS-FR-CLEAR", ... }
 * // { category: "ironmongery", materialCode: "IRON-PACK-STD-FD", ... }
 * ```
 */
export function enrichMaterialCodesForDoor(
  ctx: ResolveContext,
  requirements: MaterialRequirement[],
  config: MaterialResolverConfig = lajMaterialResolverConfig,
): MaterialRequirement[] {
  // Create a new array to avoid mutating the input
  return requirements.map((req) => {
    // Skip if materialCode already populated
    if (req.materialCode) {
      return req;
    }

    // Resolve code based on category
    let resolvedCode: string | undefined;

    switch (req.category) {
      case 'core':
        resolvedCode = resolveCoreCode(ctx, config);
        break;

      case 'glass':
        resolvedCode = resolveGlassCode(ctx, config);
        break;

      case 'ironmongery':
        resolvedCode = resolveIronmongeryCode(ctx, req.meta?.packKey, config);
        break;

      case 'lipping':
        resolvedCode = resolveLippingCode(ctx, config);
        break;

      // For other categories (timber, finish, etc.), no automatic resolution yet
      // They should either come with a materialCode or remain unresolved
      default:
        resolvedCode = undefined;
    }

    // Return enriched requirement if we found a code
    if (resolvedCode) {
      return {
        ...req,
        materialCode: resolvedCode,
      };
    }

    // Return unchanged if no code could be resolved
    return req;
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets material resolver config for a given tenant
 * 
 * @param tenantSlug - Tenant slug
 * @returns Material resolver configuration for the tenant
 * 
 * Future: This could load tenant-specific configurations from database
 * For now, returns LAJ Joinery config for all tenants
 */
export function getConfigForTenant(tenantSlug: string): MaterialResolverConfig {
  // Future: load tenant-specific config from database
  // const config = await loadTenantMaterialConfig(tenantSlug);
  
  // For now, all tenants use LAJ Joinery config
  return lajMaterialResolverConfig;
}

/**
 * Validates a material resolver configuration
 * 
 * @param config - Configuration to validate
 * @returns Validation result with any errors
 */
export function validateConfig(config: MaterialResolverConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields exist
  if (!config.core || typeof config.core !== 'object') {
    errors.push('core mapping is required');
  }

  if (!config.glass || typeof config.glass !== 'object') {
    errors.push('glass mapping is required');
  }

  if (!config.ironmongery || typeof config.ironmongery !== 'object') {
    errors.push('ironmongery mapping is required');
  }

  if (!config.lippingDefaultCode || typeof config.lippingDefaultCode !== 'string') {
    errors.push('lippingDefaultCode is required');
  }

  // Check that mappings have at least one entry
  if (config.core && Object.keys(config.core).length === 0) {
    errors.push('core mapping must have at least one entry');
  }

  if (config.ironmongery && Object.keys(config.ironmongery).length === 0) {
    errors.push('ironmongery mapping must have at least one entry');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
