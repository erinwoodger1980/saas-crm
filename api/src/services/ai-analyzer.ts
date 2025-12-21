/**
 * AI Analysis Service for Architect Packs
 * 
 * Uses OpenAI GPT-4 Vision to analyze architectural drawings
 * and extract joinery openings (doors, windows, screens, etc.)
 */

import { PDFPage } from './pdf-parser';
import { runTenantAI } from './ai/runTenantAI';

export interface DetectedOpening {
  type: 'door' | 'window' | 'screen' | 'sliding' | 'bifolding';
  widthMm: number;
  heightMm: number;
  locationHint?: string;
  pageNumber: number;
  notes?: string;
  sillHeight?: number;
  glazingType?: string;
  frameType?: string;
  confidence: number; // 0-1
}

export interface AnalysisResult {
  openings: DetectedOpening[];
  metadata: {
    pagesAnalyzed: number;
    totalPages: number;
    modelVersion: string;
    analysisTimeMs: number;
  };
}

/**
 * Analyze architectural drawings for joinery openings
 */
export async function analyzeArchitecturalDrawings(
  pages: PDFPage[],
  tenantId: string,
  modelVersion: string = 'gpt-4-vision-preview'
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const allOpenings: DetectedOpening[] = [];

  // Filter to only plan and elevation pages (most likely to have openings)
  const relevantPages = pages.filter(page => {
    const text = page.text.toLowerCase();
    return (
      text.includes('plan') ||
      text.includes('elevation') ||
      text.includes('floor') ||
      text.includes('door') ||
      text.includes('window')
    );
  });

  // If no relevant pages found, analyze all pages
  const pagesToAnalyze = relevantPages.length > 0 ? relevantPages : pages;

  // Analyze pages in batches (OpenAI rate limits)
  const batchSize = 3;
  for (let i = 0; i < pagesToAnalyze.length; i += batchSize) {
    const batch = pagesToAnalyze.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(page => analyzePage(page, tenantId, modelVersion))
    );

    batchResults.forEach(openings => {
      allOpenings.push(...openings);
    });
  }

  const analysisTimeMs = Date.now() - startTime;

  return {
    openings: allOpenings,
    metadata: {
      pagesAnalyzed: pagesToAnalyze.length,
      totalPages: pages.length,
      modelVersion,
      analysisTimeMs
    }
  };
}

/**
 * Analyze a single page for joinery openings
 */
async function analyzePage(
  page: PDFPage,
  tenantId: string,
  modelVersion: string
): Promise<DetectedOpening[]> {
  try {
    const prompt = buildAnalysisPrompt(page);

    const { result: response } = await runTenantAI({
      tenantId,
      featureKey: 'architect_pack_analysis',
      model: modelVersion,
      input: {
        type: 'image',
        imagesCount: 1,
        pdfPageCount: 1,
        text: prompt,
        inputChars: prompt.length,
      },
      execute: client => client.chat.completions.create({
        model: modelVersion,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${page.imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // Low temperature for consistent extraction
      })
    });

    const result = response.choices[0]?.message?.content;
    
    if (!result) {
      console.warn(`No response for page ${page.pageNumber}`);
      return [];
    }

    // Parse JSON response
    const parsed = parseAIResponse(result);
    
    // Add page number to all openings
    return parsed.map(opening => ({
      ...opening,
      pageNumber: page.pageNumber
    }));

  } catch (error) {
    console.error(`Error analyzing page ${page.pageNumber}:`, error);
    return [];
  }
}

/**
 * Build analysis prompt for AI
 */
function buildAnalysisPrompt(page: PDFPage): string {
  const pageType = detectPageType(page.text);
  const scale = extractScale(page.text);
  const extractedDims = extractDimensions(page.text);

  return `Analyze this architectural drawing (page ${page.pageNumber}) for joinery openings.

Page type: ${pageType}
Drawing scale: ${scale || 'not specified'}
${extractedDims.length > 0 ? `Text dimensions found: ${extractedDims.map(d => `${d.width}x${d.height}`).join(', ')}` : ''}

Identify all doors, windows, screens, sliding doors, and bifolding doors.
For each opening, extract:
- Type (door/window/screen/sliding/bifolding)
- Width and height in millimeters
- Location hint (e.g., "front entrance", "bedroom 1", "kitchen")
- Sill height (if visible, in mm)
- Glazing type (if specified)
- Frame type (if specified)
- Any relevant notes

Provide confidence scores (0-1) for each detection.

Return ONLY valid JSON in this exact format:
[
  {
    "type": "door",
    "widthMm": 900,
    "heightMm": 2100,
    "locationHint": "front entrance",
    "sillHeight": null,
    "glazingType": null,
    "frameType": "timber",
    "notes": "Single leaf entrance door",
    "confidence": 0.95
  }
]`;
}

/**
 * Parse AI response JSON
 */
function parseAIResponse(response: string): Omit<DetectedOpening, 'pageNumber'>[] {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonStr = response.trim();
    
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) {
      console.warn('AI response is not an array:', parsed);
      return [];
    }

    // Validate and normalize each opening
    return parsed
      .filter(isValidOpening)
      .map(normalizeOpening);

  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Response:', response);
    return [];
  }
}

