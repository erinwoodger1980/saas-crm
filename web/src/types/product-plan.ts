import { z } from 'zod';

/**
 * ProductPlanV1: Component-level assembly specification for 3D rendering, BOM, cutlists, and pricing.
 * 
 * This is the successor to simple param patches. A ProductPlan describes:
 * - Detected category/type/option with confidence
 * - Dimensions (may be partial, filled from defaults if needed)
 * - Material role assignments (TIMBER_PRIMARY, PANEL_CORE, SEAL_RUBBER, etc)
 * - Profile slots (FRAME_JAMB, LEAF_STILE, LEAF_RAIL, BEADING, etc)
 * - Exact component instances with parametric geometry expressions
 * - Named variables for reusable expressions (pw, ph, sd, stileW, railTop, etc)
 * 
 * Expressions use plain identifiers (pw, ph, sd) not #pw syntax.
 * All dimensions in mm.
 */

export const ComponentRoleSchema = z.enum([
  'STILE',
  'RAIL_TOP',
  'RAIL_MID',
  'RAIL_BOTTOM',
  'PANEL',
  'GLASS',
  'BEAD',
  'FRAME_JAMB_L',
  'FRAME_JAMB_R',
  'FRAME_HEAD',
  'CILL',
  'SEAL',
  'LOCK',
  'HANDLE',
  'HINGE',
  'GLAZING_BAR',
  'MOULDING',
  'THRESHOLD',
  'WEATHERBOARD'
]);

export type ComponentRole = z.infer<typeof ComponentRoleSchema>;

export const MaterialRoleSchema = z.enum([
  'TIMBER_PRIMARY',
  'TIMBER_SECONDARY',
  'PANEL_CORE',
  'SEAL_RUBBER',
  'SEAL_FOAM',
  'METAL_CHROME',
  'METAL_STEEL',
  'GLASS_CLEAR',
  'GLASS_LEADED',
  'GLASS_FROSTED',
  'PAINT_FINISH',
  'STAIN_FINISH'
]);

export type MaterialRole = z.infer<typeof MaterialRoleSchema>;

export const ProfileSlotSchema = z.enum([
  'FRAME_JAMB',
  'LEAF_STILE',
  'LEAF_RAIL',
  'BEADING',
  'MOULDING_OVOLO',
  'MOULDING_OGEE',
  'WEATHERBOARD_TOP',
  'WEATHERBOARD_SIDE',
  'THRESHOLD_PROFILE'
]);

export type ProfileSlot = z.infer<typeof ProfileSlotSchema>;

export const GeometrySchema = z.object({
  type: z.enum(['profileExtrude', 'box', 'gltf']),
  profileSlot: z.string().optional(), // e.g. "LEAF_STILE"; used if type='profileExtrude'
  widthExpr: z.string().optional(), // e.g. "(pw - stileW - stileW) / 2"; dimensions
  heightExpr: z.string().optional(),
  depthExpr: z.string().optional(),
  extrudeAxis: z.enum(['x', 'y', 'z']).optional(), // axis along which profile is extruded
  lengthExpr: z.string().optional(), // for extrude; if not set, uses depthExpr
  gltfRef: z.string().optional() // URL or filename for hardware/seal gltfs; null if not available
});

export const TransformSchema = z.object({
  xExpr: z.string(), // e.g. "stileW"; positions
  yExpr: z.string(),
  zExpr: z.string(),
  rotXDeg: z.number().default(0),
  rotYDeg: z.number().default(0),
  rotZDeg: z.number().default(0)
});

export const ComponentInstanceSchema = z.object({
  id: z.string(), // e.g. "leaf_stile_l", "top_rail", "panel_001"
  role: ComponentRoleSchema,
  parametric: z.boolean().default(true),
  geometry: GeometrySchema,
  transform: TransformSchema,
  quantityExpr: z.string().default('1'), // e.g. "2" for left/right stiles, or "(nMullions + 1)" for vertical divisions
  materialRole: MaterialRoleSchema,
  profileSlot: z.string().optional() // if geometry.type='profileExtrude', this should match geometry.profileSlot
});

