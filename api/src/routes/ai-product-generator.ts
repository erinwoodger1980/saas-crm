import { Router } from 'express';
import { prisma } from '../prisma';
import OpenAI from 'openai';
import { FormulaEvaluator } from '../lib/formula-evaluator';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * AI Product Generator
 * Takes photo/description → returns parametric components matching tenant's profiles
 * Uses tenant's standard profiles to generate formulas for instant quoting
 */

interface ComponentFormula {
  code: string;
  name: string;
  componentType: string;
  positionXFormula: string;
  positionYFormula: string;
  positionZFormula: string;
  widthFormula: string;
  heightFormula: string;
  depthFormula: string;
  materialCode?: string;
  bodyProfileCode?: string;
  startEndProfileCode?: string;
  endEndProfileCode?: string;
}

interface ProductMatch {
  productType: string;
  confidence: number;
  description: string;
  components: ComponentFormula[];
  variables: Record<string, number>; // frameWidth, gap, rebate, etc.
  estimatedPrice: number;
}

// POST /ai-product-generator/analyze - Analyze photo/description and generate product
router.post('/analyze', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { imageBase64, description, productHint } = req.body;

    if (!imageBase64 && !description) {
      return res.status(400).json({ error: 'Either imageBase64 or description required' });
    }

    // Load tenant's standard profiles and materials
    const [profiles, materials, productTemplates] = await Promise.all([
      prisma.profile.findMany({
        where: { tenantId, isActive: true },
        select: { code: true, name: true, profileType: true, dimensions: true }
      }),
      prisma.material.findMany({
        where: { tenantId, isActive: true },
        select: { code: true, name: true, color: true }
      }),
      // Load existing product templates for matching
      prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { beta: true }
      })
    ]);

    const beta = (productTemplates?.beta || {}) as Record<string, any>;
    const templates = (beta.productTemplates || []) as any[];

    // Build AI prompt with tenant's available profiles
    const systemPrompt = `You are a joinery manufacturing expert. Analyze the provided image/description and generate a parametric product configuration.

Available Profiles:
${profiles.map(p => `- ${p.code}: ${p.name} (${p.profileType}) - ${JSON.stringify(p.dimensions)}`).join('\n')}

Available Materials:
${materials.map(m => `- ${m.code}: ${m.name}${m.color ? ` (${m.color})` : ''}`).join('\n')}

Product Templates:
${templates.map((t: any) => `- ${t.type}: ${t.description}`).join('\n')}

Generate a product configuration with:
1. Product type (e.g., FIRE_DOOR, INTERNAL_DOOR, WINDOW)
2. Confidence score (0-1)
3. Description of what you identified
4. List of components with PARAMETRIC FORMULAS (not fixed values)
5. Standard variables (frameWidth, gap, rebate, tennonLength, railHeight, stileWidth, etc.)

Component formulas should reference:
- product.width, product.height, product.depth
- Other components: FRAME_LEFT.width, STILE_RIGHT.width
- Variables: frameWidth, gap, rebate

Example component:
{
  "code": "TOP_RAIL",
  "name": "Top Rail",
  "componentType": "RAIL",
  "positionXFormula": "frameWidth + gap",
  "positionYFormula": "0",
  "positionZFormula": "product.height - railHeight - gap",
  "widthFormula": "product.width - frameWidth * 2 - STILE_LEFT.width - STILE_RIGHT.width + tennonLength * 2",
  "heightFormula": "railHeight",
  "depthFormula": "doorThickness",
  "materialCode": "OAK_HARDWOOD",
  "bodyProfileCode": "RECT_45X95",
  "startEndProfileCode": "TENON_10X40",
  "endEndProfileCode": "TENON_10X40"
}

Return JSON in this format:
{
  "productType": "FIRE_DOOR",
  "confidence": 0.95,
  "description": "Fire rated flush door with oak veneer",
  "components": [...],
  "variables": {
    "frameWidth": 45,
    "gap": 2,
    "rebate": 12,
    "tennonLength": 40,
    "railHeight": 95,
    "stileWidth": 95,
    "doorThickness": 54
  },
  "estimatedPrice": 450.00
}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: description || 'Analyze this door/window and generate a parametric configuration.'
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: description
      });
    }

    if (productHint) {
      messages.push({
        role: 'user',
        content: `Hint: This is likely a ${productHint}`
      });
    }

    // Call OpenAI Vision API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 4000
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    const productMatch: ProductMatch = JSON.parse(responseText);

    // Validate formulas and resolve profile/material IDs
    const resolvedComponents = await Promise.all(
      productMatch.components.map(async (comp) => {
        // Find matching profile/material IDs
        const material = comp.materialCode
          ? materials.find(m => m.code === comp.materialCode)
          : undefined;
        
        const bodyProfile = comp.bodyProfileCode
          ? profiles.find(p => p.code === comp.bodyProfileCode)
          : undefined;
        
        const startEndProfile = comp.startEndProfileCode
          ? profiles.find(p => p.code === comp.startEndProfileCode)
          : undefined;
        
        const endEndProfile = comp.endEndProfileCode
          ? profiles.find(p => p.code === comp.endEndProfileCode)
          : undefined;

        return {
          ...comp,
          materialId: material?.code,
          bodyProfileId: bodyProfile?.code,
          startEndProfileId: startEndProfile?.code,
          endEndProfileId: endEndProfile?.code
        };
      })
    );

    // Return the AI-generated product configuration
    res.json({
      ...productMatch,
      components: resolvedComponents,
      meta: {
        tokensUsed: completion.usage?.total_tokens || 0,
        model: completion.model,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('AI Product Generator error:', error);
    res.status(500).json({ 
      error: 'Failed to generate product',
      details: error.message 
    });
  }
});

// POST /ai-product-generator/save-template - Save AI-generated config as reusable template
router.post('/save-template', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { templateName, productType, description, components, variables } = req.body;

    if (!templateName || !productType || !components) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Load existing templates
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true }
    });

    const beta = (settings?.beta || {}) as Record<string, any>;
    const templates = (beta.productTemplates || []) as any[];

    // Add new template
    const newTemplate = {
      id: `template_${Date.now()}`,
      name: templateName,
      type: productType,
      description,
      components,
      variables,
      createdAt: new Date().toISOString()
    };

    templates.push(newTemplate);

    // Save back to settings
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        beta: {
          ...beta,
          productTemplates: templates
        }
      }
    });

    res.json({ success: true, template: newTemplate });

  } catch (error: any) {
    console.error('Save template error:', error);
    res.status(500).json({ 
      error: 'Failed to save template',
      details: error.message 
    });
  }
});

// GET /ai-product-generator/templates - Get all product templates
router.get('/templates', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true }
    });

    const beta = (settings?.beta || {}) as Record<string, any>;
    const templates = (beta.productTemplates || []) as any[];

    res.json(templates);

  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch templates',
      details: error.message 
    });
  }
});

// POST /ai-product-generator/instant-quote - Photo → Quote with BOM/cutting lists
router.post('/instant-quote', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      imageBase64, 
      description, 
      clientId, 
      projectId,
      productWidth, 
      productHeight, 
      productDepth 
    } = req.body;

    // Step 1: Analyze photo and generate parametric components
    const analysisResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai-product-generator/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      },
      body: JSON.stringify({ imageBase64, description })
    });

    if (!analysisResponse.ok) {
      throw new Error('Failed to analyze product');
    }

    const analysis: ProductMatch = await analysisResponse.json();

    // Step 2: Evaluate formulas with actual dimensions
    const evaluator = new FormulaEvaluator({
      product: {
        width: productWidth || 900,
        height: productHeight || 2100,
        depth: productDepth || 54
      },
      ...analysis.variables
    });

    const evaluatedComponents = evaluator.evaluateComponentTree(
      analysis.components.map(c => ({
        code: c.code,
        name: c.name,
        position: {
          x: c.positionXFormula,
          y: c.positionYFormula,
          z: c.positionZFormula
        },
        dimensions: {
          width: c.widthFormula,
          height: c.heightFormula,
          depth: c.depthFormula
        }
      }))
    );

    // Step 3: Generate BOM and cutting lists
    const bomItems = evaluatedComponents.map(comp => {
      const volume = comp.dimensions.width * comp.dimensions.height * comp.dimensions.depth / 1000000; // cubic meters
      return {
        code: comp.code,
        name: comp.name,
        quantity: 1,
        dimensions: comp.dimensions,
        volume,
        estimatedCost: volume * 800 // £800/m³ hardwood estimate
      };
    });

    const cuttingList = evaluatedComponents.map(comp => ({
      componentCode: comp.code,
      componentName: comp.name,
      length: comp.dimensions.width,
      width: comp.dimensions.height,
      thickness: comp.dimensions.depth,
      grain: 'Along length',
      notes: `Position: X=${comp.position.x}, Y=${comp.position.y}, Z=${comp.position.z}`
    }));

    // Step 4: Generate processes (simplified for MVP)
    const processes = [
      { name: 'Cutting', duration: 30, sequence: 1 },
      { name: 'Machining (profiles)', duration: 45, sequence: 2 },
      { name: 'Assembly', duration: 60, sequence: 3 },
      { name: 'Finishing', duration: 90, sequence: 4 }
    ];

    const totalTime = processes.reduce((sum, p) => sum + p.duration, 0);
    const totalMaterialCost = bomItems.reduce((sum, item) => sum + item.estimatedCost, 0);
    const labourCost = (totalTime / 60) * 45; // £45/hour
    const totalPrice = (totalMaterialCost + labourCost) * 1.4; // 40% markup

    res.json({
      analysis,
      components: evaluatedComponents,
      bom: bomItems,
      cuttingList,
      processes,
      pricing: {
        materialCost: totalMaterialCost,
        labourCost,
        totalTime,
        markup: 0.4,
        totalPrice: Math.round(totalPrice * 100) / 100
      },
      sceneConfig: {
        components: evaluatedComponents,
        variables: analysis.variables,
        formulas: analysis.components
      }
    });

  } catch (error: any) {
    console.error('Instant quote error:', error);
    res.status(500).json({ 
      error: 'Failed to generate instant quote',
      details: error.message 
    });
  }
});

export default router;
