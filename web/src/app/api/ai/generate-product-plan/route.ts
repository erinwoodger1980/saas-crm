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

# CRITICAL: Description Parsing

**You MUST carefully analyze the product description for specific details and generate components that match those details exactly.** Do NOT generate generic defaults. Examples:

- If description mentions "6-panel door" → generate exactly 6 panels with appropriate rail structure (typically 3 rails for 6 panels)
- If description mentions "4-panel door" → generate 2 stiles, 3 rails, 4 distinct panels
- If description mentions "glazed" or "glass" → include glass panes with beading, not solid panels
- If description mentions "Georgian bars" or "muntin bars" → include glazing bars dividing panes
- If description mentions "french door" → generate frame around glass with mullions/transoms
- If description mentions "hardwood oak" vs "pine" → assign appropriate timber material roles
- If description mentions "brass hardware" vs "chrome" → use matching metal material roles
- If description mentions specific hardware like "mortice lock" or "lever handle" → include in components

**Key Detail Extraction Rules:**
1. **Panel Count**: Look for numbers (2-panel, 4-panel, 6-panel, 10-panel, etc.) and generate the exact rail/panel structure
2. **Glazing**: Look for keywords: glass, glazed, pane, french, georgian, leaded, frosted, etc.
3. **Glazing Pattern**: Georgian bars split glass into multiple panes. Count mentioned panes (e.g., "6 pane" = 2×3 grid of glass)
4. **Hardware Type**: Look for lock type, handle style, hinge count, etc.
5. **Material**: Extract timber type (oak, pine, sapele, etc.) and finish (painted, stained, natural, etc.)
6. **Special Features**: Muntins, mullions, transoms, threshold, weatherboard, seals, etc.

# Constraints

1. **Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations, no arrays of objects.**

2. **If an existing product category is provided (doors or windows), ALWAYS generate a plan for that category.** For example:
   - If "existing product type: category=windows", generate a WINDOW plan with frame, leaf(ves), glass panes, mullions/transoms as needed.
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
   - 2-panel door: 2 stiles, 2 rails (top + bottom) = 1 rail between panels, creates 2 vertical areas
   - 4-panel door: 2 stiles, 3 rails (top, middle, bottom) = 2 rails between panels, creates 2×2 grid
   - 6-panel door: 2 stiles, 3 rails (top, upper-middle, lower-middle, bottom) = 3 rails between panels (2 used), creates 2×3 grid
   - 10-panel door: 2 stiles, 5 rails needed to create 2×5 grid of panels
   - **Calculate: For N panels in 2 columns: need (N/2 + 1) horizontal rails**

8. **Profile slots** (if profileExtrude is used) hint the profile type:
   - FRAME_JAMB: outer frame, e.g. "hardwood_3x2"
   - LEAF_STILE: leaf frame vertical, e.g. "hardwood_2x1"
   - LEAF_RAIL: leaf frame horizontal, e.g. "hardwood_2x1"
   - BEADING: glass beading, e.g. "softwood_1x0_5"
   - MOULDING_OVOLO, MOULDING_OGEE, etc.

9. **Hardware as gltf placeholders:** Include LOCK, HANDLE, HINGE with geometry.type='gltf' and gltfRef=null (no models available yet). Include appropriate quantities (e.g., 3 hinges for standard doors).

10. **Variables dictionary:** Define pw (product width), ph (product height), sd (standard depth), plus any custom ones used in expressions (e.g., nPanels, railH, stileW, etc.).

11. **Reasonable ranges (mm):**
    - Stile width: 35–100
    - Rail height: 35–100
    - Panel thickness: 12–25
    - Frame depth: 35–150
    - Glass thickness: 3–6 (float) or 6–8 (safety)

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

CRITICAL ANALYSIS INSTRUCTIONS:
1. Parse the description for specific details: panel count, glazing, hardware type, material, finish
2. If you see "6-panel" generate 6 distinct panels with appropriate rail structure (3 rails minimum)
3. If you see "4-panel" generate 4 panels with 3 rails in a 2×2 arrangement
4. If you see "glazed" or "glass" generate glass panes with beading, NOT solid panels
5. If you see material type (oak, pine, sapele) reflect it in the component materials
6. If you see hardware type (brass, chrome, stainless) reflect it in the hardware material roles
7. Generate components that EXACTLY match the description, not generic defaults

CRITICAL: If an existing product category is specified above, you MUST generate a plan for that category only. Do not override it based on the description.

Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations.`;

type AiCallResult = { plan: ProductPlanV1 | null; error?: string; detail?: any };

async function callOpenAI(description: string, existingProductType?: any, existingDims?: any): Promise<AiCallResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[AI2SCENE] Missing OPENAI_API_KEY in server environment');
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
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

    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI2SCENE] No JSON found in OpenAI response', { contentSnippet: jsonText.slice(0, 500) });
      return { plan: null, error: 'no_json_in_response' };
    }

    const jsonText2 = jsonMatch[0];
    const parsed = JSON.parse(jsonText2);
    const validated = ProductPlanV1Schema.parse(parsed);

    return { plan: validated };
  } catch (error: any) {
    console.error('[AI2SCENE] Error in callOpenAI:', error.message || String(error));
    return { plan: null, error: error.message || 'unknown_error', detail: error };
  }
}

// Fallback generators if OpenAI fails
function createFallback(category: string, existingDims?: any): ProductPlanV1 {
  if (category === 'windows') {
    return createFallbackWindowPlan(existingDims);
  }
  return createFallbackDoorPlan(existingDims);
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
      return NextResponse.json(aiResult.plan);
    }

    // Fallback to safe default
    console.log('[AI2SCENE] Falling back to default plan, error:', aiResult.error);
    const fallback = createFallback(
      existingProductType?.category || 'doors',
      existingDims
    );

    return NextResponse.json(fallback);
  } catch (error) {
    console.error('[AI2SCENE] Error in POST handler:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
