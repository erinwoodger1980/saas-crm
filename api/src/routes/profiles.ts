import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import crypto from 'crypto';

const router = Router();

/**
 * Profile storage API
 * Stores 2D profiles (SVG/DXF) as base64 in TenantSettings.beta.profiles
 * MVP implementation - no external storage yet
 */

interface ProfileRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  hash?: string;
  createdAt: string;
  metadata?: any;
}

// GET /profiles - List all profiles for tenant
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
    const profiles = (beta.profiles || []) as ProfileRecord[];

    // Return without base64 data for list view (performance)
    const profileList = profiles.map(({ dataBase64, ...rest }) => rest);

    res.json(profileList);
  } catch (error) {
    console.error('[profiles] Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// GET /profiles/:id - Get specific profile with full data
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
    const profiles = (beta.profiles || []) as ProfileRecord[];
    const profile = profiles.find((p: ProfileRecord) => p.id === id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('[profiles] Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /profiles - Create new profile
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, mimeType, sizeBytes, dataBase64, hash, metadata } = req.body;

    // Validation
    if (!name || !dataBase64 || !mimeType) {
      return res.status(400).json({ error: 'name, dataBase64, and mimeType are required' });
    }

    // Validate MIME type
    if (!['image/svg+xml', 'application/vnd.dxf'].includes(mimeType)) {
      return res.status(400).json({ error: 'Only SVG and DXF files are supported' });
    }

    // Validate size (10MB limit)
    if (sizeBytes > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });

    const beta = (settings?.beta || {}) as Record<string, any>;
    let profiles = (beta.profiles || []) as ProfileRecord[];

    // Check for duplicates by hash
    if (hash && profiles.some((p: ProfileRecord) => p.hash === hash)) {
      const existing = profiles.find((p: ProfileRecord) => p.hash === hash);
      return res.json(existing);
    }

    // Create new profile
    const newProfile: ProfileRecord = {
      id: `profile_${crypto.randomUUID()}`,
      name,
      mimeType,
      sizeBytes,
      dataBase64,
      hash,
      createdAt: new Date().toISOString(),
      metadata: metadata || {},
    };

    profiles.push(newProfile);

    // Update settings
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { beta: { ...beta, profiles } as any },
    });

    res.status(201).json(newProfile);
  } catch (error) {
    console.error('[profiles] Error creating profile:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// DELETE /profiles/:id - Remove profile
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

    const beta = (settings?.beta || {}) as Record<string, any>;
    let profiles = (beta.profiles || []) as ProfileRecord[];

    const index = profiles.findIndex((p: ProfileRecord) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Remove profile
    profiles.splice(index, 1);

    // Update settings
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { beta: { ...beta, profiles } as any },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[profiles] Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
