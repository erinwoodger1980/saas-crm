/**
 * Fire Door Line Item Display Layout Configuration
 * 
 * Manages which fields are visible and editable when viewing/scanning line items.
 * Used for customizable QR scan displays and workshop views.
 */

import express, { Response } from "express";
import { prisma } from "../prisma";

const router = express.Router();

// GET /fire-door-line-item-layout - Get current layout configuration
router.get("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { 
        isFireDoorManufacturer: true,
        fireDoorLineItemLayout: true 
      },
    });

    if (!settings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: "Fire door line item layout is only available for fire door manufacturers" 
      });
    }

    // Default configuration if none exists
    const defaultLayout = {
      processes: [
        {
          code: "CORE",
          name: "Core Cutting",
          projectFields: [
            { key: "mjsNumber", label: "MJS Number", visible: true, editable: false },
            { key: "jobName", label: "Job Name", visible: true, editable: false },
          ],
          lineItemFields: [
            { key: "doorRef", label: "Door Ref", visible: true, editable: false },
            { key: "rating", label: "Fire Rating", visible: true, editable: false },
            { key: "masterWidth", label: "Master Width", visible: true, editable: false },
            { key: "doorHeight", label: "Door Height", visible: true, editable: false },
            { key: "core", label: "Core", visible: true, editable: false },
            { key: "notes1", label: "Notes", visible: true, editable: true },
          ],
        },
        {
          code: "CNC",
          name: "CNC Machining",
          projectFields: [
            { key: "mjsNumber", label: "MJS Number", visible: true, editable: false },
            { key: "jobName", label: "Job Name", visible: true, editable: false },
          ],
          lineItemFields: [
            { key: "doorRef", label: "Door Ref", visible: true, editable: false },
            { key: "masterWidth", label: "Master Width", visible: true, editable: false },
            { key: "doorHeight", label: "Door Height", visible: true, editable: false },
            { key: "lockType", label: "Lock Type", visible: true, editable: false },
            { key: "hingeType", label: "Hinge Type", visible: true, editable: false },
          ],
        },
      ],
      cncCalculations: {
        initialCncProgramUrl: "https://cnc.example.com/program/${lineItem.doorRef}",
        finalCncTrimProgramUrl: "https://cnc.example.com/trim/${lineItem.doorRef}",
      },
      hideBlankFields: true,
      groupByCategory: true,
    };

    res.json({ 
      layout: settings.fireDoorLineItemLayout || defaultLayout 
    });
  } catch (error) {
    console.error("Error fetching fire door line item layout:", error);
    res.status(500).json({ error: "Failed to fetch layout configuration" });
  }
});

// POST /fire-door-line-item-layout - Save layout configuration
router.post("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!settings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: "Fire door line item layout is only available for fire door manufacturers" 
      });
    }

    const { layout } = req.body;
    if (!layout || typeof layout !== 'object') {
      return res.status(400).json({ error: "Invalid layout format" });
    }

    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { fireDoorLineItemLayout: layout },
    });

    res.json({ success: true, layout });
  } catch (error) {
    console.error("Error saving fire door line item layout:", error);
    res.status(500).json({ error: "Failed to save layout configuration" });
  }
});

// GET /fire-door-line-item-layout/:lineItemId/data - Get line item data with project context
router.get("/:lineItemId/data", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { 
        isFireDoorManufacturer: true,
        fireDoorLineItemLayout: true 
      },
    });

    if (!settings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: "Fire door line item data is only available for fire door manufacturers" 
      });
    }

    // Get line item with its import
    const lineItem = await prisma.fireDoorLineItem.findFirst({
      where: {
        id: lineItemId,
        tenantId,
      },
      include: {
        import: true,
      },
    });

    if (!lineItem) {
      return res.status(404).json({ error: "Line item not found" });
    }

    // Get the associated fire door schedule project if it exists
    let project = null;
    if (lineItem.import.projectId) {
      project = await prisma.fireDoorScheduleProject.findUnique({
        where: { id: lineItem.import.projectId },
      });
    }

    res.json({
      lineItem,
      project,
      layout: settings.fireDoorLineItemLayout,
    });
  } catch (error) {
    console.error("Error fetching line item data:", error);
    res.status(500).json({ error: "Failed to fetch line item data" });
  }
});

export default router;
