import { NextRequest, NextResponse } from 'next/server';
import { ProductPlanV1Schema, createFallbackDoorPlan, createFallbackWindowPlan, ProductPlanV1 } from '@/types/product-plan';

/**
 * POST /api/ai/generate-product-plan
 * 
 * Takes a product description (and optionally image) and generates a detailed ProductPlanV1.
 * 
 * This is a component-level assembly plan that drives 3D rendering, BOM, cutlists, and pricing.
 * It replaces simple param patches with exact component instances, geometry expressions, and material roles.
 * 
 * Input:
 *   - description: string (e.g., "4-panel oak timber door with brass hardware")
 *   - image?: string (base64 or URL)
 *   - existingProductType?: { category, type }
 *   - existingDims?: { widthMm, heightMm, depthMm }
 * 
 * Output:
 *   - ProductPlanV1 (strictly validated zod schema)
 *   - If parsing fails, returns a fallback plan
 * 
 * Fallback strategy: If AI response cannot be parsed or validated, we return a safe default
 * (2-panel door or single-casement window) with confidence=0.2. This prevents failures.
 */

const SYSTEM_PROMPT = `You are a master joinery and fabrication expert. Your task is to produce a precise, component-level assembly plan (ProductPlanV1) for timber doors and windows based on detailed product descriptions.

A ProductPlanV1 specifies EXACTLY what components are needed, their dimensions, materials, and geometric relationships—suitable for 3D rendering, cutting lists, BOMs, and pricing.

# CRITICAL: Description Parsing - NEVER FALLBACK LIGHTLY

**You MUST carefully analyze the product description for specific details and generate components that match those details exactly.** Do NOT generate generic defaults. ALWAYS attempt to generate a high-confidence plan based on the description details. Only use fallback if description is truly too vague.

Examples:
- "6-panel door" → generate exactly 6 panels with appropriate rail structure (typically 3 rails for 6 panels)
- "4-panel door" → generate 2 stiles, 3 rails, 4 distinct panels
- "double-hung sash window with 2x2 glazing" → generate TWO sashes, EACH with 2×2 pane layout (4 glass panes per sash, 8 total), with glazing bars dividing them
- "traditional sash window with spring balances" → generate box frame, meeting rails, two sashes, and spring balance references
- "glazed" or "glass" → include glass panes with GLAZING_BAR components, not solid panels
- "Georgian bars" or "muntin bars" → include GLAZING_BAR components dividing panes
- "french door" → generate frame around glass with mullions/transoms
- "hardwood oak" vs "pine" → assign appropriate timber material roles
- "brass hardware" vs "chrome" → use matching metal material roles

## SASH WINDOW SPECIFICS

Sash windows have a distinct structure:

1. **Outer Frame (Box Frame)**:
   - 4 components: left/right jambs (FRAME_JAMB_L, FRAME_JAMB_R), head (FRAME_HEAD), sill/cill (CILL)
   - Frame depth typically 80-150mm

2. **Sashes (Two per window)**:
   - UPPER SASH: contains stiles, rails, and glass panes with glazing bars
   - LOWER SASH: contains stiles, rails, and glass panes with glazing bars
   - Each sash slides vertically on the meeting rail axis

3. **Glazing Pattern (e.g., "2 over 2" = 2×2 per sash)**:
   - "2 over 2" means 2 panes wide × 2 panes high = 4 glass panes per sash
   - For upper sash: generate 4 glass panes + 3 glazing bars (1 vertical, 2 horizontal)
   - For lower sash: generate 4 glass panes + 3 glazing bars (1 vertical, 2 horizontal)
   - Glazing bars are TIMBER_PRIMARY with GLAZING_BAR role

4. **Sash Structure (each sash)**:
   - 2 stiles (left/right edge)
   - 2 rails (top and bottom)
   - 1 meeting rail (centre, shared concept with lower/upper sash)
   - Multiple glass panes GLASS components
   - Glazing bars as GLAZING_BAR components

5. **Meeting Rails & Beads**:
   - Internal staff bead (separates sashes from frame)
   - Parting bead (separates upper and lower sashes)
   - Meeting rails where upper and lower sashes meet

6. **Hardware for Sash Windows**:
   - Sash lifts (on lower sash, usually 2)
   - Sash fastener/lock (at meeting rail, usually 1)
   - Spring balances (internal, not visible)
   - Pulleys/weights (if cord-based; NOT needed if spring balance described)

7. **Generation Rule**:
   If description contains ANY of: "double-hung", "sash window", "two sashes", "spring balance", "meeting rail", "vertically sliding", "2 over 2", "4 over 4", etc.
   → Generate full sash window structure with TWO complete sashes, not simplified casement

**Key Detail Extraction Rules:**
1. **Panel/Pane Count**: Look for numbers (2-panel, 4-panel, "2 over 2", "4 over 4", etc.) and generate exact structure
2. **Sash Type**: Detect "sash", "double-hung", "sliding", "spring balance", "weights" keywords
3. **Glazing Pattern**: "2 over 2" = 2 panes wide × 2 panes high. Multiple sashes? Apply pattern to EACH
4. **Glazing Bars**: Required for panes > 1. Generate GLAZING_BAR components
5. **Hardware Type**: Sash lifts, sash fasteners, spring balances, weights, pulleys
6. **Material**: Extract timber type (oak, pine, sapele, accoya, etc.) and finish (painted, stained, natural, etc.)
7. **Special Features**: Meeting rails, parting beads, staff beads, box frames, spring balance channels

# Constraints

1. **Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations, no arrays of objects.**

2. **If an existing product category is provided (doors or windows), ALWAYS generate a plan for that category.** For example:
   - If "existing product type: category=windows", generate a WINDOW plan with frame, leaf(ves), glass panes, mullions/transoms, or sashes as needed.
   - If "existing product type: category=doors", generate a DOOR plan with frame, stiles, rails, panels/glass, hardware.
   - Do NOT override the provided category based on the description alone.

3. **Component roles must be one of:**
   STILE, RAIL_TOP, RAIL_MID, RAIL_BOTTOM, PANEL, GLASS, BEAD, FRAME_JAMB_L, FRAME_JAMB_R, FRAME_HEAD, CILL, SEAL, LOCK, HANDLE, HINGE, GLAZING_BAR, MOULDING, THRESHOLD, WEATHERBOARD

4. **Material roles must be one of:**
   TIMBER_PRIMARY, TIMBER_SECONDARY, PANEL_CORE, SEAL_RUBBER, SEAL_FOAM, METAL_CHROME, METAL_STEEL, GLASS_CLEAR, GLASS_LEADED, GLASS_FROSTED, PAINT_FINISH, STAIN_FINISH

5. **Every component must have:**
   - id (unique: e.g. "stile_left", "rail_top", "panel_001", "handle_main")
   - role (enum from list above)
   - geometry.type: "profileExtrude" | "box" | "gltf"
   - geometry.profileSlot (if type='profileExtrude', e.g. "LEAF_STILE")
   - geometry.lengthExpr or widthExpr/heightExpr/depthExpr
   - transform with xExpr, yExpr, zExpr (in mm, using variable names like pw, ph, sd, stileW, etc)
   - quantityExpr (e.g. "1", "2", "(nMullions + 1)")
   - materialRole (one of the enums above)

6. **Expressions use plain identifiers:** pw, ph, sd, stileW, railTop, railBottom, etc. Do NOT use #pw syntax.

7. **Rail Structure Rules:**
   - 2-panel door: 2 stiles, 2 rails (top + bottom), creates 2 vertical areas
   - 4-panel door: 2 stiles, 3 rails (top, middle, bottom), creates 2×2 grid
   - 6-panel door: 2 stiles, 4 rails, creates 2×3 grid
   - Sash window with 2x2 glazing: TWO sashes, EACH with 2 stiles + 2 rails + 4 glass panes + glazing bars

8. **Glazing Bar Rules**:
   - For "2 over 2" (2×2 grid of panes): need 1 vertical bar + 2 horizontal bars = 3 bars per sash
   - For "4 over 4" (4×4 grid = 16 panes): need 3 vertical bars + 3 horizontal bars = 6 bars per sash
   - Glazing bars are TIMBER_PRIMARY role, GLAZING_BAR role
   - Position bars to divide panes evenly

9. **Profile slots** (if profileExtrude is used):
   - FRAME_JAMB: outer frame jambs, e.g. "hardwood_3x2"
   - LEAF_STILE: sash stile (vertical), e.g. "hardwood_2x1"
   - LEAF_RAIL: sash rail (horizontal), e.g. "hardwood_2x1"
   - GLAZING_BAR: thin bar dividing glass, e.g. "hardwood_0.5x0.5"
   - BEADING: glass beading, e.g. "softwood_1x0_5"

10. **Hardware for Sash Windows**: Include HANDLE (sash lifts) and LOCK (sash fastener), typically gltf placeholders. For 2-sash window: usually 2 sash lifts on lower sash, 1 sash fastener at meeting rail.

11. **Variables dictionary:** Define pw (product width), ph (product height), sd (standard depth), nSashes (e.g., 2), nPanesWide (e.g., 2), nPanesHigh (e.g., 2), plus custom ones.

12. **Reasonable ranges (mm):**
    - Stile width: 35-100
    - Rail height: 35-100
    - Glazing bar thickness: 8-20
    - Frame depth: 35-150
    - Glass thickness: 3-6 (float) or 6-8 (safety) or 24-28 (double-glazed unit)
    - Glass thickness: 3-6 (float) or 6-8 (safety)

---

# Example (4-panel oak timber door)

\`\`\`json
{
  "kind": "ProductPlanV1",
  "detected": {
    "category": "door",
    "type": "timber_door",
    "option": "4_panel",
    "confidence": 0.85
  },
  "dimensions": {
    "widthMm": 914,
    "heightMm": 2032,
    "depthMm": 45
  },
  "materialRoles": {
    "frame": "TIMBER_PRIMARY",
    "panel": "PANEL_CORE",
    "seal": "SEAL_RUBBER",
    "hardware": "METAL_CHROME"
  },
  "profileSlots": {
    "LEAF_STILE": {
      "profileHint": "oak_2x1",
      "source": "estimated"
    },
    "LEAF_RAIL": {
      "profileHint": "oak_2x1",
      "source": "estimated"
    }
  },
  "components": [
    {
      "id": "stile_left",
      "role": "STILE",
      "parametric": true,
      "geometry": {
        "type": "profileExtrude",
        "profileSlot": "LEAF_STILE",
        "lengthExpr": "ph"
      },
      "transform": {
        "xExpr": "0",
        "yExpr": "0",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "TIMBER_PRIMARY"
    },
    {
      "id": "stile_right",
      "role": "STILE",
      "parametric": true,
      "geometry": {
        "type": "profileExtrude",
        "profileSlot": "LEAF_STILE",
        "lengthExpr": "ph"
      },
      "transform": {
        "xExpr": "pw - stileW",
        "yExpr": "0",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "TIMBER_PRIMARY"
    },
    {
      "id": "rail_top",
      "role": "RAIL_TOP",
      "parametric": true,
      "geometry": {
        "type": "profileExtrude",
        "profileSlot": "LEAF_RAIL",
        "lengthExpr": "pw"
      },
      "transform": {
        "xExpr": "0",
        "yExpr": "ph - railH",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "TIMBER_PRIMARY"
    },
    {
      "id": "rail_mid",
      "role": "RAIL_MID",
      "parametric": true,
      "geometry": {
        "type": "profileExtrude",
        "profileSlot": "LEAF_RAIL",
        "lengthExpr": "pw"
      },
      "transform": {
        "xExpr": "0",
        "yExpr": "ph / 2",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "TIMBER_PRIMARY"
    },
    {
      "id": "rail_bottom",
      "role": "RAIL_BOTTOM",
      "parametric": true,
      "geometry": {
        "type": "profileExtrude",
        "profileSlot": "LEAF_RAIL",
        "lengthExpr": "pw"
      },
      "transform": {
        "xExpr": "0",
        "yExpr": "0",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "TIMBER_PRIMARY"
    },
    {
      "id": "panel_tl",
      "role": "PANEL",
      "parametric": true,
      "geometry": {
        "type": "box",
        "widthExpr": "pw - stileW - stileW",
        "heightExpr": "(ph - railH - railH - railH) / 2",
        "depthExpr": "sd"
      },
      "transform": {
        "xExpr": "stileW",
        "yExpr": "railH + ((ph - railH - railH - railH) / 2)",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "PANEL_CORE"
    },
    {
      "id": "panel_br",
      "role": "PANEL",
      "parametric": true,
      "geometry": {
        "type": "box",
        "widthExpr": "pw - stileW - stileW",
        "heightExpr": "(ph - railH - railH - railH) / 2",
        "depthExpr": "sd"
      },
      "transform": {
        "xExpr": "stileW",
        "yExpr": "railH",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "PANEL_CORE"
    },
    {
      "id": "handle_main",
      "role": "HANDLE",
      "parametric": false,
      "geometry": {
        "type": "gltf",
        "gltfRef": null
      },
      "transform": {
        "xExpr": "pw / 2",
        "yExpr": "ph * 0.6",
        "zExpr": "0"
      },
      "quantityExpr": "1",
      "materialRole": "METAL_CHROME"
    }
  ],
  "variables": {
    "pw": { "defaultValue": 914, "unit": "mm", "description": "Product width" },
    "ph": { "defaultValue": 2032, "unit": "mm", "description": "Product height" },
    "sd": { "defaultValue": 45, "unit": "mm", "description": "Standard depth" },
    "stileW": { "defaultValue": 50, "unit": "mm", "description": "Stile width" },
    "railH": { "defaultValue": 50, "unit": "mm", "description": "Rail height" }
  },
  "rationale": "4-panel oak door with stiles, mid-rail, and lower/upper panels; standard brass hardware"
}
\`\`\`

**Another example: 6-panel door structure**

For a 6-panel timber door (2 columns × 3 rows), you need:
- 2 stiles (left/right)
- 3 rails: top, middle (separating upper 2 panels), middle-lower (separating middle 2 from lower 2), bottom = creates 2×3 grid
- 6 panels (organized in 2 columns, 3 rows)
- 3 hinges, 1 handle, 1 lock
- The middle rail splits the door into upper-middle and lower-middle sections

---

# Task

Given the product description (and optional image), generate a ProductPlanV1 JSON that:
1. Detects the category (door/window/frame) and type (timber_door, timber_casement, etc.)
2. Assigns reasonable dimensions (or uses existing if provided).
3. Lists every component with role, geometry, transform, and material.
4. Includes all necessary structure (frame, stiles, rails, infill, hardware, beads if glazed).
5. Uses parametric expressions so the plan scales to different sizes.
6. Assigns semantic material roles (TIMBER_PRIMARY, PANEL_CORE, GLASS_CLEAR, etc.) per component.

**Output ONLY valid JSON. No other text.**`;


