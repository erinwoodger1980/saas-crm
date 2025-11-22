# Vision Inference Guide

## Overview
The public estimator now supports multi-layer image understanding with three sources:
- Heuristic: Fast client-side aspect ratio + dominant color rules.
- AI: Server OpenAI-assisted inference with resizing, EXIF context, truncated base64 head and caching.
- Depth Stub: Prototype endpoint for LiDAR / depth point input to approximate dimensions.

## Endpoints
- `POST /public/vision/analyze-photo`
  Payload: `{ imageHeadBase64, fileName, openingType, aspectRatio, exif, headHash? }`
  Response: `{ width_mm, height_mm, description, confidence, cached?, cacheLayer? }`
  Notes:
    - Two-tier cache: Redis (24h TTL) then in-memory (5m TTL).
    - SHA-1 hash of truncated base64 head used as key.
    - AI call retried up to 3 attempts with incremental backoff.
    - Confidence calibrated post-inference for plausibility (size ranges per openingType).
    - Telemetry (duration, cost, tokens) recorded in memory (enable console via `VISION_TELEMETRY_LOG=1`).

- `POST /public/vision/depth-analyze`
  Payload: `{ points: [{x,y,z},...], openingType?, anchorWidthMm? }`
  Response: `{ width_mm, height_mm, description, confidence }`
  Notes:
    - Performs PCA on XY to derive oriented bounding box then scales.
    - Uses anchorWidthMm for absolute scaling if provided, otherwise heuristic normalization.
    - Confidence derives from point count + calibrated plausibility filter.

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
- <40%: Rough estimate; manual measurement recommended.
- 40%-69%: Provisional; verify on site.
- >=70%: High confidence; expect close alignment.
- Calibration may increase/decrease raw model score based on plausibility of dimensions.

## Extensibility Roadmap
- Integrate real LiDAR scaling (multi-plane segmentation; door leaf vs frame).
- Persist telemetry buffer to database for trend analysis & cost optimization.
- Ensemble scoring: blend heuristic, AI, historical priors, depth metrics.
- Advanced EXIF & quality metrics (blur, noise) to trigger retake suggestions.
- Confidence decay over time if dimensions edited manually post-inference.

## Failure Modes & Fallbacks
- Missing `OPENAI_API_KEY`: AI block skipped; heuristic dims used; confidence ~0.3.
- AI parse error: Log warning, revert to heuristic dims.
- Corrupt image / load error: Heuristic returns empty; user can input manually.

## Security & Cost Controls
- Truncated base64 head limits token usage & exposure surface.
- Redis TTL enforces automated expiration (24h) for vision cache entries.
- SHA-1 key avoids storing full images; only small head retained transiently.
- Retry with low backoff prevents excessive duplicate token spend on transient failures.

## Updating / Testing
Run a build to verify types after changes:
```bash
npm run build
```
Trigger local inference by uploading an image via estimator UI; check Network tab for cached flag toggling on repeat uploads.
