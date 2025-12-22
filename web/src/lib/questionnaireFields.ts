/**
 * Questionnaire fields API utilities
 * Fetch and cache tenant's QuestionnaireField definitions by scope
 */

import { API_BASE } from './api-base';

export type QuestionnaireFieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'TEXTAREA' | 'DATE';

export interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  required: boolean;
  options?: string[] | null;
  placeholder?: string | null;
  helpText?: string | null;
  scope: 'client' | 'item' | 'project_details' | 'quote_details' | 'manufacturing' | 'fire_door_schedule' | 'fire_door_line_items' | 'public' | 'internal';
  isStandard?: boolean;
  sortOrder?: number;
}

// In-memory cache to avoid re-fetching fields multiple times per session
const fieldsCache = new Map<string, QuestionnaireField[]>();

/**
 * Fetch questionnaire fields for a tenant, optionally filtered by scope
 */
export async function fetchQuestionnaireFields(params: {
  tenantSlug: string;
  scope?: 'client' | 'item' | 'project_details' | 'quote_details' | 'manufacturing' | 'fire_door_schedule' | 'fire_door_line_items' | 'public' | 'internal';
  includeStandard?: boolean;
}): Promise<QuestionnaireField[]> {
  const { tenantSlug, scope, includeStandard = true } = params;
  const cacheKey = `${tenantSlug}:${scope || 'all'}:${includeStandard}`;

  // Return cached if available
  if (fieldsCache.has(cacheKey)) {
    return fieldsCache.get(cacheKey)!;
  }

  try {
    const url = new URL(`${API_BASE}/public/tenant/${tenantSlug}/questionnaire-fields`);
    if (includeStandard) url.searchParams.set('includeStandard', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch questionnaire fields: ${response.statusText}`);
    }

    const data = await response.json();
    const fields: QuestionnaireField[] = Array.isArray(data) ? data : [];

    // Ensure proper type casting
    const normalized = fields.map(f => ({
      ...f,
      type: (f.type?.toUpperCase() || 'TEXT') as QuestionnaireFieldType,
    }));

    // Filter by scope if specified
    const filtered = scope
      ? normalized.filter(f => f.scope === scope)
      : normalized;

    // Sort by sortOrder
    const sorted = filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Cache the result
    fieldsCache.set(cacheKey, sorted);

    return sorted;
  } catch (error) {
    console.error('Error fetching questionnaire fields:', error);
    return [];
  }
}

/**
 * Clear the fields cache (useful for testing or when fields are updated)
 */
export function clearQuestionnaireFieldsCache() {
  fieldsCache.clear();
}
