/**
 * Fire Door Schedule API Routes
 * 
 * Unified project tracking system for fire door manufacturers.
 * Replaces: 2026 TEST SYSTEM.xlsx + NEW 2023 BOM CHECK.xlsx
 * 
 * One row per WON project - tracks from enquiry to completion.
 * Migration: 20251124095123_add_fire_door_schedule
 */

import express, { Response } from "express";
import { prisma } from "../prisma";
import { completeLinkedTasksForProjectFieldUpdate } from "../services/fire-door-link";
import { completeTasksOnRecordChangeByLinks } from "../services/field-link";

const router = express.Router();

// Helper function to calculate all progress percentages
function calculateProgressPercentages(project: any) {
  // 1. BOM Progress: % of 7 materials received
  const bomItems = [
    project.blanksStatus,
    project.lippingsStatus,
    project.facingsStatus,
    project.glassStatus,
    project.cassettesStatus,
    project.timbersStatus,
    project.ironmongeryStatus
  ];
  const receivedCount = bomItems.filter((status: string) => 
    status === 'Received' || 
    status === 'Received from TBS' || 
    status === 'Received from Customer'
  ).length;
  const bomPercent = Math.round((receivedCount / bomItems.length) * 100);

  // 2. Paperwork Progress: % of 5 paperwork items completed
  const paperworkItems = [
    project.doorPaperworkStatus,
    project.finalCncSheetStatus,
    project.finalChecksSheetStatus,
    project.deliveryChecklistStatus,
    project.framesPaperworkStatus
  ];
  const completedCount = paperworkItems.filter((status: string) => 
    status === 'In Factory' || 
    status === 'Printed in Office'
  ).length;
  const paperworkPercent = Math.round((completedCount / paperworkItems.length) * 100);

  // 3. Production Progress: average of applicable production processes (excluding N/A)
  const allProductionProcesses = [
    project.blanksCutPercent,
    project.edgebandPercent,
    project.calibratePercent,
    project.facingsPercent,
    project.finalCncPercent,
    project.finishPercent,
    project.sandPercent,
    project.sprayPercent,
    project.cutPercent,
    project.cncPercent,
    project.buildPercent
  ];
  // Filter out N/A processes (null values) - only count applicable processes
  const applicableProcesses = allProductionProcesses.filter((val: number | null) => val !== null);
  const totalProductionPercent = applicableProcesses.reduce((sum: number, val: number) => sum + (val || 0), 0);
  const productionPercent = applicableProcesses.length > 0 
    ? Math.round(totalProductionPercent / applicableProcesses.length) 
    : 0;

  return { bomPercent, paperworkPercent, productionPercent };
}

