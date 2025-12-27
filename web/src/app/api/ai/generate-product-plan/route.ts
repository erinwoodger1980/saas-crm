import { NextRequest, NextResponse } from 'next/server';
import { ProductPlanV1Schema, createFallbackDoorPlan, createFallbackWindowPlan } from '@/types/product-plan';

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

const SYSTEM_PROMPT = `You are a master joinery and fabrication expert. Your task is to produce a precise, component-level assembly plan (ProductPlanV1) for timber doors and windows.

A ProductPlanV1 specifies EXACTLY what components are needed, their dimensions, materials, and geometric relationships—suitable for 3D rendering, cutting lists, BOMs, and pricing.

# Constraints

1. **Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations, no arrays of objects.**

2. **Component roles must be one of:**
   STILE, RAIL_TOP, RAIL_MID, RAIL_BOTTOM, PANEL, GLASS, BEAD, FRAME_JAMB_L, FRAME_JAMB_R, FRAME_HEAD, CILL, SEAL, LOCK, HANDLE, HINGE, GLAZING_BAR, MOULDING, THRESHOLD, WEATHERBOARD

3. **Material roles must be one of:**
   TIMBER_PRIMARY, TIMBER_SECONDARY, PANEL_CORE, SEAL_RUBBER, SEAL_FOAM, METAL_CHROME, METAL_STEEL, GLASS_CLEAR, GLASS_LEADED, GLASS_FROSTED, PAINT_FINISH, STAIN_FINISH

4. **Every component must have:**
   - id (unique: e.g. "stile_left", "rail_top", "panel_001", "handle_main")
   - role (enum from list above)
   - geometry.type: "profileExtrude" | "box" | "gltf"
   - geometry.profileSlot (if type='profileExtrude', e.g. "LEAF_STILE")
   - geometry.lengthExpr or widthExpr/heightExpr/depthExpr
   - transform with xExpr, yExpr, zExpr (in mm, using variable names like pw, ph, sd, stileW, etc)
   - quantityExpr (e.g. "1", "2", "(nMullions + 1)")
   - materialRole (one of the enums above)

5. **Expressions use plain identifiers:** pw, ph, sd, stileW, railTop, railBottom, etc. Do NOT use #pw syntax.

6. **Always include minimum components:**
   - For doors: at least 2 stiles, 1 top rail, 1 bottom rail, infill (panels or glass), and if glazing: beads
   - For windows: outer frame, leaf frame (stiles/rails), glass, and if multiple panes: mullions/transoms

7. **Profile slots** (if profileExtrude is used) hint the profile type:
   - FRAME_JAMB: outer frame, e.g. "hardwood_3x2"
   - LEAF_STILE: leaf frame vertical, e.g. "hardwood_2x1"
   - LEAF_RAIL: leaf frame horizontal, e.g. "hardwood_2x1"
   - BEADING: glass beading, e.g. "softwood_1x0_5"
   - MOULDING_OVOLO, MOULDING_OGEE, etc.

8. **Hardware as gltf placeholders:** Include LOCK, HANDLE, HINGE with geometry.type='gltf' and gltfRef=null (no models available yet).

9. **Variables dictionary:** Define pw (product width), ph (product height), sd (standard depth), plus any custom ones used in expressions.

10. **Reasonable ranges (mm):**
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

Return ONLY valid JSON matching the ProductPlanV1 schema. No markdown, no explanations.`;

async function callOpenAI(description: string, existingProductType?: any, existingDims?: any): Promise<ProductPlanV1 | null> {
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
      console.error('[AI2SCENE] OpenAI API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const jsonText = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI2SCENE] No JSON found in OpenAI response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ProductPlanV1Schema.parse(parsed);
    return validated;
  } catch (error) {
    console.error('[AI2SCENE] Error calling OpenAI or parsing response:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, image, existingProductType, existingDims } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description is required and must be a string' },
        { status: 400 }
      );
    }

    // Attempt to generate plan via OpenAI
    let plan = await callOpenAI(description, existingProductType, existingDims);

    // Fallback if AI fails or returns null
    if (!plan) {
      console.warn('[AI2SCENE] Falling back to default plan');
      const category = existingProductType?.category || 'door';
      const w = existingDims?.widthMm || 914;
      const h = existingDims?.heightMm || 2032;
      const d = existingDims?.depthMm || (category === 'window' ? 80 : 45);

      if (category === 'window') {
        plan = createFallbackWindowPlan(w, h, d);
      } else {
        plan = createFallbackDoorPlan(w, h, d);
      }
    }

    // Log summary
    console.log('[AI2SCENE] Generated ProductPlan:', {
      kind: plan.kind,
      detected: plan.detected,
      componentCount: plan.components.length,
      componentsByRole: plan.components.reduce((acc, c) => {
        acc[c.role] = (acc[c.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      profilesEstimated: Object.values(plan.profileSlots).filter(p => p.source === 'estimated').length,
      profilesUploaded: Object.values(plan.profileSlots).filter(p => p.source === 'uploaded').length
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('[AI2SCENE] generate-product-plan error:', error);
    return NextResponse.json(
      { error: 'Failed to generate product plan' },
      { status: 500 }
    );
  }
}
