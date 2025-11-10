import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { putObject } from '../lib/storage';
import multer from 'multer';
import openai from '../ai';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Admin authentication middleware
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY || 'supersecret';
  
  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /tenants/:slug
 * Fetch tenant data with content, images, and reviews
 * Query param ?draft=1 to include draft content
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const draft = req.query.draft === '1';

    const tenant = await prisma.landingTenant.findUnique({
      where: { slug },
      include: {
        content: true,
        images: {
          orderBy: { order: 'asc' },
        },
        reviews: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Filter published content unless draft=1
    if (!draft && tenant.content && !tenant.content.published) {
      tenant.content = null as any;
    }

    res.json(tenant);
  } catch (error: any) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /tenants/:slug/content
 * Upsert tenant content (headline, subhead, pricing, etc.)
 */
router.put('/:slug/content', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      headline,
      subhead,
      priceFromText,
      priceRange,
      guarantees,
      urgency,
      faqJson,
      leadMagnet,
      serviceAreas,
      published,
    } = req.body;

    // Find tenant
    const tenant = await prisma.landingTenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Upsert content
  const content = await prisma.landingTenantContent.upsert({
      where: { tenantId: tenant.id },
      create: {
  tenantId: tenant.id,
        headline,
        subhead,
        priceFromText,
        priceRange,
        guarantees: guarantees ? JSON.stringify(guarantees) : null,
        urgency: urgency ? JSON.stringify(urgency) : null,
        faqJson: faqJson ? JSON.stringify(faqJson) : null,
        leadMagnet: leadMagnet ? JSON.stringify(leadMagnet) : null,
        serviceAreas: serviceAreas ? JSON.stringify(serviceAreas) : null,
        published: published || false,
      },
      update: {
        headline,
        subhead,
        priceFromText,
        priceRange,
        guarantees: guarantees ? JSON.stringify(guarantees) : undefined,
        urgency: urgency ? JSON.stringify(urgency) : undefined,
        faqJson: faqJson ? JSON.stringify(faqJson) : undefined,
        leadMagnet: leadMagnet ? JSON.stringify(leadMagnet) : undefined,
        serviceAreas: serviceAreas ? JSON.stringify(serviceAreas) : undefined,
        published: published !== undefined ? published : undefined,
        updatedAt: new Date(),
      },
    });

    res.json(content);
  } catch (error: any) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /tenants/:slug/images/upload
 * Upload an image and create TenantImage record
 */
router.post('/:slug/images/upload', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { alt, caption, sortOrder } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Find tenant
    const tenant = await prisma.landingTenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Determine file extension
    const originalname = req.file.originalname;
    const ext = originalname.split('.').pop() || 'jpg';

    // Validate extension
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Store file
    const { publicUrl } = await putObject({
      tenantSlug: slug,
      buffer: req.file.buffer,
      ext,
    });

    // Create image record
    const image = await prisma.landingTenantImage.create({
      data: {
        landingTenantId: tenant.id,
        url: publicUrl,
        altText: alt || originalname.split('.')[0],
        caption: caption || null,
        order: sortOrder ? parseInt(sortOrder) : 0,
      },
    });

    res.json(image);
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /tenants/:slug/images/:id
 * Update image metadata (alt, caption, sortOrder)
 */
router.patch('/:slug/images/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { alt, caption, sortOrder } = req.body;

    const image = await prisma.landingTenantImage.update({
      where: { id },
      data: {
        altText: alt !== undefined ? alt : undefined,
        caption: caption !== undefined ? caption : undefined,
        order: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
      },
    });

    res.json(image);
  } catch (error: any) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /tenants/:slug/images/:id
 * Delete an image
 */
router.delete('/:slug/images/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.landingTenantImage.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /tenants/:slug/reviews
 * Create a review
 */
router.post('/:slug/reviews', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { quote, author, location, stars, sortOrder } = req.body;

    const tenant = await prisma.landingTenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const review = await prisma.landingTenantReview.create({
      data: {
        landingTenantId: tenant.id,
        text: quote,
        author: author || null,
        location: location || null,
        rating: stars || 5,
        order: sortOrder || 0,
      },
    });

    res.json(review);
  } catch (error: any) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /tenants/:slug/reviews/:id
 * Update a review
 */
router.patch('/:slug/reviews/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quote, author, location, stars, sortOrder } = req.body;

    const review = await prisma.landingTenantReview.update({
      where: { id },
      data: {
        text: quote !== undefined ? quote : undefined,
        author: author !== undefined ? author : undefined,
        location: location !== undefined ? location : undefined,
        rating: stars !== undefined ? parseInt(stars) : undefined,
        order: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
      },
    });

    res.json(review);
  } catch (error: any) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /tenants/:slug/reviews/:id
 * Delete a review
 */
router.delete('/:slug/reviews/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.landingTenantReview.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:tenantId/ai-suggest
 * Generate AI headline and subhead suggestions for landing page
 */
router.post('/:tenantId/ai-suggest', requireAdmin, async (req: Request, res: Response) => {
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
        content: true,
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
    const businessName = tenant.tenant?.name || tenant.brandName || 'the business';
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
      suggestions = suggestions.filter(s => s.headline && s.subhead).slice(0, 3);
      
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
