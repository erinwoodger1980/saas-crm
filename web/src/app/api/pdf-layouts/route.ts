/**
 * PDF Layout Template API
 * 
 * POST /api/pdf-layouts
 * Saves annotation templates for supplier profiles
 * These templates are later used by the backend parser to extract structured data
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { supplierProfile, pdfMeta, annotations } = body;

    // Validate required fields
    if (!supplierProfile || typeof supplierProfile !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid supplierProfile' },
        { status: 400 }
      );
    }

    if (!pdfMeta || !Array.isArray(pdfMeta.pageSizes)) {
      return NextResponse.json(
        { error: 'Missing or invalid pdfMeta' },
        { status: 400 }
      );
    }

    if (!Array.isArray(annotations)) {
      return NextResponse.json(
        { error: 'Missing or invalid annotations array' },
        { status: 400 }
      );
    }

    // Log the template for now (later, save to database)
    console.log('[POST /api/pdf-layouts] Received layout template:');
    console.log(JSON.stringify({
      supplierProfile,
      pdfMeta,
      annotationCount: annotations.length,
      annotations: annotations.map((a: any) => ({
        id: a.id,
        page: a.page,
        label: a.label,
        rowId: a.rowId,
        bounds: { x: a.x, y: a.y, width: a.width, height: a.height },
      })),
    }, null, 2));

    // TODO: Save to database
    // await prisma.pdfLayoutTemplate.create({
    //   data: {
    //     supplierProfile,
    //     pageCount: pdfMeta.pageCount,
    //     pageSizes: pdfMeta.pageSizes,
    //     annotations,
    //   },
    // });

    return NextResponse.json({
      ok: true,
      message: 'Layout template saved successfully',
      supplierProfile,
      annotationCount: annotations.length,
    });
  } catch (error: any) {
    console.error('[POST /api/pdf-layouts] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierProfile = searchParams.get('supplierProfile');

    if (!supplierProfile) {
      return NextResponse.json(
        { error: 'Missing supplierProfile parameter' },
        { status: 400 }
      );
    }

    // TODO: Load from database
    // const template = await prisma.pdfLayoutTemplate.findFirst({
    //   where: { supplierProfile },
    //   orderBy: { createdAt: 'desc' },
    // });

    // For now, return empty template
    return NextResponse.json({
      supplierProfile,
      pdfMeta: null,
      annotations: [],
    });
  } catch (error: any) {
    console.error('[GET /api/pdf-layouts] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error?.message },
      { status: 500 }
    );
  }
}
