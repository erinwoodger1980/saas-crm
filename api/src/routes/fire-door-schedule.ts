/**
 * Fire Door Schedule API Routes
 * 
 * Unified project tracking system for fire door manufacturers.
 * Replaces: 2026 TEST SYSTEM.xlsx + NEW 2023 BOM CHECK.xlsx
 * 
 * One row per WON project - tracks from enquiry to completion.
 */

import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// GET /fire-door-schedule
// List all fire door schedule projects for the current tenant
// ============================================================================
router.get("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
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
      orderingStatus,
      limit = "100",
      offset = "0",
      sortBy = "dateRequired",
      sortOrder = "asc",
    } = req.query;

    const where: any = { tenantId };

    if (jobLocation) where.jobLocation = jobLocation;
    if (signOffStatus) where.signOffStatus = signOffStatus;
    if (scheduledBy) where.scheduledBy = scheduledBy;
    if (orderingStatus) where.orderingStatus = orderingStatus;

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
// GET /fire-door-schedule/:id
// Get a single project by ID
// ============================================================================
router.get("/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
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

    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// ============================================================================
// POST /fire-door-schedule
// Create a new fire door schedule project
// ============================================================================
router.post("/", async (req: any, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectData = {
      ...req.body,
      tenantId,
      lastUpdatedBy: userId,
      lastUpdatedAt: new Date(),
    };

    const project = await prisma.fireDoorScheduleProject.create({
      data: projectData,
    });

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
router.patch("/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
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

    const project = await prisma.fireDoorScheduleProject.update({
      where: { id },
      data: updateData,
    });

    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// ============================================================================
// DELETE /fire-door-schedule/:id
// Delete a project
// ============================================================================
router.delete("/:id", async (req: any, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
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
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
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
      prisma.fireDoorScheduleProject.count({ where: { tenantId } }),
      prisma.fireDoorScheduleProject.count({
        where: { tenantId, jobLocation: "RED FOLDER" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { tenantId, jobLocation: "IN PROGRESS" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { tenantId, jobLocation: "COMPLETE" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: {
          tenantId,
          signOffStatus: { in: ["AWAITING SCHEDULE", "WORKING ON SCHEDULE"] },
        },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { tenantId, signOffStatus: "SCHEDULE SIGNED OFF" },
      }),
      prisma.fireDoorScheduleProject.count({
        where: { tenantId, overallProgress: { gt: 0, lt: 100 } },
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

export default router;
