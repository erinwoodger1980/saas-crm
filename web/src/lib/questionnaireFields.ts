/**
 * Questionnaire fields API utilities
 * Fetch and cache tenant's QuestionnaireField definitions by scope
 */

import { apiFetch } from './api';

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
  isActive?: boolean;
  isHidden?: boolean;
  showInPublicForm?: boolean;
  showInQuote?: boolean;
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
    const qs = new URLSearchParams();
    if (includeStandard) qs.set('includeStandard', 'true');
    const data = await apiFetch<any>(`/public/tenant/${encodeURIComponent(tenantSlug)}/questionnaire-fields${qs.toString() ? `?${qs.toString()}` : ''}`);
    const fields: QuestionnaireField[] = Array.isArray(data) ? data : [];

    // Ensure proper type casting
    const normalized = fields.map(f => ({
      ...f,
      type: (f.type?.toUpperCase() || 'TEXT') as QuestionnaireFieldType,
    }));

    // Basic safety filtering (public endpoints should already enforce this)
    const visible = normalized.filter((f) => {
      if (f.isActive === false) return false;
      if (f.isHidden === true) return false;
      return true;
    });

    // Filter by scope if specified
    const filtered = scope
      ? visible.filter(f => f.scope === scope)
      : visible;

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
