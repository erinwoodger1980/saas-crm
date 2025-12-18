/**
 * Curve System Test Scenarios
 * Demonstrates practical usage of the unified parametric curves system
 */

// ========================================
// SCENARIO 1: ARCHED DOOR (E03)
// ========================================

import { segmentalArchToCurve } from '@/lib/scene/curve-utils';
import { doorBuilder } from '@/lib/scene/parametric-door';
import { ProductParams } from '@/types/parametric-builder';

// User configures an arched entrance door, 914mm wide × 2032mm tall, glazed top
const archedDoorParams: ProductParams = {
  productType: {
    category: 'doors',
    type: 'entrance',
    option: 'E03', // Glazed top with optional arch
  },
  dimensions: {
    width: 914,
    height: 2032,
    depth: 45, // 45mm thickness
  },
  construction: {
    stileWidth: 114,
    topRail: 114,
    bottomRail: 200,
    midRail: 0, // No middle rail for arch
    timber: 'oak',
    finish: 'natural',
    glazingType: 'double-glazed',
  },
  // CURVES: Define the arched head
  curves: [
    segmentalArchToCurve(914, 300), // 914mm span, 300mm rise above spring line
  ],
  curveSlots: {
    headProfileCurveId: 'segmental-arch-914x300', // Use segmental arch for head
  },
};

// Build the door with curve support
const archedDoorResult = doorBuilder.build(archedDoorParams);

// Result structure:
// components[0] = "product" (door leaf group)
//   ├─ "frame" (frame group)
//   │   ├─ frame_leftStile
//   │   ├─ frame_rightStile
//   │   ├─ frame_topRail (standard for bottom part)
//   │   ├─ frame_bottomRail
//   │   └─ archHead (NEW - curve-based)
//   │       ├─ arch_topRail (shapeExtrude geometry following curve)
//   │       ├─ arch_glazing (glass infill under arch)
//   │       └─ arch_glazingBeads (timber beads)
//   └─ "infill" (panels below arch)
//
// Geometry types used:
// - arch_topRail: type='shapeExtrude' (Frame outline as 2D shape extruded 45mm)
// - arch_glazing: type='shapeExtrude' (Glass shape extruded 24mm)
// - arch_glazingBeads: type='shapeExtrude' (Bead profile extruded 20mm)

// Database persistence:
// SceneState table:
// {
//   tenantId: 'org-123',
//   entityType: 'quoteLineItem',
//   entityId: 'line-456',
//   config: {
//     customData: {
//       curves: [{
//         id: 'segmental-arch-914x300',
//         name: 'Segmental arch 914mm × 300mm',
//         type: 'arc',
//         plane: 'XY',
//         arc: {
//           cx: 457,           // center X (middle of span)
//           cy: -621.5,        // center Y (calculated from span/rise formula)
//           r: 621.5,          // radius (calculated)
//           startAngle: 2.356, // radians (PI - asin(457/621.5))
//           endAngle: 0.785,   // radians (asin(457/621.5))
//         },
//         usage: 'head',
//         resolution: 64,      // 64 segments for smooth curve
//       }],
//       curveSlots: {
//         headProfileCurveId: 'segmental-arch-914x300'
//       }
//     }
//   }
// }

// ========================================
// SCENARIO 2: USER EDITS ARCH (LIVE)
// ========================================

// User opens ConfiguratorModal, sees arched door rendered
// User selects the arch component (clicks on glass area)
// Inspector shows CurveEditor with presets tab active
// User adjusts:
//   - Span slider stays at 914mm (width is fixed)
//   - Rise slider from 300mm to 400mm
// User clicks "Apply Preset"

const editedArchCurve = segmentalArchToCurve(914, 400); // New rise = 400mm

// Curve updates in customData
// Scene rebuilds:
// 1. convertCurveToShape(editedArchCurve) generates new 2D shape
// 2. arch_topRail geometry regenerated with new shape boundary
// 3. arch_glazing shape updated to new size
// 4. Beads offset accordingly
// 5. Components re-rendered in Three.js
// 6. Camera preserved (same view angle)
// 7. Scene auto-persisted to database (500ms debounce)

// ========================================
// SCENARIO 3: WINDOW WITH FANLIGHTS
// ========================================

