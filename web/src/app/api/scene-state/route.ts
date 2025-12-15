/**
 * Scene State API Routes
 * REST endpoints for persisting and loading scene configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { SceneConfig } from '@/types/scene-config';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * GET /api/scene-state
 * Load scene configuration for an entity
 * 
 * Query params:
 * - tenantId: string
 * - entityType: string
 * - entityId: string
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!tenantId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required parameters: tenantId, entityType, entityId' },
        { status: 400 }
      );
    }

    // Verify user has access to tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Load scene state
    const sceneState = await prisma.sceneState.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      select: {
        id: true,
        config: true,
        updatedAt: true,
        modifiedBy: true,
      },
    });

    if (!sceneState) {
      return NextResponse.json({ error: 'Scene state not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: sceneState.id,
        config: sceneState.config as SceneConfig,
        updatedAt: sceneState.updatedAt,
        modifiedBy: sceneState.modifiedBy,
      },
    });
  } catch (error) {
    console.error('Error loading scene state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scene-state
 * Save or update scene configuration
 * 
 * Body:
 * {
 *   tenantId: string;
 *   entityType: string;
 *   entityId: string;
 *   config: SceneConfig;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, entityType, entityId, config } = body;

    if (!tenantId || !entityType || !entityId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, entityType, entityId, config' },
        { status: 400 }
      );
    }

    // Verify user has access to tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate config structure (basic check)
    if (!config.version || !config.camera || !config.dimensions) {
      return NextResponse.json(
        { error: 'Invalid scene config structure' },
        { status: 400 }
      );
    }

    // Update timestamp
    config.updatedAt = new Date().toISOString();

    // Upsert scene state
    const sceneState = await prisma.sceneState.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      create: {
        tenantId,
        entityType,
        entityId,
        config: config as any,
        modifiedBy: session.user.id,
      },
      update: {
        config: config as any,
        modifiedBy: session.user.id,
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: sceneState.id,
        updatedAt: sceneState.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error saving scene state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scene-state
 * Delete scene configuration
 * 
 * Query params:
 * - tenantId: string
 * - entityType: string
 * - entityId: string
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!tenantId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify access
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.sceneState.delete({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scene state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
