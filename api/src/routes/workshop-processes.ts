import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// GET /workshop-processes - Get all process definitions for tenant
router.get("/", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  
  const processes = await prisma.workshopProcessDefinition.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
  // Return array directly to match web client expectations
  res.json(processes);
});

// POST /workshop-processes - Create a new process definition
router.post("/", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { code, name, sortOrder, requiredByDefault, estimatedHours, isColorKey, assignmentGroup } = req.body;
  
  if (!code || !name) {
    return res.status(400).json({ error: "code and name are required" });
  }
  
  try {
    const process = await prisma.workshopProcessDefinition.create({
      data: {
        tenantId,
        code: code.toUpperCase(),
        name,
        sortOrder: sortOrder ?? 0,
        requiredByDefault: requiredByDefault ?? true,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        isColorKey: isColorKey ?? false,
        assignmentGroup: assignmentGroup || null,
      },
    });
    
    res.json({ ok: true, process });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "process_code_exists" });
    }
    throw error;
  }
});

// PATCH /workshop-processes/:id - Update a process definition
router.patch("/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = req.params.id;
  const { name, sortOrder, requiredByDefault, estimatedHours, isColorKey, assignmentGroup } = req.body;
  
  const existing = await prisma.workshopProcessDefinition.findFirst({
    where: { id, tenantId },
  });
  
  if (!existing) {
    return res.status(404).json({ error: "not_found" });
  }
  
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
  if (requiredByDefault !== undefined) updates.requiredByDefault = requiredByDefault;
  if (estimatedHours !== undefined) {
    updates.estimatedHours = estimatedHours ? Number(estimatedHours) : null;
  }
  if (isColorKey !== undefined) updates.isColorKey = isColorKey;
  if (assignmentGroup !== undefined) updates.assignmentGroup = assignmentGroup || null;
  
  const process = await prisma.workshopProcessDefinition.update({
    where: { id },
    data: updates,
  });
  
  res.json({ ok: true, process });
});

// DELETE /workshop-processes/:id - Delete a process definition
router.delete("/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = req.params.id;
  
  const existing = await prisma.workshopProcessDefinition.findFirst({
    where: { id, tenantId },
  });
  
  if (!existing) {
    return res.status(404).json({ error: "not_found" });
  }
  
  await prisma.workshopProcessDefinition.delete({ where: { id } });
  
  res.json({ ok: true });
});

// GET /workshop-processes/project/:opportunityId - Get process assignments for a project
router.get("/project/:opportunityId", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const opportunityId = req.params.opportunityId;
  
  // Verify opportunity belongs to tenant
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId },
  });
  
  if (!opp) {
    return res.status(404).json({ error: "opportunity_not_found" });
  }
  
  const assignments = await prisma.projectProcessAssignment.findMany({
    where: { tenantId, opportunityId },
    include: {
      processDefinition: true,
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: {
      processDefinition: {
        sortOrder: "asc",
      },
    },
  });
  
  res.json({ ok: true, assignments });
});

