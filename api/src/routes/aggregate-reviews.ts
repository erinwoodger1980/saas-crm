import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /aggregate-reviews
 * Compute aggregate rating across all tenants for Organization schema
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Fetch all reviews across all landing tenants
    const reviews = await prisma.landingTenantReview.findMany({
      select: {
        rating: true,
        createdAt: true
      }
    });

    if (reviews.length === 0) {
      return res.json({
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: {},
        schema: null
      });
    }

    // Calculate statistics
    const totalStars = reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = totalStars / reviews.length;

    // Rating distribution (1-5 stars)
    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };

    reviews.forEach((review: any) => {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    });

    // Generate Organization schema with aggregate rating
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Joinery AI',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      description: 'UK\'s largest joinery marketplace connecting homeowners with trusted joinery specialists',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: averageRating.toFixed(2),
        reviewCount: reviews.length,
        bestRating: '5',
        worstRating: '1'
      },
      sameAs: [
        'https://www.facebook.com/joineryai',
        'https://twitter.com/joineryai',
        'https://www.linkedin.com/company/joineryai'
      ]
    };

    res.json({
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews: reviews.length,
      ratingDistribution,
      schema: organizationSchema
    });
  } catch (error: any) {
    console.error('Failed to compute aggregate reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /aggregate-reviews/:tenantId
 * Get aggregate rating for specific tenant
 */
router.get('/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Find landing tenant for this tenant
    const landingTenant = await prisma.landingTenant.findUnique({
      where: { tenantId },
      select: { id: true }
    });

    if (!landingTenant) {
      return res.json({
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: {},
        recentReviews: []
      });
    }

    const reviews = await prisma.landingTenantReview.findMany({
      where: { landingTenantId: landingTenant.id },
      select: {
        rating: true,
        text: true,
        author: true,
        location: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (reviews.length === 0) {
      return res.json({
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: {},
        recentReviews: []
      });
    }

    const totalStars = reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = totalStars / reviews.length;

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };

    reviews.forEach((review: any) => {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    });

    res.json({
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews: reviews.length,
      ratingDistribution,
      recentReviews: reviews.slice(0, 5) // Top 5 most recent
    });
  } catch (error: any) {
    console.error('Failed to fetch tenant reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
