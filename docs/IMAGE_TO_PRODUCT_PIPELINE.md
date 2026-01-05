# Image → Parametric Product Pipeline

This document describes the end-to-end flow from an uploaded image/description to an editable parametric product in JoineryAI.

## Overview

1. **Settings → Product Types (wizard entry)**
   * User uploads an image or enters a description.
   * `/api/ai/estimate-components` returns:
     * `suggestedParamsPatch`
     * `suggestedAddedParts`
     * optional `layoutHint`
     * `confidence`
2. **Canonical ProductParams merge**
   * The Settings flow merges the AI patch into a full `ProductParams` object.
   * The option’s `productParams` becomes the canonical template state.
3. **Deterministic layout resolution**
   * `resolveDoorLayout` / `resolveWindowLayout` convert `ProductParams` into explicit layout slots.
   * Layout overrides and AI layout hints are clamped and validated.
4. **Builder generation**
   * Door/window builders consume layout slots to create components, materials, and editable attributes.
   * Material roles map to semantic materials (wood, glass, metal, rubber).
5. **Parametric → SceneConfig adapter**
   * `parametricToSceneConfig` builds the scene from `ProductParams` and normalizes camera/lighting.
   * The result is cached by hash for fast iteration.
6. **Configurator editing**
   * Edits update `ProductParams` (or overrides) and then rebuild the scene.
   * Templates store canonical `ProductParams`.
   * Line items store template references plus overrides.

## Key Modules

- `web/src/lib/scene/layout/*`
  - Deterministic layout resolvers for doors and windows.
- `web/src/lib/scene/parametricToSceneConfig.ts`
  - Canonical adapter from params → SceneConfig with caching and normalization.
- `web/src/lib/scene/parametric-door.ts`
  - Consumes `DoorLayout` for rails, panels, glazing slots, and edit constraints.
- `web/src/lib/scene/parametric-window.ts`
  - Consumes `WindowLayout` for sash grid, mullions, and transoms.
- `web/src/app/api/ai/estimate-components/route.ts`
  - AI estimation endpoint (layout hints + confidence + cost logging).

## Settings Flow (Wizard)

1. **Step 1: Dimensions**
   * Apply product dimensions (width/height/depth).
2. **Step 2: Layout**
   * Edit rails/panels/mullions using layout-derived slots.
3. **Step 3: Materials**
   * Swap role-based materials (wood/glass/metal/seal).
4. **Step 4: Hardware**
   * Reserved for future enhancements.

## Notes

- `ProductParams` is the canonical source of truth.
- `SceneConfig` is always derived and normalized.
- Layout IDs are deterministic (no random IDs).
- AI cost logging prints:
  ```
  [AI COST][tenant=...] model=... tokens=... latencyMs=... confidence=...
  ```