// POST /workshop-processes/project/:opportunityId - Assign processes to a project
router.post("/project/:opportunityId", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const opportunityId = req.params.opportunityId;
  const { processDefinitionId, required, assignedUserId, estimatedHours } = req.body;
  
  if (!processDefinitionId) {
    return res.status(400).json({ error: "processDefinitionId is required" });
  }
  
  // Verify opportunity and process definition belong to tenant
  const [opp, processDef, prevAssignment] = await Promise.all([
    prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } }),
    prisma.workshopProcessDefinition.findFirst({ where: { id: processDefinitionId, tenantId } }),
    prisma.projectProcessAssignment.findFirst({
      where: { tenantId, opportunityId, processDefinitionId },
      select: { id: true, assignedUserId: true, required: true },
    }),
  ]);
  
  if (!opp) {
    return res.status(404).json({ error: "opportunity_not_found" });
  }
  if (!processDef) {
    return res.status(404).json({ error: "process_definition_not_found" });
  }
  
  const assignment = await prisma.projectProcessAssignment.upsert({
    where: {
      opportunityId_processDefinitionId: {
        opportunityId,
        processDefinitionId,
      },
    },
    create: {
      tenantId,
      opportunityId,
      processDefinitionId,
      required: required ?? true,
      assignedUserId: assignedUserId || null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
    },
    update: {
      required: required ?? undefined,
      assignedUserId: assignedUserId === null ? null : (assignedUserId || undefined),
      estimatedHours: estimatedHours !== undefined ? (estimatedHours ? Number(estimatedHours) : null) : undefined,
    },
    include: {
      processDefinition: true,
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  
  // If this process has an assignment group and a user was assigned, assign to all processes in the group
  if (processDef.assignmentGroup && assignedUserId) {
    // Find all other processes in the same group
    const groupProcesses = await prisma.workshopProcessDefinition.findMany({
      where: {
        tenantId,
        assignmentGroup: processDef.assignmentGroup,
        id: { not: processDefinitionId }, // Exclude the current process
      },
    });
    
    // Find all existing assignments for this opportunity
    const existingAssignments = await prisma.projectProcessAssignment.findMany({
      where: {
        tenantId,
        opportunityId,
        processDefinitionId: { in: groupProcesses.map(p => p.id) },
      },
    });
    
    // Update assignments for all processes in the group
    for (const groupProcess of groupProcesses) {
      const existingAssignment = existingAssignments.find(a => a.processDefinitionId === groupProcess.id);
      
      if (existingAssignment) {
        // Update existing assignment
        await prisma.projectProcessAssignment.update({
          where: { id: existingAssignment.id },
          data: { assignedUserId },
        });
      } else {
        // Create new assignment
        await prisma.projectProcessAssignment.create({
          data: {
            tenantId,
            opportunityId,
            processDefinitionId: groupProcess.id,
            required: groupProcess.requiredByDefault,
            assignedUserId,
            estimatedHours: groupProcess.estimatedHours,
          },
        });
      }
    }
  }
  
  // Auto-task generation and syncing
  try {
    const isRequired = assignment.required === true;
    const newAssigneeId: string | null = assignment.assignedUser?.id || assignedUserId || null;
    const oldAssigneeId: string | null = prevAssignment?.assignedUserId || null;

    // Build deterministic task title per (project, process)
    const processName = assignment.processDefinition?.name || processDef?.name || "Process";
    const projectTitle = opp?.title || opp?.id || opportunityId;
    const taskTitle = `${processName} – ${projectTitle}`;

    // Look for existing task for this (tenant, WORKSHOP, project, title)
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: "WORKSHOP" as any,
        relatedId: opportunityId,
        status: { not: "CANCELLED" as any },
        title: { equals: taskTitle, mode: "insensitive" },
      },
      include: { assignees: true },
    });

    // Helper to set single assignee (replace all)
    async function setAssignee(taskId: string, userId: string | null) {
      // Remove all current assignees then add the new one (if provided)
      await prisma.taskAssignee.deleteMany({ where: { taskId } });
      if (userId) {
        await prisma.taskAssignee.create({ data: { taskId, userId, role: "OWNER" as any } });
      }
    }

    if (isRequired && newAssigneeId) {
      if (!existingTask) {
        const dueAt = opp?.deliveryDate ? new Date(opp.deliveryDate) : null;
        const created = await prisma.task.create({
          data: {
            tenantId,
            title: taskTitle,
            description: `Workshop process: ${processName}`,
            relatedType: "WORKSHOP" as any,
            relatedId: opportunityId,
            priority: "MEDIUM" as any,
            status: "OPEN" as any,
            dueAt: dueAt ?? undefined,
            meta: { processDefinitionId, processCode: processDef?.code || assignment.processDefinition?.code || null } as any,
            assignees: { create: [{ userId: newAssigneeId, role: "OWNER" as any }] },
          },
        });
        await prisma.activityLog.create({
          data: {
            tenantId,
            entity: "TASK" as any,
            entityId: created.id,
            verb: "CREATED" as any,
            actorId: req.auth?.userId ?? undefined,
            data: { source: "workshop_process_assignment", opportunityId, processDefinitionId } as any,
          },
        });
      } else {
        // Ensure correct assignee if changed
        if (newAssigneeId !== oldAssigneeId) {
          await setAssignee(existingTask.id, newAssigneeId);
        }
        // Re-open if it was cancelled previously
        if (existingTask.status === ("CANCELLED" as any)) {
          await prisma.task.update({ where: { id: existingTask.id }, data: { status: "OPEN" as any } });
        }
      }
    } else if (existingTask) {
      // If no longer required or no assignee, keep the task but clear assignees; optionally cancel
      await setAssignee(existingTask.id, null);
      // Optional: cancel to avoid clutter
      await prisma.task.update({ where: { id: existingTask.id }, data: { status: "CANCELLED" as any } });
    }
  } catch (err) {
    // Don't fail the main request if task automation fails
    console.warn("[workshop-processes] task automation failed:", (err as any)?.message || err);
  }

  res.json({ ok: true, assignment });
});

