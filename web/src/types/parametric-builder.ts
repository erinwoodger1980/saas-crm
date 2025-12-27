/**
 * Parametric Builder System Types
 * Unified contract for all product-specific builders (doors, windows, etc.)
 * Includes comprehensive curve support for arched heads, fanlights, etc.
 */

import { ComponentNode, MaterialDefinition, SceneConfig } from './scene-config';

/**
 * New Flow Spec (TEMPLATE vs INSTANCE)
 * - ConfiguratorMode dictates persistence target and initialization source
 * - TEMPLATE edits save to ProductType.templateConfig
 * - INSTANCE edits save to QuoteLine configuredProductParams / sceneState
 * - Both modes use the same builder/render pipeline (ProductParams -> BuildResult -> SceneConfig)
 */
export type ConfiguratorMode = 'TEMPLATE' | 'INSTANCE';

/**
 * Curve type definitions for arches, ellipses, beziers, etc.
 */
export type CurveType = 'arc' | 'ellipse' | 'bezier' | 'polyline' | 'spline';

/**
 * Plane orientation for curves
 */
export type CurvePlane = 'XY' | 'XZ' | 'YZ';

/**
 * Joinery usage classification for curves
 */
export type CurveUsage = 'head' | 'fanlight' | 'glazingBarPath' | 'mouldingPath' | 'cutout';

/**
 * Arc curve definition (segments of circles)
 */
export interface ArcCurve {
  cx: number; // center X
  cy: number; // center Y
  r: number; // radius
  startAngle: number; // radians
  endAngle: number; // radians
  clockwise?: boolean;
}

/**
 * Ellipse curve definition
 */
export interface EllipseCurve {
  cx: number;
  cy: number;
  rx: number; // radius X
  ry: number; // radius Y
  rotation?: number; // radians
  startAngle?: number;
  endAngle?: number;
  clockwise?: boolean;
}

/**
 * Cubic Bezier curve definition
 */
export interface BezierCurve {
  p0: [number, number]; // start point
  p1: [number, number]; // control point 1
  p2: [number, number]; // control point 2
  p3: [number, number]; // end point
}

/**
 * Polyline (connected line segments)
 */
export interface PolylineCurve {
  points: [number, number][]; // vertices
  closed?: boolean;
}

/**
 * Spline (smooth interpolation through points)
 */
export interface SplineCurve {
  points: [number, number][]; // control points
  closed?: boolean;
  tension?: number; // 0-1, affects curvature
}

/**
 * Complete curve definition
 */
export interface CurveDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Curve type */
  type: CurveType;
  /** Plane this curve exists in */
  plane: CurvePlane;
  /** Units (mm) */
  units: string;
  
  /** Curve parameters (one should be present based on type) */
  arc?: ArcCurve;
  ellipse?: EllipseCurve;
  bezier?: BezierCurve;
  polyline?: PolylineCurve;
  spline?: SplineCurve;
  
  /** Joinery meaning */
  usage: CurveUsage;
  
  /** Offset from curve (for rebates, moulding offsets) */
  offset?: number;
  
  /** Thickness for extrudes */
  thickness?: number;
  
  /** Depth/Z for extrudes */
  depth?: number;
  
  /** Resolution: number of segments for curve sampling */
  resolution?: number;
}

/**
 * Joinery-friendly curve presets
 * Users input high-level parameters, converted to CurveDefinition
 */
export interface CurvePreset {
  /** Preset type */
  type: 'segmentalArch' | 'radiusHead' | 'gothicArch';
  
  // Segmental arch: specify span and rise
  segmentalArch?: {
    span: number; // width (mm)
    rise: number; // height at center above spring line (mm)
  };
  
  // Radius head: circle with specified radius and spring line
  radiusHead?: {
    radius: number; // mm
    springLineHeight: number; // distance from bottom of opening to spring line
  };
  
  // Gothic/pointed arch: apex height and shoulder radius
  gothicArch?: {
    span: number;
    apexHeight: number;
    shoulderRadius?: number; // if omitted, two-point gothic
  };
}

/**
 * Curve slots: references to curves used in component structure
 */
