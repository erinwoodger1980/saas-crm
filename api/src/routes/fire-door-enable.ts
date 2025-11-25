/**
 * Enable Fire Door Manufacturer Flag
 * 
 * POST /fire-door-schedule/enable-manufacturer
 * Admin endpoint to enable fire door manufacturer flag for current tenant
 */

import express, { Response } from "express";
import { prisma } from "../prisma";

const router = express.Router();

router.post("/enable-manufacturer", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`Enabling fire door manufacturer flag for tenant ${tenantId}...`);

    // Check if settings exist
    const existingSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!existingSettings) {
      return res.status(400).json({ 
        error: "Tenant settings not found. Please contact support to enable this feature." 
      });
    }

    // Update the flag
    const settings = await prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        isFireDoorManufacturer: true,
      },
    });

    console.log(`✅ Enabled fire door manufacturer flag for tenant ${tenantId}`);

    res.json({
      success: true,
      message: "Fire door manufacturer flag enabled",
      settings: {
        tenantId: settings.tenantId,
        isFireDoorManufacturer: settings.isFireDoorManufacturer,
      },
    });
  } catch (error) {
    console.error("Error enabling fire door manufacturer flag:", error);
    res.status(500).json({ error: "Failed to enable flag" });
  }
});

export default router;