import { radiusHeadToCurve } from '@/lib/scene/curve-utils';
import { buildFanlightComponent } from '@/lib/scene/parametric-window-curves';

const windowWithFanlight: ProductParams = {
  productType: {
    category: 'windows',
    type: 'casement',
    option: 'W02', // Double casement
  },
  dimensions: {
    width: 1200,
    height: 1500,
    depth: 100, // Frame depth (profile)
  },
  construction: {
    mullions: 1,      // Vertical split
    transoms: 1,      // Horizontal split (for fanlight area)
    timber: 'pine',
    finish: 'painted',
    glazingType: 'double-glazed',
  },
  // Fanlight curve: radius head
  curves: [
    radiusHeadToCurve(
      600,    // radius in mm
      1200,   // spring line height (bottom of fanlight opening)
      1200    // span (width of opening)
    ),
  ],
  curveSlots: {
    fanlightCurveId: 'radius-head-600', // Curved fanlight above main sashes
  },
};

// Rendering:
// components[0] = "window" (group)
//   ├─ "frame" (outer frame: head, sill, jambs)
//   ├─ "sashes" (rectangular casement sashes below fanlight)
//   │   ├─ sash_1 (left side)
//   │   └─ sash_2 (right side)
//   └─ "fanlight" (NEW - curve-based component)
//       ├─ fanlight_frame (type='shapeExtrude', follows radius curve)
//       ├─ fanlight_glass (type='shapeExtrude', double glazed)
//       └─ fanlight_beads (glazing beads around curve)

// ========================================
// SCENARIO 4: CURVED GLAZING BAR (MUNTIN)
// ========================================

import { buildCurvedGlazingBar } from '@/lib/scene/parametric-window-curves';

// Window with a single curved horizontal glazing bar
// (creates artistic divided light effect)

const windowWithCurvedBar: ProductParams = {
  productType: {
    category: 'windows',
    type: 'casement',
    option: 'W01',
  },
  dimensions: {
    width: 1500,
    height: 1200,
    depth: 100,
  },
  construction: {
    timber: 'oak',
    glazingType: 'double-glazed',
  },
  curves: [
    {
      id: 'glazing_bar_curved_1',
      name: 'Curved horizontal muntin (gentle arc)',
      type: 'arc',
      plane: 'XY',
      usage: 'glazingBarPath',
      arc: {
        cx: 750,        // center X (middle of width)
        cy: 50,         // center Y (slight upward curve)
        r: 2000,        // very large radius = gentle curve
        startAngle: -0.15,
        endAngle: 0.15,
        clockwise: false,
      },
      resolution: 64,
      thickness: 3,    // Bar thickness in mm
    },
  ],
  curveSlots: {
    glazingBarPaths: ['glazing_bar_curved_1'],
  },
};

// Rendering:
// components[0] = "window" (group)
//   ├─ "frame"
//   ├─ "glazingBar_curved_1" (NEW - type='tube' geometry)
//   │   Geometry: TubeGeometry(
//   │     path: arc centered at (750,50) r=2000,
//   │     tubularSegments: 64,
//   │     radius: 1.5,         // 3mm / 2
//   │     radialSegments: 8
//   │   )
//   └─ "glazing" (4 panes that wrap around the curved bar)

// ========================================
// SCENARIO 5: GOTHIC ARCH DOOR
// ========================================

import { gothicArchToCurve } from '@/lib/scene/curve-utils';

const gothicDoor: ProductParams = {
  productType: {
    category: 'doors',
    type: 'entrance',
    option: 'E03',
  },
  dimensions: {
    width: 914,
    height: 2400, // Taller for gothic effect
    depth: 58,
  },
  construction: {
    stileWidth: 120,
    bottomRail: 250,
    timber: 'oak',
    finish: 'stained',
  },
  curves: [
    gothicArchToCurve(
      914,      // span
      400,      // apex height above spring line
      250       // shoulder radius (creates two-arc gothic look)
    ),
  ],
  curveSlots: {
    headProfileCurveId: 'gothic-arch-914x400',
  },
};

// Result: Door with pointed arch head, each side curves inward to peak
// Geometry: shapeExtrude with bezier or two-arc boundary