export interface CurveSlots {
  /** Head profile curve (for arch/radius/gothic tops) */
  headProfileCurveId?: string;
  /** Fanlight curve definition */
  fanlightCurveId?: string;
  /** Glazing bar paths */
  glazingBarPaths?: string[];
  /** Moulding paths */
  mouldingPaths?: string[];
  /** Custom slot mapping */
  [key: string]: string | string[] | undefined;
}

/**
 * Editable attribute definition for inspector UI
 */
export interface EditableAttribute {
  /** Unique key for this attribute */
  key: string;
  /** Display label */
  label: string;
  /** Input type */
  type: 'number' | 'text' | 'select' | 'boolean' | 'color';
  /** Current value */
  value: any;
  /** Unit label (e.g., "mm") */
  unit?: string;
  /** Min value for number inputs */
  min?: number;
  /** Max value for number inputs */
  max?: number;
  /** Step for number inputs */
  step?: number;
  /** Options for select inputs */
  options?: Array<{ value: any; label: string }>;
  /** Help text */
  helpText?: string;
}

/**
 * Product parametric inputs
 * Stored in SceneConfig.customData
 */
export interface ProfileDefinition {
  id: string;
  name: string;
  kind: 'stile' | 'rail' | 'mullion' | 'transom' | 'panelMould' | 'stop' | 'custom';
  units: 'mm';
  shape2D: {
    points: [number, number][];
    closed: boolean;
  };
  sourceType?: 'points' | 'svg';
  svgText?: string;
  depthMm?: number;
  scale?: number;
  metadata?: {
    source: 'estimated' | 'uploaded';
    notes?: string;
  };
}

// TODO: Persist profiles to DB (profiles table) and link uploaded SVG/DXF -> 2D points
export interface ProfileStorageRecord {
  id: string;
  tenantId: string;
  name: string;
  kind: ProfileDefinition['kind'];
  units: 'mm';
  shapePoints: [number, number][];
  metadata?: ProfileDefinition['metadata'];
}

export interface ProductParams {
  /** Product type identifiers from DB */
  productType: {
    category: string; // 'doors' | 'windows'
    type: string; // e.g., 'entrance-door', 'casement-window'
    option: string; // e.g., 'E01', 'E02', 'E03'
  };
  
  /** Overall dimensions from quote line item */
  dimensions: {
    width: number; // mm
    height: number; // mm
    depth: number; // mm (thickness)
  };
  
  /** Parametric construction details */
  construction: {
    // Frame/structure
    stileWidth?: number;
    topRail?: number;
    midRail?: number;
    bottomRail?: number;
    thickness?: number;
    
    // Layout
    panelLayout?: {
      rows: number;
      cols: number;
    };
    glazingArea?: {
      topPercent: number;
      bottomPercent: number;
    };
    
    // Materials
    timber?: string;
    finish?: string;
    glazingType?: string;

    /** Profile mapping by component type (stile, rails, etc.) */
    profileIds?: Record<string, string>;

    /** Layout overrides for rail heights (mm from bottom to centerline) */
    layoutOverrides?: {
      topRailY?: number;
      midRailY?: number;
      bottomRailY?: number;
      railYById?: Record<string, number>;
    };

    /** Optional layout hints from AI (validated by resolvers) */
    layoutHint?: {
      panelCount?: number;
      panelGrid?: string; // e.g., "1x2", "2x2"
      glazedTopPct?: number;
      railHeightsHints?: {
        top?: number;
        mid?: number;
        bottom?: number;
      };
      style?: string;
    };
    
    // Additional parametric data
    [key: string]: any;
  };
  
  /**
   * Template-level material role mapping
   * Maps semantic roles to material ids (e.g., FRAME_TIMBER -> 'oak')
   */
  materialRoleMap?: Partial<Record<
    'FRAME_TIMBER' | 'PANEL_TIMBER' | 'GLASS' | 'HARDWARE_METAL' | 'SEAL_RUBBER' | 'PAINT',
    string
  >>;

  /**
   * Instance-level material overrides
   * Maps component ids or roles to material ids
   */
  materialOverrides?: Record<string, string>;
  
