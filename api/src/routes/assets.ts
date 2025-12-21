import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import crypto from 'crypto';

const router = Router();

/**
 * Asset storage API
 * Stores 3D models (GLB/GLTF) as base64 in TenantSettings.beta.assets
 * MVP implementation - no external storage yet
 */

interface AssetRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  hash?: string;
  createdAt: string;
  metadata?: any;
}

// GET /assets - List all assets for tenant
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });

    const beta = (settings?.beta || {}) as Record<string, any>;
    const assets = (beta.assets || []) as AssetRecord[];

    // Return without base64 data for list view (performance)
    const assetList = assets.map(({ dataBase64, ...rest }) => rest);

    res.json(assetList);
  } catch (error) {
    console.error('[assets] Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /assets/:id - Get specific asset with full data
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });

    const beta = (settings?.beta || {}) as Record<string, any>;
    const assets = (beta.assets || []) as AssetRecord[];
    const asset = assets.find((a) => a.id === id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    console.error('[assets] Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// POST /assets - Create new asset
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, mimeType, sizeBytes, dataBase64, hash, metadata } = req.body;

    // Validation
    if (!name || !mimeType || !dataBase64) {
      return res.status(400).json({ error: 'Missing required fields: name, mimeType, dataBase64' });
    }

    // Validate MIME type
    if (!['model/gltf-binary', 'model/gltf+json'].includes(mimeType)) {
      return res.status(400).json({ error: 'Invalid MIME type. Must be model/gltf-binary or model/gltf+json' });
    }

    // Size limit: 10MB for base64 MVP
    const MAX_SIZE = 10 * 1024 * 1024;
    if (sizeBytes > MAX_SIZE) {
      return res.status(413).json({ error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB` });
    }

    // Ensure tenant settings exists
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      settings = await prisma.tenantSettings.create({
        data: {
          tenantId,
          slug: tenant.slug || `tenant-${tenantId.slice(0, 6)}`,
          brandName: tenant.name || 'Company',
          beta: { assets: [] },
        },
      });
    }

    const beta = (settings.beta || {}) as Record<string, any>;
    const assets = (beta.assets || []) as AssetRecord[];

    // Check for duplicate hash (deduplication)
    if (hash) {
      const existing = assets.find((a) => a.hash === hash);
      if (existing) {
        return res.json(existing); // Return existing asset
      }
    }

    // Create new asset
    const newAsset: AssetRecord = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      mimeType,
      sizeBytes,
      dataBase64,
      hash,
      createdAt: new Date().toISOString(),
      metadata: metadata || {},
    };

    assets.push(newAsset);

    // Update settings
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { beta: { ...beta, assets } as any },
    });

    res.status(201).json(newAsset);
  } catch (error) {
    console.error('[assets] Error creating asset:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// DELETE /assets/:id - Delete asset
router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const beta = (settings.beta || {}) as Record<string, any>;
    const assets = (beta.assets || []) as AssetRecord[];
    const index = assets.findIndex((a) => a.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Remove asset
    assets.splice(index, 1);

    // Update settings
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { beta: { ...beta, assets } as any },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[assets] Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

export default router;