// ============================================================================
// GET /fire-door-schedule
// List all fire door schedule projects for the current tenant
// ============================================================================
router.get("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if tenant is a fire door manufacturer
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    // Optional filters
    const {
      jobLocation,
      signOffStatus,
      scheduledBy,
      clientAccountId,
      limit = "1000",
      offset = "0",
      sortBy = "dateRequired",
      sortOrder = "asc",
    } = req.query;

    const where: any = { tenantId };

    if (jobLocation) where.jobLocation = jobLocation;
    if (signOffStatus) where.signOffStatus = signOffStatus;
    if (scheduledBy) where.scheduledBy = scheduledBy;
    
    // Filter by client account - get fireDoorScheduleIds from Projects linked to client's Opportunities
    if (clientAccountId) {
      const matchingProjects = await prisma.project.findMany({
        where: {
          tenantId,
          opportunity: {
            clientAccountId: clientAccountId as string,
          },
          fireDoorScheduleId: { not: null }, // Only projects with fire door schedules
        },
        select: { fireDoorScheduleId: true },
      });
      const fireDoorScheduleIds = matchingProjects
        .map(p => p.fireDoorScheduleId)
        .filter((id): id is string => id !== null);
      
      // Filter FireDoorScheduleProjects by ID
      where.id = { in: fireDoorScheduleIds };
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === "desc" ? "desc" : "asc";

    const [projects, totalCount] = await Promise.all([
      prisma.fireDoorScheduleProject.findMany({
        where,
        orderBy,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.fireDoorScheduleProject.count({ where }),
    ]);

    res.json({
      projects,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error("Error fetching fire door schedule projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// ============================================================================
// GET /fire-door-schedule/colors
// Get custom fire door schedule colors for the current tenant
// NOTE: Must come BEFORE /:id route to avoid "colors" being treated as an ID
// ============================================================================
router.get("/colors", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { 
        isFireDoorManufacturer: true,
        fireDoorScheduleColors: true 
      },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    // Return custom colors or empty object if not set
    res.json({ colors: tenantSettings.fireDoorScheduleColors || {} });
  } catch (error) {
    console.error("Error fetching fire door schedule colors:", error);
    res.status(500).json({ error: "Failed to fetch colors" });
  }
});

// ============================================================================
// POST /fire-door-schedule/colors
// Save custom fire door schedule colors for the current tenant
// NOTE: Must come BEFORE /:id route to avoid "colors" being treated as an ID
// ============================================================================
router.post("/colors", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    const { colors } = req.body;
    if (!colors || typeof colors !== 'object') {
      return res.status(400).json({ error: "Invalid colors format" });
    }

    // Update tenant settings with new colors
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { fireDoorScheduleColors: colors },
    });

    res.json({ success: true, colors });
  } catch (error) {
    console.error("Error saving fire door schedule colors:", error);
    res.status(500).json({ error: "Failed to save colors" });
  }
});

// ============================================================================
// GET /fire-door-schedule/column-config
// Get custom fire door schedule column configurations for the current tenant
// NOTE: Must come BEFORE /:id route to avoid "column-config" being treated as an ID
// ============================================================================
router.get("/column-config", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { 
        isFireDoorManufacturer: true,
        fireDoorScheduleColumnConfig: true 
      },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    // Return column configs or empty object if not set
    res.json({ columnConfig: tenantSettings.fireDoorScheduleColumnConfig || {} });
  } catch (error) {
    console.error("Error fetching fire door schedule column config:", error);
    res.status(500).json({ error: "Failed to fetch column config" });
  }
});

// ============================================================================
// POST /fire-door-schedule/column-config
// Save custom fire door schedule column configurations for the current tenant
// NOTE: Must come BEFORE /:id route to avoid "column-config" being treated as an ID
// ============================================================================
router.post("/column-config", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    const { columnConfig } = req.body;
    if (!columnConfig || typeof columnConfig !== 'object') {
      return res.status(400).json({ error: "Invalid column config format" });
    }

    // Update tenant settings with new column config
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { fireDoorScheduleColumnConfig: columnConfig },
    });

    res.json({ success: true, columnConfig });
  } catch (error) {
    console.error("Error saving fire door schedule column config:", error);
    res.status(500).json({ error: "Failed to save column config" });
  }
});

