import { Router } from "express";
import { prisma } from "../prisma";
import { ensureOwnerCoachingAccess } from "../lib/coaching-access";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

router.use(requireAuth);

// Middleware to check coaching access
async function checkCoachingAccess(req: any, res: any, next: any) {
  try {
    const { tenant, user } = await ensureOwnerCoachingAccess(req.auth.tenantId, req.auth.userId);
    req.coachingAccess = { tenant, user };
    next();
  } catch (error: any) {
    if (error.message === "GROUP_COACHING_NOT_ENABLED") {
      return res.status(403).json({ error: "group_coaching_not_enabled" });
    }
    if (error.message === "OWNER_ACCESS_ONLY") {
      return res.status(403).json({ error: "owner_access_only" });
    }
    return res.status(500).json({ error: "internal_error" });
  }
}

router.use(checkCoachingAccess);

// ======================
// GOAL PLANS
// ======================

// GET /coaching/goal-plans - List all goal plans for tenant
router.get("/goal-plans", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  
  const plans = await prisma.goalPlan.findMany({
    where: { tenantId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      months: {
        include: {
          weeks: {
            include: {
              tasks: true
            }
          }
        }
      },
      notes: true
    },
    orderBy: { createdAt: "desc" }
  });
  
  res.json({ ok: true, plans });
});

// GET /coaching/goal-plans/:id - Get single goal plan with all details
router.get("/goal-plans/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const planId = req.params.id;
  
  const plan = await prisma.goalPlan.findFirst({
    where: { id: planId, tenantId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      months: {
        include: {
          weeks: {
            include: {
              tasks: true
            }
          }
        },
        orderBy: { monthNumber: "asc" }
      },
      notes: { orderBy: { sessionDate: "desc" } }
    }
  });
  
  if (!plan) {
    return res.status(404).json({ error: "plan_not_found" });
  }
  
  res.json({ ok: true, plan });
});

// POST /coaching/goal-plans - Create new goal plan
router.post("/goal-plans", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const userId = req.auth.userId;
  const { title, description } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  
  const plan = await prisma.goalPlan.create({
    data: {
      tenantId,
      ownerUserId: userId,
      title,
      description
    },
    include: {
      owner: { select: { id: true, name: true, email: true } }
    }
  });
  
  res.json({ ok: true, plan });
});

// PATCH /coaching/goal-plans/:id - Update goal plan
router.patch("/goal-plans/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const planId = req.params.id;
  const { title, description } = req.body;
  
  const plan = await prisma.goalPlan.updateMany({
    where: { id: planId, tenantId },
    data: { title, description }
  });
  
  if (plan.count === 0) {
    return res.status(404).json({ error: "plan_not_found" });
  }
  
  res.json({ ok: true });
});

// POST /coaching/goal-plans/:id/generate - Generate AI monthly/weekly plan
router.post("/goal-plans/:id/generate", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const planId = req.params.id;
  
  const plan = await prisma.goalPlan.findFirst({
    where: { id: planId, tenantId }
  });
  
  if (!plan) {
    return res.status(404).json({ error: "plan_not_found" });
  }
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a business coach for a joinery manufacturing company. Generate a detailed 12-month action plan to achieve the goal.
          
Return JSON with this exact structure:
{
  "months": [
    {
      "monthNumber": 1,
      "title": "Month 1 Goal Title",
      "description": "What needs to be achieved this month",
      "weeks": [
        {
          "weekNumber": 1,
          "title": "Week 1 Focus",
          "description": "What to focus on this week",
          "tasks": [
            { "title": "Task 1", "description": "Detailed task description" },
            { "title": "Task 2", "description": "Another task" }
          ]
        }
      ]
    }
  ]
}

Each month should have 4 weeks, each week should have 3-5 specific actionable tasks.`
        },
        {
          role: "user",
          content: `12-Month Goal: ${plan.title}\n\nDescription: ${plan.description}\n\nGenerate a complete 12-month plan with monthly goals, weekly focuses, and specific tasks.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const generated = JSON.parse(completion.choices[0].message.content || "{}");
    
    // Create all months, weeks, and tasks
    for (const monthData of generated.months || []) {
      const month = await prisma.monthlyGoal.create({
        data: {
          goalPlanId: planId,
          monthNumber: monthData.monthNumber,
          title: monthData.title,
          description: monthData.description,
          aiSuggested: true
        }
      });
      
      for (const weekData of monthData.weeks || []) {
        const week = await prisma.weeklyGoal.create({
          data: {
            monthlyGoalId: month.id,
            weekNumber: weekData.weekNumber,
            title: weekData.title,
            description: weekData.description,
            aiSuggested: true
          }
        });
        
        for (const taskData of weekData.tasks || []) {
          await prisma.goalTask.create({
            data: {
              weeklyGoalId: week.id,
              title: taskData.title,
              description: taskData.description,
              aiSuggested: true,
              status: "TODO"
            }
          });
        }
      }
    }
    
    res.json({ ok: true, generated: true });
  } catch (error: any) {
    console.error("AI generation error:", error);
    res.status(500).json({ error: "ai_generation_failed", message: error.message });
  }
});