const EXAMPLE_USER_PROMPT = `Product Description: {description}

{existingInfo}

CRITICAL ANALYSIS INSTRUCTIONS - FOLLOW EXACTLY:

1. **Identify Product Type Keywords**:
   - Sash: "double-hung", "sash window", "vertically sliding", "spring balance", "meeting rail", "parting bead"
   - Glazing: "glazed", "glass", "pane", "2 over 2", "4 over 4", "glazing bars", "Georgian", "muntin"
   - Panels: "panel", "rail", "stile"
   - Material: timber type (oak, pine, sapele, accoya, etc.)
   - Hardware: hardware type (brass, chrome, sash lift, sash fastener, spring balance, etc.)

2. **Sash Window Rules** (if description contains sash/double-hung keywords):
   - ALWAYS generate TWO complete sashes (upper + lower)
   - Each sash gets its own stiles, rails, and glass panes
   - If "2 over 2": Each sash has 2×2=4 glass panes + 3 glazing bars
   - If "4 over 4": Each sash has 4×4=16 glass panes + 6+ glazing bars
   - Add box frame (left/right jambs, head, cill)
   - Add meeting rails and beads
   - Add sash hardware (lifts, fasteners, spring balance references)
   - Confidence should be HIGH (80%+) if sash keywords present

3. **Door Panel Rules** (if description contains door keywords):
   - Count exact panels mentioned (2-panel, 4-panel, 6-panel)
   - Generate correct number of rails: (N panels / 2 columns) + 1
   - If glazed: use glass panes + beading instead of solid panels

4. **Glazing Bar Rules** (if glass panes > 1):
   - Required for any divided pane layout
   - "2 over 2" = 1 vertical bar + 2 horizontal = 3 total bars
   - "4 over 4" = 3 vertical + 3 horizontal = 6+ bars
   - Position to divide glass evenly
   - Use role GLAZING_BAR, material TIMBER_PRIMARY

5. **Material Assignment**:
   - Extract timber type from description (oak, pine, sapele, accoya, etc.)
   - Assign TIMBER_PRIMARY to frame/stiles/rails/beads
   - Match paint/stain finish if mentioned
   - Match hardware material (brass=METAL_CHROME, chrome=METAL_CHROME, steel=METAL_STEEL)

6. **Confidence Level**:
   - HIGH (80%+): Clear sash/door keywords, panel count, glazing pattern specified
   - MEDIUM (60%): Some details vague but category clear
   - LOW (20%): Only generic "window" or "door", must fall back
   - NEVER return 20% confidence if description is detailed with specific measurements/types

CRITICAL: If an existing product category is specified above, you MUST generate a plan for that category only. Do not override it based on the description.

Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations.`;

