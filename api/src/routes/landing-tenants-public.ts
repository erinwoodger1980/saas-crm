import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /landing-tenants/nearby
 * Find tenants in the same service area for internal linking
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { location, exclude, limit = '3' } = req.query;

    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'location parameter required' });
    }

    // Find tenants with published landing pages in the same service area
    const tenants = await prisma.tenant.findMany({
      where: {
        id: { not: exclude as string },
        serviceAreas: {
          has: location // PostgreSQL array contains operator
        },
        landingTenant: {
          publishedAt: { not: null }
        }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        serviceAreas: true
      },
      take: parseInt(limit as string, 10),
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate aggregate ratings for each tenant
    const tenantsWithRatings = await Promise.all(
      tenants.map(async (tenant) => {
        const landingTenant = await prisma.landingTenant.findUnique({
          where: { tenantId: tenant.id },
          include: {
            reviews: {
              select: { rating: true }
            }
          }
        });

        const reviews = landingTenant?.reviews || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : null;

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug || '',
          serviceAreas: tenant.serviceAreas,
          avgRating,
          reviewCount: reviews.length
        };
      })
    );

    res.json({ tenants: tenantsWithRatings });
  } catch (error: any) {
    console.error('Failed to fetch nearby tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /landing-tenants/published
 * Get all published tenants for sitemap generation
 */
router.get('/published', async (_req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        landingTenant: {
          publishedAt: { not: null }
        }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        serviceAreas: true,
        keywords: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({ tenants });
  } catch (error: any) {
    console.error('Failed to fetch published tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /landing-tenants/by-slug/:slug
 * Fetch tenant by slug for SEO pages
 */
router.get('/by-slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        landingTenant: {
          include: {
            content: true,
            images: {
              orderBy: { order: 'asc' }
            },
            reviews: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        }
      }
    });

    if (!tenant || !tenant.landingTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      tenant: {
        ...tenant,
        landingTenant: tenant.landingTenant
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
