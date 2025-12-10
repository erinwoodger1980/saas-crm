# Wealden Joinery AI Image Pipeline

## Quick Start

### 1. Set Up API Keys

Add these to your `.env.local` file (or API `.env`):

```bash
# Required for image analysis
OPENAI_API_KEY=sk-...

# Optional for image generation (if local images aren't enough)
REPLICATE_API_TOKEN=r8_...
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Replicate: https://replicate.com/account/api-tokens

### 2. Run the Pipeline

```bash
cd web
pnpm wealden:images
```

This will:
1. Load all 96 images from `~/Desktop/Web Images`
2. Enhance each with Sharp (color correction, sharpening)
3. Analyze with GPT-4 Vision (captions, tags, placement hints)
4. Generate missing category images with FLUX (if needed)
5. Save to `/public/wealden-ai/`
6. Create manifest at `/scripts/wealden-ai-images.json`

### 3. Images Automatically Available

All Wealden pages already import from the helper:

```typescript
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

// Get hero image
const heroImage = getHeroImage();

// Get windows range images
const windowImages = getImagesByHint("range-windows", 3);

// Get by tag
const oakImages = getImagesByTag("oak");
```

## Image Categories

The pipeline ensures minimum counts for each category:

| Category       | Min Count | Used On |
|----------------|-----------|---------|
| hero           | 1         | Landing page hero, contact, estimate |
| range-windows  | 3         | Landing ranges, windows page |
| range-doors    | 3         | Landing ranges, doors page |
| alu-clad       | 2         | Landing ranges, alu-clad page |
| case-study     | 4         | Landing case studies, projects page |
| workshop       | 2         | About page |
| detail         | 3         | Windows, doors, choices pages |
| lifestyle      | 3         | Doors, contact, estimate pages |
| team           | 1         | About page |

## Manual Run (from root)

```bash
tsx scripts/process-wealden-images.ts
```

## Output Structure

```
/public/wealden-ai/
  local-0-abc123.jpg      # Enhanced local image
  local-1-def456.jpg
  gen-hero-0-1234567.jpg  # AI generated image
  ...

/scripts/wealden-ai-images.json  # Manifest with metadata
```

## Manifest Format

```json
{
  "version": "1.0",
  "generatedAt": "2025-12-10T...",
  "totalImages": 100,
  "images": [
    {
      "id": "local-0-abc123",
      "publicPath": "/wealden-ai/local-0-abc123.jpg",
      "caption": "Traditional sash windows on Georgian home",
      "tags": ["sash", "window", "heritage", "timber"],
      "placementHints": ["range-windows", "hero"],
      "sourceKind": "local-enhanced",
      "width": 2400,
      "height": 1600
    }
  ]
}
```

## Helper Functions

```typescript
// Get hero image
getHeroImage(): WealdenImage | null

// Get by placement hint
getImagesByHint(hint: string, limit?: number): WealdenImage[]

// Get by tag
getImagesByTag(tag: string, limit?: number): WealdenImage[]

// Advanced filtering
getImages({
  hints?: string[],
  tags?: string[],
  sourceKind?: "local-enhanced" | "ai-generated",
  limit?: number
}): WealdenImage[]

// Fallback
getFallbackImages(count: number): WealdenImage[]

// Random for variety
getRandomImage(hint?: string): WealdenImage | null

// Stats
getManifestStats()
```

## Troubleshooting

### "OPENAI_API_KEY not found"
Add your OpenAI API key to `.env.local`

### "REPLICATE_API_TOKEN not found"
This is optional. The pipeline will skip AI generation if not provided.
Only needed if your local images don't cover all categories.

### Images not showing
1. Check manifest exists: `scripts/wealden-ai-images.json`
2. Check output folder: `web/public/wealden-ai/`
3. Verify Next.js can access public folder
4. Restart dev server after running pipeline

### Re-run pipeline
Safe to run multiple times. Will overwrite previous output.

```bash
cd web && pnpm wealden:images
```
