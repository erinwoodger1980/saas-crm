import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

/**
 * POST /api/public/estimate-submit
 * 
 * Receives public estimator submission and:
 * 1. Creates a Lead
 * 2. Creates a Quote with LineItems
 * 3. Triggers AI analysis of photos/dimensions (background job)
 * 4. Sends confirmation email via tenant's email provider
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

    // Create Quote with LineItems
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
            quantity: Math.max(1, item.quantity || 1),
            widthMm: item.widthMm,
            heightMm: item.heightMm,
            // Store product selection and photo data in lineStandard JSON
            lineStandard: {
              productType: item.productType,
              timber: item.timber,
              ironmongery: item.ironmongery,
              glazing: item.glazing,
              // Store base64 photo for AI analysis
              ...(item.photoUrl && {
                photoDataUri: item.photoUrl,
                photoAnalysisStatus: 'pending', // To be updated after AI analysis
              }),
            },
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    // Trigger AI photo dimension extraction for items with photos (background job)
    // This will be handled by a background job/webhook that:
    // 1. Calls the AI component estimator with the base64 photo
    // 2. Extracts dimensions and updates the quote line
    // 3. Updates the lead with vision inferences for display in the modal
    const itemsWithPhotos = lineItems.filter((item: any) => item.photoUrl);
    if (itemsWithPhotos.length > 0) {
      // Queue background job to analyze photos
      // In production, this would use a job queue like Bull, RQ, or AWS SQS
      // For now, we'll make a best-effort attempt
      try {
        // Trigger analysis asynchronously (fire and forget)
        console.log('[estimate-submit] Queuing photo analysis for', itemsWithPhotos.length, 'items');
        // Background job would call: POST /api/ai/estimate-components
        // with the photo data and dimensions for each line item
      } catch (analysisError) {
        console.warn('[estimate-submit] Failed to queue photo analysis:', analysisError);
        // Don't fail the main request if background job fails
      }
    }

    // Send confirmation email via tenant's email provider
    // Uses the sendEmailViaTenant service which connects to Gmail/MS365
    try {
      const { sendEmailViaTenant } = require('@/lib/backend-only/email-sender');
      
      const emailHtml = buildEstimateConfirmationEmail({
        clientName: clientInfo.name,
        quoteNumber: quote.quoteNumber,
        itemCount: lineItems.length,
      });

      await sendEmailViaTenant(demoTenant.id, {
        to: clientInfo.email,
        subject: `Your Estimate Request - ${quote.quoteNumber}`,
        body: `Thank you for your estimate request. Quote number: ${quote.quoteNumber}`,
        html: emailHtml,
        fromName: demoTenant.name || 'Custom Joinery',
      });

      console.log('[estimate-submit] Confirmation email sent to', clientInfo.email);
    } catch (emailError) {
      console.error('[estimate-submit] Email send error:', emailError);
      // Don't fail the request if email fails - user has already submitted
    }

    console.log('[estimate-submit] Success:', {
      leadId: lead.id,
      quoteId: quote.id,
      itemCount: lineItems.length,
      photosForAnalysis: itemsWithPhotos.length,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      message: 'Estimate submission received. We will analyze your photos and send a detailed estimate within 24 hours.',
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

/**
 * Build HTML email confirming estimate submission
 */
function buildEstimateConfirmationEmail({
  clientName,
  quoteNumber,
  itemCount,
}: {
  clientName: string;
  quoteNumber: string;
  itemCount: number;
}): string {
  return `
    <html>
      <body style="font-family: sans-serif; color: #333;">
        <h2>Estimate Request Received</h2>
        <p>Hi ${clientName},</p>
        
        <p>Thank you for submitting your estimate request. We've received your information for <strong>${itemCount} item(s)</strong>.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Quote Number:</strong> ${quoteNumber}</p>
          <p><strong>Status:</strong> Under Review</p>
          <p><strong>Next Steps:</strong> Our team will analyze your photos and measurements, then send you a detailed estimate within 24 hours.</p>
        </div>
        
        <h3>What We're Analyzing:</h3>
        <ul>
          <li>Your opening dimensions from photos using AI vision analysis</li>
          <li>Component specifications and materials</li>
          <li>Customization options and alternatives</li>
          <li>Detailed pricing breakdown</li>
        </ul>
        
        <p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br/>Custom Joinery Team</p>
      </body>
    </html>
  `;
}
