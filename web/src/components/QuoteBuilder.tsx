/**
 * Phase 6: Quote Builder Integration Component
 * 
 * Integrates ProductTypeSelector + QuestionSetForm into the quote workflow
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { ProductTypeSelector } from './ProductTypeSelector';
import { QuestionSetForm } from './QuestionSetForm';

interface QuoteBuilderStepConfig {
  step: 'select-product' | 'fill-questionnaire' | 'review';
  productTypeId?: string;
  selections?: Record<string, any>;
  completeness?: number;
}

interface QuoteBuilderProps {
  quoteId?: string;
  initialProductTypeId?: string;
  initialSelections?: Record<string, any>;
  productTypes: any[];
  questions?: any[];
  attributes?: any[];
  onSave?: (payload: {
    productTypeId: string;
    selections: Record<string, any>;
    completenessPercent: number;
  }) => Promise<void>;
  onClose?: () => void;
  loading?: boolean;
}

const QUOTE_BUILDER_STORAGE_KEY = 'quote-builder-draft';

/**
 * Saves draft to localStorage for recovery on disconnect
 */
function saveDraft(data: QuoteBuilderStepConfig, quoteId?: string) {
  const key = quoteId ? `${QUOTE_BUILDER_STORAGE_KEY}-${quoteId}` : QUOTE_BUILDER_STORAGE_KEY;
  try {
    localStorage.setItem(key, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
}

/**
 * Loads draft from localStorage
 */
function loadDraft(quoteId?: string): QuoteBuilderStepConfig | null {
  const key = quoteId ? `${QUOTE_BUILDER_STORAGE_KEY}-${quoteId}` : QUOTE_BUILDER_STORAGE_KEY;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Failed to load draft:', e);
    return null;
  }
}

/**
 * Clears draft from localStorage
 */
function clearDraft(quoteId?: string) {
  const key = quoteId ? `${QUOTE_BUILDER_STORAGE_KEY}-${quoteId}` : QUOTE_BUILDER_STORAGE_KEY;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear draft:', e);
  }
}

export interface QuoteBuilderState {
  step: 'select-product' | 'fill-questionnaire' | 'review';
  productTypeId?: string;
  selections: Record<string, any>;
  completeness: number;
}

/**
 * Quote Builder Component
 * Multi-step flow: select product type → fill questionnaire → review
 */
