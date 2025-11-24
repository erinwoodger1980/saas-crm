/**
 * Material Debug Routes
 * 
 * Debugging endpoints to verify material cost data visibility
 * Helps diagnose missing costs and data issues
 */

import { Router, Response } from "express";
import { prisma } from "../prisma";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * GET /material-debug
 * List all materials for tenant with full details including costs
 */
router.get("/", requireAuth, async (req: any, res: Response) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const includeInactive = req.query.includeInactive === "true";
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    let where: any = { tenantId };
    
    if (!includeInactive) {
      where.isActive = true;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const materials = await (prisma as any).materialItem.findMany({
      where,
      orderBy: [
        { category: "asc" },
        { code: "asc" },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        cost: true,
        currency: true,
        unit: true,
        stockQuantity: true,
        minStockLevel: true,
        isActive: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate statistics
    const stats = {
      total: materials.length,
      withCost: materials.filter((m: any) => Number(m.cost) > 0).length,
      zeroCost: materials.filter((m: any) => Number(m.cost) === 0).length,
      active: materials.filter((m: any) => m.isActive).length,
      inactive: materials.filter((m: any) => !m.isActive).length,
      byCategory: materials.reduce((acc: any, m: any) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json({
      ok: true,
      materials: materials.map((m: any) => ({
        ...m,
        cost: Number(m.cost),
        stockQuantity: Number(m.stockQuantity),
        minStockLevel: m.minStockLevel ? Number(m.minStockLevel) : null,
      })),
      stats,
      query: {
        tenantId,
        includeInactive,
        category,
        search,
      },
    });
  } catch (error: any) {
    console.error("[GET /material-debug] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch materials",
      detail: error?.message,
    });
  }
});

/**
 * GET /material-debug/:id
 * Get detailed information about a specific material
 */
router.get("/:id", requireAuth, async (req: any, res: Response) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const { id } = req.params;

    const material = await (prisma as any).materialItem.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        supplier: true,
        shoppingListItems: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quantity: true,
            unit: true,
            createdAt: true,
            shoppingList: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        purchaseOrderLines: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            createdAt: true,
            purchaseOrder: {
              select: {
                id: true,
                status: true,
                orderDate: true,
              },
            },
          },
        },
      },
    });

    if (!material) {
      return res.status(404).json({
        ok: false,
        error: "Material not found",
      });
    }

    res.json({
      ok: true,
      material: {
        ...material,
        cost: Number(material.cost),
        stockQuantity: Number(material.stockQuantity),
        minStockLevel: material.minStockLevel ? Number(material.minStockLevel) : null,
        purchaseOrderLines: material.purchaseOrderLines.map((line: any) => ({
          ...line,
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
        })),
      },
    });
  } catch (error: any) {
    console.error("[GET /material-debug/:id] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch material",
      detail: error?.message,
    });
  }
});

/**
 * GET /material-debug/categories/list
 * Get list of all material categories in use
 */
router.get("/categories/list", requireAuth, async (req: any, res: Response) => {
  try {
    const tenantId = req.auth.tenantId as string;

    const materials = await (prisma as any).materialItem.findMany({
      where: { tenantId },
      select: { category: true },
      distinct: ["category"],
    });

    const categories = materials.map((m: any) => m.category).sort();

    res.json({
      ok: true,
      categories,
    });
  } catch (error: any) {
    console.error("[GET /material-debug/categories/list] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch categories",
      detail: error?.message,
    });
  }
});

export default router;
