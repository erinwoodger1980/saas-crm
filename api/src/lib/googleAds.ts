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
  const loginCustomerId = process.env.LOGIN_CUSTOMER_ID;
  if (!loginCustomerId) {
    throw new Error('LOGIN_CUSTOMER_ID not set');
  }

  const customer = getAdsClient(loginCustomerId);

  try {
    const response = await customer.customerClients.list();
    return response.map((c: any) => c.customer_client.id?.toString() || '');
  } catch (error: any) {
    console.error('Error listing accessible customers:', error.message);
    throw error;
  }
}

/**
 * Create a new customer client (sub-account) under the MCC
 */
export async function createCustomerClient(options: {
  name: string;
  currency?: string;
  timeZone?: string;
}): Promise<string> {
  const { name, currency = 'GBP', timeZone = 'Europe/London' } = options;

  const loginCustomerId = process.env.LOGIN_CUSTOMER_ID;
  if (!loginCustomerId) {
    throw new Error('LOGIN_CUSTOMER_ID not set');
  }

  const customer = getAdsClient(loginCustomerId);

  try {
    const operation = {
      customer_client: {
        descriptive_name: name,
        currency_code: currency,
        time_zone: timeZone,
      },
    };

    const response = await customer.customerClients.create(operation);
    
    // Extract customer ID from resource name: customers/1234567890
    const resourceName = response.resource_name || '';
    const customerId = resourceName.split('/').pop() || '';
    
    console.log(`Created customer client: ${customerId} (${name})`);
    return customerId;
  } catch (error: any) {
    console.error('Error creating customer client:', error.message);
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