export type ComponentInstance = z.infer<typeof ComponentInstanceSchema>;

export const VariableSchema = z.object({
  defaultValue: z.number(),
  unit: z.string(), // "mm", "count", etc
  description: z.string().optional()
});

export const DetectedSchema = z.object({
  category: z.enum(['door', 'window', 'frame']), // or extend as needed
  type: z.string(), // e.g. "timber_casement", "french_door", "sliding_sash"
  option: z.string().optional(), // e.g. "glazed_top", "4_panel", "horned"
  confidence: z.number().min(0).max(1) // 0.0 to 1.0
});

export const ProductPlanV1Schema = z.object({
  kind: z.literal('ProductPlanV1'),
  
  detected: DetectedSchema.describe('Category/type/option detected from description/image with confidence'),
  
  dimensions: z.object({
    widthMm: z.number().optional(),
    heightMm: z.number().optional(),
    depthMm: z.number().optional()
  }).describe('May be partial; builder fills defaults'),
  
  materialRoles: z.record(z.string(), MaterialRoleSchema).describe('Semantic role -> material role mapping'),
  
  profileSlots: z.record(
    z.string(),
    z.object({
      profileHint: z.string(), // e.g. "hardwood_2x1", "softwood_2x2"
      source: z.enum(['estimated', 'uploaded']),
      uploadedSvg: z.string().optional() // base64 or URL if uploaded
    })
  ).describe('e.g. { "LEAF_STILE": { profileHint: "hardwood_2x1", source: "estimated" }, ... }'),
  
  components: z.array(ComponentInstanceSchema).describe('Exact component instances with parametric geometry/transform'),
  
  variables: z.record(z.string(), VariableSchema).describe(
    'Named variables used in expressions: pw (product width), ph (product height), sd (standard depth), stileW, railH, etc'
  ),
  
  rationale: z.string().describe('Short explanation of the plan (e.g., "4-panel timber door with 50mm stiles, oak finish")')
});

export type ProductPlanV1 = z.infer<typeof ProductPlanV1Schema>;

/**
 * Fallback: Generate a minimal ProductPlan for a simple 2-panel timber door (safest default).
 * Used when AI parsing fails or schema validation fails.
 */
