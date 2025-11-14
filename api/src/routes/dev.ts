import { Router } from "express";
import { prisma } from "../prisma";
import dayjs from "dayjs";

const router = Router();

// Middleware to require developer role
function requireDeveloper(req: any, res: any, next: any) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Check if user is a developer
  prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { isDeveloper: true, role: true }
  }).then(user => {
    if (!user?.isDeveloper) {
      return res.status(403).json({ error: "Developer access required" });
    }
    next();
  }).catch(err => {
    console.error("Developer auth check failed:", err);
    res.status(500).json({ error: "Auth check failed" });
  });
}

// ==============================
// Tenant Management (Developer Only)
// ==============================

// Get all tenants
router.get("/tenants", requireDeveloper, async (req: any, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            opportunities: true,
            feedbacks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ ok: true, tenants });
  } catch (error: any) {
    console.error("Failed to fetch tenants:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get tenant details
router.get("/tenants/:id", requireDeveloper, async (req: any, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            signupCompleted: true
          }
        },
        _count: {
          select: {
            leads: true,
            opportunities: true,
            quotes: true,
            feedbacks: true,
            tasks: true,
            emailMessages: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ ok: true, tenant });
  } catch (error: any) {
    console.error("Failed to fetch tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Impersonate tenant (login as tenant owner for troubleshooting)
router.post("/tenants/:id/impersonate", requireDeveloper, async (req: any, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const jwtSecret = process.env.APP_JWT_SECRET || process.env.JWT_SECRET || "fallback-secret";
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          where: { role: "owner" },
          take: 1
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    if (!tenant.users || tenant.users.length === 0) {
      return res.status(404).json({ error: "No owner found for this tenant" });
    }

    const owner = tenant.users[0];
    
    // Create JWT token for impersonation
    const token = jwt.sign(
      {
        userId: owner.id,
        tenantId: tenant.id,
        role: owner.role,
        impersonating: true,
        impersonatedBy: req.auth.userId
      },
      jwtSecret,
      { expiresIn: "8h" }
    );

    res.json({ 
      ok: true, 
      token,
      user: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }
    });
  } catch (error: any) {
    console.error("Failed to impersonate tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Feedback Management (Developer Only)
// ==============================

// Get all feedback across tenants
router.get("/feedback", requireDeveloper, async (req: any, res) => {
  try {
    const { status, priority, category, tenantId } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (tenantId) where.tenantId = tenantId;

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, email: true, name: true }
        },
        resolvedBy: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ ok: true, feedbacks });
  } catch (error: any) {
    console.error("Failed to fetch feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update feedback
router.patch("/feedback/:id", requireDeveloper, async (req: any, res) => {
  try {
    const { status, priority, category, devNotes, linkedTaskId } = req.body;
    
    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(devNotes !== undefined && { devNotes }),
        ...(linkedTaskId !== undefined && { linkedTaskId }),
        ...(status === 'COMPLETED' && { resolvedAt: new Date(), resolvedById: req.auth.userId })
      },
      include: {
        tenant: { select: { name: true } },
        user: { select: { email: true, name: true } }
      }
    });

    res.json({ ok: true, feedback });
  } catch (error: any) {
    console.error("Failed to update feedback:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Dev Task Management (Developer Only)
// ==============================

// Get all dev tasks
router.get("/tasks", requireDeveloper, async (req: any, res) => {
  try {
    const { status, sprint, priority } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (sprint) where.sprint = sprint;
    if (priority) where.priority = priority;

    const tasks = await prisma.devTask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ ok: true, tasks });
  } catch (error: any) {
    console.error("Failed to fetch dev tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create dev task
router.post("/tasks", requireDeveloper, async (req: any, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      category,
      sprint,
      estimatedHours,
      assignee,
      feedbackIds,
      tenantIds,
      notes
    } = req.body;

    const task = await prisma.devTask.create({
      data: {
        title,
        description,
        status: status || 'BACKLOG',
        priority: priority || 'MEDIUM',
        category,
        sprint,
        estimatedHours,
        assignee,
        feedbackIds: feedbackIds || [],
        tenantIds: tenantIds || [],
        notes
      }
    });

    res.json({ ok: true, task });
  } catch (error: any) {
    console.error("Failed to create dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update dev task
router.patch("/tasks/:id", requireDeveloper, async (req: any, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      category,
      sprint,
      estimatedHours,
      actualHours,
      assignee,
      feedbackIds,
      tenantIds,
      notes
    } = req.body;

    const task = await prisma.devTask.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { 
          status,
          ...(status === 'DONE' && { completedAt: new Date() })
        }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(sprint !== undefined && { sprint }),
        ...(estimatedHours !== undefined && { estimatedHours }),
        ...(actualHours !== undefined && { actualHours }),
        ...(assignee !== undefined && { assignee }),
        ...(feedbackIds && { feedbackIds }),
        ...(tenantIds && { tenantIds }),
        ...(notes !== undefined && { notes })
      }
    });

    res.json({ ok: true, task });
  } catch (error: any) {
    console.error("Failed to update dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete dev task
router.delete("/tasks/:id", requireDeveloper, async (req: any, res) => {
  try {
    await prisma.devTask.delete({
      where: { id: req.params.id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete dev task:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// ML Training Status (Developer Only)
// ==============================

// Get ML training status for all tenants
router.get("/ml/status", requireDeveloper, async (req: any, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    const statuses = await Promise.all(
      tenants.map(async (tenant) => {
        const [insights, events, leadCount, emailCount] = await Promise.all([
          prisma.trainingInsights.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          }),
          prisma.trainingEvent.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 5
          }),
          prisma.lead.count({
            where: { tenantId: tenant.id }
          }),
          prisma.emailMessage.count({
            where: { tenantId: tenant.id }
          })
        ]);

        return {
          tenant,
          latestInsight: insights[0] || null,
          recentEvents: events,
          dataStats: {
            leadCount,
            emailCount
          }
        };
      })
    );

    res.json({ ok: true, statuses });
  } catch (error: any) {
    console.error("Failed to fetch ML status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed ML status for specific tenant
router.get("/ml/status/:tenantId", requireDeveloper, async (req: any, res) => {
  try {
    const { tenantId } = req.params;

    const [tenant, insights, events, overrides, leadCount, emailCount, opportunityCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true }
      }),
      prisma.trainingInsights.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.trainingEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.modelOverride.findMany({
        where: { tenantId }
      }),
      prisma.lead.count({ where: { tenantId } }),
      prisma.emailMessage.count({ where: { tenantId } }),
      prisma.opportunity.count({ where: { tenantId } })
    ]);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({
      ok: true,
      tenant,
      insights,
      events,
      overrides,
      dataStats: {
        leadCount,
        emailCount,
        opportunityCount
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch ML status for tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger ML training for specific tenant
router.post("/ml/train/:tenantId", requireDeveloper, async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Call ML service to trigger training
    const ML_API_URL = process.env.ML_API_URL || "http://localhost:8001";
    const response = await fetch(`${ML_API_URL}/train/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ML training failed: ${error}`);
    }

    const result = await response.json();
    res.json({ ok: true, result });
  } catch (error: any) {
    console.error("Failed to trigger ML training:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// System Stats (Developer Only)
// ==============================

router.get("/stats", requireDeveloper, async (req: any, res) => {
  try {
    const [
      tenantCount,
      userCount,
      leadCount,
      opportunityCount,
      feedbackCount,
      devTaskCount
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.feedback.count({ where: { status: { not: 'COMPLETED' } } }),
      prisma.devTask.count({ where: { status: { not: 'DONE' } } })
    ]);

    const recentActivity = await prisma.lead.findMany({
      take: 10,
      orderBy: { capturedAt: 'desc' },
      include: {
        tenant: { select: { name: true } }
      }
    });

    res.json({
      ok: true,
      stats: {
        tenantCount,
        userCount,
        leadCount,
        opportunityCount,
        feedbackCount,
        devTaskCount
      },
      recentActivity
    });
  } catch (error: any) {
    console.error("Failed to fetch stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Database Operations (Developer Only)
// ==============================

router.post("/db/migrate", requireDeveloper, async (req: any, res) => {
  try {
    // This would trigger Prisma migrations
    // For now, just return a placeholder
    res.json({ 
      ok: true, 
      message: "Run migrations using: cd api && npx prisma migrate deploy" 
    });
  } catch (error: any) {
    console.error("Migration failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// Seed Data (Keep existing endpoint)
// ==============================

router.post("/seed-data", async (req, res) => {
  const a = (req as any).auth; if (!a) return res.status(401).json({ error: "unauthorized" });

  // 3 leads
  const leads = await prisma.$transaction([
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Acme Windows", email: "acme@example.com", status: "READY_TO_QUOTE" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Wealden Joinery", email: "wealden@example.com", status: "QUOTE_SENT" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Landmark Timber", email: "landmark@example.com", status: "INFO_REQUESTED" } }),
  ]);

  // 3 opportunities (2 won this month, 1 open)
  const now = dayjs();
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[0].id, title: "Sash Windows (10 units)", valueGBP: 18000, stage: "WON", wonAt: now.subtract(2, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[1].id, title: "Doors & Frames (6 units)", valueGBP: 12500, stage: "WON", wonAt: now.subtract(10, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[2].id, title: "Shopfit Counter", valueGBP: 9500, stage: "NEGOTIATE" }
  });

  res.json({ ok: true, leads: leads.map(l=>l.id) });
});

export default router;
