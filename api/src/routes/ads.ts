/**
 * Google Ads REST API endpoints
 * Provides HTTP interface for sub-account creation and campaign bootstrap
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createSubAccount, ensureNegativeList, getTenantCustomerId } from '../services/ads/tenants';
import { bootstrapSearchCampaign, gbpToMicros } from '../services/ads/bootstrap';
import { checkMccEnv, canAccessCustomer, digitsOnly, formatCustomerId } from '../lib/googleAds';

const router = Router();
const prisma = new PrismaClient();

// Reusable resolver that accepts either id or slug
async function resolveTenant(param: string) {
  let t = await prisma.tenant.findUnique({ where: { id: param } });
  if (t) return t;
  t = await prisma.tenant.findUnique({ where: { slug: param } });
  return t;
}

const CustomerIdSchema = z.string().regex(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/, "Google Ads Customer ID must be like 123-456-7890");

// POST /ads/tenant/:tenant/save
router.post("/tenant/:tenant/save", async (req, res) => {
  try {
    const tenantParam = req.params.tenant;
    const tenant = await resolveTenant(tenantParam);
    if (!tenant) return res.status(404).json({ error: `Tenant not found: ${tenantParam}` });

    const body = z.object({ customerId: CustomerIdSchema }).parse(req.body);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { googleAdsCustomerId: body.customerId },
    });
    return res.json({ ok: true });
  } catch (e:any) {
    return res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /ads/tenant/:tenant/verify
router.post("/tenant/:tenant/verify", async (req, res) => {
  try {
    const tenantParam = req.params.tenant;
    const tenant = await resolveTenant(tenantParam);
    if (!tenant) return res.status(404).json({ error: `Tenant not found: ${tenantParam}` });

    if (!tenant.googleAdsCustomerId) {
      return res.status(400).json({ error: "No Google Ads Customer ID saved for this tenant" });
    }

    // Basic readiness check: env present
    const { GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN } = process.env;
    if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_DEVELOPER_TOKEN) {
      return res.status(400).json({ error: "Server missing Google Ads env vars (CLIENT_ID/SECRET/DEVELOPER_TOKEN)" });
    }

    // (Optional real API probe can be added later)
    return res.json({ ok: true, customerId: tenant.googleAdsCustomerId });
  } catch (e:any) {
    return res.status(500).json({ error: e.message || "Verify failed" });
  }
});

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
const BootstrapCampaignSchema = z.object({
  landingUrl: z.string().url('Landing URL must be a valid URL'),
  postcode: z.string().min(1, 'Postcode is required'),
  radiusMiles: z.number().optional().default(50),
  dailyBudgetGBP: z.number().optional().default(10),
  city: z.string().optional(),
  campaignName: z.string().optional(),
});

router.post('/tenant/:slug/bootstrap', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Validate request body
    const validation = BootstrapCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const {
      landingUrl,
      postcode,
      radiusMiles,
      dailyBudgetGBP,
      city,
      campaignName,
    } = validation.data;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Get customer ID from TenantAdsConfig
    const config = await prisma.tenantAdsConfig.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!config?.googleAdsCustomerId) {
      return res.status(400).json({
        error: 'Tenant does not have a Google Ads account linked',
        message: 'Use POST /ads/tenant/:slug/link to link a customer ID first',
      });
    }

    const customerId = config.googleAdsCustomerId;

    // Bootstrap campaign with digits-only customer ID
    const result = await bootstrapSearchCampaign({
      tenantId: tenant.id,
      customerId: digitsOnly(customerId),
      landingUrl,
      postcode,
      radiusMiles,
      dailyBudgetGBP,
      city: city || tenant.name,
      campaignName: campaignName || `Search - ${tenant.name}`,
    });

    res.json({
      success: true,
      customerId,
      budget: result.budgetResourceName,
      campaign: result.campaignResourceName,
      adGroup: result.adGroupResourceName,
      ads: result.adResourceNames,
      keywords: result.keywordResourceNames,
      message: `Campaign bootstrapped successfully. Review in Google Ads and enable when ready.`,
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

/**
 * POST /ads/tenant/:slug/link
 * Link an existing Google Ads customer ID to a tenant
 */
const LinkCustomerSchema = z.object({
  customerId: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Customer ID must be in format 123-456-7890'),
});

router.post('/tenant/:slug/link', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Validate request body
    const validation = LinkCustomerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { customerId } = validation.data;

    // Find tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Upsert TenantAdsConfig with customer ID (store with dashes)
    await prisma.tenantAdsConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        googleAdsCustomerId: customerId,
        status: 'active',
      },
      update: {
        googleAdsCustomerId: customerId,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    res.json({
      ok: true,
      customerId,
      message: `Linked customer ${customerId} to tenant ${tenant.name}`,
    });
  } catch (error: any) {
    console.error('Error linking customer:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /ads/tenant/:slug/verify
 * Verify readiness for Google Ads campaign bootstrap
 */
router.get('/tenant/:slug/verify', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found: ${slug}` });
    }

    // Check MCC environment
    const { ok: mccOk, notes: mccNotes } = checkMccEnv();

    // Get customer ID from DB
    const config = await prisma.tenantAdsConfig.findUnique({
      where: { tenantId: tenant.id },
    });

    const customerId = config?.googleAdsCustomerId || null;
    const notes: string[] = [...mccNotes];

    // Test access if customer ID is present
    let accessOk: boolean | null = null;
    if (customerId && mccOk) {
      try {
        accessOk = await canAccessCustomer(customerId);
        if (accessOk) {
          notes.push(`✓ MCC has access to customer ${customerId}`);
        } else {
          notes.push(`✗ MCC cannot access customer ${customerId} - check permissions`);
        }
      } catch (error: any) {
        accessOk = false;
        notes.push(`✗ Error testing access: ${error.message}`);
      }
    } else if (!customerId) {
      notes.push('⚠ No customer ID linked - use POST /ads/tenant/:slug/link first');
    }

    // Check GA4 ID (from environment)
    const ga4IdPresent = !!(process.env.NEXT_PUBLIC_GA4_ID || process.env.GA4_MEASUREMENT_ID);
    if (ga4IdPresent) {
      notes.push('✓ GA4 tracking ID is configured');
    } else {
      notes.push('⚠ GA4 tracking ID not set (optional for tracking)');
    }

    res.json({
      mccOk,
      customerId,
      accessOk,
      ga4IdPresent,
      notes,
      ready: mccOk && !!customerId && accessOk === true,
    });
  } catch (error: any) {
    console.error('Error verifying readiness:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

export default router;
