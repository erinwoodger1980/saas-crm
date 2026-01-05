import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEstimateEmail } from '@/lib/email/sendEstimateEmail';
import { nanoid } from 'nanoid';

/**
 * POST /api/public/estimate-submit
 * 
 * Receives public estimator submission and:
 * 1. Creates a Lead
 * 2. Creates a Quote with LineItems
 * 3. Triggers AI analysis of photos/dimensions
 * 4. Sends confirmation email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientInfo,
      projectInfo,
      lineItems,
    } = body;

    // Validate required fields
    if (!clientInfo?.email || !clientInfo?.name) {
      return NextResponse.json(
        { message: 'Client name and email are required' },
        { status: 400 }
      );
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { message: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Create or find tenant (public submissions default to demo tenant)
    // In production, you'd want to determine this based on the domain/referrer
    const demoTenant = await prisma.tenant.findFirst({
      where: { name: { contains: 'demo' } },
    });

    if (!demoTenant) {
      return NextResponse.json(
        { message: 'Unable to process estimate at this time' },
        { status: 500 }
      );
    }

    // Create Lead
    const lead = await prisma.lead.create({
      data: {
        tenantId: demoTenant.id,
        firstName: clientInfo.name.split(' ')[0],
        lastName: clientInfo.name.split(' ').slice(1).join(' '),
        email: clientInfo.email,
        phone: clientInfo.phone,
        company: clientInfo.company,
        address: clientInfo.address,
        city: clientInfo.city,
        postCode: clientInfo.postcode,
        propertyType: projectInfo.propertyType,
        status: 'new',
        source: 'public_estimator',
        notes: [
          `Public Estimator Submission`,
          `Project Type: ${projectInfo.projectType}`,
          `Location: ${projectInfo.location}`,
          projectInfo.projectDescription ? `Description: ${projectInfo.projectDescription}` : '',
          projectInfo.targetDate ? `Target Date: ${projectInfo.targetDate}` : '',
          projectInfo.urgency ? `Urgency: ${projectInfo.urgency}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    // Create Quote
    const quote = await prisma.quote.create({
      data: {
        leadId: lead.id,
        tenantId: demoTenant.id,
        status: 'draft',
        quoteNumber: `EST-${Date.now()}`,
        lineItems: {
          create: lineItems.map((item: any, idx: number) => ({
            sequenceNumber: idx + 1,
            description: item.description,
            quantity: item.quantity,
            widthMm: item.widthMm,
            heightMm: item.heightMm,
            productType: item.productType,
            materialTimber: item.timber,
            materialIronmongery: item.ironmongery,
            materialGlazing: item.glazing,
            notes: item.photoUrl ? 'Photo attached for analysis' : undefined,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    // Process any uploaded photos (in production, store in S3)
    const photoUrls: Record<string, string> = {};
    for (const item of lineItems) {
      if (item.photoUrl && item.id) {
        photoUrls[item.id] = item.photoUrl;
        // TODO: Upload to S3, trigger dimension extraction via AI
      }
    }

    // Send confirmation email
    try {
      await sendEstimateEmail({
        to: clientInfo.email,
        clientName: clientInfo.name,
        quoteNumber: quote.quoteNumber,
        estimatedDeliveryTime: '24 hours',
        itemCount: lineItems.length,
      });
    } catch (emailError) {
      console.error('[estimate-submit] Email send error:', emailError);
      // Don't fail the request if email fails
    }

    console.log('[estimate-submit] Success:', {
      leadId: lead.id,
      quoteId: quote.id,
      itemCount: lineItems.length,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      message: 'Estimate submission received. Check your email for updates.',
    });
  } catch (error) {
    console.error('[estimate-submit] Error:', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process estimate submission',
      },
      { status: 500 }
    );
  }
}
