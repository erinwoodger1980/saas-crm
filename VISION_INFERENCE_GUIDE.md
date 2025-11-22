# Vision Inference Guide

## Overview
The public estimator now supports multi-layer image understanding with three sources:
- Heuristic: Fast client-side aspect ratio + dominant color rules.
- AI: Server OpenAI-assisted inference with resizing, EXIF context, truncated base64 head and caching.
- Depth Stub: Prototype endpoint for LiDAR / depth point input to approximate dimensions.

## Endpoints
- `POST /public/vision/analyze-photo`
  Payload: `{ imageHeadBase64, fileName, openingType, aspectRatio, exif, headHash? }`
  Response: `{ width_mm, height_mm, description, confidence, cached? }`
  Notes: In-memory 5 min cache keyed by SHA-1 hash of truncated base64 head. Falls back to heuristic if AI unavailable or missing dimensions.

- `POST /public/vision/depth-analyze`
  Payload: `{ points: [{x,y,z},...], openingType?, anchorWidthMm? }`
  Response: `{ width_mm, height_mm, description, confidence }`
  Notes: Stub implementation using planar bounding box; scales height via aspect. Used for future LiDAR integration.

## Client Flow
1. User uploads image.
2. Heuristic inference runs immediately (`inferFromImage`).
3. AI inference (`inferOpeningFromImage`) preprocesses: resize (max 1600px), extract minimal EXIF (Orientation, FocalLength, Model), truncate head (~12KB), hash for cache.
4. Client-side cache checks hash before network; server also caches.
5. UI displays confidence badge with color scale (>=70% green, >=40% amber, else red) and source label.
6. Optional depth stub button triggers `/public/vision/depth-analyze` with mock points.

## Persistence
`openingDetails[]` items now include:
- `inferenceSource: 'heuristic' | 'ai' | 'depth'`
- `inferenceConfidence: number`
These fields are stored transparently in the project `payload`.

## Confidence Guidance
- <40%: Treat as rough estimate; manual measurement recommended.
- 40%-69%: Acceptable provisional; verify on site.
- >=70%: High confidence; expect close alignment.

## Extensibility Roadmap
- Replace depth stub with true LiDAR point cloud scaling & plane fitting.
- Add server-side durability cache (Redis) for cross-session reuse.
- Introduce model ensemble (heuristic + AI + historical dimension priors).
- Expand EXIF usage (exposure, ISO) to detect motion blur / request retake.

## Failure Modes & Fallbacks
- Missing `OPENAI_API_KEY`: AI block skipped; heuristic dims used; confidence ~0.3.
- AI parse error: Log warning, revert to heuristic dims.
- Corrupt image / load error: Heuristic returns empty; user can input manually.

## Security & Cost Controls
- Truncating base64 reduces token usage and prevents full raw image leakage.
- SHA-1 hash is used only for caching; do not store full image in memory beyond TTL.
- Resize ensures consistent token footprint.

## Updating / Testing
Run a build to verify types after changes:
```bash
npm run build
```
Trigger local inference by uploading an image via estimator UI; check Network tab for cached flag toggling on repeat uploads.
