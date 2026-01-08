import { Router } from "express";
import prisma from "../db";

const router = Router();

/**
 * GET /lookup-tables
 * Fetch all available lookup tables for the current tenant
 */
router.get("/", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tables = await prisma.lookupTable.findMany({
      where: { tenantId },
      select: {
        id: true,
        tableName: true,
        category: true,
        description: true,
      },
      orderBy: { tableName: "asc" },
    });

    res.json(tables);
  } catch (error) {
    console.error("Error fetching lookup tables:", error);
    res.status(500).json({ error: "Failed to fetch lookup tables" });
  }
});

export default router;