// PATCH /coaching/monthly-goals/:id - Update monthly goal
router.patch("/monthly-goals/:id", async (req: any, res) => {
  const monthId = req.params.id;
  const { title, description, progress } = req.body;
  
  const month = await prisma.monthlyGoal.update({
    where: { id: monthId },
    data: { title, description, progress }
  });
  
  res.json({ ok: true, month });
});

// PATCH /coaching/weekly-goals/:id - Update weekly goal
router.patch("/weekly-goals/:id", async (req: any, res) => {
  const weekId = req.params.id;
  const { title, description, progress } = req.body;
  
  const week = await prisma.weeklyGoal.update({
    where: { id: weekId },
    data: { title, description, progress }
  });
  
  res.json({ ok: true, week });
});

// PATCH /coaching/tasks/:id - Update task
router.patch("/tasks/:id", async (req: any, res) => {
  const taskId = req.params.id;
  const { title, description, status, dueDate } = req.body;
  
  const task = await prisma.goalTask.update({
    where: { id: taskId },
    data: { title, description, status, dueDate: dueDate ? new Date(dueDate) : undefined }
  });
  
  res.json({ ok: true, task });
});

// POST /coaching/weekly-goals/:id/suggest-tasks - AI suggest tasks for a week
router.post("/weekly-goals/:id/suggest-tasks", async (req: any, res) => {
  const weekId = req.params.id;
  
  const week = await prisma.weeklyGoal.findUnique({
    where: { id: weekId },
    include: {
      month: {
        include: {
          plan: true
        }
      }
    }
  });
  
  if (!week) {
    return res.status(404).json({ error: "week_not_found" });
  }
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a business coach. Suggest 3-5 specific actionable tasks for this week's goal.
          
Return JSON: { "tasks": [{ "title": "Task", "description": "Details" }] }`
        },
        {
          role: "user",
          content: `Overall Goal: ${week.month.plan.title}\nWeek Goal: ${week.title}\n${week.description}\n\nSuggest specific tasks.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const suggestions = JSON.parse(completion.choices[0].message.content || "{}");
    
    res.json({ ok: true, suggestions: suggestions.tasks || [] });
  } catch (error: any) {
    console.error("AI suggestion error:", error);
    res.status(500).json({ error: "ai_suggestion_failed" });
  }
});

// POST /coaching/weekly-goals/:id/tasks - Add task to week
router.post("/weekly-goals/:id/tasks", async (req: any, res) => {
  const weekId = req.params.id;
  const { title, description, dueDate, aiSuggested } = req.body;
  
  const task = await prisma.goalTask.create({
    data: {
      weeklyGoalId: weekId,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      aiSuggested: aiSuggested ?? false,
      status: "TODO"
    }
  });
  
  res.json({ ok: true, task });
});

// ======================
// COACHING NOTES
// ======================

// GET /coaching/notes - List all coaching notes for tenant
router.get("/notes", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  
  const notes = await prisma.coachingNote.findMany({
    where: {
      goalPlan: { tenantId }
    },
    include: {
      goalPlan: {
        select: { id: true, title: true }
      }
    },
    orderBy: { sessionDate: "desc" }
  });
  
  res.json({ ok: true, notes });
});

// GET /coaching/notes/summary - Get summary of recent notes
router.get("/notes/summary", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  
  const recentNote = await prisma.coachingNote.findFirst({
    where: {
      goalPlan: { tenantId }
    },
    orderBy: { sessionDate: "desc" },
    include: {
      goalPlan: {
        select: { id: true, title: true }
      }
    }
  });
  
  const totalNotes = await prisma.coachingNote.count({
    where: {
      goalPlan: { tenantId }
    }
  });
  
  res.json({
    ok: true,
    summary: {
      totalNotes,
      lastSession: recentNote?.sessionDate || null,
      recentNote: recentNote || null
    }
  });
});

