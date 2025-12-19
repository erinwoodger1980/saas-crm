/**
 * Batch Create Components Endpoint
 * Creates components from AI-generated specifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/api/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { tenantId, components } = await request.json();

    if (!tenantId || !components || !Array.isArray(components)) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, components (array)' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Create components
    const created = await Promise.all(
      components.map((comp: any) =>
        prisma.component.create({
          data: {
            tenantId,
            name: comp.name || `Component`,
            type: comp.type || 'part',
            category: 'ai-generated',
            dimensions: {
              width: comp.width || 500,
              height: comp.height || 500,
              depth: comp.depth || 50,
            },
            material: comp.material || 'wood',
            attributes: {
              sourceDescription: comp.sourceDescription,
              aiGenerated: true,
              generatedAt: new Date().toISOString(),
            },
            isActive: true,
          },
        })
      )
    );

    return NextResponse.json({
      createdCount: created.length,
      components: created,
      success: true,
    });
  } catch (error) {
    console.error('[batch-create-components] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create components' },
      { status: 500 }
    );
  }
}
