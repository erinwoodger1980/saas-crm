// api/src/routes/opportunity-groups.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

/**
 * GET /opportunity-groups
 * List all opportunity groups for the tenant
 */
router.get("/", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const groups = await prisma.opportunityGroup.findMany({
      where: { tenantId },
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
          },
        },
        _count: {
          select: { opportunities: true, timeEntries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, groups });
  } catch (err: any) {
    console.error("[opportunity-groups.get] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_fetch_groups" });
  }
});

/**
 * GET /opportunity-groups/:id
 * Get a single opportunity group with details
 */
router.get("/:id", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);

  try {
    const group = await prisma.opportunityGroup.findFirst({
      where: { id, tenantId },
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
            timeEntries: true,
          },
        },
        timeEntries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "group_not_found" });
    }

    res.json({ ok: true, group });
  } catch (err: any) {
    console.error("[opportunity-groups.get] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_fetch_group" });
  }
});

/**
 * POST /opportunity-groups
 * Create a new opportunity group
 * Body: { name, description?, opportunityIds?: string[], budgetHours?, scheduledStartDate?, scheduledEndDate? }
 */
router.post("/", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const {
    name,
    description,
    opportunityIds = [],
    budgetHours,
    scheduledStartDate,
    scheduledEndDate,
    status = "PLANNED",
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    // Verify all opportunities exist and belong to tenant
    if (opportunityIds.length > 0) {
      const count = await prisma.opportunity.count({
        where: {
          id: { in: opportunityIds },
          tenantId,
        },
      });

      if (count !== opportunityIds.length) {
        return res.status(400).json({ error: "some_opportunities_not_found" });
      }
    }

    // Create group
    const group = await prisma.opportunityGroup.create({
      data: {
        tenantId,
        name,
        description,
        budgetHours: budgetHours ? parseFloat(budgetHours) : undefined,
        scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate) : undefined,
        scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate) : undefined,
        status,
      },
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
          },
        },
      },
    });

    // Link opportunities to group if provided
    if (opportunityIds.length > 0) {
      await prisma.opportunity.updateMany({
        where: { id: { in: opportunityIds } },
        data: { groupId: group.id },
      });
    }

    // Fetch updated group with linked opportunities
    const updatedGroup = await prisma.opportunityGroup.findUnique({
      where: { id: group.id },
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
          },
        },
      },
    });

    res.json({ ok: true, group: updatedGroup });
  } catch (err: any) {
    console.error("[opportunity-groups.post] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_create_group" });
  }
});

/**
 * PATCH /opportunity-groups/:id
 * Update a group's details
 * Body: { name?, description?, budgetHours?, scheduledStartDate?, scheduledEndDate?, status? }
 */
router.patch("/:id", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const updates = req.body || {};

  try {
    // Verify group exists
    const existing = await prisma.opportunityGroup.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "group_not_found" });
    }

    const data: any = {};
    if ("name" in updates) data.name = updates.name;
    if ("description" in updates) data.description = updates.description;
    if ("status" in updates) data.status = updates.status;
    if ("budgetHours" in updates) data.budgetHours = updates.budgetHours ? parseFloat(updates.budgetHours) : null;
    if ("scheduledStartDate" in updates) data.scheduledStartDate = updates.scheduledStartDate ? new Date(updates.scheduledStartDate) : null;
    if ("scheduledEndDate" in updates) data.scheduledEndDate = updates.scheduledEndDate ? new Date(updates.scheduledEndDate) : null;

    const group = await prisma.opportunityGroup.update({
      where: { id },
      data,
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
          },
        },
      },
    });

    res.json({ ok: true, group });
  } catch (err: any) {
    console.error("[opportunity-groups.patch] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_update_group" });
  }
});

/**
 * PUT /opportunity-groups/:id/opportunities
 * Add or remove opportunities from a group
 * Body: { add?: string[], remove?: string[] }
 */
router.put("/:id/opportunities", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const { add = [], remove = [] } = req.body || {};

  try {
    // Verify group exists
    const group = await prisma.opportunityGroup.findFirst({
      where: { id, tenantId },
    });

    if (!group) {
      return res.status(404).json({ error: "group_not_found" });
    }

    // Add opportunities to group
    if (add.length > 0) {
      await prisma.opportunity.updateMany({
        where: {
          id: { in: add },
          tenantId,
        },
        data: { groupId: id },
      });
    }

    // Remove opportunities from group
    if (remove.length > 0) {
      await prisma.opportunity.updateMany({
        where: {
          id: { in: remove },
          tenantId,
          groupId: id,
        },
        data: { groupId: null },
      });
    }

    // Fetch updated group
    const updated = await prisma.opportunityGroup.findUnique({
      where: { id },
      include: {
        opportunities: {
          include: {
            client: true,
            lead: true,
          },
        },
      },
    });

    res.json({ ok: true, group: updated });
  } catch (err: any) {
    console.error("[opportunity-groups.opportunities] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_update_opportunities" });
  }
});

/**
 * DELETE /opportunity-groups/:id
 * Delete an opportunity group (unlinks opportunities, doesn't delete them)
 */
router.delete("/:id", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);

  try {
    // Verify group exists
    const group = await prisma.opportunityGroup.findFirst({
      where: { id, tenantId },
    });

    if (!group) {
      return res.status(404).json({ error: "group_not_found" });
    }

    // Unlink all opportunities first
    await prisma.opportunity.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    // Delete the group
    await prisma.opportunityGroup.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[opportunity-groups.delete] Error:", err);
    res.status(500).json({ error: err.message || "failed_to_delete_group" });
  }
});

export default router;
