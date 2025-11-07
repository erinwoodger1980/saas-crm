/**
 * Tenant-level Google Ads operations
 * Manages sub-accounts and shared negative keyword lists
 */

import { PrismaClient } from '@prisma/client';
import { createCustomerClient, getAdsClient, digitsOnly } from '../../lib/googleAds';
import { DEFAULT_NEGATIVE_KEYWORDS } from './constants';

const prisma = new PrismaClient();

/**
 * Create a Google Ads sub-account for a tenant and save to TenantAdsConfig
 */
export async function createSubAccount(
  tenantId: string,
  name: string
): Promise<string> {
  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  // Check if already has ads config
  const existing = await prisma.tenantAdsConfig.findUnique({
    where: { tenantId },
  });

  if (existing) {
    throw new Error(
      `Tenant ${tenantId} already has Google Ads account: ${existing.googleAdsCustomerId}`
    );
  }

  // Create sub-account under MCC
  const customerId = await createCustomerClient({
    name: name || `${tenant.name} Ads`,
    currency: 'GBP',
    timeZone: 'Europe/London',
  });

  // Save to database
  await prisma.tenantAdsConfig.create({
    data: {
      tenantId,
      googleAdsCustomerId: customerId,
      status: 'active',
    },
  });

  console.log(`Created sub-account ${customerId} for tenant ${tenantId}`);
  return customerId;
}

/**
 * Ensure a shared negative keyword list exists and is attached to all campaigns
 */
export async function ensureNegativeList(
  customerId: string,
  listName = 'Joinery AI Default Negatives'
): Promise<string> {
  const customer = getAdsClient(customerId);

  try {
    // Check if list already exists
    const query = `
      SELECT
        shared_set.id,
        shared_set.name,
        shared_set.type,
        shared_set.resource_name
      FROM shared_set
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
        AND shared_set.name = '${listName}'
    `;

    const existingLists = await customer.query(query);

    let sharedSetResourceName: string;

    if (existingLists.length > 0) {
      sharedSetResourceName = existingLists[0].shared_set.resource_name;
      console.log(`Using existing negative list: ${sharedSetResourceName}`);
    } else {
      // Create new shared set
      const sharedSetOperation = {
        create: {
          name: listName,
          type: 'NEGATIVE_KEYWORDS',
        },
      };

      const sharedSetResponse = await customer.sharedSets.create([sharedSetOperation]);
      sharedSetResourceName = sharedSetResponse.results[0].resource_name;
      console.log(`Created negative list: ${sharedSetResourceName}`);

      // Add negative keywords to the set
      const criteriaOperations = DEFAULT_NEGATIVE_KEYWORDS.map((keyword) => ({
        create: {
          shared_set: sharedSetResourceName,
          keyword: {
            text: keyword,
            match_type: 'BROAD',
          },
          type: 'KEYWORD',
        },
      }));

      if (criteriaOperations.length > 0) {
        await customer.sharedCriteria.create(criteriaOperations);
        console.log(`Added ${DEFAULT_NEGATIVE_KEYWORDS.length} negative keywords`);
      }
    }

    // Get all campaigns in the account
    const campaignsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.resource_name
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `;

    const campaigns = await customer.query(campaignsQuery);

    if (campaigns.length === 0) {
      console.log('No campaigns found to attach negative list');
      return sharedSetResourceName;
    }

    // Check which campaigns already have the list attached
    const attachedQuery = `
      SELECT
        campaign_shared_set.campaign,
        campaign_shared_set.shared_set
      FROM campaign_shared_set
      WHERE campaign_shared_set.shared_set = '${sharedSetResourceName}'
    `;

    const attachedCampaigns = await customer.query(attachedQuery);
    const attachedCampaignResourceNames = new Set(
      attachedCampaigns.map((a: any) => a.campaign_shared_set.campaign)
    );

    // Attach to campaigns that don't have it yet
    const attachOperations = campaigns
      .filter((c: any) => !attachedCampaignResourceNames.has(c.campaign.resource_name))
      .map((c: any) => ({
        create: {
          campaign: c.campaign.resource_name,
          shared_set: sharedSetResourceName,
        },
      }));

    if (attachOperations.length > 0) {
      await customer.campaignSharedSets.create(attachOperations);
      console.log(`Attached negative list to ${attachOperations.length} campaigns`);
    } else {
      console.log('Negative list already attached to all campaigns');
    }

    return sharedSetResourceName;
  } catch (error: any) {
    console.error('Error ensuring negative list:', error.message);
    if (error.failure) {
      console.error('Partial failure details:', JSON.stringify(error.failure, null, 2));
    }
    throw error;
  }
}

/**
 * Get tenant's Google Ads customer ID
 */
export async function getTenantCustomerId(tenantId: string): Promise<string | null> {
  const config = await prisma.tenantAdsConfig.findUnique({
    where: { tenantId },
    select: { googleAdsCustomerId: true },
  });

  return config?.googleAdsCustomerId || null;
}
