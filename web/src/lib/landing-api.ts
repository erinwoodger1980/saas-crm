/**
 * API client helper with admin authentication
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { requireAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (requireAuth && ADMIN_KEY) {
    headers['x-admin-key'] = ADMIN_KEY;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch tenant data from API (with DB content)
 */
export async function fetchTenantFromDB(slug: string, draft: boolean = false) {
  try {
    const url = `/landing-tenants/${slug}${draft ? '?draft=1' : ''}`;
    const data = await apiFetch(url);
    return data;
  } catch (error) {
    console.warn(`Failed to fetch tenant ${slug} from DB:`, error);
    return null;
  }
}

/**
 * Update tenant content
 */
export async function updateTenantContent(slug: string, content: any) {
  return apiFetch(`/landing-tenants/${slug}/content`, {
    method: 'PUT',
    requireAuth: true,
    body: JSON.stringify(content),
  });
}

/**
 * Upload an image
 */
export async function uploadTenantImage(slug: string, file: File, metadata: { alt?: string; caption?: string; sortOrder?: number }) {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata.alt) formData.append('alt', metadata.alt);
  if (metadata.caption) formData.append('caption', metadata.caption);
  if (metadata.sortOrder !== undefined) formData.append('sortOrder', metadata.sortOrder.toString());

  const headers: Record<string, string> = {};
  if (ADMIN_KEY) {
    headers['x-admin-key'] = ADMIN_KEY;
  }

  const response = await fetch(`${API_BASE}/landing-tenants/${slug}/images/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update image metadata
 */
export async function updateTenantImage(slug: string, imageId: string, updates: any) {
  return apiFetch(`/landing-tenants/${slug}/images/${imageId}`, {
    method: 'PATCH',
    requireAuth: true,
    body: JSON.stringify(updates),
  });
}

/**
 * Delete an image
 */
export async function deleteTenantImage(slug: string, imageId: string) {
  return apiFetch(`/landing-tenants/${slug}/images/${imageId}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

/**
 * Create a review
 */
export async function createTenantReview(slug: string, review: any) {
  return apiFetch(`/landing-tenants/${slug}/reviews`, {
    method: 'POST',
    requireAuth: true,
    body: JSON.stringify(review),
  });
}

/**
 * Update a review
 */
export async function updateTenantReview(slug: string, reviewId: string, updates: any) {
  return apiFetch(`/landing-tenants/${slug}/reviews/${reviewId}`, {
    method: 'PATCH',
    requireAuth: true,
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a review
 */
export async function deleteTenantReview(slug: string, reviewId: string) {
  return apiFetch(`/landing-tenants/${slug}/reviews/${reviewId}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}
