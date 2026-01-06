/**
 * AI Component Estimator API
 * Analyzes images or descriptions to estimate product components,
 * sizes, profiles, and positions for doors, windows, and joinery
 */

import { Router } from 'express';
import openai from '../ai';
import multer from 'multer';
import { z } from 'zod';
import { generateEstimatedProfile } from '../lib/svg-profile-generator';
import { prisma } from '../prisma';

// ProductPlan (AI2SCENE)
const DetectedSchema = z.object({
  category: z.enum(['door', 'window', 'frame']),
  type: z.string(),
  option: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

const VariableSchema = z.object({
  defaultValue: z.number(),
  unit: z.string(),
  description: z.string().optional(),
});

const ProductPlanV1Schema = z.object({
  kind: z.literal('ProductPlanV1'),
  detected: DetectedSchema,
  dimensions: z.object({
    widthMm: z.number().optional(),
    heightMm: z.number().optional(),
    depthMm: z.number().optional(),
  }),
  materialRoles: z.record(z.string(), z.string()),
  profileSlots: z.record(
    z.string(),
    z.object({
      profileHint: z.string(),
      source: z.enum(['estimated', 'uploaded']),
      uploadedSvg: z.string().optional(),
    })
  ),
  components: z.array(z.any()),
  variables: z.record(z.string(), VariableSchema),
  rationale: z.string(),
});

type ProductPlanV1 = z.infer<typeof ProductPlanV1Schema>;

function createFallbackDoorPlan(
  widthMm = 914,
  heightMm = 2032,
  depthMm = 45,
  reason?: string
): ProductPlanV1 {
  return {
    kind: 'ProductPlanV1',
    detected: { category: 'door', type: 'timber_door', option: 'panel', confidence: 0.2 },
    dimensions: { widthMm, heightMm, depthMm },
    materialRoles: {
      frame: 'TIMBER_PRIMARY',
      panel: 'PANEL_CORE',
      glass: 'GLASS_CLEAR',
      seal: 'SEAL_RUBBER',
      hardware: 'METAL_CHROME',
    },
    profileSlots: {
      LEAF_STILE: { profileHint: 'hardwood_2x1', source: 'estimated' },
      LEAF_RAIL: { profileHint: 'hardwood_2x1', source: 'estimated' },
    },
    components: [],
    variables: {
      pw: { defaultValue: widthMm, unit: 'mm', description: 'Product width (outer)' },
      ph: { defaultValue: heightMm, unit: 'mm', description: 'Product height (outer)' },
      sd: { defaultValue: depthMm, unit: 'mm', description: 'Standard depth' },
    },
    rationale: `Fallback: simple 2-panel timber door with standard proportions${reason ? ` (reason: ${reason})` : ''}`,
  };
}

function createFallbackWindowPlan(
  widthMm = 1200,
  heightMm = 1200,
  depthMm = 80,
  reason?: string
): ProductPlanV1 {
  return {
    kind: 'ProductPlanV1',
    detected: { category: 'window', type: 'timber_casement', confidence: 0.2 },
    dimensions: { widthMm, heightMm, depthMm },
    materialRoles: {
      frame: 'TIMBER_PRIMARY',
      glass: 'GLASS_CLEAR',
      seal: 'SEAL_RUBBER',
      hardware: 'METAL_CHROME',
    },
    profileSlots: {
      FRAME_JAMB: { profileHint: 'hardwood_3x2', source: 'estimated' },
      LEAF_STILE: { profileHint: 'hardwood_2x1_5', source: 'estimated' },
      LEAF_RAIL: { profileHint: 'hardwood_2x1_5', source: 'estimated' },
    },
    components: [],
    variables: {
      pw: { defaultValue: widthMm, unit: 'mm', description: 'Product width (outer)' },
      ph: { defaultValue: heightMm, unit: 'mm', description: 'Product height (outer)' },
      sd: { defaultValue: depthMm, unit: 'mm', description: 'Standard depth' },
      frameW: { defaultValue: 80, unit: 'mm', description: 'Frame width' },
      stileW: { defaultValue: 35, unit: 'mm', description: 'Stile width (leaf frame)' },
    },
    rationale: `Fallback: simple single-casement window with frame and clear glass${reason ? ` (reason: ${reason})` : ''}`,
  };
}

const GenerateProductPlanRequestSchema = z.object({
  description: z.string().default(''),
  image: z.string().optional(),
  existingProductType: z
    .object({ category: z.string(), type: z.string().optional(), option: z.string().optional() })
    .optional(),
  existingDims: z
    .object({ widthMm: z.number().optional(), heightMm: z.number().optional(), depthMm: z.number().optional() })
    .optional(),
});

const SYSTEM_PROMPT = `You are an expert joinery product planner. You output strictly valid JSON matching a ProductPlanV1 schema.

Rules:
- Use detected.category as one of: door | window | frame
- Always include a concise rationale.
- Use variables pw/ph/sd for product width/height/depth and reference them in expressions where helpful.
- Return ONLY JSON (no markdown).
`;

function pickDims(existingDims?: any, defaults?: { widthMm: number; heightMm: number; depthMm: number }) {
  const w = Number(existingDims?.widthMm);
  const h = Number(existingDims?.heightMm);
  const d = Number(existingDims?.depthMm);
  return {
    widthMm: Number.isFinite(w) && w > 0 ? w : defaults?.widthMm,
    heightMm: Number.isFinite(h) && h > 0 ? h : defaults?.heightMm,
    depthMm: Number.isFinite(d) && d > 0 ? d : defaults?.depthMm,
  };
}

async function callOpenAiForProductPlan(payload: {
  description: string;
  existingProductType?: any;
  existingDims?: any;
}): Promise<{ plan: ProductPlanV1 | null; error?: string }> {
  try {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(
          {
            description: payload.description,
            existingProductType: payload.existingProductType,
            existingDims: payload.existingDims,
          },
          null,
          2
        ),
      },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) return { plan: null, error: 'no_openai_response' };

    const parsed = JSON.parse(responseText);
    const validated = ProductPlanV1Schema.parse(parsed);
    return { plan: validated };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('[AI2SCENE API] callOpenAiForProductPlan failed:', msg);
    return { plan: null, error: msg };
  }
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const EstimateRequestSchema = z.object({
  productType: z.object({
    category: z.string(),
    type: z.string().optional(),
    option: z.string().optional(),
  }),
  dimensions: z.object({
    widthMm: z.number(),
    heightMm: z.number(),
    depthMm: z.number().optional(),
  }),
  description: z.string().optional(),
  imageBase64: z.string().optional(),
});

interface MaterialSuggestion {
  materialId?: string; // Reference to Material in database
  category: string; // TIMBER_HARDWOOD, TIMBER_SOFTWOOD, etc.
  name: string; // e.g., "Oak Natural", "Pine Stained"
  color?: string; // Hex color
  colorName?: string; // Human-readable color
  finish?: string; // Stained, Painted, Natural, etc.
  species?: string; // Oak, Pine, etc.
  confidence: number;
}

interface ComponentEstimate {
  id: string;
  type: 'stile' | 'rail' | 'mullion' | 'transom' | 'panel' | 'glass' | 'glazingBar';
  label: string;
  componentLookupId?: string; // Reference to reusable component in database
  geometry: {
    width: number;
    height: number;
    depth: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  material: string; // Legacy string (e.g., "timber")
  materialSuggestion?: MaterialSuggestion; // NEW: Detailed material recommendation
  profile?: {
    suggested: string;
    widthMm: number;
    depthMm: number;
    svg?: string; // Generated SVG profile geometry
    profileId?: string; // Reference to ComponentProfile in database
  };
  confidence: number;
}

interface EstimationResult {
  components: ComponentEstimate[];
  reasoning: string;
  confidence: number;
  suggestions: string[];
}

/**
 * POST /ai/estimate-components
 * Estimate components from image or description
 */
router.post('/estimate-components', upload.single('image'), async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse request
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const parsed = EstimateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const { productType, dimensions, description } = parsed.data;
    let imageBase64 = parsed.data.imageBase64;

    // Handle uploaded image
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
    }

    if (!description && !imageBase64) {
      return res.status(400).json({ error: 'Either description or image is required' });
    }

    console.log('[AI Component Estimator] Request:', {
      productType,
      dimensions,
      hasImage: !!imageBase64,
      hasDescription: !!description,
    });

    // Build OpenAI prompt
    const systemPrompt = buildSystemPrompt(productType, dimensions);
    const userPrompt = buildUserPrompt(description, !!imageBase64);

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: imageBase64
          ? [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ]
          : userPrompt,
      },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const aiResponse = JSON.parse(responseText);
    console.log('[AI Component Estimator] AI Response:', aiResponse);

    // Transform AI response and match/create reusable components
    const result: EstimationResult = await transformAndMatchComponents(
      aiResponse,
      dimensions,
      productType,
      auth.tenantId
    );

    res.json(result);
  } catch (error: any) {
    console.error('[AI Component Estimator] Error:', error);
    res.status(500).json({
      error: 'Failed to estimate components',
      message: error.message,
    });
  }
});