// ============================================================================
// GET /fire-door-schedule/:id
// Get a single project by ID
// ============================================================================
router.get("/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.fireDoorScheduleProject.findFirst({
      where: { id, tenantId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get the most recent import for this project
    const latestImport = await prisma.fireDoorImport.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const fireDoorImportId = latestImport?.id || null;

    res.json({ ...project, fireDoorImportId });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// ============================================================================
// GET /fire-door-schedule/:id/line-items
// Get all line items for a fire door schedule project
// Used by QR print page
// ============================================================================
router.get("/:id/line-items", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.fireDoorScheduleProject.findFirst({
      where: { id, tenantId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Load all line items for this project through FireDoorImport
    const lineItems = await prisma.fireDoorLineItem.findMany({
      where: { 
        import: {
          projectId: id,
        }
      },
      orderBy: [
        { doorRef: 'asc' },
        { lajRef: 'asc' },
      ],
    });

    res.json(lineItems);
  } catch (error) {
    console.error("Error fetching line items:", error);
    res.status(500).json({ error: "Failed to fetch line items" });
  }
});

// ============================================================================
// POST /fire-door-schedule
// Create a new fire door schedule project
// Automatically creates a won opportunity for workshop scheduling
// ============================================================================
router.post("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId || req.auth?.id;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectData = {
      ...req.body,
      tenantId,
      lastUpdatedBy: userId,
      lastUpdatedAt: new Date(),
    };

    // Create the fire door project
    const project = await prisma.fireDoorScheduleProject.create({
      data: projectData,
    });

    // Automatically create a won opportunity if client name exists
    if (project.clientName && userId) {
      try {
        // Find or create lead
        let lead = await prisma.lead.findFirst({
          where: {
            tenantId,
            contactName: project.clientName,
          },
        });

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              tenantId,
              createdById: userId,
              contactName: project.clientName,
              capturedAt: project.dateReceived || new Date(),
            },
          });
        }

        // Create won opportunity
        const opportunity = await prisma.opportunity.create({
          data: {
            tenantId,
            leadId: lead.id,
            title: project.jobName || `Fire Door Project - ${project.mjsNumber || 'Untitled'}`,
            stage: 'WON' as any,
            startDate: project.signOffDate,
            deliveryDate: project.approxDeliveryDate,
            valueGBP: project.netValue,
            wonAt: project.signOffDate || project.dateReceived || new Date(),
            createdAt: project.dateReceived || new Date(),
          },
        });

        // Link opportunity to project
        await prisma.fireDoorScheduleProject.update({
          where: { id: project.id },
          data: { projectId: opportunity.id },
        });

        console.log(`Created won opportunity ${opportunity.id} for fire door project ${project.id}`);
      } catch (oppError) {
        console.error('Failed to create opportunity for fire door project:', oppError);
        // Don't fail the project creation if opportunity creation fails
      }
    }

    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// ============================================================================
