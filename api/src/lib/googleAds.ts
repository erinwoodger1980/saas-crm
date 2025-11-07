/**
 * Google Ads API client for MCC management
 * Uses single MCC refresh token from env for all tenant sub-accounts
 */

import { GoogleAdsApi, Customer } from 'google-ads-api';

/**
 * Strip dashes from customer ID
 */
export function stripDashes(id: string): string {
  return id.replace(/-/g, '');
}

/**
 * Extract only digits from customer ID
 */
export function digitsOnly(id: string): string {
  return id.replace(/\D/g, '');
}

/**
 * Format customer ID with dashes (123-456-7890)
 */
export function formatCustomerId(id: string): string {
  const digits = digitsOnly(id);
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Get configured Google Ads API client for a specific customer
 * Uses MCC-level refresh token from environment
 */
export function getAdsClient(customerId: string): Customer {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const loginCustomerId = process.env.LOGIN_CUSTOMER_ID;

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !loginCustomerId) {
    throw new Error(
      'Missing required Google Ads environment variables: ' +
      'GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, ' +
      'GOOGLE_ADS_REFRESH_TOKEN, LOGIN_CUSTOMER_ID'
    );
  }

  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  // Return customer instance with MCC login
  return client.Customer({
    customer_id: digitsOnly(customerId),
    refresh_token: refreshToken,
    login_customer_id: digitsOnly(loginCustomerId),
  });
}

/**
 * List all accessible customer accounts (from MCC perspective)
 */
export async function listAccessibleCustomers(): Promise<string[]> {
  try {
    const mccCustomerId = getMccCustomerId();
    const customer = getAdsClient(mccCustomerId);

    // Query for all accessible customers
    const query = `
      SELECT 
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.manager
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
    `;

    const results = await customer.query(query);

    return results.map((r: any) => r.customer_client.id);
  } catch (error: any) {
    console.error("Failed to list accessible customers:", error);
    throw new Error(`Google Ads API error: ${error.message}`);
  }
}

/**
 * Create a new customer client (sub-account) under the MCC
 */
export async function createCustomerClient(params: {
  name: string;
  currency?: string;
  timeZone?: string;
}): Promise<string> {
  try {
    const mccCustomerId = getMccCustomerId();
    
    // Note: Customer creation via API may require special permissions
    // For now, this is a placeholder that should be replaced with proper implementation
    // You may need to create customers manually in Google Ads UI or use Customer Lifecycle Management
    
    throw new Error(
      "Customer creation via API requires special access. " +
      "Please create customers manually in Google Ads UI under your MCC account, " +
      "then link them to tenants using the TenantAdsConfig model."
    );
  } catch (error: any) {
    console.error("Failed to create customer client:", error);
    throw error;
  }
}

/**
 * Get MCC customer ID from environment
 */
export function getMccCustomerId(): string {
  const loginCustomerId = process.env.LOGIN_CUSTOMER_ID;
  if (!loginCustomerId) {
    throw new Error('LOGIN_CUSTOMER_ID not set');
  }
  return digitsOnly(loginCustomerId);
}

/**
 * Check if all required MCC environment variables are set
 */
export function checkMccEnv(): { ok: boolean; notes: string[] } {
  const required = {
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    LOGIN_CUSTOMER_ID: process.env.LOGIN_CUSTOMER_ID,
  };

  const notes: string[] = [];
  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    notes.push(`Missing environment variables: ${missing.join(', ')}`);
    return { ok: false, notes };
  }

  notes.push('All Google Ads environment variables are set');
  return { ok: true, notes };
}

/**
 * Test if MCC has access to a specific customer account
 */
export async function canAccessCustomer(customerIdWithDashes: string): Promise<boolean> {
  try {
    const customerId = digitsOnly(customerIdWithDashes);
    const customer = getAdsClient(customerId);

    // Try a lightweight query to test access
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name
      FROM customer
      LIMIT 1
    `;

    await customer.query(query);
    return true;
  } catch (error: any) {
    console.error(`Cannot access customer ${customerIdWithDashes}:`, error.message);
    return false;
  }
}
