import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Admin authentication middleware
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  // TODO: Implement proper JWT validation
  // For now, just check if token exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GET /api/admin/landing-tenants - List all tenants
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        landingTenant: {
          select: {
            id: true,
            publishedAt: true,
          },
        },
        _count: {
          select: {
            images: true,
            reviews: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ tenants });
  } catch (error) {
    console.error('Failed to fetch tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// GET /api/admin/landing-tenants/:id - Get single tenant with all content
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    let landingTenant = await prisma.landingTenant.findUnique({
      where: { tenantId: req.params.id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Create empty landing tenant if doesn't exist
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

    res.json({
      ...landingTenant,
      tenant,
    });
  } catch (error) {
    console.error('Failed to fetch tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// PUT /api/admin/landing-tenants/:id/content - Update content
router.put('/:id/content', requireAdmin, async (req, res) => {
  try {
    const {
      headline,
      subhead,
      urgencyBanner,
      ctaText,
      guarantees,
      images,
      reviews,
      publish,
    } = req.body;

    // Update or create landing tenant
    const landingTenant = await prisma.landingTenant.upsert({
      where: { tenantId: req.params.id },
      create: {
        tenantId: req.params.id,
        headline: headline || '',
        subhead: subhead || '',
        urgencyBanner: urgencyBanner || '',
        ctaText: ctaText || 'Get Your Free Quote',
        guarantees: guarantees || [],
        publishedAt: publish ? new Date() : null,
      },
      update: {
        headline,
        subhead,
        urgencyBanner,
        ctaText,
        guarantees,
        publishedAt: publish ? new Date() : undefined,
      },
    });

    // Update images (delete all and recreate for simplicity)
    if (images && Array.isArray(images)) {
      await prisma.landingImage.deleteMany({
        where: { landingTenantId: landingTenant.id },
      });

      if (images.length > 0) {
        await prisma.landingImage.createMany({
          data: images.map((img, index) => ({
            landingTenantId: landingTenant.id,
            url: img.url,
            altText: img.altText || '',
            order: index,
          })),
        });
      }
    }

    // Update reviews (delete all and recreate)
    if (reviews && Array.isArray(reviews)) {
      await prisma.landingReview.deleteMany({
        where: { landingTenantId: landingTenant.id },
      });

      if (reviews.length > 0) {
        await prisma.landingReview.createMany({
          data: reviews.map((review) => ({
            landingTenantId: landingTenant.id,
            author: review.author,
            rating: review.rating,
            text: review.text,
            date: review.date ? new Date(review.date) : new Date(),
          })),
        });
      }
    }

    // Fetch updated data
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const updated = await prisma.landingTenant.findUnique({
      where: { id: landingTenant.id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.json({
      ...updated,
      tenant,
    });
  } catch (error) {
    console.error('Failed to update tenant content:', error);
    res.status(500).json({ error: 'Failed to update tenant content' });
  }
});

export default router;