  /** Curve definitions (arches, fanlights, glazing bars) */
  curves?: CurveDefinition[];

  /** Profile definitions used by components (stored with params for now) */
  profiles?: ProfileDefinition[];
  
  /** Slots referencing which curves to use */
  curveSlots?: CurveSlots;
  
  /** User-added components */
  addedParts?: AddedPart[];
  
  /** Custom overrides */
  overrides?: Record<string, any>;
}

/**
 * Component added by user (not part of base product)
 */
export interface AddedPart {
  /** Unique ID */
  id: string;
  /** Component type from DB */
  componentTypeCode: string;
  /** Variant code if specific variant selected */
  variantCode?: string;
  /** Insertion mode used */
  insertionMode: 'parametric' | 'click' | 'coordinates';
  /** Parametric slot (e.g., 'mullion-center', 'glazing-bar-h1') */
  parametricSlot?: string;
  /** Explicit position if click/coordinates mode */
  position?: [number, number, number];
  /** Rotation override */
  rotation?: [number, number, number];
  /** Parametric inputs for this part */
  params?: Record<string, any>;
}

/**
 * Result from builder
 */
export interface BuildResult {
  /** Generated component tree */
  components: ComponentNode[];
  /** Material definitions */
  materials: MaterialDefinition[];
  /** Lighting bounds for dynamic scaling */
  lighting: {
    boundsX: [number, number];
    boundsZ: [number, number];
    shadowCatcherDiameter: number;
  };
  /** Updated params with defaults filled */
  params: ProductParams;
  /** Editable attributes for inspector */
  editableAttributes?: Record<string, EditableAttribute[]>; // Keyed by componentId
}

/**
 * Edit operation
 */
export interface ComponentEdit {
  /** Component ID being edited */
  componentId: string;
  /** Attribute changes */
  changes: Record<string, any>;
}

/**
 * Parametric builder interface
 * All product-specific builders must implement this
 */
export interface ParametricBuilder {
  /** Builder identifier */
  type: string; // 'door' | 'window'
  
  /** 
   * Build component tree from parametric inputs
   * This is the core function that generates geometry
   */
  build(params: ProductParams): BuildResult;
  
  /**
   * Apply edit to parametric params
   * Returns updated params
   */
  applyEdit(params: ProductParams, edit: ComponentEdit): ProductParams;
  
  /**
   * Validate parametric inputs
   * Returns validation errors or null
   */
  validate(params: ProductParams): string[] | null;
  
  /**
   * Get default params for this product type
   */
  getDefaults(
    productType: { category: string; type: string; option: string },
    dimensions: { width: number; height: number; depth: number }
  ): ProductParams;
}

/**
 * Builder registry
 * Maps product category to builder implementation
 */
export type BuilderRegistry = Record<string, ParametricBuilder>;

/**
 * Extract parametric params from quote line item
 */
export interface QuoteLineItem {
  id: string;
  description?: string | null;
  meta?: Record<string, any> | null;
  lineStandard?: Record<string, any> | null;
  configuredProduct?: Record<string, any> | null;
}

/**
 * Helper to extract params from line item
 */
export function extractParamsFromLineItem(
  line: QuoteLineItem,
  productType: { category: string; type: string; option: string }
): Partial<ProductParams> {
  // Extract dimensions from lineStandard or meta
  const width = line.lineStandard?.widthMm || line.meta?.widthMm || 914;
  const height = line.lineStandard?.heightMm || line.meta?.heightMm || 2032;
  const depth = line.lineStandard?.thicknessMm || line.meta?.depthMm || line.meta?.thicknessMm || 45;
  
  // Extract construction details from configuredProduct or lineStandard
  const construction = {
    timber: line.lineStandard?.timber || line.meta?.timber,
    finish: line.lineStandard?.finish || line.meta?.finish,
    glazingType: line.lineStandard?.glazing || line.meta?.glazingType,
    ...(line.configuredProduct?.selections || {}),
  };
  
  return {
    productType,
    dimensions: { width, height, depth },
    construction,
    addedParts: line.configuredProduct?.addedParts || [],
  };
}
