/**
 * AI Component Estimator Endpoint
 * Uses OpenAI to estimate components and dimensions from a product description
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

    // Call OpenAI to estimate components
    const openaiApiKey = process.env.OPENAI_API_KEY;
    console.log('[estimate-components] Checking OPENAI_API_KEY...');
    console.log('[estimate-components] OPENAI_API_KEY exists:', !!openaiApiKey);
    console.log('[estimate-components] OPENAI_API_KEY length:', openaiApiKey?.length || 0);
    console.log('[estimate-components] All env keys:', Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API') || k.includes('KEY')).join(', '));
    
    if (!openaiApiKey) {
      console.error('[estimate-components] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI service not configured', debug: { keyExists: false, allKeys: Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API')).join(', ') } },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert furniture/joinery component designer. Given a product description, you will estimate the components needed and their dimensions.

Return a JSON object with a "components" array. Each component should have:
- id: unique string identifier
- name: descriptive name
- type: component type (frame, panel, rail, stile, etc.)
- width: width in mm
- height: height in mm  
- depth: depth in mm
- material: material type (oak, pine, mdf, etc.)
- position: [x, y, z] position in 3D space

Base dimensions on standard joinery sizes. For doors, typical sizes are 800-1000mm wide, 1800-2200mm tall. For windows, typically 600-1500mm wide, 600-1500mm tall.

Return ONLY valid JSON, no markdown or explanations.`;

    const userPrompt = `Product description: "${description}"

${productType ? `Product type: ${JSON.stringify(productType)}` : ''}
${existingDimensions ? `Existing dimensions: ${JSON.stringify(existingDimensions)}` : ''}

Generate the component breakdown for this product. Provide realistic dimensions in millimeters.`;

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
        { error: 'Failed to generate components from OpenAI' },
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
    let components;
    try {
      const parsed = JSON.parse(content);
      components = parsed.components || [parsed];
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    // Validate and sanitize components
    const sanitized = components
      .map((comp: any, idx: number) => ({
        id: comp.id || `comp-${idx}`,
        name: comp.name || `Component ${idx + 1}`,
        type: comp.type || 'part',
        width: Math.max(10, Math.min(5000, parseInt(comp.width) || 500)),
        height: Math.max(10, Math.min(5000, parseInt(comp.height) || 500)),
        depth: Math.max(10, Math.min(1000, parseInt(comp.depth) || 50)),
        material: comp.material || 'wood',
        position: Array.isArray(comp.position) ? comp.position : [0, 0, 0],
      }))
      .filter((comp: any) => comp.width && comp.height && comp.depth);

    return NextResponse.json({
      components: sanitized,
      count: sanitized.length,
      sourceDescription: description,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[estimate-components] Error:', errorMessage);
    console.error('[estimate-components] Full error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
