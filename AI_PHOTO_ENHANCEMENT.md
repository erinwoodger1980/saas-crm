# AI Photo Enhancement for Example Photos

## Overview

The example photo gallery now includes **one-click AI enhancement** to professionalize product photos before displaying them to customers.

## Features

### AI Enhancement Models

**Primary: Real-ESRGAN (Upscaling + Detail Enhancement)**
- Upscales images 2x or 4x while adding realistic detail
- Enhances clarity and sharpness
- Removes compression artifacts
- Perfect for product photography

**Fallback: Sharp-based Enhancement**
- When AI API unavailable or quota exceeded
- Auto-levels (normalize brightness/contrast)
- Sharpening
- Saturation boost
- Brightness adjustment

**Optional: Background Removal**
- Removes backgrounds for clean product shots
- Uses RemBG model via Replicate
- Creates professional catalog-style photos

### Enhancement Types

1. **Professional (Default)**
   - 2x upscaling
   - Noise reduction
   - Detail enhancement
   - Auto color correction
   - Sharpening

2. **Upscale**
   - Simple 2x or 4x resolution increase
   - Preserves original style
   - Faster processing

3. **Denoise**
   - Removes noise and grain
   - Cleans up low-light photos
   - Uses Google Research MAXIM model

## Usage

### Admin UI

1. Navigate to `/admin/example-photos`
2. Find photo to enhance
3. Click **"Enhance"** button (sparkle icon)
4. Confirm replacement
5. Wait 10-30 seconds for processing
6. Photo automatically updates with enhanced version

**Note**: Original image is archived with `_old` suffix in case you need to revert.

### API Endpoint

```http
POST /example-photos/:photoId/enhance
Content-Type: application/json

{
  "type": "professional",  // professional | upscale | denoise
  "removeBackground": false
}

Response:
{
  "success": true,
  "photo": { ... updated photo object },
  "enhanced": true,
  "method": "AI"  // "AI" or "basic"
}
```

## Setup

### Environment Variables

Add to `.env`:

```bash
# Replicate API for AI image enhancement
REPLICATE_API_TOKEN=r8_xxx...
```

**Get API Token:**
1. Sign up at https://replicate.com
2. Go to Account → API Tokens
3. Create new token
4. Add to environment

**Pricing:**
- Free tier: $5 credit (50-100 images)
- Pay-as-you-go: ~$0.05-0.10 per image
- Real-ESRGAN: $0.0023 per prediction
- RemBG: $0.0011 per prediction

### Installation

```bash
cd api
pnpm install  # Installs replicate package
```

## How It Works

1. **Retrieves original image** from storage
2. **Converts to base64** for API submission
3. **Sends to Replicate** with selected model
4. **Downloads enhanced result**
5. **Applies Sharp post-processing**:
   - Auto color normalization
   - Sharpening
   - Quality optimization
6. **Generates new thumbnail** (400x300px)
7. **Archives old image** (adds `_old` suffix)
8. **Updates database** with new URLs
9. **Returns success** with method used

## Benefits

### For Customers
- **Professional appearance** builds trust
- **Clear details** make selection easier
- **Consistent quality** across gallery
- **Better color accuracy**

### For Business
- **No manual editing** required
- **Consistent branding**
- **Higher conversion** from better photos
- **Time savings** (instant vs hours in Photoshop)

### For ML Training
- **Better image quality** → better feature extraction
- **Standardized input** → more consistent training
- **Enhanced details** → model learns finer patterns

## Advanced Usage

### Batch Enhancement

Enhance multiple photos:

```typescript
const photoIds = ["id1", "id2", "id3"];

for (const id of photoIds) {
  await fetch(`/example-photos/${id}/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "professional" }),
  });
  
  // Wait 30 seconds between requests to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 30000));
}
```

### Custom Enhancement Pipeline

Modify `photo-enhancement.ts`:

```typescript
// Add custom processing
await sharp(enhancedPath)
  .normalize()
  .sharpen({ sigma: 1.5 })
  .modulate({ saturation: 1.2 })
  .toColorspace("srgb")
  .jpeg({ quality: 95 })
  .toFile(outputPath);
```

### Background Removal for Product Catalogs

```typescript
await fetch(`/example-photos/${photoId}/enhance`, {
  method: "POST",
  body: JSON.stringify({ 
    type: "professional",
    removeBackground: true  // Creates white/transparent background
  }),
});
```

## Error Handling

### Fallback Strategy

1. **Try AI enhancement** (if API token available)
2. **On failure**, use Sharp-based basic enhancement
3. **On Sharp failure**, keep original
4. **Always return success** with method indicator

### Common Issues

**"AI enhancement failed"**
- Check REPLICATE_API_TOKEN is set
- Verify API token is valid
- Check Replicate account has credit
- Falls back to basic enhancement automatically

**"Enhancement timeout"**
- Large images take longer (30-60s)
- Increase timeout in production
- Consider queue system for batch processing

**"Out of memory"**
- Very large images can cause issues
- Pre-resize to max 4096px before enhancing
- Use Sharp to downsample first

## Performance

### Processing Time
- AI enhancement: 10-30 seconds
- Basic enhancement: 1-2 seconds
- Background removal: +5-10 seconds

### Optimization Tips
1. **Pre-process large images**: Resize to 2048px max before enhancing
2. **Queue system**: Process enhancements asynchronously
3. **Cache results**: Store enhanced versions permanently
4. **Batch at night**: Enhance during off-peak hours

## Future Enhancements

1. **Automatic Enhancement on Upload**
   - Checkbox: "Auto-enhance uploaded photos"
   - Applies during upload process
   
2. **Style Transfer**
   - Apply consistent brand styling
   - Match company's visual identity
   
3. **Smart Cropping**
   - AI-powered composition improvement
   - Center products automatically
   
4. **Lighting Adjustment**
   - Fix underexposed/overexposed photos
   - Studio lighting simulation
   
5. **Comparison View**
   - Before/after slider in admin
   - Revert to original option

## Monitoring

### Track Enhancement Success

Add analytics to track:
- Success rate (AI vs fallback)
- Processing time
- Error rate
- API costs

```typescript
// Log enhancement metrics
await prisma.enhancementLog.create({
  data: {
    photoId,
    method: usingAI ? "AI" : "basic",
    processingTimeMs: endTime - startTime,
    success: true,
  }
});
```

## Cost Management

**Free Tier Strategy:**
- Enhance only high-value photos
- Use basic enhancement for drafts
- Batch process during free credits

**Production Strategy:**
- Budget $50/month = ~500 photos
- Cache all enhancements
- Only enhance once per photo
- Consider resizing before enhancement (reduces cost)

---

**Summary**: One-click AI enhancement transforms amateur product photos into professional-quality images, improving customer trust and conversion rates while saving hours of manual editing work.