// POST /coaching/notes - Create coaching note (standalone or for active plan)
router.post("/notes", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const { sessionDate, notes, commitments, goalPlanId } = req.body;
  
  if (!sessionDate || !notes) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  
  // If no goalPlanId provided, find or create a default plan
  let planId = goalPlanId;
  if (!planId) {
    const activePlan = await prisma.goalPlan.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
    
    if (activePlan) {
      planId = activePlan.id;
    } else {
      // Create a default plan for notes
      const newPlan = await prisma.goalPlan.create({
        data: {
          tenantId,
          ownerUserId: req.auth.userId,
          title: "Coaching Sessions",
          description: "General coaching notes and commitments"
        }
      });
      planId = newPlan.id;
    }
  }
  
  const note = await prisma.coachingNote.create({
    data: {
      goalPlanId: planId,
      sessionDate: new Date(sessionDate),
      notes,
      commitments: commitments || []
    },
    include: {
      goalPlan: {
        select: { id: true, title: true }
      }
    }
  });
  
  res.json({ ok: true, note });
});

// POST /coaching/goal-plans/:id/notes - Add coaching note to specific plan
router.post("/goal-plans/:id/notes", async (req: any, res) => {
  const planId = req.params.id;
  const { sessionDate, notes, commitments, autoAddToTasks } = req.body;
  
  const note = await prisma.coachingNote.create({
    data: {
      goalPlanId: planId,
      sessionDate: new Date(sessionDate),
      notes,
      commitments: commitments || [],
      autoAddToTasks: autoAddToTasks ?? false
    }
  });
  
  res.json({ ok: true, note });
});

// ======================
// FINANCIAL PLANS
// ======================

// GET /coaching/financial-plans - List financial plans
router.get("/financial-plans", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  
  const plans = await prisma.financialPlan.findMany({
    where: { tenantId },
    include: {
      years: {
        include: {
          months: { orderBy: { monthNumber: "asc" } }
        },
        orderBy: { year: "asc" }
      },
      targets: true
    },
    orderBy: { startYear: "desc" }
  });
  
  res.json({ ok: true, plans });
});

// GET /coaching/financial-plans/:id - Get financial plan
router.get("/financial-plans/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const planId = req.params.id;
  
  const plan = await prisma.financialPlan.findFirst({
    where: { id: planId, tenantId },
    include: {
      years: {
        include: {
          months: { orderBy: { monthNumber: "asc" } }
        },
        orderBy: { year: "asc" }
      },
      targets: true
    }
  });
  
  if (!plan) {
    return res.status(404).json({ error: "plan_not_found" });
  }
  
  res.json({ ok: true, plan });
});

// POST /coaching/financial-plans - Create financial plan
router.post("/financial-plans", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const { startYear, durationYears } = req.body;
  
  if (!startYear || !durationYears) {
    return res.status(400).json({ error: "missing_required_fields" });
  }
  
  // Create plan with years and months
  const plan = await prisma.financialPlan.create({
    data: {
      tenantId,
      startYear,
      durationYears
    }
  });
  
  // Create years and months
  for (let i = 0; i < durationYears; i++) {
    const year = await prisma.financialYear.create({
      data: {
        financialPlanId: plan.id,
        year: startYear + i
      }
    });
    
    // Create 12 months
    for (let month = 1; month <= 12; month++) {
      await prisma.monthlyPnl.create({
        data: {
          financialYearId: year.id,
          monthNumber: month
        }
      });
    }
  }
  
  res.json({ ok: true, plan });
});

// PATCH /coaching/monthly-pnl/:id - Update monthly P&L
router.patch("/monthly-pnl/:id", async (req: any, res) => {
  const pnlId = req.params.id;
  const { revenue, directLabour, materials, marketing, overheads } = req.body;
  
  const pnl = await prisma.monthlyPnl.update({
    where: { id: pnlId },
    data: {
      revenue: revenue !== undefined ? revenue : undefined,
      directLabour: directLabour !== undefined ? directLabour : undefined,
      materials: materials !== undefined ? materials : undefined,
      marketing: marketing !== undefined ? marketing : undefined,
      overheads: overheads !== undefined ? overheads : undefined
    }
  });
  
  res.json({ ok: true, pnl });
});

