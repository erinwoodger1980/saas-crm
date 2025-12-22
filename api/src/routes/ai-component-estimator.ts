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
  material: string;
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
- Y-axis points up, X-axis points right, Z-axis points forward`;
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