/**
 * POST /ai/generate-product-plan
 * Body: { description, image?, existingProductType?, existingDims? }
 * Returns ProductPlanV1; falls back deterministically with rationale containing the reason.
 */
router.post('/generate-product-plan', async (req, res) => {
  // IMPORTANT: This endpoint should never hard-fail in production UI flows.
  // If OpenAI or parsing fails, return a deterministic fallback plan with a reason.
  try {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = GenerateProductPlanRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const { description, existingProductType, existingDims } = parsed.data;
    const categoryHint = (existingProductType?.category || '').toLowerCase();
    const defaultCategory = categoryHint.includes('window') ? 'windows' : 'doors';
    const dims = pickDims(existingDims, defaultCategory === 'windows'
      ? { widthMm: 1200, heightMm: 1200, depthMm: 80 }
      : { widthMm: 914, heightMm: 2032, depthMm: 45 }
    );

    const ai = await callOpenAiForProductPlan({
      description: description || '',
      existingProductType,
      existingDims: dims,
    });

    if (ai.plan) {
      res.setHeader('x-ai-fallback', '0');
      return res.json(ai.plan);
    }

    const reason = ai.error || 'unknown';
    res.setHeader('x-ai-fallback', '1');
    const safeHeader = String(reason ?? '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 200);
    res.setHeader('x-ai-error', safeHeader);

    if (defaultCategory === 'windows') {
      return res.json(createFallbackWindowPlan(dims.widthMm, dims.heightMm, dims.depthMm, reason));
    }
    return res.json(createFallbackDoorPlan(dims.widthMm, dims.heightMm, dims.depthMm, reason));
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('[AI2SCENE API] /ai/generate-product-plan failed:', msg);

    // Best-effort recovery: return fallback plan so UI can proceed.
    let categoryHint = '';
    let existingDims: any = undefined;
    try {
      categoryHint = String((req as any)?.body?.existingProductType?.category || '').toLowerCase();
      existingDims = (req as any)?.body?.existingDims;
    } catch {}

    const defaultCategory = categoryHint.includes('window') ? 'windows' : 'doors';
    const dims = pickDims(
      existingDims,
      defaultCategory === 'windows'
        ? { widthMm: 1200, heightMm: 1200, depthMm: 80 }
        : { widthMm: 914, heightMm: 2032, depthMm: 45 }
    );

    res.setHeader('x-ai-fallback', '1');
    const safeHeader = String(msg ?? '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 200);
    res.setHeader('x-ai-error', safeHeader);
    if (defaultCategory === 'windows') {
      return res.json(createFallbackWindowPlan(dims.widthMm, dims.heightMm, dims.depthMm, msg));
    }
    return res.json(createFallbackDoorPlan(dims.widthMm, dims.heightMm, dims.depthMm, msg));
  }
});

/**
 * Build system prompt for OpenAI
 */
function buildSystemPrompt(
  productType: { category: string; type?: string; option?: string },
  dimensions: { widthMm: number; heightMm: number; depthMm?: number }
): string {
  const { category, type, option } = productType;
  const { widthMm, heightMm, depthMm = 45 } = dimensions;

  return `You are an expert joinery estimator. Analyze the ${category} (${type || 'generic'} ${option || ''}) 
and provide a detailed component breakdown.

Product Specifications:
- Category: ${category}
- Type: ${type || 'standard'}
- Overall dimensions: ${widthMm}mm W × ${heightMm}mm H × ${depthMm}mm D

Your task:
1. Identify all structural components (stiles, rails, mullions, transoms)
2. Identify infill components (panels, glass)
3. Estimate each component's:
   - Exact position (x, y, z in mm from center origin)
   - Dimensions (width, height, depth in mm)
   - Material type (timber, glass, composite)
   - Suggested profile dimensions
4. Provide confidence score (0-1) for each component
5. Include reasoning for your estimates

Respond with valid JSON:
{
  "components": [
    {
      "id": "unique-id",
      "type": "stile|rail|mullion|transom|panel|glass|glazingBar",
      "label": "descriptive name",
      "geometry": { "width": 0, "height": 0, "depth": 0 },
      "position": { "x": 0, "y": 0, "z": 0 },
      "material": "timber|glass|composite",
      "materialSuggestion": {
        "category": "TIMBER_HARDWOOD|TIMBER_SOFTWOOD|BOARD_MDF|etc",
        "name": "Oak Natural|Pine Stained|White Painted|etc",
        "color": "#8B4513",
        "colorName": "Natural Oak|White|Grey|etc",
        "finish": "Natural|Stained|Painted|Lacquered",
        "species": "Oak|Pine|Sapele|etc",
        "confidence": 0.8
      },
      "profile": { "suggested": "description", "widthMm": 0, "depthMm": 0 },
      "confidence": 0.9
    }
  ],
  "reasoning": "explanation of your analysis",
  "confidence": 0.85,
  "suggestions": ["improvement recommendations"]
}

Use standard joinery conventions:
- Stiles are vertical outer frame members (typically 60-100mm wide)
- Rails are horizontal outer frame members (typically 50-80mm high)
- Mullions are vertical intermediate dividers (typically 40-60mm wide)
- Transoms are horizontal intermediate dividers (typically 40-60mm high)
- Glass/panels fill between frames
- Positions are relative to product center (0,0,0)
- Y-axis points up, X-axis points right, Z-axis points forward

For materialSuggestion:
- Analyze image for wood species (oak, pine, sapele, etc.)
- Detect finish type (natural, stained, painted, lacquered)
- Estimate color (provide hex code and name)
- Use TIMBER_HARDWOOD for oak, sapele, walnut, etc.
- Use TIMBER_SOFTWOOD for pine, spruce, cedar, etc.
- For painted finishes, use color name like "White Painted" or "Grey Painted"`;
}

/**
 * Build user prompt
 */
function buildUserPrompt(description?: string, hasImage?: boolean): string {
  if (hasImage && description) {
    return `Analyze this image and description to estimate components:\n\n${description}`;
  }
  if (hasImage) {
    return 'Analyze this image to estimate the component structure.';
  }
  if (description) {
    return `Based on this description, estimate the component structure:\n\n${description}`;
  }
  return 'Estimate a standard component structure.';
}

/**
 * Transform AI response and match with existing components or create new ones
 */
async function transformAndMatchComponents(
  aiResponse: any,
  dimensions: { widthMm: number; heightMm: number; depthMm?: number },
  productType: { category: string; type?: string; option?: string },
  tenantId: string
): Promise<EstimationResult> {
  const components: ComponentEstimate[] = [];

  for (const c of aiResponse.components || []) {
    const profileWidth = c.profile?.widthMm || c.geometry?.width || 50;
    const profileDepth = c.profile?.depthMm || c.geometry?.depth || dimensions.depthMm || 45;
    
    // Try to find or create a matching component in the database
    const matchResult = await findOrCreateComponent(
      tenantId,
      c.type || 'panel',
      c.label || c.type,
      profileWidth,
      profileDepth,
      productType.category
    );

    // Generate SVG profile if not already exists
    let profileSvg = matchResult.profile?.geometry?.svg;
    if (!profileSvg) {
      const profileDef = generateEstimatedProfile(c.type || 'panel', profileWidth, profileDepth);
      profileSvg = profileDef.svg;
    }
    
    // Match or create material if AI suggested one
    let materialSuggestion: MaterialSuggestion | undefined;
    if (c.materialSuggestion) {
      const materialMatch = await findOrCreateMaterial(
        tenantId,
        c.materialSuggestion
      );
      materialSuggestion = {
        ...c.materialSuggestion,
        materialId: materialMatch?.id,
      };
    }
    
    components.push({
      id: c.id || `component-${Math.random().toString(36).substr(2, 9)}`,
      type: c.type || 'panel',
      label: c.label || c.type,
      componentLookupId: matchResult.componentId,
      geometry: {
        width: c.geometry?.width || 50,
        height: c.geometry?.height || 50,
        depth: c.geometry?.depth || dimensions.depthMm || 45,
      },
      position: {
        x: c.position?.x || 0,
        y: c.position?.y || 0,
        z: c.position?.z || 0,
      },
      material: c.material || 'timber',
      materialSuggestion, // NEW: Include matched material
      profile: {
        suggested: c.profile?.suggested || matchResult.component?.name || `${c.type} profile`,
        widthMm: profileWidth,
        depthMm: profileDepth,
        svg: profileSvg,
        profileId: matchResult.profileId,
      },
      confidence: c.confidence || 0.7,
    });
  }

  return {
    components,
    reasoning: aiResponse.reasoning || 'AI estimation completed',
    confidence: aiResponse.confidence || 0.75,
    suggestions: aiResponse.suggestions || [],
  };
}

/**
 * Find existing component or create new one in database
 * Returns component ID and profile ID for reuse
 */
async function findOrCreateComponent(
  tenantId: string,
  componentType: string,
  label: string,
  widthMm: number,
  depthMm: number,
  productCategory: string
): Promise<{
  componentId: string;
  profileId?: string;
  component?: any;
  profile?: any;
}> {
  // Normalize component type for matching
  const normalizedType = componentType.toUpperCase().replace(/[-_]/g, '_');
  const code = `${normalizedType}_${widthMm}x${depthMm}`;

  // Try to find existing component with same type and dimensions
  let component = await prisma.componentLookup.findFirst({
    where: {
      tenantId,
      componentType: normalizedType,
      code,
    },
    include: {
      profile: true,
    },
  });

  if (component) {
    console.log(`[AI Estimator] Reusing existing component: ${component.code}`);
    return {
      componentId: component.id,
      profileId: component.profile?.id,
      component,
      profile: component.profile,
    };
  }

  // Create new component
  console.log(`[AI Estimator] Creating new component: ${code}`);
  
  // Generate profile SVG
  const profileDef = generateEstimatedProfile(componentType, widthMm, depthMm);
  
  component = await prisma.componentLookup.create({
    data: {
      tenantId,
      componentType: normalizedType,
      code,
      name: label || `${componentType} ${widthMm}×${depthMm}mm`,
      description: `Auto-generated ${componentType} component`,
      productTypes: [productCategory.toUpperCase()],
      unitOfMeasure: 'EA',
      basePrice: 0,
      metadata: {
        widthMm,
        depthMm,
        autoGenerated: true,
        generatedAt: new Date().toISOString(),
      },
      profile: {
        create: {
          profileType: 'CUSTOM',
          dimensions: { widthMm, depthMm },
          geometry: {
            svg: profileDef.svg,
            type: componentType,
          },
        },
      },
    },
    include: {
      profile: true,
    },
  });

  return {
    componentId: component.id,
    profileId: component.profile?.id,
    component,
    profile: component.profile,
  };
}

/**
 * Find existing material or create new one in database
 * Returns material for reuse in 3D rendering
 */
async function findOrCreateMaterial(
  tenantId: string,
  materialSuggestion: any
): Promise<any | null> {
  if (!materialSuggestion) return null;

  const { category, name, color, colorName, finish, species } = materialSuggestion;
  
  // Normalize for matching
  const code = `${category}_${(species || colorName || name).toUpperCase().replace(/\s+/g, '_')}`;

  try {
    // Try to find existing material with same category + color/species
    let material = await prisma.material.findFirst({
      where: {
        tenantId,
        category: category || 'TIMBER_HARDWOOD',
        OR: [
          { code },
          { species: { equals: species, mode: 'insensitive' } },
        ],
      },
    });

    if (material) {
      console.log(`[AI Estimator] Reusing existing material: ${material.code}`);
      return material;
    }

    // Create new material
    console.log(`[AI Estimator] Creating new material: ${code}`);
    
    material = await prisma.material.create({
      data: {
        tenantId,
        category: category || 'TIMBER_HARDWOOD',
        code,
        name: name || `${species || colorName} ${finish || ''}`.trim(),
        species,
        finish,
        unitCost: 0, // Default, can be updated later
        currency: 'GBP',
        unit: 'm',
        isActive: true,
      } as any,
    });

    return material;
  } catch (error) {
    console.error('[AI Estimator] Failed to create material:', error);
    return null;
  }
}

/**
 * Transform AI response to our format (legacy, now uses transformAndMatchComponents)
 */
function transformAIResponse(
  aiResponse: any,
  dimensions: { widthMm: number; heightMm: number; depthMm?: number }
): EstimationResult {
  const components: ComponentEstimate[] = (aiResponse.components || []).map((c: any) => {
    const profileWidth = c.profile?.widthMm || c.geometry?.width || 50;
    const profileDepth = c.profile?.depthMm || c.geometry?.depth || dimensions.depthMm || 45;
    
    // Generate actual SVG profile geometry
    const profileDef = generateEstimatedProfile(c.type || 'panel', profileWidth, profileDepth);
    
    return {
      id: c.id || `component-${Math.random().toString(36).substr(2, 9)}`,
      type: c.type || 'panel',
      label: c.label || c.type,
      geometry: {
        width: c.geometry?.width || 50,
        height: c.geometry?.height || 50,
        depth: c.geometry?.depth || dimensions.depthMm || 45,
      },
      position: {
        x: c.position?.x || 0,
        y: c.position?.y || 0,
        z: c.position?.z || 0,
      },
      material: c.material || 'timber',
      profile: {
        suggested: c.profile?.suggested || profileDef.name,
        widthMm: profileWidth,
        depthMm: profileDepth,
        svg: profileDef.svg, // Include generated SVG
      },
      confidence: c.confidence || 0.7,
    };
  });

  return {
    components,
    reasoning: aiResponse.reasoning || 'AI estimation completed',
    confidence: aiResponse.confidence || 0.75,
    suggestions: aiResponse.suggestions || [],
  };
}

export default router;