type AiCallResult = { plan: ProductPlanV1 | null; error?: string; detail?: any };

async function callOpenAI(description: string, existingProductType?: any, existingDims?: any): Promise<AiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPENAI_APIKEY;
  if (!apiKey) {
    console.error('[AI2SCENE] Missing OpenAI API key in server environment (OPENAI_API_KEY)');
    return { plan: null, error: 'missing_openai_api_key' };
  }

  try {
    // Build user prompt
    let existingInfo = '';
    if (existingProductType) {
      existingInfo += `Existing product type: category="${existingProductType.category}", type="${existingProductType.type}".\n`;
    }
    if (existingDims) {
      existingInfo += `Existing dimensions: ${existingDims.widthMm}×${existingDims.heightMm}×${existingDims.depthMm} mm.\n`;
    }

    const userPrompt = EXAMPLE_USER_PROMPT
      .replace('{description}', description)
      .replace('{existingInfo}', existingInfo);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        // Enforce JSON output to reduce fallback due to formatting.
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[AI2SCENE] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        bodySnippet: errText?.slice(0, 500) ?? '',
      });
      return { plan: null, error: 'openai_response_not_ok', detail: { status: response.status, statusText: response.statusText } };
    }

    const raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('[AI2SCENE] Failed to parse OpenAI JSON response', { error: String(e), rawSnippet: raw.slice(0, 500) });
      return { plan: null, error: 'openai_json_parse_failed' };
    }

    const jsonText = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (defensive, though response_format should already enforce JSON)
    const trimmed = typeof jsonText === 'string' ? jsonText.trim() : '';
    const jsonCandidate = trimmed.startsWith('{') ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? '');
    if (!jsonCandidate) {
      console.error('[AI2SCENE] No JSON found in OpenAI response', { contentSnippet: String(jsonText).slice(0, 500) });
      return { plan: null, error: 'no_json_in_response' };
    }

    const parsed = JSON.parse(jsonCandidate);
    const validated = ProductPlanV1Schema.parse(parsed);

    return { plan: validated };
  } catch (error: any) {
    console.error('[AI2SCENE] Error in callOpenAI:', error.message || String(error));
    return { plan: null, error: error.message || 'unknown_error', detail: error };
  }
}

