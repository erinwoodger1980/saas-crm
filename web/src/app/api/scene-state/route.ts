/**
 * Scene State API Routes
 * REST endpoints for persisting and loading scene configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SceneConfig } from '@/types/scene-config';

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

    try {
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
    } catch (dbError: any) {
      // Handle table doesn't exist or other DB errors
      if (dbError.code === 'P2025' || dbError.message?.includes('does not exist') || dbError.message?.includes('RELATION')) {
        console.warn('[GET /api/scene-state] Database table or record not found:', dbError.message);
        return NextResponse.json({ error: 'Scene state not found' }, { status: 404 });
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error loading scene state:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error?.message },
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
    const body = await request.json();
    const { tenantId, entityType, entityId, config } = body;

    if (!tenantId || !entityType || !entityId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, entityType, entityId, config' },
        { status: 400 }
      );
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
        modifiedBy: 'system',
      },
      update: {
        config: config as any,
        modifiedBy: 'system',
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
