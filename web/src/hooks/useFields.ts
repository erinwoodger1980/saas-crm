/**
 * useFields Hook
 * Manages field data fetching, caching, and state
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: string;
  scope: string;
  isActive: boolean;
  isStandard: boolean;
  helpText?: string | null;
  options?: Array<{ value: string; label: string }> | null;
  displayContexts?: string[] | null;
}

interface UseFieldsOptions {
  scope?: string;
  context?: string;
  includeDisplayContexts?: boolean;
  tenantId?: string;
}

interface UseFieldsReturn {
  fields: QuestionnaireField[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Global cache for fields
const fieldCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useFields(options: UseFieldsOptions = {}): UseFieldsReturn {
  const { scope, context, includeDisplayContexts = true, tenantId } = options;
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `fields:${tenantId}:${scope || 'all'}:${context || 'all'}`;

  const fetchFields = useCallback(async () => {
    // Check cache
    const cached = fieldCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setFields(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const auth = getAuthIdsFromJwt();
      const params = new URLSearchParams();
      if (scope) params.append('scope', scope);
      if (context) params.append('context', context);
      if (includeDisplayContexts) params.append('includeDisplayContexts', 'true');

      const headers: Record<string, string> = {};
      if (auth) {
        headers['x-user-id'] = auth.userId;
        headers['x-tenant-id'] = auth.tenantId;
      }

      const response = await fetch(`/api/flexible-fields?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch fields: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the results
      fieldCache.set(cacheKey, { data, timestamp: Date.now() });

      setFields(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch fields';
      setError(message);
      console.error('[useFields]', message);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, scope, context, includeDisplayContexts]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return { fields, isLoading, error, refetch: fetchFields };
}

/**
 * useLookupTable Hook
 * Fetches and caches lookup table data
 */
interface UseLookupTableOptions {
  tableId: string;
  tenantId?: string;
}

interface UseLookupTableReturn {
  data: any;
  columns: string[];
  rows: any[];
  loading: boolean;
  error: string | null;
}

export function useLookupTable(options: UseLookupTableOptions): UseLookupTableReturn {
  const { tableId, tenantId } = options;
  const [data, setData] = useState<any>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `lookup:${tableId}`;

  useEffect(() => {
    // Check cache
    const cached = fieldCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached.data);
      setColumns(cached.data.columns || []);
      setRows(cached.data.rows || []);
      setLoading(false);
      return;
    }

    const fetchTable = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/flexible-fields/lookup-tables/${tableId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch lookup table');
        }

        const tableData = await response.json();

        // Cache the results
        fieldCache.set(cacheKey, { data: tableData, timestamp: Date.now() });

        setData(tableData);
        setColumns(tableData.columns || []);
        setRows(tableData.rows || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch lookup table';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchTable();
  }, [tableId, cacheKey]);

  return { data, columns, rows, loading, error };
}

/**
 * useFieldValue Hook
 * Manages individual field value state with validation
 */
interface UseFieldValueOptions {
  fieldId?: string;
  initialValue?: any;
  onValidate?: (value: any) => string | null; // returns error message or null
}

interface UseFieldValueReturn {
  value: any;
  setValue: (value: any) => void;
  error: string | null;
  isDirty: boolean;
  reset: () => void;
}

export function useFieldValue(options: UseFieldValueOptions = {}): UseFieldValueReturn {
  const { initialValue, onValidate } = options;
  const [value, setValueState] = useState(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = useCallback(
    (newValue: any) => {
      setValueState(newValue);
      setIsDirty(true);

      if (onValidate) {
        const validationError = onValidate(newValue);
        setError(validationError);
      }
    },
    [onValidate]
  );

  const reset = useCallback(() => {
    setValueState(initialValue);
    setIsDirty(false);
    setError(null);
  }, [initialValue]);

  return { value, setValue, error, isDirty, reset };
}

/**
 * Clears all cached field data
 * Useful when fields are updated
 */
export function clearFieldCache() {
  fieldCache.clear();
}
