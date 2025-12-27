/**
 * AI Component Configurator - Parametric Version
 * Embeds ProductConfigurator3D to render parametric door/window designs from AI suggestions
 * AI suggests ProductParams + addedParts; builders handle real joinery geometry
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Loader2, Wand2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ProductParams, AddedPart } from '@/types/parametric-builder';
import { getOrCreateParams } from '@/lib/scene/builder-registry';
import { ProductConfigurator3D } from './ProductConfigurator3D';
import { updateQuoteLine } from '@/lib/api/quotes';
import { diffProductParams } from '@/lib/scene/parametric-overrides';

interface AIComponentConfiguratorProps {
  tenantId: string;
  lineItem: any;
  description?: string;
  onClose?: () => void;
  height?: string | number;
}

interface AIResponse {
  suggestedParamsPatch: Partial<ProductParams>;
  suggestedAddedParts: AddedPart[];
  rationale: string;
}

export function AIComponentConfigurator({
  tenantId,
  lineItem,
  description: initialDescription = '',
  onClose,
  height = '80vh',
}: AIComponentConfiguratorProps) {
  const [description, setDescription] = useState(initialDescription);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AIResponse | null>(null);
  const [appliedParams, setAppliedParams] = useState<ProductParams | null>(null);

  /**
   * Get initial params from line item
   */
  const baseParams = useMemo(() => {
    return getOrCreateParams(lineItem);
  }, [lineItem]);

  /**
   * Merge AI suggestions into current params
   */
  const mergeParams = useCallback((base: ProductParams | null, suggestion: AIResponse): ProductParams => {
    const baseParams = base as any;
    if (!base) {
      // Start fresh from suggestion
      return {
        productType: suggestion.suggestedParamsPatch.productType || {
          category: 'doors',
          type: 'entrance',
          option: 'E01',
        },
        dimensions: baseParams?.dimensions || { width: 914, height: 2032, depth: 45 },
        construction: {
          ...baseParams?.construction,
          ...suggestion.suggestedParamsPatch.construction,
        },
        addedParts: [...(baseParams?.addedParts || []), ...suggestion.suggestedAddedParts],
        curves: baseParams?.curves,
        curveSlots: baseParams?.curveSlots,
      };
    }

    // Deep merge construction fields
    return {
      ...base,
      productType: suggestion.suggestedParamsPatch.productType || base.productType,
      construction: {
        ...base.construction,
        ...suggestion.suggestedParamsPatch.construction,
      },
      addedParts: [...(base.addedParts || []), ...suggestion.suggestedAddedParts],
    };
  }, []);

  /**
   * Call OpenAI to generate parametric suggestions
   */
  const handleGeneratePreview = useCallback(async () => {
    if (!description.trim()) {
      toast.error('Please enter a product description');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          description: description.trim(),
          productType: lineItem?.configuredProduct?.productType,
          existingDimensions: lineItem?.lineStandard,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData.error || ''}`);
      }

      const data: AIResponse = await response.json();
      setAiSuggestion(data);

      // Merge suggestions into params and apply
      const merged = mergeParams(baseParams, data);
      setAppliedParams(merged);

      toast.success('AI suggestions generated');
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  }, [description, tenantId, lineItem, baseParams, mergeParams]);

  /**
   * Save suggestions to quote line item
   */
  const handleSaveToQuote = useCallback(async () => {
    if (!appliedParams) {
      toast.error('No suggestions to save. Generate a preview first.');
      return;
    }

    setIsSaving(true);
    try {
      const templateParams =
        lineItem?.configuredProduct?.templateParams ||
        lineItem?.meta?.configuredProductTemplateParams;
      const overrides = templateParams ? diffProductParams(templateParams, appliedParams) : appliedParams;

      // Persist to quote line item via API
      await updateQuoteLine(tenantId, lineItem.id, {
        meta: {
          ...lineItem.meta,
          ...(templateParams
            ? {
                configuredProductTemplateParams: templateParams,
                configuredProductOverrides: overrides,
              }
            : {
                configuredProductParams: appliedParams,
              }),
          configuredProduct: {
            ...lineItem.configuredProduct,
            productType: appliedParams.productType,
            customData: appliedParams,
          },
        },
      });

      toast.success('Saved to quote line item');

      // Close after successful save
      if (onClose) {
        setTimeout(onClose, 500);
      }
    } catch (error) {
      console.error('Error saving to quote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [appliedParams, lineItem, tenantId, onClose]);

  // Patcher function to update appliedParams when ProductConfigurator3D changes
  const patchedLineItem = useMemo(() => {
    const templateParams =
      lineItem?.configuredProduct?.templateParams ||
      lineItem?.meta?.configuredProductTemplateParams;
    const overrides = templateParams && appliedParams ? diffProductParams(templateParams, appliedParams) : appliedParams;

    return {
      ...lineItem,
      lineStandard: {
        ...lineItem.lineStandard,
        widthMm: appliedParams?.dimensions.width || lineItem.lineStandard?.widthMm || 914,
        heightMm: appliedParams?.dimensions.height || lineItem.lineStandard?.heightMm || 2032,
        thicknessMm: appliedParams?.dimensions.depth || lineItem.lineStandard?.thicknessMm || 45,
      },
      configuredProduct: {
        ...lineItem.configuredProduct,
        productType: appliedParams?.productType || lineItem.configuredProduct?.productType,
        customData: appliedParams,
      },
      meta: {
        ...lineItem.meta,
        ...(templateParams
          ? {
              configuredProductTemplateParams: templateParams,
              configuredProductOverrides: overrides,
            }
          : {
              configuredProductParams: appliedParams,
            }),
      },
    };
  }, [appliedParams, lineItem]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden min-h-0" style={{ height }}>
      {/* Header with description + buttons */}
      <div className="p-4 border-b space-y-3 bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
        <h2 className="text-lg font-semibold">AI Product Suggestion</h2>

        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your product (e.g., 'Oak entrance door with 4 panels and glazed top')"
            className="min-h-20 resize-none text-sm font-medium"
          />

          <div className="flex gap-2">
            <Button
              onClick={handleGeneratePreview}
              disabled={isGenerating || !description.trim()}
              className="gap-2 flex-1 h-10 text-sm font-medium"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate AI Suggestion
                </>
              )}
            </Button>

            {appliedParams && (
              <Button
                onClick={handleSaveToQuote}
                disabled={isSaving}
                variant="default"
                className="gap-2 flex-1 h-10 text-sm font-medium bg-green-600 hover:bg-green-700"
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save to Quote
                  </>
                )}
              </Button>
            )}
          </div>

          {aiSuggestion && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs">
              <p className="font-semibold text-blue-900 mb-1">AI Rationale:</p>
              <p className="text-blue-800">{aiSuggestion.rationale}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main configurator - render ProductConfigurator3D with applied params */}
      {appliedParams ? (
        <div className="flex-1 relative min-h-0">
          <ProductConfigurator3D
            tenantId={tenantId}
            entityType="quoteLineItem"
            entityId={`preview-${lineItem.id}`}
            lineItem={patchedLineItem}
            onClose={onClose}
            width="100%"
            height="100%"
            heroMode={true}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-0">
          <div className="text-center space-y-3">
            <div className="text-5xl">✨</div>
            <p className="text-muted-foreground font-medium">Enter a description and click "Generate AI Suggestion"</p>
            <p className="text-xs text-muted-foreground">AI will propose parametric design with professional rendering</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 flex gap-2 shrink-0">
        {onClose && (
          <Button onClick={onClose} variant="outline" className="flex-1 h-9 text-sm" size="sm">
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
