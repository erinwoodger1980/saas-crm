# Wealden Image Upload - Quick Reference

## For Developers

### Using ImageSlot Component

```tsx
import { ImageSlot } from "../_components/image-slot";

// Basic usage
<ImageSlot
  slotId="unique-id"           // Required: unique key for localStorage
  label="Hero Image"            // Required: accessibility label
/>

// With optimization context
<ImageSlot
  slotId="product-card"
  label="Product Image"
  imageContext="card"          // Optimizes to 1600px
  aspectRatio="aspect-[4/3]"   // Tailwind class
  size="lg"                     // sm | md | lg | xl
/>

// Hero image (large)
<ImageSlot
  slotId="page-hero"
  label="Page Hero"
  imageContext="hero"          // Optimizes to 2400px
  aspectRatio="aspect-[21/9]"
  size="xl"
/>
```

### Image Context Guide

| Context | Max Edge | Use Case |
|---------|----------|----------|
| `hero` | 2400px | Full-width hero images, lifestyle shots |
| `card` | 1600px | Product cards, project images, galleries |
| `thumbnail` | 800px | Small preview images, icons |
| `default` | 2000px | General purpose (fallback) |

### Avoiding Navigation Conflicts

❌ **DON'T** wrap ImageSlot in Link:
```tsx
<Link href="/page">
  <ImageSlot slotId="test" label="Test" />
  <h3>Title</h3>
</Link>
```

✅ **DO** keep ImageSlot outside Link:
```tsx
<div className="group">
  <ImageSlot slotId="test" label="Test" />
  <Link href="/page">
    <h3>Title</h3>
  </Link>
</div>
```

### localStorage Keys

Pattern: `wealden-image-{slotId}`

```javascript
// Check stored images
Object.keys(localStorage)
  .filter(k => k.startsWith('wealden-image-'))

// Clear all images
Object.keys(localStorage)
  .filter(k => k.startsWith('wealden-image-'))
  .forEach(k => localStorage.removeItem(k))

// Clear specific image
localStorage.removeItem('wealden-image-home-hero')
```

### Testing Checklist

1. **Navigation test**: Click upload button → file picker opens, NO navigation
2. **Compression test**: Upload 5MB image → compresses to < 1MB in ~1-2s
3. **Quality test**: View compressed image → no visible degradation
4. **Persistence test**: Refresh page → images remain
5. **Error test**: Upload .pdf file → shows error message

### Console Messages

Look for these in browser console:

```
✅ Success:
[Image Optimizer] ✓ Optimized: 3276KB → 892KB (3.67x compression)

⚠️ Warning:
[Image Optimizer] Could not compress below 1000KB. Final size: 1024KB

ℹ️ Info:
[Image Optimizer] File already optimized: 487.3KB

❌ Error:
[Image Optimizer] Optimization failed: Invalid file type
```

### Common Pitfalls

1. **Duplicate slotIds** → Images overwrite each other
2. **ImageSlot in Link** → Upload triggers navigation
3. **Missing imageContext** → Uses default 2000px (not optimal)
4. **localStorage full** → Compression works but save fails

### Performance Tips

- Use smallest appropriate `imageContext` (don't use `hero` for thumbnails)
- Keep slotIds short (saves localStorage space)
- Compress very large images before upload (e.g., resize to 4000px max)
- Limit total slots per page (localStorage ~5-10MB limit)

### API Reference

```typescript
// imageOptimizer.ts
optimizeImageFile(
  file: File,
  options?: {
    maxEdgePx?: number,      // Default: 2000
    targetBytes?: number,     // Default: 1_000_000 (1MB)
    initialQuality?: number,  // Default: 0.86
    qualityStep?: number,     // Default: 0.04
    minQuality?: number       // Default: 0.6
  }
): Promise<OptimizeResult>

getRecommendedMaxEdge(
  context: 'hero' | 'card' | 'thumbnail' | 'default'
): number
```

### Supported Formats

**Input**: JPEG, JPG, PNG, WEBP, HEIC
**Output**: JPEG (photos), PNG (transparency), WebP (if already used)

### File Size Limits

- **Target**: < 1MB per image (automatic)
- **localStorage**: ~5-10MB total (browser dependent)
- **Recommended**: Keep under 50 images total

### Browser Support

✅ Chrome/Edge, Safari, Firefox, Mobile Safari, Mobile Chrome
❌ IE11 (not supported, shows static placeholders)

---

## Quick Debug Commands

```javascript
// In browser console:

// View all images
Object.keys(localStorage)
  .filter(k => k.startsWith('wealden'))
  .map(k => ({
    key: k,
    size: (localStorage[k].length / 1024).toFixed(1) + 'KB'
  }))

// Total localStorage usage
Object.keys(localStorage).reduce((sum, k) => 
  sum + localStorage[k].length, 0) / 1024 / 1024

// Clear Wealden images only
Object.keys(localStorage)
  .filter(k => k.startsWith('wealden-image-'))
  .forEach(k => localStorage.removeItem(k))
```

---

## Component States

| State | Button Text | Icon | Duration |
|-------|-------------|------|----------|
| `idle` (no image) | "Upload" | Upload icon | - |
| `idle` (has image) | "Replace" | Upload icon | - |
| `optimizing` | "Optimizing..." | Spinner | 1-3s |
| `success` | "Optimized ✓" | Check | 2s |
| `error` | "Error" | None | 2s |

---

## Need Help?

1. Check `WEALDEN_IMAGE_UPLOAD_SMOKE_TESTS.md` for comprehensive testing
2. Check `WEALDEN_IMAGE_UPLOAD_IMPLEMENTATION.md` for architecture details
3. Check browser console for [Image Optimizer] messages
4. Verify imageSlot component has proper `e.preventDefault()` and `z-10`