// DELETE /workshop-processes/project/:opportunityId/:assignmentId - Remove process assignment
router.delete("/project/:opportunityId/:assignmentId", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { opportunityId, assignmentId } = req.params;
  
  const assignment = await prisma.projectProcessAssignment.findFirst({
    where: { id: assignmentId, tenantId, opportunityId },
  });
  
  if (!assignment) {
    return res.status(404).json({ error: "not_found" });
  }
  
  await prisma.projectProcessAssignment.delete({ where: { id: assignmentId } });
  
  res.json({ ok: true });
});

// POST /workshop-processes/seed-default - Seed default processes for tenant
router.post("/seed-default", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  
  const defaultProcesses = [
    { code: "MACHINING", name: "Machining", sortOrder: 1, requiredByDefault: true, estimatedHours: 8 },
    { code: "ASSEMBLY", name: "Assembly", sortOrder: 2, requiredByDefault: true, estimatedHours: 6 },
    { code: "SANDING", name: "Sanding", sortOrder: 3, requiredByDefault: true, estimatedHours: 4 },
    { code: "SPRAYING", name: "Spraying", sortOrder: 4, requiredByDefault: true, estimatedHours: 3 },
    { code: "FINAL_ASSEMBLY", name: "Final Assembly", sortOrder: 5, requiredByDefault: true, estimatedHours: 4 },
    { code: "GLAZING", name: "Glazing", sortOrder: 6, requiredByDefault: true, estimatedHours: 2 },
    { code: "IRONMONGERY", name: "Ironmongery", sortOrder: 7, requiredByDefault: true, estimatedHours: 2 },
    { code: "INSTALLATION", name: "Installation", sortOrder: 8, requiredByDefault: true, estimatedHours: 8 },
  ];
  
  const created = [];
  for (const proc of defaultProcesses) {
    try {
      const process = await prisma.workshopProcessDefinition.create({
        data: {
          tenantId,
          ...proc,
        },
      });
      created.push(process);
    } catch (error: any) {
      // Skip if already exists
      if (error.code !== 'P2002') {
        throw error;
      }
    }
  }
  
  res.json({ ok: true, created: created.length, processes: created });
});

/**
 * PATCH /workshop-processes/process/:processId/complete
 * Marks a process assignment as complete and completes the associated task
 */
router.patch('/process/:processId/complete', async (req, res) => {
  const { processId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Mark the process complete
    const processAssignment = await prisma.projectProcessAssignment.update({
      where: { id: processId },
      data: { completedAt: new Date() },
      include: {
        processDefinition: true,
        project: true
      }
    });

    // Find and complete the associated task
    const task = await prisma.task.findFirst({
      where: {
        relatedType: 'WORKSHOP',
        relatedId: processAssignment.projectId,
        meta: {
          path: ['processCode'],
          equals: processAssignment.processDefinition?.code
        }
      }
    });

    if (task && task.status !== 'DONE') {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'DONE',
          completedAt: new Date()
        }
      });

      // Log activity
      await prisma.activity.create({
        data: {
          verb: 'COMPLETED',
          objectType: 'TASK',
          objectId: task.id,
          actorId: userId,
          opportunityId: task.relatedId,
          metadata: {
            taskTitle: task.title,
            processCode: processAssignment.processDefinition?.code,
            completedViaProcess: true
          }
        }
      });

      console.log(`✅ Process complete → Task complete: ${task.title}`);
    }

    res.json({ ok: true, processAssignment, taskCompleted: !!task });
  } catch (error) {
    console.error('Error completing process:', error);
    res.status(500).json({ error: 'Failed to complete process' });
  }
});

export default router;
