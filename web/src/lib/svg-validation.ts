/**
 * SVG Validation & Normalization Utilities
 * Works on both client and server (no DOM dependencies)
 * Shared validation rules for pasted SVG input
 */

export interface SvgValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SvgNormalizationResult {
  normalizedSvg: string;
  viewBox: { x: number; y: number; width: number; height: number } | null;
  warnings: string[];
}

/**
 * Validate SVG text against security and format rules
 * 
 * Rules:
 * - Must include <svg and </svg>
 * - Must include at least one shape element
 * - Reject forbidden security patterns
 * - Enforce max length (200,000 chars)
 */
export function validateSvgText(svgText: string): SvgValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Trim whitespace
  const trimmed = svgText.trim();

  // Check empty
  if (!trimmed) {
    errors.push('SVG text cannot be empty');
    return { valid: false, errors, warnings };
  }

  // Check max length
  if (trimmed.length > 200_000) {
    errors.push(`SVG exceeds maximum length of 200,000 characters (current: ${trimmed.length})`);
  }

  // Case-insensitive checks
  const lower = trimmed.toLowerCase();

  // Check for opening and closing svg tags
  if (!lower.includes('<svg')) {
    errors.push('SVG must include opening <svg tag');
  }
  if (!lower.includes('</svg>')) {
    errors.push('SVG must include closing </svg> tag');
  }

  // Check for at least one shape element
  const shapeElements = ['<path', '<polygon', '<polyline', '<rect', '<circle', '<ellipse'];
  const hasShape = shapeElements.some(shape => lower.includes(shape));
  if (!hasShape) {
    errors.push(
      'SVG must include at least one shape element (<path>, <polygon>, <polyline>, <rect>, <circle>, or <ellipse>)'
    );
  }

  // Security checks - forbidden patterns
  const forbiddenPatterns = [
    { pattern: /<script/i, message: '<script> tags not allowed' },
    { pattern: /onload\s*=/i, message: 'onload attributes not allowed' },
    { pattern: /onclick\s*=/i, message: 'onclick attributes not allowed' },
    { pattern: /xlink:href\s*=/i, message: 'xlink:href attributes not allowed' },
    { pattern: /href\s*=\s*["']https?:/i, message: 'External HTTP(S) links not allowed in href' },
    { pattern: /<foreignObject/i, message: '<foreignObject> elements not allowed' },
  ];

  forbiddenPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(trimmed)) {
      errors.push(message);
    }
  });

  // Warnings for common issues
  if (!/viewBox\s*=\s*["']/i.test(trimmed)) {
    warnings.push('SVG does not include a viewBox attribute - one will be generated from width/height if available');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Normalize SVG text:
 * - Trim whitespace
 * - Collapse multiple whitespace to single space
 * - Extract or derive viewBox
 * - Ensure valid structure
 */
export function normalizeSvgText(svgText: string): SvgNormalizationResult {
  const warnings: string[] = [];

  // Trim and collapse whitespace
  let normalized = svgText
    .trim()
    .replace(/\s+/g, ' '); // Collapse multiple whitespace

  // Extract viewBox
  let viewBox: { x: number; y: number; width: number; height: number } | null = null;

  const viewBoxMatch = normalized.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).filter(p => p);
    if (parts.length === 4) {
      const [x, y, width, height] = parts.map(Number);
      if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
        viewBox = { x, y, width, height };
      }
    }
  }

  // Try to derive viewBox from width/height if not present
  if (!viewBox) {
    const widthMatch = normalized.match(/width\s*=\s*["']([^"']+)["']/i);
    const heightMatch = normalized.match(/height\s*=\s*["']([^"']+)["']/i);

    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);

      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        viewBox = { x: 0, y: 0, width, height };
        warnings.push(`ViewBox derived from width/height: 0 0 ${width} ${height}`);

        // Add viewBox attribute if missing
        const svgTagMatch = normalized.match(/(<svg\s+[^>]*)/i);
        if (svgTagMatch && !svgTagMatch[1].includes('viewBox')) {
          normalized = normalized.replace(
            /(<svg\s+)/i,
            `$1viewBox="0 0 ${width} ${height}" `
          );
        }
      }
    }
  }

  if (!viewBox) {
    warnings.push('Could not determine viewBox - extrusion may not scale correctly');
  }

  return {
    normalizedSvg: normalized,
    viewBox,
    warnings,
  };
}

/**
 * Compute SHA-256 hash of normalized SVG text
 * Returns hex string
 * 
 * Note: This is a synchronous wrapper around Web Crypto API
 * Must be called with await in async context
 */
export async function hashSvgText(svgText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(svgText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Quick validation + normalization pipeline
 * Returns null if validation fails
 */
export function processAndValidateSvg(svgText: string): {
  normalized: string;
  viewBox: { x: number; y: number; width: number; height: number } | null;
  hash: Promise<string>;
  warnings: string[];
} | null {
  const validation = validateSvgText(svgText);
  if (!validation.valid) {
    return null;
  }

  const normalization = normalizeSvgText(svgText);

  return {
    normalized: normalization.normalizedSvg,
    viewBox: normalization.viewBox,
    hash: hashSvgText(normalization.normalizedSvg),
    warnings: [...validation.warnings, ...normalization.warnings],
  };
}
