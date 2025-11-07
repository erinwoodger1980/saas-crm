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

// Admin authentication middleware
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// POST /api/admin/landing-tenants/:id/images - Upload images
router.post('/:id/images', requireAdmin, upload.array('images', 10), async (req: any, res: any) => {
  try {
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
          slug: tenantSlug,
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

    // Upload files and create records
    const uploadedImages = [];

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

    res.json(uploadedImages);
  } catch (error) {
    console.error('Failed to upload images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

export default router;