/**
 * Validate opening object
 */
function isValidOpening(opening: any): boolean {
  return (
    opening &&
    typeof opening === 'object' &&
    ['door', 'window', 'screen', 'sliding', 'bifolding'].includes(opening.type) &&
    typeof opening.widthMm === 'number' &&
    typeof opening.heightMm === 'number' &&
    opening.widthMm > 0 &&
    opening.heightMm > 0 &&
    typeof opening.confidence === 'number' &&
    opening.confidence >= 0 &&
    opening.confidence <= 1
  );
}

/**
 * Normalize opening object
 */
function normalizeOpening(opening: any): Omit<DetectedOpening, 'pageNumber'> {
  return {
    type: opening.type,
    widthMm: Math.round(opening.widthMm),
    heightMm: Math.round(opening.heightMm),
    locationHint: opening.locationHint || undefined,
    sillHeight: opening.sillHeight ? Math.round(opening.sillHeight) : undefined,
    glazingType: opening.glazingType || undefined,
    frameType: opening.frameType || undefined,
    notes: opening.notes || undefined,
    confidence: Math.round(opening.confidence * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Detect page type from text
 */
function detectPageType(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('plan') || lower.includes('floor')) return 'plan';
  if (lower.includes('elevation')) return 'elevation';
  if (lower.includes('section')) return 'section';
  if (lower.includes('detail')) return 'detail';
  
  return 'unknown';
}

/**
 * Extract scale from text
 */
function extractScale(text: string): string | null {
  const match = text.match(/1:(\d+)/);
  return match ? match[0] : null;
}

/**
 * Extract dimensions from text
 */
function extractDimensions(text: string): Array<{ width: number; height: number }> {
  const dimensions: Array<{ width: number; height: number }> = [];
  const dimPattern = /(\d{3,4})\s*[xX×]\s*(\d{3,4})/g;
  
  let match;
  while ((match = dimPattern.exec(text)) !== null) {
    dimensions.push({
      width: parseInt(match[1]),
      height: parseInt(match[2])
    });
  }

  return dimensions;
}

// System prompt for AI analysis
const SYSTEM_PROMPT = `You are an expert architectural drawing analyzer specializing in joinery and fenestration.

Your task is to analyze architectural drawings (plans, elevations, sections) and identify all joinery openings including:
- Doors (single, double, entrance)
- Windows (fixed, opening, casement)
- Screens (security, insect)
- Sliding doors (patio, cavity)
- Bifolding doors (internal, external)

For each opening you detect, extract:
1. Type: Classify as door/window/screen/sliding/bifolding
2. Dimensions: Width and height in millimeters (standard architectural notation)
3. Location: Room or area name (e.g., "kitchen", "bedroom 1", "front facade")
4. Sill height: Height above floor level (if shown)
5. Glazing: Type of glass or glazing (if specified)
6. Frame: Frame material or type (if specified)
7. Notes: Any other relevant details (fire rating, hardware, finish)
8. Confidence: Your confidence in the detection (0-1 scale)

Rules:
- Only return openings you can clearly identify
- Use dimensions from the drawing or text annotations
- If multiple dimensions are shown (rough opening vs finished), prefer finished dimensions
- Standard door heights are typically 2040mm, 2100mm, 2340mm
- Standard door widths are typically 720mm, 820mm, 870mm, 920mm
- Windows vary widely - rely on annotations
- Provide confidence < 0.7 if dimensions are estimated or unclear
- Return ONLY valid JSON array, no other text

Be thorough but conservative. It's better to miss an opening than to incorrectly identify one.`;
