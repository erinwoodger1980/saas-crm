/**
 * Paste SVG Profile Feature Implementation Summary
 * 
 * FEATURE OVERVIEW
 * ================
 * Adds "Paste SVG" mode to Component Settings modal, allowing users to input SVG profiles
 * directly as text instead of only uploading files. Includes validation, normalization,
 * 3D preview, and persistence.
 * 
 * FILES CREATED
 * =============
 * 1. /web/src/lib/svg-validation.ts
 *    - Client-side SVG validation & normalization utilities
 *    - Shared validation rules (no DOM dependencies)
 *    - validateSvgText(), normalizeSvgText(), hashSvgText()
 * 
 * 2. /web/src/components/SvgPreview.tsx
 *    - 3D preview component using Three.js + React Three Fiber
 *    - Renders extruded SVG mesh using existing pipeline
 *    - Memoized for performance (only re-renders on hash change)
 * 
 * 3. /api/src/lib/svg-validation.ts
 *    - Server-side validation utilities (Node.js compatible)
 *    - Same validation rules as client for consistency
 *    - Used in API route validation
 * 
 * FILES MODIFIED
 * ==============
 * 1. /web/src/components/ProfileUpload.tsx
 *    - Added "Paste SVG" tab alongside "Upload File" tab
 *    - Added textarea for pasting SVG text
 *    - Added handlers: handleValidateSvg(), handlePreviewSvg(), handleSaveSvg()
 *    - Integrated SvgPreview component
 *    - Displays validation status and warnings
 *    - Memoized preview to avoid redundant re-renders
 * 
 * 2. /api/src/routes/profiles.ts
 *    - Updated ProfileRecord interface to include svgText field
 *    - Modified POST /profiles to accept both dataBase64 (upload) and svgText (paste)
 *    - Added server-side SVG validation
 *    - Maintains backwards compatibility with file uploads
 * 
 * IMPLEMENTATION DETAILS
 * ======================
 * 
 * VALIDATION RULES (validateSvgText):
 * ✓ Must include <svg and </svg>
 * ✓ Must include at least one shape element (<path>, <polygon>, <polyline>, <rect>, <circle>, <ellipse>)
 * ✓ Reject: <script tags, onload=, onclick=, xlink:href=, http/https href=, <foreignObject>
 * ✓ Max length: 200,000 characters
 * ✓ Returns: { valid, errors[], warnings[] }
 * 
 * NORMALIZATION (normalizeSvgText):
 * ✓ Trims and collapses whitespace
 * ✓ Extracts viewBox if present
 * ✓ Derives viewBox from width/height if not present
 * ✓ Returns: { normalizedSvg, viewBox, warnings }
 * 
 * HASHING (hashSvgText):
 * ✓ Computes SHA-256 of normalized SVG
 * ✓ Used to detect duplicates and for caching
 * ✓ Async function (returns Promise<string>)
 * 
 * PREVIEW:
 * ✓ Parses SVG using THREE.SVGLoader
 * ✓ Extracts shapes and extrudes them
 * ✓ Rotates -90° on X axis (SVG XY → 3D XZ plane)
 * ✓ Uses material from existing timber material system
 * ✓ Only renders on "Preview" button click (not on keypress)
 * ✓ Cached by SVG hash - same content = no re-render
 * 
 * PERSISTENCE:
 * ✓ Saves to TenantSettings.beta.profiles array (same as file uploads)
 * ✓ Stores both dataBase64 (for uploads) and svgText (for pastes)
 * ✓ Metadata includes: sourceType, viewBox, pastedAt timestamp
 * ✓ Hash computed server-side for deduplication
 * ✓ Backwards compatible - existing file uploads unchanged
 * 
 * PERFORMANCE:
 * ✓ Preview memoized with useMemo([], [svgHash, pastedSvg])
 * ✓ Only re-parses SVG when hash changes
 * ✓ Texture caching unchanged (existing optimization)
 * ✓ Lazy loading: preview only on button click, not on type
 * 
 * UX FLOW
 * =======
 * 1. User opens Component Settings → click "Paste SVG" tab
 * 2. Paste SVG text into textarea
 * 3. Click "Validate" → sees validation status + warnings
 * 4. Click "Preview" → 3D preview renders (if valid)
 * 5. Click "Save Profile" → saves to database
 * 6. Profile now available for component extrusion
 * 
 * API CHANGES
 * ===========
 * POST /profiles
 * Request body (pasted SVG):
 * {
 *   name: string,
 *   mimeType: "application/svg+xml",
 *   sizeBytes: number,
 *   svgText: string,        // NEW: instead of dataBase64
 *   hash: string,
 *   metadata: {
 *     sourceType: "pasted",
 *     viewBox: { x, y, width, height },
 *     pastedAt: ISO timestamp
 *   }
 * }
 * 
 * Response:
 * {
 *   id: string,
 *   name: string,
 *   mimeType: string,
 *   sizeBytes: number,
 *   dataBase64?: string,
 *   svgText?: string,
 *   hash: string,
 *   createdAt: ISO timestamp,
 *   metadata: any
 * }
 * 
 * NO SCHEMA MIGRATION NEEDED
 * ===========================
 * Profiles stored in TenantSettings.beta.profiles (JSON array)
 * Existing code already stores arbitrary JSON
 * New svgText field is optional, fully backwards compatible
 * No database migration required
 * 
 * TESTING CHECKLIST
 * =================
 * ✓ Validation: invalid SVG rejected with clear error messages
 * ✓ Normalization: viewBox added if missing
 * ✓ Preview: 3D mesh renders correctly for simple SVG
 * ✓ Save: profile persisted to TenantSettings.beta.profiles
 * ✓ Dedup: duplicate SVG (same hash) returns existing profile
 * ✓ Backwards compat: file uploads still work unchanged
 * ✓ Security: forbidden patterns rejected (script, onload, etc.)
 * ✓ Performance: preview doesn't lag on large SVG
 * ✓ UX: clear error messages and validation feedback
 * 
 * DEPLOYMENT STEPS
 * ================
 * 1. No database migration required (uses existing JSON field)
 * 2. Build with: pnpm build (already runs)
 * 3. Deploy API and web app as usual
 * 4. Settings → Components page automatically has new UI
 * 5. Existing profiles continue to work unchanged
 * 
 * FUTURE ENHANCEMENTS
 * ===================
 * 1. Batch paste: allow pasting multiple SVGs at once
 * 2. Edit SVG: modify existing pasted profiles inline
 * 3. Template library: pre-built profile SVG templates
 * 4. Advanced preview: rotate/scale/extrude depth control
 * 5. DXF paste: support pasting DXF format text
 * 6. Diff view: show before/after when updating profiles
 */

