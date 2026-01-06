/**
 * Sage Business Cloud Accounting API Client
 * 
 * Implements OAuth2 token management and API requests for Sage Accounting UK.
 * Based on existing Gmail/MS365 OAuth patterns.
 */

import { prisma } from "../../prisma";

const SAGE_AUTH_BASE = "https://www.sageone.com";
const SAGE_API_BASE = "https://api.accounting.sage.com/v3.1";

interface SageTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  requested_by_id: string;
}

interface SageInvoice {
  id: string;
  displayed_as: string;
  $path: string;
  created_at: string;
  updated_at: string;
  date: string;
  due_date?: string;
  reference?: string;
  contact?: {
    id: string;
    displayed_as: string;
    name?: string;
  };
  total_amount?: number;
  net_amount?: number;
  tax_amount?: number;
  currency?: {
    id: string;
    displayed_as: string;
  };
  status?: {
    id: string;
    displayed_as: string;
  };
  invoice_number?: string;
}

/**
 * Get Sage OAuth connection for tenant
 */
export async function getSageConnection(tenantId: string) {
  const conn = await prisma.tenantAccountingConnection.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider: "sage",
      },
    },
  });

  if (!conn) {
    throw new Error("Sage not connected for this tenant");
  }

  if (conn.status !== "active") {
    throw new Error(`Sage connection status: ${conn.status}`);
  }

  return conn;
}

/**
 * Refresh Sage access token using refresh token
 */
export async function refreshSageToken(refreshToken: string): Promise<string> {
  const clientId = process.env.SAGE_CLIENT_ID;
  const clientSecret = process.env.SAGE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Sage OAuth credentials not configured");
  }

  const response = await fetch(`${SAGE_AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Sage] Token refresh failed:", error);
    throw new Error(`Sage token refresh failed: ${response.statusText}`);
  }

  const data: SageTokenResponse = await response.json();
  return data.access_token;
}

/**
 * Get valid access token for Sage API, refreshing if needed
 */
export async function getSageAccessToken(tenantId: string): Promise<string> {
  const conn = await getSageConnection(tenantId);

  // Check if token is expired or about to expire (5 min buffer)
  const now = new Date();
  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (needsRefresh && conn.refreshToken) {
    console.log(`[Sage] Refreshing access token for tenant ${tenantId}`);
    const newAccessToken = await refreshSageToken(conn.refreshToken);
    
    // Update connection with new token (Sage typically issues new refresh token too)
    // For now, just update access token and expiry
    const newExpiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now
    
    await prisma.tenantAccountingConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: newAccessToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    return newAccessToken;
  }

  if (!conn.accessToken) {
    throw new Error("No access token available for Sage");
  }

  return conn.accessToken;
}

/**
 * Make authenticated request to Sage API
 */
export async function sageRequest<T = any>(
  tenantId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getSageAccessToken(tenantId);
  const conn = await getSageConnection(tenantId);

  const url = endpoint.startsWith("http") ? endpoint : `${SAGE_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Add any custom headers from options
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // Add business ID to request if we have it
  if (conn.businessId) {
    headers["X-Business"] = conn.businessId;
  }

  console.log(`[Sage] Request: ${options.method || "GET"} ${endpoint} for tenant ${tenantId}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Sage] API error:`, error);
    
    // If 401, try refreshing token once
    if (response.status === 401) {
      console.log(`[Sage] Got 401, attempting token refresh`);
      const newToken = await refreshSageToken(conn.refreshToken!);
      
      // Retry request with new token
      const retryHeaders: Record<string, string> = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      
      const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
      
      if (!retryResponse.ok) {
        throw new Error(`Sage API error after retry: ${retryResponse.statusText}`);
      }
      
      return retryResponse.json();
    }
    
    throw new Error(`Sage API error: ${response.statusText} - ${error}`);
  }

  return response.json();
}

/**
 * Fetch sales invoices from Sage
 */