// PATCH /fire-door-schedule/:id
// Update an existing project (partial update)
// ============================================================================
const updateProjectHandler = async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId || req.auth?.id;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project belongs to tenant
    const existing = await prisma.fireDoorScheduleProject.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updateData = {
      ...req.body,
      lastUpdatedBy: userId,
      lastUpdatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated via API
    delete updateData.id;
    delete updateData.tenantId;
    delete updateData.createdAt;
    
    // Convert date strings to Date objects for date fields
    // Also handle clearing dates (empty string -> null)
    const dateFields = [
      'dateReceived', 'dateRequired', 'signOffDate', 'approxDeliveryDate',
      'deliveryDate', 'installStart', 'installEnd',
      'blanksDateOrdered', 'blanksDateExpected', 'blanksDateReceived',
      'lippingsDateOrdered', 'lippingsDateExpected', 'lippingsDateReceived',
      'facingsDateOrdered', 'facingsDateExpected', 'facingsDateReceived',
      'glassDateOrdered', 'glassDateExpected', 'glassDateReceived',
      'cassettesDateOrdered', 'cassettesDateExpected', 'cassettesDateReceived',
      'timbersDateOrdered', 'timbersDateExpected', 'timbersDateReceived',
      'ironmongeryDateOrdered', 'ironmongeryDateExpected', 'ironmongeryDateReceived',
      'signOffDate'
    ];
    
    console.log('[fire-door-schedule] PATCH request data:', JSON.stringify(updateData, null, 2));
    console.log('[fire-door-schedule] Paperwork fields:', {
      doorPaperworkStatus: updateData.doorPaperworkStatus,
      finalCncSheetStatus: updateData.finalCncSheetStatus,
      finalChecksSheetStatus: updateData.finalChecksSheetStatus,
      deliveryChecklistStatus: updateData.deliveryChecklistStatus,
      framesPaperworkStatus: updateData.framesPaperworkStatus,
      ironmongeryStatus: updateData.ironmongeryStatus,
    });
    
    for (const field of dateFields) {
      if (updateData[field] !== undefined) {
        const val = updateData[field];
        console.log(`[fire-door-schedule] Processing date field ${field}:`, val, typeof val);
        if (val === null || val === '') {
          // Clear the date field
          updateData[field] = null;
          console.log(`[fire-door-schedule] Cleared ${field} to null`);
        } else if (typeof val === 'string') {
          // Convert date string to Date object
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            updateData[field] = parsed;
            console.log(`[fire-door-schedule] Converted ${field} to Date:`, parsed);
          } else {
            // Invalid date string, set to null
            updateData[field] = null;
            console.log(`[fire-door-schedule] Invalid date for ${field}, set to null`);
          }
        }
        // If it's already a Date object, leave it as is
      }
    }

    // Calculate progress percentages based on updated data
    const mergedData = { ...existing, ...updateData };
    const { bomPercent, paperworkPercent, productionPercent } = calculateProgressPercentages(mergedData);
    
    updateData.bomPercent = bomPercent;
    updateData.paperworkPercent = paperworkPercent;
    updateData.productionPercent = productionPercent;
    updateData.overallProgress = productionPercent; // Keep overallProgress for backwards compatibility

    console.log('[fire-door-schedule] Final updateData before Prisma:', JSON.stringify(updateData, null, 2));
    
    const project = await prisma.fireDoorScheduleProject.update({
      where: { id },
      data: updateData,
    });

    console.log('[fire-door-schedule] Project updated successfully');
    console.log('[fire-door-schedule] Updated paperwork fields:', {
      doorPaperworkStatus: project.doorPaperworkStatus,
      finalCncSheetStatus: project.finalCncSheetStatus,
      finalChecksSheetStatus: project.finalChecksSheetStatus,
      deliveryChecklistStatus: project.deliveryChecklistStatus,
      framesPaperworkStatus: project.framesPaperworkStatus,
      ironmongeryStatus: project.ironmongeryStatus,
    });

    // After updating, auto-complete any tasks linked to changed fields
    try {
      const changed: any = {};
      if (Object.prototype.hasOwnProperty.call(updateData, "blanksDateOrdered")) {
        changed.blanksDateOrdered = (updateData as any).blanksDateOrdered;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, "doorPaperworkStatus")) {
        changed.doorPaperworkStatus = (updateData as any).doorPaperworkStatus;
      }
      if (Object.keys(changed).length > 0) {
        await completeLinkedTasksForProjectFieldUpdate({ tenantId, projectId: id, changed });
        // Generic field-link sync for configured links on this model
        await completeTasksOnRecordChangeByLinks({ tenantId, model: "FireDoorScheduleProject", recordId: id, changed, newRecord: project });
      }
    } catch (e) {
      console.warn("[fire-door-schedule] task sync failed:", (e as any)?.message || e);
    }

    res.json(project);
  } catch (error) {
    console.error("Error updating fire door project:", error);
    console.error("Error details:", (error as any)?.message, (error as any)?.stack);
    res.status(500).json({ 
      error: "Failed to update project",
      details: process.env.NODE_ENV === 'development' ? (error as any)?.message : undefined
    });
  }
};

router.put("/:id", updateProjectHandler);
router.patch("/:id", updateProjectHandler);

// ============================================================================
// DELETE /fire-door-schedule/:id
// Delete a project
// ============================================================================
router.delete("/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project belongs to tenant
    const existing = await prisma.fireDoorScheduleProject.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }

    await prisma.fireDoorScheduleProject.delete({ where: { id } });

    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ============================================================================
