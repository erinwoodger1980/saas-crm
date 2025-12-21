# Paste SVG Profile Feature - User & Developer Guide

## Overview

The **Paste SVG** feature allows users to input SVG profiles directly as text in the Settings → Components modal, complementing the existing file upload functionality. This enables quick prototyping, version control via text, and programmatic profile generation.

## User Guide

### How to Paste an SVG Profile

1. **Open Settings**
   - Navigate to Settings → Components
   - Find or create a component
   - Click the component name to open details modal
   - Scroll to "Component Profile (SVG/DXF)" section

2. **Switch to Paste Mode**
   - Tab selector shows "Upload File" and "Paste SVG"
   - Click "Paste SVG" tab

3. **Paste SVG Text**
   - Paste complete SVG element (including `<svg>...</svg>` tags)
   - Entire SVG must be in single textarea
   - Example:
     ```xml
     <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
       <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z"/>
     </svg>
     ```

4. **Validate**
   - Click "Validate" button
   - System checks for:
     - Required `<svg>` and `</svg>` tags
     - At least one shape element
     - Forbidden security patterns
     - Max 200,000 character length
   - Validation status displays with errors or warnings

5. **Preview**
   - Click "Preview" button
   - 3D extruded mesh renders in real-time
   - Allows visual verification before saving
   - Can be toggled multiple times without re-validation

6. **Save Profile**
   - Once validated, click "Save Profile"
   - Profile persisted to database
   - Component now uses this profile for extrusion
   - Can be used for component geometry generation

### Validation Rules & Security

**Required Elements:**
- Must contain opening `<svg` tag
- Must contain closing `</svg>` tag
- Must include at least one shape: `<path>`, `<polygon>`, `<polyline>`, `<rect>`, `<circle>`, or `<ellipse>`

**Rejected Patterns (Security):**
- `<script>` tags
- `onload=` attributes
- `onclick=` attributes
- `xlink:href=` attributes
- `href=` pointing to `http://` or `https://`
- `<foreignObject>` elements

**Constraints:**
- Maximum 200,000 characters
- ViewBox must be present or derivable from width/height

### Warnings

The system may warn about:
- **Missing viewBox**: If not present, viewBox will be auto-generated from width/height (if present)
- **Non-standard structure**: If SVG cannot be automatically enhanced

## Developer Guide

### Architecture

#### Client-Side Components

**1. `web/src/lib/svg-validation.ts`**
- Pure JavaScript validation and normalization utilities
- No DOM dependencies (works in server context too)
- Exports:
  - `validateSvgText(svgText: string): SvgValidationResult`
  - `normalizeSvgText(svgText: string): SvgNormalizationResult`
  - `hashSvgText(svgText: string): Promise<string>`
  - `processAndValidateSvg(svgText): object | null`

**2. `web/src/components/SvgPreview.tsx`**
- React component using R3F (React Three Fiber)
- Props:
  - `svgText: string` - SVG content to render
  - `extrudeDepth?: number` - Extrusion depth in mm (default 45)
  - `width?: string | number` - Canvas width (default 100%)
  - `height?: string | number` - Canvas height (default 300px)
  - `isLoading?: boolean` - Show loading state

**3. `web/src/components/ProfileUpload.tsx` (Enhanced)**
- Tabs UI with "Upload File" and "Paste SVG" modes
- Uses Textarea component from shadcn/ui
- Integration with SvgPreview for real-time 3D rendering
- Handlers:
  - `handleValidateSvg()` - Runs validation only
  - `handlePreviewSvg()` - Validates + generates hash + renders
  - `handleSaveSvg()` - Saves to database

#### Server-Side

**1. `api/src/lib/svg-validation.ts`**
- Node.js compatible validation utilities
- Same rules as client for consistency
- Used by API routes for server-side validation

**2. `api/src/routes/profiles.ts` (Enhanced)**
- POST `/profiles` now accepts both upload and paste modes
- Request body changes:
  ```typescript
  // Upload mode (existing)
  {
    name: string,
    mimeType: "image/svg+xml",
    dataBase64: string,
    ...
  }

  // Paste mode (new)
  {
    name: string,
    mimeType: "application/svg+xml",
    svgText: string,        // Instead of dataBase64
    metadata: {
      sourceType: "pasted",
      viewBox: { x, y, width, height },
      pastedAt: ISO_TIMESTAMP
    }
  }
  ```