export async function fetchSalesInvoices(
  tenantId: string,
  options: {
    fromDate?: string; // YYYY-MM-DD
    toDate?: string;
    page?: number;
    itemsPerPage?: number;
  } = {}
): Promise<{ invoices: SageInvoice[]; total: number }> {
  const params = new URLSearchParams();
  
  if (options.fromDate) {
    params.append("from_date", options.fromDate);
  }
  if (options.toDate) {
    params.append("to_date", options.toDate);
  }
  if (options.page) {
    params.append("page", options.page.toString());
  }
  if (options.itemsPerPage) {
    params.append("items_per_page", options.itemsPerPage.toString());
  }

  const queryString = params.toString();
  const endpoint = `/sales_invoices${queryString ? `?${queryString}` : ""}`;

  const result = await sageRequest<any>(tenantId, endpoint);
  
  return {
    invoices: result.$items || [],
    total: result.$total || 0,
  };
}

/**
 * Fetch sales credit notes from Sage
 */
export async function fetchSalesCreditNotes(
  tenantId: string,
  options: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    itemsPerPage?: number;
  } = {}
): Promise<{ credits: SageInvoice[]; total: number }> {
  const params = new URLSearchParams();
  
  if (options.fromDate) {
    params.append("from_date", options.fromDate);
  }
  if (options.toDate) {
    params.append("to_date", options.toDate);
  }
  if (options.page) {
    params.append("page", options.page.toString());
  }
  if (options.itemsPerPage) {
    params.append("items_per_page", options.itemsPerPage.toString());
  }

  const queryString = params.toString();
  const endpoint = `/sales_credit_notes${queryString ? `?${queryString}` : ""}`;

  const result = await sageRequest<any>(tenantId, endpoint);
  
  return {
    credits: result.$items || [],
    total: result.$total || 0,
  };
}

/**
 * Fetch purchase invoices from Sage
 */
export async function fetchPurchaseInvoices(
  tenantId: string,
  options: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    itemsPerPage?: number;
  } = {}
): Promise<{ invoices: SageInvoice[]; total: number }> {
  const params = new URLSearchParams();
  
  if (options.fromDate) {
    params.append("from_date", options.fromDate);
  }
  if (options.toDate) {
    params.append("to_date", options.toDate);
  }
  if (options.page) {
    params.append("page", options.page.toString());
  }
  if (options.itemsPerPage) {
    params.append("items_per_page", options.itemsPerPage.toString());
  }

  const queryString = params.toString();
  const endpoint = `/purchase_invoices${queryString ? `?${queryString}` : ""}`;

  const result = await sageRequest<any>(tenantId, endpoint);
  
  return {
    invoices: result.$items || [],
    total: result.$total || 0,
  };
}

/**
 * Fetch purchase credit notes from Sage
 */
export async function fetchPurchaseCreditNotes(
  tenantId: string,
  options: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    itemsPerPage?: number;
  } = {}
): Promise<{ credits: SageInvoice[]; total: number }> {
  const params = new URLSearchParams();
  
  if (options.fromDate) {
    params.append("from_date", options.fromDate);
  }
  if (options.toDate) {
    params.append("to_date", options.toDate);
  }
  if (options.page) {
    params.append("page", options.page.toString());
  }
  if (options.itemsPerPage) {
    params.append("items_per_page", options.itemsPerPage.toString());
  }

  const queryString = params.toString();
  const endpoint = `/purchase_credit_notes${queryString ? `?${queryString}` : ""}`;

  const result = await sageRequest<any>(tenantId, endpoint);
  
  return {
    credits: result.$items || [],
    total: result.$total || 0,
  };
}

/**
 * Extract order reference from Sage reference text
 * Looks for patterns like: JOB:1234, ORDER:1234, #1234, or exact orderNumber
 */
export function extractOrderRef(referenceText: string | null | undefined): string | null {
  if (!referenceText) return null;

  const text = referenceText.trim();
  
  // Pattern 1: JOB:XXXX or ORDER:XXXX
  const jobMatch = text.match(/(?:JOB|ORDER):\s*([A-Z0-9-]+)/i);
  if (jobMatch) return jobMatch[1];

  // Pattern 2: #XXXX
  const hashMatch = text.match(/#([A-Z0-9-]+)/);
  if (hashMatch) return hashMatch[1];

  // Pattern 3: Just return the reference if it looks like an order number
  // (alphanumeric with possible dashes/slashes)
  if (/^[A-Z0-9-/]+$/i.test(text) && text.length <= 20) {
    return text;
  }

  return null;
}
