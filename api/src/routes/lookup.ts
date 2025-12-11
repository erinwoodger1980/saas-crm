import { Router } from "express";
import prisma from "../db";

const router = Router();

/**
 * Generic lookup endpoint that queries database tables based on conditions
 * Example: /api/lookup/FireCertificationRule?rating=FD30&returnField=certification
 */
router.get("/:tableName", async (req: any, res) => {
  const { tableName } = req.params;
  const { returnField, ...conditions } = req.query;

  try {
    // Validate table name (whitelist approach for security)
    const allowedTables = [
      "FireCertificationRule",
      "WeightLookup",
      "MaterialPricing",
      "DoorPricing",
    ];

    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({
        error: `Table '${tableName}' is not available for lookup`,
      });
    }

    if (!returnField || typeof returnField !== "string") {
      return res.status(400).json({
        error: "returnField parameter is required",
      });
    }

    // Build where clause from conditions
    const where: any = {};
    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === "string") {
        where[key] = value;
      }
    }

    // Perform the lookup based on table name
    let result: any = null;

    switch (tableName) {
      case "FireCertificationRule":
        result = await (prisma as any).fireCertificationRule.findFirst({
          where,
          select: {
            [returnField]: true,
          },
        });
        break;

      case "WeightLookup":
        result = await (prisma as any).weightLookup.findFirst({
          where,
          select: {
            [returnField]: true,
          },
        });
        break;

      case "MaterialPricing":
        // Check if MaterialPricing table exists, otherwise return empty
        result = null;
        break;

      case "DoorPricing":
        // Check if DoorPricing table exists, otherwise return empty
        result = null;
        break;

      default:
        return res.status(400).json({
          error: `Table '${tableName}' handler not implemented`,
        });
    }

    if (!result) {
      return res.json({
        value: null,
        found: false,
      });
    }

    return res.json({
      value: result[returnField],
      found: true,
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Lookup failed",
    });
  }
});

export default router;
