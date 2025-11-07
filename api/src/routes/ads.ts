/**
 * Google Ads REST API endpoints
 * Provides HTTP interface for sub-account creation and campaign bootstrap
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createSubAccount, ensureNegativeList, getTenantCustomerId } from '../services/ads/tenants';
import { bootstrapSearchCampaign, gbpToMicros } from '../services/ads/bootstrap';

const router = Router();
const prisma = new PrismaClient();

/**
 * Middleware to check Google Ads environment variables
 */
function checkAdsEnv(req: Request, res: Response, next: Function) {
  const required = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'LOGIN_CUSTOMER_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return res.status(500).json({
      error: 'Google Ads not configured',
      missing,
      message: 'Set required environment variables on server',
    });
  }

  next();
}

router.use(checkAdsEnv);

/**
 * POST /ads/tenant/:slug/create-subaccount
 * Create a new Google Ads sub-account for a tenant
 */
router.post('/tenant/:slug/create-subaccount', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { name } = req.body;

    // Find tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Create sub-account
    const customerId = await createSubAccount(tenant.id, name || `${tenant.name} Ads`);

    res.json({
      success: true,
      tenantId: tenant.id,
      customerId,
      message: `Created Google Ads sub-account: ${customerId}`,
    });
  } catch (error: any) {
    console.error('Error creating sub-account:', error);
    res.status(500).json({
      error: error.message,
      details: error.failure || undefined,
    });
  }
});

/**
 * POST /ads/tenant/:slug/bootstrap
 * Bootstrap a complete Search campaign for a tenant
 */
router.post('/tenant/:slug/bootstrap', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      landingUrl,
      postcode,
      radiusMiles = 50,
      dailyBudgetGBP = 10,
      city,
    } = req.body;

    // Validate required fields
    if (!landingUrl || !postcode) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['landingUrl', 'postcode'],
      });
    }

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Get customer ID
    const customerId = await getTenantCustomerId(tenant.id);
    if (!customerId) {
      return res.status(400).json({
        error: 'Tenant does not have a Google Ads account',
        message: 'Create sub-account first using POST /ads/tenant/:slug/create-subaccount',
      });
    }

    // Convert budget to micros
    const dailyBudgetMicros = gbpToMicros(parseFloat(dailyBudgetGBP));

    // Bootstrap campaign
    const result = await bootstrapSearchCampaign({
      tenantId: tenant.id,
      customerId,
      landingUrl,
      postcode,
      radiusMiles: parseInt(radiusMiles),
      dailyBudget: dailyBudgetMicros,
      city: city || 'Sussex',
    });

    res.json({
      success: true,
      tenantId: tenant.id,
      customerId,
      campaign: result.campaignResourceName,
      adGroup: result.adGroupResourceName,
      budget: result.budgetResourceName,
      ads: result.adResourceNames,
      sitelinks: result.sitelinkResourceNames,
      keywords: result.keywordResourceNames,
      message: 'Campaign bootstrap complete. Campaign is PAUSED - enable in Google Ads UI.',
    });
  } catch (error: any) {
    console.error('Error bootstrapping campaign:', error);
    res.status(500).json({
      error: error.message,
      details: error.failure || undefined,
    });
  }
});

/**
 * POST /ads/tenant/:slug/negatives/attach
 * Ensure negative keyword list is attached to all campaigns
 */
router.post('/tenant/:slug/negatives/attach', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { listName } = req.body;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Get customer ID
    const customerId = await getTenantCustomerId(tenant.id);
    if (!customerId) {
      return res.status(400).json({
        error: 'Tenant does not have a Google Ads account',
      });
    }

    // Attach negative list
    const sharedSetResourceName = await ensureNegativeList(
      customerId,
      listName || 'Joinery AI Default Negatives'
    );

    res.json({
      success: true,
      tenantId: tenant.id,
      customerId,
      sharedSet: sharedSetResourceName,
      message: 'Negative keyword list attached to all campaigns',
    });
  } catch (error: any) {
    console.error('Error attaching negatives:', error);
    res.status(500).json({
      error: error.message,
      details: error.failure || undefined,
    });
  }
});

/**
 * GET /ads/tenant/:slug/config
 * Get tenant's Google Ads configuration
 */
router.get('/tenant/:slug/config', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    const config = await prisma.tenantAdsConfig.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!config) {
      return res.json({
        tenantId: tenant.id,
        hasAdsAccount: false,
        message: 'No Google Ads account configured',
      });
    }

    res.json({
      tenantId: tenant.id,
      hasAdsAccount: true,
      customerId: config.googleAdsCustomerId,
      status: config.status,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
