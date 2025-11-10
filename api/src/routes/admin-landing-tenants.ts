import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import openai from '../ai';

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

// Helper: sanitize slug
function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// POST /api/admin/landing-tenants - Create a new tenant and seed landing tenant
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let baseSlug = (typeof slug === 'string' && slug.trim()) ? toSlug(slug) : toSlug(name);
    if (!baseSlug) baseSlug = `tenant-${Date.now().toString(36)}`;

    // Ensure unique slug on tenant
    let uniqueSlug = baseSlug;
    let suffix = 1;
    // Prisma unique constraint will protect us
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await prisma.tenant.findFirst({ where: { slug: uniqueSlug } });
      if (!clash) break;
      uniqueSlug = `${baseSlug}-${suffix++}`;
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: { name: name.trim(), slug: uniqueSlug },
      select: { id: true, name: true, slug: true },
    });

    // Seed landing tenant row
    const landing = await prisma.landingTenant.create({
      data: {
        tenantId: tenant.id,
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

    return res.status(201).json({
      ...landing,
      tenant,
    });
  } catch (error) {
    console.error('Failed to create tenant:', error);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
});

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
            _count: {
              select: {
                images: true,
                reviews: true,
              },
            },
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

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
      await prisma.landingTenantImage.deleteMany({
        where: { landingTenantId: landingTenant.id },
      });

      if (images.length > 0) {
        await prisma.landingTenantImage.createMany({
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
      await prisma.landingTenantReview.deleteMany({
        where: { landingTenantId: landingTenant.id },
      });

      if (reviews.length > 0) {
        await prisma.landingTenantReview.createMany({
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
    const refreshedTenant = await prisma.tenant.findUnique({
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
      tenant: refreshedTenant ?? tenant,
    });
  } catch (error) {
    console.error('Failed to update tenant content:', error);
    res.status(500).json({ error: 'Failed to update tenant content' });
  }
});

// POST /:tenantId/ai-suggest - Generate AI headline and subhead suggestions
router.post('/:tenantId/ai-suggest', requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { currentHeadline, currentSubhead, context } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'AI service not configured',
        message: 'OPENAI_API_KEY is not set' 
      });
    }

    // Fetch tenant info for context
    const tenant = await prisma.landingTenant.findUnique({
      where: { id: tenantId },
      include: {
        tenant: {
          select: { name: true, slug: true }
        },
        reviews: {
          take: 3,
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Build context for AI
    const businessName = tenant.tenant?.name || 'the business';
    const industry = 'joinery and carpentry services';
    const reviewContext = tenant.reviews.length > 0 
      ? `Customer reviews highlight: ${tenant.reviews.map(r => r.text?.slice(0, 100)).filter(Boolean).join('; ')}`
      : '';

    const prompt = `You are an expert copywriter specializing in local service business landing pages for joiners, carpenters, and home renovation businesses.

Business: ${businessName}
Industry: ${industry}
Current headline: ${currentHeadline || 'Not set'}
Current subhead: ${currentSubhead || 'Not set'}
${reviewContext}
${context ? `Additional context: ${context}` : ''}

Generate 3 compelling headline and subhead pairs for this joinery business landing page. Each should:
- Be concise, benefit-focused, and locally relevant
- Highlight expertise, quality, or trust
- Include emotional appeal or urgency where appropriate
- Be SEO-friendly (under 60 chars for headline)
- Sound natural and professional

Return your response as a JSON array with exactly 3 objects, each containing "headline" and "subhead" fields.
Example format:
[
  {
    "headline": "Expert Joiners in Kent | Custom Kitchens & Renovations",
    "subhead": "Transform your home with bespoke joinery. Family-run, fully insured, 20+ years experience."
  },
  {
    "headline": "...",
    "subhead": "..."
  },
  {
    "headline": "...",
    "subhead": "..."
  }
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert copywriter. Always respond with valid JSON arrays only, no markdown formatting or extra text.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '[]';
    
    // Parse JSON response, handling potential markdown code blocks
    let suggestions = [];
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText
        .replace(/^```json\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      
      suggestions = JSON.parse(cleanedText);
      
      // Validate structure
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('Invalid suggestions format');
      }
      
      // Ensure each suggestion has required fields
      suggestions = suggestions.filter((s: any) => s.headline && s.subhead).slice(0, 3);
      
      if (suggestions.length === 0) {
        throw new Error('No valid suggestions found');
      }
      
    } catch (parseError: any) {
      console.error('Failed to parse AI response:', parseError.message, 'Response:', responseText);
      
      // Fallback suggestions
      suggestions = [
        {
          headline: `Expert ${industry} in Your Area`,
          subhead: 'Quality craftsmanship you can trust. Get your free quote today.'
        }
      ];
    }

    res.json({ 
      suggestions,
      model: 'gpt-4o-mini'
    });

  } catch (error: any) {
    console.error('Error generating AI suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestions',
      message: error.message 
    });
  }
});

export default router;