- Stores in `TenantSettings.beta.profiles` (same as uploads)
- Deduplicates by SHA-256 hash

### Data Flow

```
User pastes SVG
    ↓
validateSvgText() [client]
    ↓ (if valid)
handlePreviewSvg()
    ↓
normalizeSvgText() [client]
    ↓
hashSvgText() [client, async]
    ↓
SvgPreview renders 3D mesh
    ↓
User clicks "Save Profile"
    ↓
POST /profiles {svgText, hash, metadata}
    ↓
validateSvgText() [server]
    ↓ (if valid)
Store in TenantSettings.beta.profiles
    ↓
Return ProfileRecord {id, svgText, hash, ...}
    ↓
UI updates, shows "Profile saved"
```

### Integration Points

#### Existing Systems

1. **ProfileUpload Component**
   - Used in Settings → Components
   - Also used in other component configuration UIs
   - Both upload and paste modes work seamlessly

2. **SVG Extrusion Pipeline**
   - `web/src/lib/scene/svg-profile.ts`
   - `createExtrudedProfileMesh()` handles both uploaded and pasted SVG
   - No changes needed - works transparently

3. **Material System**
   - SvgPreview uses existing oak material (#C19A6B)
   - Can be customized per component

4. **Three.js Setup**
   - Uses SVGLoader from `three/examples/jsm/loaders/SVGLoader.js`
   - Existing in project, no new dependencies

### API Contract

#### Create Profile (POST /profiles)

**Request:**
```typescript
{
  name: string,                              // Display name
  mimeType: "application/svg+xml",           // or "image/svg+xml"
  sizeBytes: number,                         // Length of dataBase64 or svgText
  dataBase64?: string,                       // For file uploads
  svgText?: string,                          // For paste mode
  hash: string,                              // SHA-256 hex
  metadata?: {
    sourceType?: "uploaded" | "pasted",      // Optional marker
    viewBox?: { x, y, width, height },       // From normalization
    pastedAt?: ISO_TIMESTAMP,                // When pasted
    originalFilename?: string                // For uploads
  }
}
```

**Response:**
```typescript
{
  id: string,
  name: string,
  mimeType: string,
  sizeBytes: number,
  dataBase64?: string | null,
  svgText?: string | null,
  hash: string,
  createdAt: ISO_TIMESTAMP,
  metadata: Record<string, any>
}
```

**Error Responses:**
```typescript
// Missing required fields
{ error: "name, mimeType, and either dataBase64 (upload) or svgText (paste) are required" }

// Invalid SVG
{ 
  error: "Invalid SVG",
  details: ["SVG must include...", "SVG must include at least one shape..."]
}

// Exceeds limits
{ error: "SVG text exceeds 200,000 character limit" }
```

### Performance Considerations

1. **Preview Memoization**
   ```tsx
   const previewMesh = useMemo(() => {
     return svgHash && pastedSvg ? { svgText: pastedSvg, hash: svgHash } : null;
   }, [svgHash, pastedSvg]);
   ```
   - Only re-renders when hash changes
   - Same SVG (same hash) = no re-parse
   - Significant performance boost for repeated previews

2. **Lazy Loading**
   - Preview only renders when "Preview" button clicked
   - Not on every keystroke (unlike auto-preview)
   - Reduces CPU load during typing

3. **Async Hashing**
   - `hashSvgText()` is async (uses Web Crypto API)
   - Doesn't block UI
   - Called only once per save attempt

4. **Texture Caching**
   - Existing system unchanged
   - Texture cache not affected by new feature

### Extending the Feature

#### Add Template Library
```tsx
const SVG_TEMPLATES = {
  'rectangular-profile': '<svg viewBox="0 0 50 50">...</svg>',
  'round-profile': '<svg viewBox="0 0 50 50">...</svg>',
};

// In Paste mode tab:
<div className="space-y-2">
  <label>Quick Templates:</label>
  {Object.entries(SVG_TEMPLATES).map(([name, svg]) => (
    <Button 
      onClick={() => setPastedSvg(svg)}
      variant="outline"
      size="sm"
    >
      Use {name}
    </Button>
  ))}
</div>
```

#### Add Batch Paste
```tsx
// Support multiple SVG blocks in one paste
const svgBlocks = pastedSvg.split('</svg>').filter(s => s.includes('<svg'));
// Create multiple profiles
```

#### Add Edit Mode
```tsx
// Allow modifying existing pasted profiles inline
if (profile?.metadata?.sourceType === 'pasted') {
  <Button onClick={() => switchToEditMode()}>
    Edit SVG
  </Button>
}
```

### Troubleshooting

**"SVG must include opening <svg tag"**
- Copy entire `<svg>...</svg>` block
- Check for typos in tag name

**"SVG must include at least one shape element"**
- Add at least one: `<path>`, `<circle>`, `<rect>`, etc.
- Groups `<g>` don't count; need actual shapes inside

**"External HTTP(S) links not allowed in href"**
- Remove any `href="https://..."` attributes
- Use local references or data URIs instead

**Preview shows blank/gray box**
- Check browser console for errors
- Ensure viewBox is present and valid numbers
- Try simpler SVG first (single rect/circle)

**Profile appears but component isn't extruded**
- Check that profile is actually assigned to component
- Verify component extrusion pipeline still uses createExtrudedProfileMesh
- Check browser DevTools Network tab for SVG loading

## Testing

### Unit Tests
See `PASTE_SVG_IMPLEMENTATION.md` for comprehensive test cases covering:
- Valid SVG acceptance
- Invalid SVG rejection
- Whitespace normalization
- ViewBox derivation
- Security pattern blocking
- Hash consistency

### Manual Testing

1. **Test Upload Still Works**
   - Open Settings → Components
   - Click existing component
   - Upload SVG file via drag-drop
   - Verify profile saves

2. **Test Paste Basic**
   - Switch to Paste SVG tab
   - Paste simple SVG:
     ```xml
     <svg viewBox="0 0 100 100">
       <rect x="10" y="10" width="80" height="80"/>
     </svg>
     ```
   - Click Validate → should pass
   - Click Preview → should show gray box (rect)
   - Click Save → should save

3. **Test Security**
   - Try pasting with `<script>alert(1)</script>`
   - Should reject with error
   - Try `onload="alert(1)"`
   - Should reject with error

4. **Test Normalization**
   - Paste SVG without viewBox:
     ```xml
     <svg width="100" height="100">
       <circle cx="50" cy="50" r="40"/>
     </svg>
     ```
   - Should auto-add viewBox attribute
   - Preview should render correctly

5. **Test Deduplication**
   - Paste same SVG twice
   - Second paste should return existing profile
   - No duplicate in database

## Deployment Checklist

- [x] Build passes (`pnpm build`)
- [x] No TypeScript errors
- [x] No new dependencies required
- [x] No database migration required (uses existing JSON field)
- [x] Backwards compatibility maintained (file uploads unchanged)
- [x] API validation on both client and server
- [x] Security patterns blocked server-side too
- [x] Error messages clear and helpful
- [x] UX smooth and responsive

## Commands

```bash
# Build
pnpm build

# Run tests (if implemented in test suite)
pnpm test

# Type check
pnpm type-check

# Deploy (existing process)
# No special deployment needed - just normal build + deploy
```

## Files Changed Summary

| File | Change | Lines |
|------|--------|-------|
| `web/src/lib/svg-validation.ts` | New | +168 |
| `web/src/components/SvgPreview.tsx` | New | +196 |
| `api/src/lib/svg-validation.ts` | New | +197 |
| `web/src/components/ProfileUpload.tsx` | Modified | +317/-46 |
| `api/src/routes/profiles.ts` | Modified | +42 |
| `PASTE_SVG_IMPLEMENTATION.md` | New | +305 |
| **Total** | | **+1,225 / -46** |

## Support & Questions

For issues or feature requests:
1. Check troubleshooting section above
2. Review validation error messages
3. Inspect browser console (DevTools)
4. Check API response errors (Network tab)
5. Reference implementation files for code examples