// POST /coaching/financial-plans/:id/targets - Create/update target
router.post("/financial-plans/:id/targets", async (req: any, res) => {
  const planId = req.params.id;
  const { horizon, year, revenueTarget, grossProfitTarget, netProfitTarget, grossMarginTarget, netMarginTarget, labourPctTarget, materialsPctTarget, marketingPctTarget, overheadsPctTarget } = req.body;
  
  // Check if target exists
  const existing = await prisma.financialTarget.findFirst({
    where: { financialPlanId: planId, horizon, year }
  });
  
  if (existing) {
    const target = await prisma.financialTarget.update({
      where: { id: existing.id },
      data: {
        revenueTarget,
        grossProfitTarget,
        netProfitTarget,
        grossMarginTarget,
        netMarginTarget,
        labourPctTarget,
        materialsPctTarget,
        marketingPctTarget,
        overheadsPctTarget
      }
    });
    return res.json({ ok: true, target });
  }
  
  const target = await prisma.financialTarget.create({
    data: {
      financialPlanId: planId,
      horizon,
      year,
      revenueTarget,
      grossProfitTarget,
      netProfitTarget,
      grossMarginTarget,
      netMarginTarget,
      labourPctTarget,
      materialsPctTarget,
      marketingPctTarget,
      overheadsPctTarget
    }
  });
  
  res.json({ ok: true, target });
});

// POST /coaching/financial-plans/:id/suggest-improvements - AI suggestions
router.post("/financial-plans/:id/suggest-improvements", async (req: any, res) => {
  const tenantId = req.auth.tenantId;
  const planId = req.params.id;
  
  const plan = await prisma.financialPlan.findFirst({
    where: { id: planId, tenantId },
    include: {
      years: {
        include: {
          months: { orderBy: { monthNumber: "asc" } }
        }
      },
      targets: true
    }
  });
  
  if (!plan) {
    return res.status(404).json({ error: "plan_not_found" });
  }
  
  try {
    // Calculate current metrics
    let totalRevenue = 0;
    let totalLabour = 0;
    let totalMaterials = 0;
    let totalMarketing = 0;
    let totalOverheads = 0;
    
    for (const year of plan.years) {
      for (const month of year.months) {
        totalRevenue += month.revenue;
        totalLabour += month.directLabour;
        totalMaterials += month.materials;
        totalMarketing += month.marketing;
        totalOverheads += month.overheads;
      }
    }
    
    const grossProfit = totalRevenue - totalLabour - totalMaterials;
    const netProfit = grossProfit - totalMarketing - totalOverheads;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Get targets
    const yearTarget = plan.targets.find(t => t.horizon === "YEAR");
    const fiveYearTarget = plan.targets.find(t => t.horizon === "FIVE_YEAR");
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a business consultant for a joinery manufacturing company. Analyze financial data and provide actionable improvement suggestions grouped by focus area.

Return JSON with this structure:
{
  "areas": [
    {
      "area": "Revenue",
      "actions": [
        {
          "title": "Action Title",
          "description": "Detailed explanation",
          "impact": "Expected impact description",
          "timeframe": "Implementation timeframe"
        }
      ]
    }
  ]
}

Focus areas: Revenue, Gross Margin, Net Margin, Labour Cost Control, Material Waste Reduction, Marketing ROI`
        },
        {
          role: "user",
          content: `Current Financials:
- Revenue: £${totalRevenue.toFixed(2)}
- Gross Margin: ${grossMargin.toFixed(1)}%
- Net Margin: ${netMargin.toFixed(1)}%
- Labour: ${totalRevenue > 0 ? ((totalLabour / totalRevenue) * 100).toFixed(1) : 0}%
- Materials: ${totalRevenue > 0 ? ((totalMaterials / totalRevenue) * 100).toFixed(1) : 0}%
- Marketing: ${totalRevenue > 0 ? ((totalMarketing / totalRevenue) * 100).toFixed(1) : 0}%
- Overheads: ${totalRevenue > 0 ? ((totalOverheads / totalRevenue) * 100).toFixed(1) : 0}%

Yearly Targets:
${yearTarget ? `- Revenue Target: £${yearTarget.revenueTarget}
- Gross Margin Target: ${yearTarget.grossMarginTarget}%
- Net Margin Target: ${yearTarget.netMarginTarget}%` : "No yearly targets set"}

Provide specific, actionable improvement suggestions.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const suggestions = JSON.parse(completion.choices[0].message.content || "{}");
    
    res.json({ ok: true, suggestions: suggestions.areas || [] });
  } catch (error: any) {
    console.error("AI suggestion error:", error);
    res.status(500).json({ error: "ai_suggestion_failed" });
  }
});

export default router;
