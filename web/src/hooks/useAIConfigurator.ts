/**
 * AI Template Configurator Hook
 * 
 * Manages the AI template generation and resolution flow:
 * 1. User enters description/image
 * 2. Call AI API to get TemplateDraft
 * 3. Resolve to ResolvedProduct
 * 4. Build SceneConfig
 * 5. Handle editing and re-resolution
 */

import { useState, useCallback } from 'react';
import type { TemplateDraft, ResolvedProduct } from '@/types/resolved-product';
import type { SceneConfig } from '@/types/scene-config';
import { resolveProductComplete } from '@/lib/scene/resolve-product';
import { buildSceneFromResolvedProduct } from '@/lib/scene/scene-builder';

export interface UseAIConfiguratorOptions {
  onSceneChange?: (scene: SceneConfig) => void;
  onProductChange?: (product: ResolvedProduct) => void;
}

export interface UseAIConfiguratorReturn {
  // State
  loading: boolean;
  error: string | null;
  draft: TemplateDraft | null;
  product: ResolvedProduct | null;
  scene: SceneConfig | null;
  
  // Actions
  generateFromDescription: (description: string, imageBase64?: string) => Promise<void>;
  resolveProduct: () => Promise<void>;
  updateComponent: (instanceId: string, updates: any) => void;
  reset: () => void;
}

export function useAIConfigurator(options: UseAIConfiguratorOptions = {}): UseAIConfiguratorReturn {
  const { onSceneChange, onProductChange } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [product, setProduct] = useState<ResolvedProduct | null>(null);
  const [scene, setScene] = useState<SceneConfig | null>(null);
  
  /**
   * Generate template draft from description
   */
  const generateFromDescription = useCallback(async (description: string, imageBase64?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/product-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          imageBase64,
          productCategory: 'doors', // Default for now
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate template');
      }
      
      const templateDraft: TemplateDraft = await response.json();
      setDraft(templateDraft);
      
      // Auto-resolve to product
      await resolveAndBuild(templateDraft);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useAIConfigurator] generateFromDescription error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Resolve current draft to product
   */
  const resolveProduct = useCallback(async () => {
    if (!draft) {
      setError('No draft to resolve');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await resolveAndBuild(draft);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useAIConfigurator] resolveProduct error:', err);
    } finally {
      setLoading(false);
    }
  }, [draft]);
  
  /**
   * Resolve draft and build scene
   */
  const resolveAndBuild = useCallback(async (templateDraft: TemplateDraft) => {
    // Resolve template to product (with BOM/cutlist/pricing)
    const resolvedProduct = await resolveProductComplete(templateDraft);
    setProduct(resolvedProduct);
    onProductChange?.(resolvedProduct);
    
    // Build scene config from resolved product
    const sceneConfig = buildSceneFromResolvedProduct(resolvedProduct);
    setScene(sceneConfig);
    onSceneChange?.(sceneConfig);
  }, [onSceneChange, onProductChange]);
  
  /**
   * Update a component instance (for editing)
   */
  const updateComponent = useCallback((instanceId: string, updates: any) => {
    if (!product || !draft) return;
    
    // For now, this is a simplified version
    // Full implementation would back-propagate to draft expressions
    // and then re-resolve
    
    // TODO: Implement full editing flow with expression back-propagation
    console.warn('[useAIConfigurator] updateComponent not yet fully implemented', { instanceId, updates });
  }, [product, draft]);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setDraft(null);
    setProduct(null);
    setScene(null);
    setError(null);
  }, []);
  
  return {
    loading,
    error,
    draft,
    product,
    scene,
    generateFromDescription,
    resolveProduct,
    updateComponent,
    reset,
  };
}
