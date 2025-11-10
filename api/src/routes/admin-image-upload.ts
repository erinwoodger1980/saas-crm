import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { putObject } from '../lib/storage';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/admin/landing-tenants/:id/images - Upload images
// Note: server mounts this router behind requireAuth (cookie or Bearer). Do an extra sanity check here.
router.post('/:id/images', upload.array('images', 10), async (req: any, res: any) => {
  try {
    if (!req.auth?.tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    // Optional: enforce tenant matches path (owners/admins may upload only for their tenant)
    if (req.params?.id && req.auth?.tenantId && req.params.id !== req.auth.tenantId) {
      // Allow admins/owners to upload for other tenants if role permits
      const role = String(req.auth?.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'owner';
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
    }
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { slug: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get or create landing tenant
    let landingTenant = await prisma.landingTenant.findUnique({
      where: { tenantId: req.params.id },
    });

    const tenantSlug = tenant.slug ?? `tenant-${req.params.id}`;

    if (!landingTenant) {
      landingTenant = await prisma.landingTenant.create({
        data: {
          tenantId: req.params.id,
          headline: '',
          subhead: '',
          urgencyBanner: '',
          ctaText: 'Get Your Free Quote',
          guarantees: [],
        },
        include: {
          images: true,
          reviews: true,
        },
      });
    }

  // Upload files and (optionally) persist them immediately to landingTenantImage
  const uploadedImages: Array<{ url: string; altText: string }> = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop() || 'jpg';

      const { publicUrl } = await putObject({
        tenantSlug,
        buffer: file.buffer,
        ext,
      });

      uploadedImages.push({
        url: publicUrl,
        altText: file.originalname.split('.')[0],
      });
    }

    // Persist uploaded images directly so they appear without requiring a manual save
    try {
      const existingCount = await prisma.landingTenantImage.count({
        where: { landingTenantId: landingTenant.id },
      });
      // Create records with sequential order appended after existing images
      await prisma.landingTenantImage.createMany({
        data: uploadedImages.map((img, idx) => ({
          landingTenantId: landingTenant!.id,
            url: img.url,
            altText: img.altText,
            order: existingCount + idx,
        })),
      });
    } catch (persistErr) {
      console.warn('[admin-image-upload] failed to persist images automatically', (persistErr as any)?.message || persistErr);
    }

    res.json(uploadedImages);
  } catch (error) {
    console.error('Failed to upload images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

export default router;
