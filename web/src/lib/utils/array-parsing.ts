/**
 * Array parsing utilities for API responses
 * Handles various response formats and provides safe fallbacks
 */

/**
 * Safely extracts an array from various API response formats
 * 
 * @param response - The API response which may be:
 *   - An array directly: [...]
 *   - An object with data property: { data: [...] }
 *   - An object with a named array property: { suppliers: [...], users: [...], etc }
 *   - An unexpected format
 * @param propertyNames - Optional property names to check for arrays (in priority order)
 * @returns Array if found, empty array otherwise
 * 
 * @example
 * asArray([1, 2, 3]) // [1, 2, 3]
 * asArray({ data: [1, 2, 3] }) // [1, 2, 3]
 * asArray({ suppliers: [1, 2, 3] }, ['suppliers']) // [1, 2, 3]
 * asArray({ unexpected: 'format' }) // []
 */
export function asArray<T = any>(
  response: any,
  propertyNames: string[] = ['data', 'items', 'results']
): T[] {
  // Already an array
  if (Array.isArray(response)) {
    return response;
  }

  // Not an object
  if (!response || typeof response !== 'object') {
    console.warn('[asArray] Response is not an object or array:', response);
    return [];
  }

  // Check for common array property names
  for (const propName of propertyNames) {
    if (Array.isArray(response[propName])) {
      return response[propName];
    }
  }

  // Check if any property is an array (fallback)
  for (const key in response) {
    if (Array.isArray(response[key])) {
      console.warn(`[asArray] Found array at unexpected property "${key}"`);
      return response[key];
    }
  }

  // No array found
  console.error('[asArray] Could not extract array from response:', response);
  return [];
}