export function createFallbackDoorPlan(
  widthMm: number = 914,
  heightMm: number = 2032,
  depthMm: number = 45
): ProductPlanV1 {
  return {
    kind: 'ProductPlanV1',
    detected: {
      category: 'door',
      type: 'timber_door',
      option: 'panel',
      confidence: 0.2 // low confidence; this is a fallback
    },
    dimensions: {
      widthMm,
      heightMm,
      depthMm
    },
    materialRoles: {
      frame: 'TIMBER_PRIMARY',
      panel: 'PANEL_CORE',
      glass: 'GLASS_CLEAR',
      seal: 'SEAL_RUBBER',
      hardware: 'METAL_CHROME'
    },
    profileSlots: {
      LEAF_STILE: {
        profileHint: 'hardwood_2x1',
        source: 'estimated'
      },
      LEAF_RAIL: {
        profileHint: 'hardwood_2x1',
        source: 'estimated'
      }
    },
    components: [
      {
        id: 'stile_left',
        role: 'STILE',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_STILE',
          lengthExpr: 'ph'
        },
        transform: {
          xExpr: '0',
          yExpr: '0',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'stile_right',
        role: 'STILE',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_STILE',
          lengthExpr: 'ph'
        },
        transform: {
          xExpr: 'pw - stileW',
          yExpr: '0',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'rail_top',
        role: 'RAIL_TOP',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_RAIL',
          lengthExpr: 'pw'
        },
        transform: {
          xExpr: '0',
          yExpr: 'ph - railH',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'rail_bottom',
        role: 'RAIL_BOTTOM',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_RAIL',
          lengthExpr: 'pw'
        },
        transform: {
          xExpr: '0',
          yExpr: '0',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'panel_lower',
        role: 'PANEL',
        parametric: true,
        geometry: {
          type: 'box',
          widthExpr: 'pw - stileW - stileW',
          heightExpr: '(ph - railH - railH) / 2',
          depthExpr: 'sd'
        },
        transform: {
          xExpr: 'stileW',
          yExpr: 'railH',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'PANEL_CORE'
      }
    ],
    variables: {
      pw: { defaultValue: widthMm, unit: 'mm', description: 'Product width' },
      ph: { defaultValue: heightMm, unit: 'mm', description: 'Product height' },
      sd: { defaultValue: depthMm, unit: 'mm', description: 'Standard depth' },
      stileW: { defaultValue: 50, unit: 'mm', description: 'Stile width' },
      railH: { defaultValue: 50, unit: 'mm', description: 'Rail height' }
    },
    rationale: 'Fallback: simple 2-panel timber door with standard proportions'
  };
}

/**
 * Fallback: Generate a minimal ProductPlan for a simple casement window.
 */
export function createFallbackWindowPlan(
  widthMm: number = 1200,
  heightMm: number = 1200,
  depthMm: number = 80
): ProductPlanV1 {
  return {
    kind: 'ProductPlanV1',
    detected: {
      category: 'window',
      type: 'timber_casement',
      confidence: 0.2
    },
    dimensions: {
      widthMm,
      heightMm,
      depthMm
    },
    materialRoles: {
      frame: 'TIMBER_PRIMARY',
      glass: 'GLASS_CLEAR',
      seal: 'SEAL_RUBBER',
      hardware: 'METAL_CHROME'
    },
    profileSlots: {
      FRAME_JAMB: {
        profileHint: 'hardwood_3x2',
        source: 'estimated'
      },
      LEAF_STILE: {
        profileHint: 'hardwood_2x1_5',
        source: 'estimated'
      },
      LEAF_RAIL: {
        profileHint: 'hardwood_2x1_5',
        source: 'estimated'
      }
    },
    components: [
      {
        id: 'frame_head',
        role: 'FRAME_HEAD',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'FRAME_JAMB',
          lengthExpr: 'pw'
        },
        transform: {
          xExpr: '0',
          yExpr: 'ph',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'leaf_stile_l',
        role: 'STILE',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_STILE',
          lengthExpr: 'ph'
        },
        transform: {
          xExpr: 'frameW',
          yExpr: '0',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'leaf_rail_top',
        role: 'RAIL_TOP',
        parametric: true,
        geometry: {
          type: 'profileExtrude',
          profileSlot: 'LEAF_RAIL',
          lengthExpr: 'leafW'
        },
        transform: {
          xExpr: 'frameW',
          yExpr: 'ph - railH',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'TIMBER_PRIMARY'
      },
      {
        id: 'glass_panel',
        role: 'GLASS',
        parametric: true,
        geometry: {
          type: 'box',
          widthExpr: 'leafW - (2 * stileW)',
          heightExpr: 'ph - (2 * railH)',
          depthExpr: '3.2' // standard 3.2mm float glass
        },
        transform: {
          xExpr: 'frameW + stileW',
          yExpr: 'railH',
          zExpr: '0',
          rotXDeg: 0,
          rotYDeg: 0,
          rotZDeg: 0,
        },
        quantityExpr: '1',
        materialRole: 'GLASS_CLEAR'
      }
    ],
    variables: {
      pw: { defaultValue: widthMm, unit: 'mm', description: 'Product width (outer)' },
      ph: { defaultValue: heightMm, unit: 'mm', description: 'Product height (outer)' },
      sd: { defaultValue: depthMm, unit: 'mm', description: 'Standard depth' },
      frameW: { defaultValue: 45, unit: 'mm', description: 'Frame width' },
      leafW: { defaultValue: widthMm - 90, unit: 'mm', description: 'Leaf width (pw - 2*frameW)' },
      stileW: { defaultValue: 35, unit: 'mm', description: 'Stile width (leaf frame)' },
      railH: { defaultValue: 35, unit: 'mm', description: 'Rail height (leaf frame)' }
    },
    rationale: 'Fallback: simple single-casement window with frame and clear glass'
  };
}
