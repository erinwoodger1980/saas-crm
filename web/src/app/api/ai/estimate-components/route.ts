/**
 * AI Component Estimator - Parametric Version
 * Uses OpenAI to suggest parametric ProductParams + addedParts for doors/windows
 * Instead of raw box components, returns structured parametric data for builders
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductParams, AddedPart } from '@/types/parametric-builder';

export const runtime = 'nodejs';

interface AIEstimateResponse {
  suggestedParamsPatch: Partial<ProductParams>;
  suggestedAddedParts: AddedPart[];
  rationale: string;
  components?: Array<any>; // Backwards compat
}

export async function POST(request: NextRequest) {
  try {
    const {
      tenantId,
      description,
      productType,
      existingDimensions,
    } = await request.json();

    if (!description || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: description, tenantId' },
        { status: 400 }
      );
    }

    // Call OpenAI to estimate parametric params
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('[estimate-components] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert furniture/joinery designer specializing in parametric door and window generation.

Given a product description, return a JSON object with:

{
  "productType": {
    "category": "doors" | "windows",
    "type": "entrance" | "french" | "bifold" | "casement" | "sash" | "bay",
    "option": "E01" | "E02" | "E03" for doors; "NxM" for windows
  },
  "construction": {
    "stileWidth": 50-200,        // mm, vertical frame members
    "topRail": 50-300,           // mm, top horizontal
    "midRail": 50-300,           // mm, middle horizontal (if E02)
    "bottomRail": 50-300,        // mm, bottom horizontal
    "thickness": 35-100,         // mm, door/window leaf thickness
    "timber": "oak|sapele|accoya|iroko",
    "finish": "clear|paint|stain|oiled",
    "glazingType": "single|double|triple"
  },
  "addedParts": [
    {
      "componentTypeCode": "MULLION_V|MULLION_H|TRANSOM|GLAZING_BAR",
      "position": [x, y, z],
      "params": { "materialId": "timber" }
    }
  ],
  "rationale": "explanation of AI choices"
}

For doors:
- Typical entrance doors: 914mm wide, 2032mm tall, 45mm thick, oak timber, clear finish
- E01 = 2 panels (1x2 layout)
- E02 = 4 panels (2x2 layout) - include midRail ~200mm
- E03 = glazed top 35% + panels 65% - suitable for "glazed" or "glass top" descriptions

For windows:
- Casement: 600-1500mm wide/tall, 100mm thick
- Sash: 600-1500mm wide/tall, 100mm thick
- Bay: 1500-3000mm wide, component windows with mullions

Always return realistic defaults for all construction fields. Dimensions in millimeters.`;

    const userPrompt = `Product description: "${description}"

${productType ? `Current type: ${JSON.stringify(productType)}` : 'Infer product type from description'}
${existingDimensions ? `Existing sizes: width=${existingDimensions.widthMm}mm, height=${existingDimensions.heightMm}mm, thickness=${existingDimensions.thicknessMm}mm` : ''}

Generate parametric ProductParams for this joinery product. Include sensible defaults for construction.
If the description implies added components (mullions, glass bars, transoms), suggest them in addedParts.

Return ONLY valid JSON.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate suggestions from OpenAI' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content from OpenAI');
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let aiSuggestion: any;
    try {
      aiSuggestion = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    // Build parametric response
    const suggestedParamsPatch: Partial<ProductParams> = {
      productType: aiSuggestion.productType || {
        category: 'doors',
        type: 'entrance',
        option: 'E01',
      },
      construction: {
        stileWidth: Math.max(50, Math.min(200, aiSuggestion.construction?.stileWidth || 114)),
        topRail: Math.max(50, Math.min(300, aiSuggestion.construction?.topRail || 114)),
        midRail: Math.max(50, Math.min(300, aiSuggestion.construction?.midRail || 200)),
        bottomRail: Math.max(50, Math.min(300, aiSuggestion.construction?.bottomRail || 200)),
        thickness: Math.max(35, Math.min(100, aiSuggestion.construction?.thickness || 58)),
        timber: aiSuggestion.construction?.timber || 'oak',
        finish: aiSuggestion.construction?.finish || 'clear',
        glazingType: aiSuggestion.construction?.glazingType || 'double',
      },
    };

    const suggestedAddedParts: AddedPart[] = (aiSuggestion.addedParts || [])
      .map((part: any, idx: number) => ({
        id: `ai-part-${idx}`,
        componentTypeCode: part.componentTypeCode,
        variantCode: part.variantCode,
        insertionMode: 'parametric' as const,
        parametricSlot: part.parametricSlot,
        position: part.position as [number, number, number] | undefined,
        rotation: part.rotation as [number, number, number] | undefined,
        params: part.params || {},
      }));

    const result: AIEstimateResponse = {
      suggestedParamsPatch,
      suggestedAddedParts,
      rationale: aiSuggestion.rationale || 'AI-suggested parameters',
    };

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[estimate-components] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
