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
  
  res.json({ ok: true, processes });
});

// POST /workshop-processes - Create a new process definition
router.post("/", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { code, name, sortOrder, requiredByDefault, estimatedHours } = req.body;
  
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
  const { name, sortOrder, requiredByDefault, estimatedHours } = req.body;
  
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
  const [opp, processDef] = await Promise.all([
    prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } }),
    prisma.workshopProcessDefinition.findFirst({ where: { id: processDefinitionId, tenantId } }),
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

export default router;
