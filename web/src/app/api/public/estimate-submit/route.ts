import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-base';

/**
 * POST /api/public/estimate-submit
 * 
 * Receives public estimator submission and:
 * Creates a NEW_ENQUIRY lead via the backend public intake route.
 * 
 * Note: The web workspace no longer ships with Prisma access; this route must
 * forward to the API service.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientInfo,
      projectInfo,
      lineItems,
      tenantSlug: rawTenantSlug,
    } = body;

    const tenantSlug = String(
      rawTenantSlug ||
        request.headers.get('x-tenant-slug') ||
        process.env.PUBLIC_ESTIMATOR_TENANT_SLUG ||
        process.env.NEXT_PUBLIC_PUBLIC_ESTIMATOR_TENANT_SLUG ||
        ''
    )
      .trim()
      .toLowerCase();

    if (!tenantSlug) {
      return NextResponse.json(
        {
          message:
            'Estimate intake is not configured (missing tenantSlug / PUBLIC_ESTIMATOR_TENANT_SLUG).',
        },
        { status: 500 }
      );
    }

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

    const safe = (v: any) => String(v ?? '').trim().slice(0, 5000);
    const itemsSummary = Array.isArray(lineItems)
      ? lineItems
          .slice(0, 10)
          .map((it: any, idx: number) => {
            const qty = Number(it?.quantity) || 1;
            const desc = safe(it?.description) || `Item ${idx + 1}`;
            const w = it?.widthMm ? `${it.widthMm}mm` : '';
            const h = it?.heightMm ? `${it.heightMm}mm` : '';
            const dims = [w, h].filter(Boolean).join(' x ');
            return `- ${qty} × ${desc}${dims ? ` (${dims})` : ''}`;
          })
          .join('\n')
      : '';

    const message = [
      'Public estimator submission',
      projectInfo?.projectType ? `Project type: ${safe(projectInfo.projectType)}` : '',
      projectInfo?.propertyType ? `Property type: ${safe(projectInfo.propertyType)}` : '',
      projectInfo?.location ? `Location: ${safe(projectInfo.location)}` : '',
      projectInfo?.targetDate ? `Target date: ${safe(projectInfo.targetDate)}` : '',
      projectInfo?.urgency ? `Urgency: ${safe(projectInfo.urgency)}` : '',
      projectInfo?.projectDescription ? `Description: ${safe(projectInfo.projectDescription)}` : '',
      itemsSummary ? `\nItems:\n${itemsSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const createLeadResponse = await fetch(
      `${API_BASE}/public/tenant/${encodeURIComponent(tenantSlug)}/leads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'public_estimator',
          name: safe(clientInfo.name),
          email: safe(clientInfo.email),
          phone: safe(clientInfo.phone),
          postcode: safe(clientInfo.postcode),
          projectType: safe(projectInfo?.projectType),
          propertyType: safe(projectInfo?.propertyType),
          message,
        }),
      }
    );

    if (!createLeadResponse.ok) {
      const errorText = await createLeadResponse.text();
      console.error('[estimate-submit] Lead intake failed', {
        status: createLeadResponse.status,
        body: errorText?.slice(0, 500),
      });
      return NextResponse.json(
        { message: 'Failed to submit estimate' },
        { status: 502 }
      );
    }

    const leadResult = await createLeadResponse.json().catch(() => null);
    const leadId = leadResult?.id || leadResult?.leadId || null;

    console.log('[estimate-submit] Success:', {
      tenantSlug,
      leadId,
      itemCount: Array.isArray(lineItems) ? lineItems.length : 0,
    });

    return NextResponse.json({
      success: true,
      leadId,
      message:
        'Estimate submission received. We will review your details and be in touch shortly.',
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
        