// Fallback generators if OpenAI fails
function createFallback(category: string, existingDims?: any): ProductPlanV1 {
  const w = Number(existingDims?.widthMm);
  const h = Number(existingDims?.heightMm);
  const d = Number(existingDims?.depthMm);
  const widthMm = Number.isFinite(w) && w > 0 ? w : undefined;
  const heightMm = Number.isFinite(h) && h > 0 ? h : undefined;
  const depthMm = Number.isFinite(d) && d > 0 ? d : undefined;

  if (category === 'windows') {
    return createFallbackWindowPlan(widthMm ?? 1200, heightMm ?? 1200, depthMm ?? 80);
  }
  return createFallbackDoorPlan(widthMm ?? 914, heightMm ?? 2032, depthMm ?? 45);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, image, existingProductType, existingDims } = body;

    console.log('[AI2SCENE] POST /api/ai/generate-product-plan', {
      hasDescription: !!description,
      hasImage: !!image,
      existingProductType,
      existingDims,
    });

    // Call OpenAI to generate ProductPlan
    const aiResult = await callOpenAI(description, existingProductType, existingDims);

    if (aiResult.plan) {
      console.log('[AI2SCENE] Generated ProductPlan:', {
        kind: aiResult.plan.kind,
        detected: aiResult.plan.detected,
        numComponents: aiResult.plan.components.length,
      });
      const res = NextResponse.json(aiResult.plan);
      res.headers.set('x-ai-fallback', '0');
      return res;
    }

    // Fallback to safe default
    console.log('[AI2SCENE] Falling back to default plan, error:', aiResult.error);
    const fallback = createFallback(
      existingProductType?.category || 'doors',
      existingDims
    );

    const res = NextResponse.json(fallback);
    res.headers.set('x-ai-fallback', '1');
    if (aiResult.error) res.headers.set('x-ai-error', String(aiResult.error).slice(0, 200));
    return res;
  } catch (error) {
    console.error('[AI2SCENE] Error in POST handler:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