// GET /fire-door-schedule/stats/summary
// Get summary statistics for dashboard
// ============================================================================
router.get("/stats/summary", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Optional client filter - get fireDoorScheduleIds from Projects linked to client's Opportunities
    const { clientAccountId } = req.query;
    const baseWhere: any = { tenantId };
    if (clientAccountId) {
      const matchingProjects = await prisma.project.findMany({
        where: {
          tenantId,
          opportunity: {
            clientAccountId: clientAccountId as string,
          },
          fireDoorScheduleId: { not: null }, // Only projects with fire door schedules
        },
        select: { fireDoorScheduleId: true },
      });
      const fireDoorScheduleIds = matchingProjects
        .map(p => p.fireDoorScheduleId)
        .filter((id): id is string => id !== null);
      
      baseWhere.id = { in: fireDoorScheduleIds };
    }

    const [
      totalProjects,
      redFolderCount,
      inProgressCount,
      completeCount,
      awaitingSignOff,
      signedOff,
      inProduction,
    ] = await Promise.all([
      // Total Current Projects: exclude CANCELLED and COMPLETE & DELIVERED
      prisma.fireDoorScheduleProject.count({ 
        where: { 
          ...baseWhere,
          jobLocation: { notIn: ["CANCELLED", "COMPLETE & DELIVERED"] }
        } 
      }),
      prisma.fireDoorScheduleProject.count({
        where: { ...baseWhere, jobLocation: "RED FOLDER" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { ...baseWhere, jobLocation: "IN PROGRESS" },
      }),
      // Complete in Factory only
      prisma.fireDoorScheduleProject.count({
        where: { 
          ...baseWhere, 
          jobLocation: "COMPLETE IN FACTORY"
        },
      }),
      prisma.fireDoorScheduleProject.count({
        where: {
          ...baseWhere,
          signOffStatus: { in: ["AWAITING SCHEDULE", "WORKING ON SCHEDULE"] },
        },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { ...baseWhere, signOffStatus: "SCHEDULE SIGNED OFF" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { ...baseWhere, overallProgress: { gt: 0, lt: 100 } },
      }),
    ]);

    res.json({
      totalProjects,
      byLocation: {
        redFolder: redFolderCount,
        inProgress: inProgressCount,
        complete: completeCount,
      },
      bySignOff: {
        awaitingSignOff,
        signedOff,
      },
      production: {
        inProduction,
      },
    });
  } catch (error) {
    console.error("Error fetching summary stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// POST /fire-door-schedule/line-items - Create new line item
router.post("/line-items", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    const { fireDoorImportId, ...lineItemData } = req.body;

    // Verify the import belongs to this tenant
    const fireDoorImport = await prisma.fireDoorImport.findFirst({
      where: {
        id: fireDoorImportId,
        tenantId,
      },
    });

    if (!fireDoorImport) {
      return res.status(404).json({ error: "Fire door import not found" });
    }

    // Create the line item
    const newLineItem = await prisma.fireDoorLineItem.create({
      data: {
        ...lineItemData,
        fireDoorImportId,
        tenantId,
      },
    });

    res.json(newLineItem);
  } catch (error) {
    console.error("Error creating line item:", error);
    res.status(500).json({ error: "Failed to create line item" });
  }
});

// POST /fire-door-schedule/imports - Create new fire door import (for manual entry)
router.post("/imports", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    const { projectId, sourceName, totalValue, rowCount } = req.body;

    // Verify the project belongs to this tenant
    const project = await prisma.fireDoorScheduleProject.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Create the import
    const newImport = await prisma.fireDoorImport.create({
      data: {
        projectId,
        tenantId,
        createdById: userId,
        sourceName: sourceName || 'Manual Entry',
        totalValue: totalValue || 0,
        rowCount: rowCount || 0,
        status: 'Processed',
      },
    });

    res.json(newImport);
  } catch (error) {
    console.error("Error creating import:", error);
    res.status(500).json({ error: "Failed to create import" });
  }
});

// PATCH /fire-door-schedule/line-items/:id - Update line item fields
router.patch("/line-items/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { id } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: "Fire door schedule is only available for fire door manufacturers" });
    }

    // Verify line item belongs to this tenant
    const existingLineItem = await prisma.fireDoorLineItem.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingLineItem) {
      return res.status(404).json({ error: "Line item not found" });
    }

    // Update the line item
    const updatedLineItem = await prisma.fireDoorLineItem.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, lineItem: updatedLineItem });
  } catch (error) {
    console.error("Error updating line item:", error);
    res.status(500).json({ error: "Failed to update line item" });
  }
});

export default router;