// ========================================
// SCENARIO 6: ADVANCED - OFFSET MOULDING
// ========================================

import { offsetCurve } from '@/lib/scene/curve-utils';

// User wants arched door with decorative moulding offset from main frame

const moldedArchDoor: ProductParams = {
  productType: {
    category: 'doors',
    type: 'entrance',
    option: 'E03',
  },
  dimensions: {
    width: 914,
    height: 2032,
    depth: 58,
  },
  construction: {
    stileWidth: 114,
    bottomRail: 200,
    timber: 'walnut',
    finish: 'polished',
  },
  curves: [
    segmentalArchToCurve(914, 300),
    // Decorative moulding offset outward from arch
    offsetCurve(
      segmentalArchToCurve(914, 300),
      25 // 25mm outward offset
    ),
  ],
  curveSlots: {
    headProfileCurveId: 'segmental-arch-914x300',
    mouldingPaths: ['segmental-arch-914x300-offset-25'],
  },
};

// Result:
// - Main arch frame
// - Decorative moulding ring offset 25mm outward
// - Both follow same curve profile but at different depths

// ========================================
// SCENARIO 7: PERSISTENCE & RELOAD
// ========================================

// User creates arched door (Scenario 1)
// Scene persisted to database with curves data
// Next day, user reopens same quote

// API calls: GET /api/scene-state?tenantId=org-123&entityType=quoteLineItem&entityId=line-456

// Response includes:
// {
//   config: {
//     customData: {
//       curves: [{ /* arch definition */ }],
//       curveSlots: { headProfileCurveId: '...' }
//     }
//   }
// }

// ProductConfigurator3D:
// 1. Loads SceneConfig from API
// 2. Initializes scene with loaded config
// 3. Calls doorBuilder.build(params) with customData.curves
// 4. Arch renders exactly as before (deterministic from parametric definition)
// 5. User can immediately edit (CurveEditor opens)

// ========================================
// SCENARIO 8: AI SUGGEST - CURVES
// ========================================

// Future: POST /api/ai/suggest-components
// Input: door dimensions (914×2032), product type, description "formal entrance with arch"
// Output includes:
// {
//   suggestedCurves: [
//     {
//       id: 'suggested-arch-1',
//       name: 'Segmental arch (300mm rise)',
//       type: 'arc',
//       arc: { /* pre-calculated for 914 width */ },
//       usage: 'head',
//       confidence: 0.92
//     }
//   ],
//   suggestedComponentTypes: [
//     { code: 'GLAZING_BEAD', variantCode: 'OAK_NATURAL', forSlot: 'arch_glazingBeads' }
//   ]
// }

// User sees "AI Suggest" panel with arch recommendation
// Clicks "Apply" → arch added to scene
// Edits rise to preference
// Saves

// ========================================
// IMPLEMENTATION CHECKLIST
// ========================================

/*
✅ Curves stored in customData.curves[] (parametric, not tessellated)
✅ Curve slots reference curves by ID
✅ convertCurveToShape() generates THREE.Shape from definition
✅ shapeExtrude geometry renders 2D shapes as 3D solids
✅ tube geometry renders paths as tubes (for glazing bars)
✅ Joinery presets (segmental arch, radius head, gothic arch)
✅ CurveEditor with preset mode + advanced mode
✅ Live editing with rebuild
✅ Scene persistence to database
✅ Build system verification (TypeScript, no errors)
✅ Selection/highlighting for curved components
✅ Offset curve support (for mouldings)

TODO: 
- [ ] AI suggest endpoint enhancement (suggest curves)
- [ ] Component addition UI (add curves to scene)
- [ ] Comprehensive rendering tests
- [ ] Performance benchmarking (high-res curves)
*/

// ========================================
// USAGE IN QUOTE BUILDER
// ========================================

// Quote detail page → ParsedLinesTable
// Line item with door: "Entrance door 914×2032"
// "3D" button appears (canConfigure returns true)
// Click → ConfiguratorModal opens
// ProductConfigurator3D renders with door
// User can immediately use CurveEditor to add arches

export { archedDoorParams, windowWithFanlight, windowWithCurvedBar, gothicDoor };
