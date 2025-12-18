/**
 * Phase 6: useQuoteBuilder Hook
 * 
 * Manages quote builder state and handles API integration
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

interface UseQuoteBuilderOptions {
  quoteId?: string;
  tenantId?: string;
}

interface UseQuoteBuilderState {
  productTypes: any[];
  questions: any[];
  attributes: any[];
  loading: boolean;
  error: string | null;
}

interface UseQuoteBuilderActions {
  generateBOM: (lineId: string, selections: Record<string, any>) => Promise<any>;
  saveQuote: (payload: {
    productTypeId: string;
    selections: Record<string, any>;
    completenessPercent: number;
  }) => Promise<void>;
  syncAnswers: (responses: Record<string, any>) => Promise<void>;
}

export function useQuoteBuilder(
  options: UseQuoteBuilderOptions = {}
): UseQuoteBuilderState & UseQuoteBuilderActions {
  const { quoteId, tenantId } = options;
  const [state, setState] = useState<UseQuoteBuilderState>({
    productTypes: [],
    questions: [],
    attributes: [],
    loading: true,
    error: null
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Load product types
        const ptRes = await fetch('/api/configured-product/product-types', {
          headers: { 'tenant-id': tenantId || '' }
        });
        const productTypes = await ptRes.json();

        // Load questions
        const qRes = await fetch('/api/configured-product/questions', {
          headers: { 'tenant-id': tenantId || '' }
        });
        const questions = await qRes.json();

        // Load attributes
        const aRes = await fetch('/api/configured-product/attributes', {
          headers: { 'tenant-id': tenantId || '' }
        });
        const attributes = await aRes.json();

        setState(prev => ({
          ...prev,
          productTypes: Array.isArray(productTypes) ? productTypes : [],
          questions: Array.isArray(questions) ? questions : [],
          attributes: Array.isArray(attributes) ? attributes : [],
          loading: false
        }));
      } catch (e: any) {
        setState(prev => ({
          ...prev,
          error: e?.message || 'Failed to load quote builder data',
          loading: false
        }));
      }
    };

    loadData();
  }, [tenantId]);

  // Generate BOM for a quote line
  const generateBOM = useCallback(
    async (lineId: string, selections: Record<string, any>) => {
      try {
        const res = await fetch('/api/tenant/bom/generate-for-line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId,
            lineId,
            selections
          })
        });

        if (!res.ok) {
          throw new Error(`Failed to generate BOM: ${res.statusText}`);
        }

        return await res.json();
      } catch (e: any) {
        throw new Error(e?.message || 'BOM generation failed');
      }
    },
    [quoteId]
  );

  // Save quote with configured product data
  const saveQuote = useCallback(
    async (payload: {
      productTypeId: string;
      selections: Record<string, any>;
      completenessPercent: number;
    }) => {
      try {
        if (!quoteId) {
          throw new Error('No quoteId provided');
        }

        // First, save the quote with configuredProduct selections
        const res = await fetch(`/api/quotes/${quoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configuredProduct: {
              productTypeId: payload.productTypeId,
              selections: payload.selections,
              completeness: payload.completenessPercent,
              updatedAt: new Date().toISOString()
            }
          })
        });

        if (!res.ok) {
          throw new Error(`Failed to save quote: ${res.statusText}`);
        }

        // Then generate BOM for all lines
        const bomRes = await fetch('/api/tenant/bom/generate-for-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId })
        });

        if (!bomRes.ok) {
          console.warn('Failed to generate BOM during quote save');
        }

        return await res.json();
      } catch (e: any) {
        throw new Error(e?.message || 'Quote save failed');
      }
    },
    [quoteId]
  );

  // Sync all answers to configured product (for existing questionnaire responses)
  const syncAnswers = useCallback(
    async (responses: Record<string, any>) => {
      try {
        if (!quoteId) {
          throw new Error('No quoteId provided');
        }

        const res = await fetch('/api/tenant/configured-product/sync-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId,
            answers: responses
          })
        });

        if (!res.ok) {
          throw new Error(`Failed to sync answers: ${res.statusText}`);
        }

        return await res.json();
      } catch (e: any) {
        throw new Error(e?.message || 'Sync failed');
      }
    },
    [quoteId]
  );

  return {
    ...state,
    generateBOM,
    saveQuote,
    syncAnswers
  };
}

export default useQuoteBuilder;