import { describe, it, expect } from 'vitest';
import {
  validateSvgText,
  normalizeSvgText,
  hashSvgText,
} from '../web/src/lib/svg-validation';

describe('SVG Validation & Normalization', () => {
  describe('validateSvgText', () => {
    it('accepts valid SVG with path', () => {
      const svg = '<svg viewBox="0 0 100 100"><path d="M 10 10 L 90 90" /></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects SVG without shape elements', () => {
      const svg = '<svg viewBox="0 0 100 100"></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('shape element'))).toBe(true);
    });

    it('rejects SVG with script tag', () => {
      const svg = '<svg><script>alert("xss")</script><path d="M 0 0 L 10 10" /></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('script'))).toBe(true);
    });

    it('rejects SVG with onload handler', () => {
      const svg = '<svg onload="alert(1)"><path d="M 0 0 L 10 10" /></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('onload'))).toBe(true);
    });

    it('rejects SVG with external HTTP href', () => {
      const svg = '<svg><a href="https://malicious.com"><path d="M 0 0 L 10 10" /></a></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('href'))).toBe(true);
    });

    it('rejects SVG exceeding max length', () => {
      const svg = `<svg><path d="${'M 0 0 '.repeat(50000)}" /></svg>`;
      const result = validateSvgText(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('accepts SVG with multiple shape types', () => {
      const svg = `
        <svg viewBox="0 0 100 100">
          <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" />
          <circle cx="50" cy="50" r="10" />
          <rect x="20" y="20" width="60" height="60" />
        </svg>
      `;
      const result = validateSvgText(svg);
      expect(result.valid).toBe(true);
    });

    it('warns if viewBox missing', () => {
      const svg = '<svg width="100" height="100"><path d="M 0 0 L 10 10" /></svg>';
      const result = validateSvgText(svg);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('viewBox'))).toBe(true);
    });
  });

  describe('normalizeSvgText', () => {
    it('collapses whitespace', () => {
      const svg = `
        <svg   viewBox="0 0 100 100"  >
          <path   d="M 10 10 L 90 90"  />
        </svg>
      `;
      const result = normalizeSvgText(svg);
      expect(result.normalizedSvg).not.toContain('\n');
      expect(result.normalizedSvg).not.toContain('  ');
    });

    it('extracts viewBox', () => {
      const svg = '<svg viewBox="10 20 100 200"><path d="M 0 0 L 10 10" /></svg>';
      const result = normalizeSvgText(svg);
      expect(result.viewBox).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 200,
      });
    });

    it('derives viewBox from width/height', () => {
      const svg = '<svg width="100" height="200"><path d="M 0 0 L 10 10" /></svg>';
      const result = normalizeSvgText(svg);
      expect(result.viewBox).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 200,
      });
      expect(result.normalizedSvg).toContain('viewBox="0 0 100 200"');
    });

    it('handles missing viewBox', () => {
      const svg = '<svg><path d="M 0 0 L 10 10" /></svg>';
      const result = normalizeSvgText(svg);
      expect(result.viewBox).toBeNull();
      expect(result.warnings.some(w => w.includes('viewBox'))).toBe(true);
    });
  });

  describe('hashSvgText', () => {
    it('returns consistent hash for same SVG', async () => {
      const svg = '<svg viewBox="0 0 100 100"><path d="M 0 0 L 10 10" /></svg>';
      const hash1 = await hashSvgText(svg);
      const hash2 = await hashSvgText(svg);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('returns different hash for different SVG', async () => {
      const svg1 = '<svg viewBox="0 0 100 100"><path d="M 0 0 L 10 10" /></svg>';
      const svg2 = '<svg viewBox="0 0 100 100"><path d="M 0 0 L 20 20" /></svg>';
      const hash1 = await hashSvgText(svg1);
      const hash2 = await hashSvgText(svg2);
      expect(hash1).not.toBe(hash2);
    });

    it('returns same hash for normalized whitespace differences', async () => {
      const svg1 = '<svg viewBox="0 0 100 100"><path d="M 0 0 L 10 10" /></svg>';
      const svg2 = `
        <svg viewBox="0 0 100 100">
          <path d="M 0 0 L 10 10" />
        </svg>
      `;
      const hash1 = await hashSvgText(svg1);
      const norm2 = normalizeSvgText(svg2);
      const hash2 = await hashSvgText(norm2.normalizedSvg);
      expect(hash1).toBe(hash2);
    });
  });
});