export const QuoteBuilder: React.FC<QuoteBuilderProps> = ({
  quoteId,
  initialProductTypeId,
  initialSelections = {},
  productTypes,
  questions = [],
  attributes = [],
  onSave,
  onClose,
  loading = false
}) => {
  // Initialize from draft or props
  const draft = useMemo(() => loadDraft(quoteId), [quoteId]);
  const [state, setState] = useState<QuoteBuilderState>({
    step: initialProductTypeId ? 'fill-questionnaire' : draft?.step || 'select-product',
    productTypeId: initialProductTypeId || draft?.productTypeId,
    selections: initialSelections || draft?.selections || {},
    completeness: draft?.completeness || 0
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-save draft as user progresses
  React.useEffect(() => {
    saveDraft({
      step: state.step,
      productTypeId: state.productTypeId,
      selections: state.selections,
      completeness: state.completeness
    }, quoteId);
  }, [state, quoteId]);

  // Get selected product type info
  const selectedProductType = useMemo(() => {
    if (!state.productTypeId) return null;
    return productTypes.find(pt => pt.id === state.productTypeId);
  }, [state.productTypeId, productTypes]);

  // Filter questions for selected product type
  const relevantQuestions = useMemo(() => {
    if (!state.productTypeId) return [];
    return questions.filter(q => {
      // If question has productTypeIds filter, check it
      if (q.productTypeIds?.length > 0) {
        return q.productTypeIds.includes(state.productTypeId);
      }
      return true;
    });
  }, [state.productTypeId, questions]);

  // Handle product type selection
  const handleSelectProductType = useCallback((productType: any) => {
    setState(prev => ({
      ...prev,
      step: 'fill-questionnaire',
      productTypeId: productType.id,
      selections: {} // Reset selections when changing product type
    }));
    setError(null);
  }, []);

  // Handle questionnaire changes
  const handleSelectionsChange = useCallback((newSelections: Record<string, any>, completeness: number) => {
    setState(prev => ({
      ...prev,
      selections: newSelections,
      completeness
    }));
  }, []);

  // Move to review step
  const handleReview = useCallback(() => {
    if (!state.productTypeId) {
      setError('Please select a product type');
      return;
    }
    if (state.completeness < 50) {
      setError('Please fill in at least 50% of required fields');
      return;
    }
    setState(prev => ({ ...prev, step: 'review' }));
    setError(null);
  }, [state.productTypeId, state.completeness]);

  // Save the quote
  const handleSave = useCallback(async () => {
    if (!state.productTypeId || !onSave) return;
    
    setSaving(true);
    setError(null);
    try {
      await onSave({
        productTypeId: state.productTypeId,
        selections: state.selections,
        completenessPercent: state.completeness
      });
      clearDraft(quoteId);
    } catch (e: any) {
      setError(e?.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  }, [state.productTypeId, state.selections, state.completeness, onSave, quoteId]);

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-6 px-4 py-3 bg-gray-50 rounded-lg">
      {['select-product', 'fill-questionnaire', 'review'].map((s, i) => {
        const stepName = {
          'select-product': 'Product',
          'fill-questionnaire': 'Questions',
          'review': 'Review'
        }[s];

        const isActive = state.step === s;
        const isComplete = 
          (s === 'select-product' && state.productTypeId) ||
          (s === 'fill-questionnaire' && state.completeness >= 50) ||
          false;

        return (
          <React.Fragment key={s}>
            <button
              onClick={() => {
                if (s === 'select-product' || (s === 'fill-questionnaire' && state.productTypeId)) {
                  setState(prev => ({ ...prev, step: s as any }));
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : isComplete
                  ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {isComplete && <CheckCircle2 size={16} />}
              <span>{stepName}</span>
            </button>
            {i < 2 && <ChevronRight size={20} className="text-gray-300" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {quoteId ? 'Edit Quote' : 'Create Quote'}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step: Select Product Type */}
        {state.step === 'select-product' && (
          <div className="space-y-4">
            <p className="text-gray-600">Select a product type to begin building your quote.</p>
            <ProductTypeSelector
              isOpen={true}
              productTypes={productTypes}
              onSelect={handleSelectProductType}
              loading={loading}
              onClose={() => onClose?.()}
            />
          </div>
        )}

        {/* Step: Fill Questionnaire */}
        {state.step === 'fill-questionnaire' && selectedProductType && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Product:</strong> {selectedProductType.name}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Complete the questionnaire to generate your quote.
              </p>
            </div>

            <QuestionSetForm
              questions={relevantQuestions}
              attributes={attributes}
              values={state.selections}
              onChange={handleSelectionsChange}
              completenessMode="quote-ready"
            />
          </div>
        )}

        {/* Step: Review */}
        {state.step === 'review' && selectedProductType && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Quote Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-green-700">Product Type:</dt>
                  <dd className="font-medium text-green-900">{selectedProductType.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-green-700">Questionnaire Complete:</dt>
                  <dd className="font-medium text-green-900">{state.completeness}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-green-700">Questions Answered:</dt>
                  <dd className="font-medium text-green-900">
                    {Object.keys(state.selections).length} of {relevantQuestions.length}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Selections Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Your Selections</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(state.selections).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-start text-sm border-b border-gray-200 pb-2"
                  >
                    <span className="text-gray-600">{key}</span>
                    <span className="font-medium text-gray-900">
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {state.step === 'fill-questionnaire' && (
            <span>{state.completeness}% complete</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state.step !== 'select-product' && (
            <button
              onClick={() => {
                if (state.step === 'fill-questionnaire') {
                  setState(prev => ({ ...prev, step: 'select-product' }));
                } else if (state.step === 'review') {
                  setState(prev => ({ ...prev, step: 'fill-questionnaire' }));
                }
              }}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Back
            </button>
          )}

          {state.step === 'fill-questionnaire' && (
            <button
              onClick={handleReview}
              disabled={loading || state.completeness < 50}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              Review & Proceed
            </button>
          )}

          {state.step === 'review' && (
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteBuilder;
