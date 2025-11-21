/**
 * Tenant-level Google Ads operations
 * Manages sub-accounts and shared negative keyword lists
 */

import { prisma } from '../../prisma';
import { createCustomerClient, getAdsClient, digitsOnly } from '../../lib/googleAds';
import { DEFAULT_NEGATIVE_KEYWORDS } from './constants';


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
      SELECT shared_set.id, shared_set.name, shared_set.resource_name
      FROM shared_set
      WHERE shared_set.name = '${listName}'
        AND shared_set.type = 'NEGATIVE_KEYWORDS'
    `;

    const existing = await customer.query(query);
    if (existing.length > 0) {
      const resourceName = existing[0]?.shared_set?.resource_name;
      if (!resourceName) {
        throw new Error("Invalid shared set resource name");
      }
      console.log("✓ Negative list already exists:", resourceName);
      return resourceName;
    }

    // Create new negative keyword list
    const sharedSetResponse = await customer.sharedSets.create([
      {
        name: listName,
        type: "NEGATIVE_KEYWORDS",
      },
    ]);
    const sharedSetResourceName = sharedSetResponse.results?.[0]?.resource_name || "";
    if (!sharedSetResourceName) {
      throw new Error("Failed to create shared set");
    }

    // Add negative keywords to the list
    const negativeKeywords = DEFAULT_NEGATIVE_KEYWORDS.map((keyword) => ({
      shared_set: sharedSetResourceName,
      keyword: {
        text: keyword,
        match_type: "BROAD",
      },
      type: "KEYWORD",
    }));

    await customer.sharedCriteria.create(negativeKeywords as any);
    console.log(`Added ${DEFAULT_NEGATIVE_KEYWORDS.length} negative keywords to list`);

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
        campaign: c.campaign.resource_name,
        shared_set: sharedSetResourceName,
      }));

    if (attachOperations.length > 0) {
      await customer.campaignSharedSets.create(attachOperations as any);
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

/**
 * List campaigns for a customer account
 */
export interface CampaignInfo {
  id: string;
  resourceName: string;
  name: string;
  status: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  adGroupCount?: number;
  startDate?: string;
  endDate?: string;
}

export async function listCampaigns(customerId: string): Promise<CampaignInfo[]> {
  const customer = getAdsClient(digitsOnly(customerId));

  try {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.resource_name,
        campaign.status,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.amount_micros,
        campaign_budget.explicitly_shared
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
    `;

    const results = await customer.query(query);

    // Get ad group count for each campaign
    const campaigns: CampaignInfo[] = [];
    
    for (const row of results) {
      const campaign = row.campaign;
      const budget = row.campaign_budget;

      if (!campaign?.id) continue; // Skip if campaign data is missing

      // Query ad groups for this campaign
      const adGroupQuery = `
        SELECT ad_group.id
        FROM ad_group
        WHERE campaign.id = ${campaign.id}
          AND ad_group.status != 'REMOVED'
      `;

      const adGroups = await customer.query(adGroupQuery);

      campaigns.push({
        id: campaign.id?.toString() || '',
        resourceName: campaign.resource_name || '',
        name: campaign.name || '',
        status: (campaign.status as string) || 'UNKNOWN',
        budgetAmount: budget?.amount_micros ? Math.round(budget.amount_micros / 1_000_000) : undefined,
        budgetCurrency: 'GBP',
        adGroupCount: adGroups.length,
        startDate: campaign.start_date || undefined,
        endDate: campaign.end_date || undefined,
      });
    }

    return campaigns;
  } catch (error: any) {
    console.error('Error listing campaigns:', error.message);
    if (error.failure) {
      console.error('Partial failure details:', JSON.stringify(error.failure, null, 2));
    }
    throw error;
  }
}
