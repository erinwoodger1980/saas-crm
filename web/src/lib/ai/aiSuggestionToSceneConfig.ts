/**
 * AI Suggestion to SceneConfig Converter
 * 
 * Canonical function to convert AI estimation results into complete SceneConfig
 * using parametric builders. Ensures consistent AI→3D flow across Settings and Line Items.
 */

import type { SceneConfig } from '@/types/scene-config';
import type { ProductParams, AddedPart } from '@/types/parametric-builder';

export interface AIEstimateResponse {
  suggestedParamsPatch: Partial<ProductParams>;
  suggestedAddedParts: AddedPart[];
  rationale: string;
}

export interface AISuggestionToSceneConfigArgs {
  /** Base ProductParams with dimensions and defaults from UI/builder */
  baseParams: ProductParams;
  /** AI estimation response with parametric suggestions */
  ai: AIEstimateResponse;
  /** Entity context for SceneConfig metadata */
  context: {
    tenantId: string;
    entityType: 'productTemplate' | 'quoteLineItem';
    entityId: string;
  };
}

/**
 * Convert AI estimation result to complete SceneConfig using parametric builders
 * 
 * Flow:
 * 1. Merge AI suggestions (suggestedParamsPatch) into baseParams
 * 2. Get appropriate builder for product category (doors/windows)
 * 3. Call builder to generate components, materials, lighting
 * 4. Create complete SceneConfig with camera, visibility, UI
 * 5. Store ProductParams in customData for regeneration
 * 
 * @param args - Base params, AI response, and entity context
 * @returns Complete SceneConfig ready for ProductConfigurator3D
 */
export function aiSuggestionToSceneConfig({
  baseParams,
  ai,
  context,
}: AISuggestionToSceneConfigArgs): SceneConfig {
  const { suggestedParamsPatch, suggestedAddedParts, rationale } = ai;
  
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.group('[aiSuggestionToSceneConfig] Starting conversion');
    console.log('Base dimensions:', baseParams.dimensions);
    console.log('Product type:', baseParams.productType);
    console.log('AI patch keys:', Object.keys(suggestedParamsPatch));
    console.log('Added parts count:', suggestedAddedParts?.length || 0);
  }

  // Import builders dynamically to avoid circular deps
  const { initializeSceneFromParams, getBuilder } = require('@/lib/scene/builder-registry');
  
  // Get appropriate builder for product category
  const builder = getBuilder(baseParams.productType.category);
  
  if (isDev) {
    console.log('Builder selected:', baseParams.productType.category);
  }

  // Merge AI suggestions into base params
  const mergedParams: ProductParams = {
    ...baseParams,
    ...suggestedParamsPatch,
    productType: suggestedParamsPatch.productType || baseParams.productType,
    dimensions: baseParams.dimensions, // Always use base dimensions (from UI)
    construction: {
      ...baseParams.construction,
      ...suggestedParamsPatch.construction,
    },
    addedParts: suggestedAddedParts || [],
  };

  if (isDev) {
    console.log('Merged construction:', {
      stileWidth: mergedParams.construction?.stileWidth,
      topRail: mergedParams.construction?.topRail,
      midRail: mergedParams.construction?.midRail,
      bottomRail: mergedParams.construction?.bottomRail,
      thickness: mergedParams.construction?.thickness,
      timber: mergedParams.construction?.timber,
      finish: mergedParams.construction?.finish,
      glazingType: mergedParams.construction?.glazingType,
    });
  }

  // Generate complete SceneConfig using builder infrastructure
  const sceneConfig: SceneConfig = initializeSceneFromParams(
    mergedParams,
    context.tenantId,
    context.entityType,
    context.entityId
  );

  // Store parametric source of truth in customData
  sceneConfig.customData = {
    ...sceneConfig.customData,
    productParams: mergedParams,
    aiRationale: rationale,
    aiGeneratedAt: new Date().toISOString(),
  };

  if (isDev) {
    console.log('SceneConfig generated:', {
      version: sceneConfig.version,
      componentCount: sceneConfig.components?.length || 0,
      materialCount: Object.keys(sceneConfig.materials || {}).length,
      hasCamera: !!sceneConfig.camera,
      hasLighting: !!sceneConfig.lighting,
      lightingBounds: sceneConfig.lighting?.bounds,
      shadowDiameter: sceneConfig.lighting?.shadowDiameter,
      visibilityKeys: Object.keys(sceneConfig.visibility || {}),
    });
    console.groupEnd();
  }

  return sceneConfig;
}
