/**
 * useFieldEvaluation Hook
 * Evaluates calculated fields and lookups
 */

'use client';

import { useCallback, useState } from 'react';

interface EvaluationResult {
  result: any;
  field: {
    id: string;
    key: string;
    label: string;
  };
}

interface UseFieldEvaluationOptions {
  tenantId: string;
}

interface UseFieldEvaluationReturn {
  evaluate: (fieldId: string, inputs: Record<string, any>, context?: string) => Promise<any>;
  results: Map<string, any>;
  loading: Set<string>;
  errors: Map<string, string>;
}

export function useFieldEvaluation(options: UseFieldEvaluationOptions): UseFieldEvaluationReturn {
  const { tenantId } = options;
  const [results, setResults] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const evaluate = useCallback(
    async (fieldId: string, inputs: Record<string, any>, context?: string): Promise<any> => {
      setLoading((prev) => new Set([...prev, fieldId]));
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(fieldId);
        return next;
      });

      try {
        const response = await fetch('/api/flexible-fields/evaluate-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            fieldId,
            inputs,
            context,
          }),
        });

        if (!response.ok) {
          throw new Error(`Evaluation failed: ${response.statusText}`);
        }

        const data: EvaluationResult = await response.json();

        setResults((prev) => new Map(prev).set(fieldId, data.result));
        return data.result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Evaluation failed';
        setErrors((prev) => new Map(prev).set(fieldId, message));
        throw err;
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(fieldId);
          return next;
        });
      }
    },
    [tenantId]
  );

  return { evaluate, results, loading, errors };
}

/**
 * Formula evaluation utility
 * Evaluates calculation formulas with input values
 */
export function evaluateFormula(formula: string, inputs: Record<string, any>): number | null {
  try {
    // Replace field keys with their values
    let evaluatedFormula = formula;
    Object.entries(inputs).forEach(([key, value]) => {
      // Match whole word boundaries to avoid partial replacements
      evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
    });

    // Simple expression evaluation - be careful in production!
    // In a real app, use a safe expression evaluator library like decimal.js
    // eslint-disable-next-line no-eval
    const result = eval(evaluatedFormula);
    return typeof result === 'number' ? result : null;
  } catch (error) {
    console.error('[evaluateFormula] Error:', error);
    return null;
  }
}

/**
 * Lookup table matcher
 * Finds rows matching lookup criteria
 */
export function matchLookupRow(
  rows: any[],
  inputFields: string[],
  criteria: Record<string, any>,
  caseInsensitive = true
): any | null {
  return rows.find((row) =>
    inputFields.every((field) => {
      const rowValue = row[field];
      const criteriaValue = criteria[field];

      if (caseInsensitive && typeof rowValue === 'string' && typeof criteriaValue === 'string') {
        return rowValue.toLowerCase() === criteriaValue.toLowerCase();
      }

      return rowValue === criteriaValue;
    })
  ) || null;
}

/**
 * Batch evaluate multiple fields
 * More efficient than individual evaluations
 */
export async function batchEvaluateFields(
  tenantId: string,
  evaluations: Array<{
    fieldId: string;
    inputs: Record<string, any>;
    context?: string;
  }>
): Promise<Map<string, any>> {
  const results = new Map<string, any>();

  // Execute in parallel, but with reasonable batching
  const batchSize = 10;
  for (let i = 0; i < evaluations.length; i += batchSize) {
    const batch = evaluations.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map((eval_) =>
        fetch('/api/flexible-fields/evaluate-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            fieldId: eval_.fieldId,
            inputs: eval_.inputs,
            context: eval_.context,
          }),
        })
          .then((res) => res.json())
          .then((data: EvaluationResult) => ({
            fieldId: eval_.fieldId,
            result: data.result,
          }))
      )
    );

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.set(result.value.fieldId, result.value.result);
      }
    });
  }

  return results;
}
