/**
 * AI Product Template Generation API
 * 
 * POST /api/ai/product-template
 * Body: { description?: string, imageBase64?: string, productCategory?: 'doors'|'windows' }
 * Returns: TemplateDraft
 * 
 * For now uses heuristic pattern matching instead of real OpenAI.
 * Easily swappable to real AI later by replacing generateTemplateDraft()
 */

import { NextRequest, NextResponse } from 'next/server';
import type { TemplateDraft } from '@/types/resolved-product';
import { doorEntranceE01Template } from '@/lib/scene/templates/door-entrance-e01';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, imageBase64, productCategory } = body;
    
    // Generate template draft using heuristic (or real AI when available)
    const draft = await generateTemplateDraft({
      description,
      imageBase64,
      productCategory,
    });
    
    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

interface GenerateTemplateInput {
  description?: string;
  imageBase64?: string;
  productCategory?: 'doors' | 'windows' | string;
}

/**
 * Generate template draft from description/image
 * 
 * CURRENT: Heuristic pattern matching
 * FUTURE: Replace with OpenAI GPT-4 Vision call
 */
async function generateTemplateDraft(input: GenerateTemplateInput): Promise<TemplateDraft> {
  const { description = '', productCategory } = input;
  
  // Normalize description to lowercase for pattern matching
  const desc = description.toLowerCase();
  
  // Start with base template (entrance door for now)
  const baseDraft: TemplateDraft = JSON.parse(JSON.stringify(doorEntranceE01Template));
  
  // Apply heuristics based on description keywords
  
  // === DIMENSIONS ===
  if (desc.includes('wide') || desc.includes('double')) {
    baseDraft.globals.pw.value = 1800; // Double door width
  }
  if (desc.includes('tall') || desc.includes('high')) {
    baseDraft.globals.ph.value = 2400;
  }
  if (desc.includes('narrow')) {
    baseDraft.globals.pw.value = 750;
  }
  
  // === GLAZING ===
  if (desc.includes('half glass') || desc.includes('half glazed') || desc.includes('half-glazed')) {
    baseDraft.globals.hasGlazing.value = true;
    baseDraft.globals.topRailH.value = 150;
    baseDraft.globals.glazingRailH.value = 80;
  } else if (desc.includes('full glass') || desc.includes('fully glazed')) {
    baseDraft.globals.hasGlazing.value = true;
    baseDraft.globals.topRailH.value = 100;
    baseDraft.globals.midRailH.value = 100;
    baseDraft.globals.bottomRailH.value = 100;
    baseDraft.globals.glazingRailH.value = 0;
  } else if (desc.includes('no glass') || desc.includes('solid')) {
    baseDraft.globals.hasGlazing.value = false;
  }
  
  // === PANELS ===
  const panelCount = desc.match(/(\d+)\s*panel/i);
  if (panelCount) {
    const count = parseInt(panelCount[1], 10);
    baseDraft.questions.push(`Detected ${count} panels - configuration will be adjusted`);
  }
  
  // === MATERIALS ===
  
  // Timber species
  if (desc.includes('oak')) {
    baseDraft.materials.find(m => m.role === 'timber')!.materialKey = 'oak-natural';
    baseDraft.warnings.push('Oak timber selected');
  } else if (desc.includes('accoya')) {
    baseDraft.materials.find(m => m.role === 'timber')!.materialKey = 'accoya-natural';
    baseDraft.warnings.push('Accoya timber selected');
  } else if (desc.includes('sapele') || desc.includes('mahogany')) {
    baseDraft.materials.find(m => m.role === 'timber')!.materialKey = 'sapele-natural';
  } else if (desc.includes('pine') || desc.includes('softwood')) {
    baseDraft.materials.find(m => m.role === 'timber')!.materialKey = 'pine-natural';
  }
  
  // Paint/finish
  if (desc.includes('painted') || desc.includes('paint')) {
    baseDraft.materials.find(m => m.role === 'finish')!.materialKey = 'painted-ral-9016';
    baseDraft.warnings.push('Painted finish selected - RAL 9016 white default');
    
    if (desc.includes('white')) {
      baseDraft.materials.find(m => m.role === 'finish')!.materialKey = 'painted-ral-9016';
    } else if (desc.includes('black')) {
      baseDraft.materials.find(m => m.role === 'finish')!.materialKey = 'painted-ral-9005';
    } else if (desc.includes('grey') || desc.includes('gray')) {
      baseDraft.materials.find(m => m.role === 'finish')!.materialKey = 'painted-ral-7016';
    }
  }
  
  // Glass type
  if (desc.includes('stained glass')) {
    baseDraft.materials.find(m => m.role === 'glass')!.materialKey = 'stained-glass';
    baseDraft.warnings.push('Stained glass selected');
  } else if (desc.includes('frosted') || desc.includes('obscured')) {
    baseDraft.materials.find(m => m.role === 'glass')!.materialKey = 'frosted-glass';
  } else if (desc.includes('tinted')) {
    baseDraft.materials.find(m => m.role === 'glass')!.materialKey = 'tinted-glass';
  }
  
  // === DECORATIVE ELEMENTS ===
  if (desc.includes('bolection')) {
    baseDraft.globals.hasBolection.value = true;
    baseDraft.warnings.push('Bolection moldings included');
  } else if (desc.includes('plain') || desc.includes('simple')) {
    baseDraft.globals.hasBolection.value = false;
  }
  
  if (desc.includes('mullion') || desc.includes('vertical bar')) {
    baseDraft.globals.hasMullion.value = true;
    baseDraft.warnings.push('Vertical mullion included');
  }
  
  // === HARDWARE ===
  if (desc.includes('winkhaus')) {
    // Already default
    baseDraft.warnings.push('Winkhaus lock selected');
  } else if (desc.includes('yale') || desc.includes('standard lock')) {
    baseDraft.hardware[0].sku = 'YALE-STD-001';
    baseDraft.hardware[0].name = 'Yale Standard Lock';
  }
  
  if (desc.includes('chrome')) {
    baseDraft.materials.find(m => m.role === 'metal')!.materialKey = 'polished-chrome';
  } else if (desc.includes('brass')) {
    baseDraft.materials.find(m => m.role === 'metal')!.materialKey = 'polished-brass';
  } else if (desc.includes('black') && desc.includes('handle')) {
    baseDraft.materials.find(m => m.role === 'metal')!.materialKey = 'matte-black';
  }
  
  // === QUESTIONS ===
  if (!desc) {
    baseDraft.questions.push('No description provided - using default entrance door configuration');
  }
  
  if (desc.length > 0 && desc.length < 10) {
    baseDraft.questions.push('Description is very short - using default configuration with best guesses');
  }
  
  // Check for unrecognized terms
  const recognizedTerms = [
    'oak', 'accoya', 'sapele', 'mahogany', 'pine', 'softwood',
    'painted', 'paint', 'white', 'black', 'grey', 'gray',
    'glass', 'glazed', 'stained', 'frosted', 'obscured', 'tinted',
    'bolection', 'plain', 'simple', 'mullion',
    'winkhaus', 'yale', 'chrome', 'brass',
    'wide', 'narrow', 'tall', 'high', 'double', 'panel',
  ];
  
  const words = desc.split(/\s+/);
  const unrecognized = words.filter(word => 
    word.length > 3 && 
    !recognizedTerms.some(term => word.includes(term)) &&
    !word.match(/^\d+$/)
  );
  
  if (unrecognized.length > 0 && unrecognized.length < 5) {
    baseDraft.questions.push(`Unrecognized terms: ${unrecognized.join(', ')} - may need manual adjustment`);
  }
  
  return baseDraft;
}

/**
 * FUTURE: Real OpenAI implementation
 * 
 * async function generateTemplateDraftWithAI(input: GenerateTemplateInput): Promise<TemplateDraft> {
 *   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *   
 *   const prompt = `Generate a joinery product template from this description: ${input.description}
 *   
 *   Return a JSON object matching the TemplateDraft schema with:
 *   - templateId (choose from: door_entrance_e01, window_casement_w01, etc)
 *   - globals (dimensions and parameters)
 *   - instances (component list with expressions using #tokens)
 *   - materials (material role mappings)
 *   - hardware (locks, handles, hinges)
 *   - warnings and questions
 *   `;
 *   
 *   const messages = [{ role: 'user', content: prompt }];
 *   
 *   if (input.imageBase64) {
 *     messages.push({
 *       role: 'user',
 *       content: [
 *         { type: 'text', text: 'Analyze this image:' },
 *         { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` } },
 *       ],
 *     });
 *   }
 *   
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4-vision-preview',
 *     messages,
 *     response_format: { type: 'json_object' },
 *   });
 *   
 *   return JSON.parse(response.choices[0].message.content);
 * }
 */
