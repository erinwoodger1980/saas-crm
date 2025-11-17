import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// Helper to get start and end of week (Monday-Sunday)
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

// GET /timesheets - List timesheets with filters
router.get("/", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { userId, status, weekStart, generate } = req.query as {
      userId?: string; status?: string; weekStart?: string; generate?: string;
    };

    // Optional backfill: generate missing timesheets for the last 12 weeks
    if (generate === "1") {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 12);
      const entries = await prisma.timeEntry.findMany({
        where: { tenantId, date: { gte: since } },
        select: { id: true, userId: true, date: true, hours: true },
        orderBy: { date: "asc" }
      });

      const groups = new Map<string, { tenantId: string; userId: string; weekStart: Date; weekEnd: Date; totalHours: number }>();
      for (const e of entries) {
        const { start, end } = getWeekBounds(new Date(e.date));
        const key = `${e.userId}:${start.toISOString()}`;
        const g = groups.get(key) || { tenantId, userId: e.userId, weekStart: start, weekEnd: end, totalHours: 0 };
        g.totalHours += Number(e.hours);
        groups.set(key, g);
      }

      // Upsert pending timesheets with totals (and refresh totals for pending ones)
      for (const g of groups.values()) {
        const existing = await prisma.timesheet.findUnique({
          where: { tenantId_userId_weekStartDate: { tenantId, userId: g.userId, weekStartDate: g.weekStart } },
          select: { id: true, status: true }
        });
        if (!existing) {
          await prisma.timesheet.create({
            data: {
              tenantId,
              userId: g.userId,
              weekStartDate: g.weekStart,
              weekEndDate: g.weekEnd,
              totalHours: g.totalHours,
              status: "pending",
            }
          });
        } else if (existing.status === "pending") {
          await prisma.timesheet.update({ where: { id: existing.id }, data: { totalHours: g.totalHours } });
        }
      }
    }

    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (weekStart) where.weekStartDate = new Date(weekStart);

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            workshopColor: true
          }
        },
        signedOffBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { weekStartDate: "desc" },
        { user: { name: "asc" } }
      ]
    });

    return res.json({ ok: true, items: timesheets });
  } catch (e: any) {
    console.error("[GET /timesheets] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /timesheets/week/:date - Get or generate timesheet for specific week
router.get("/week/:date", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const date = new Date(req.params.date);
    const { start, end } = getWeekBounds(date);

    // Get time entries for this week
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        userId,
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        project: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { date: "asc" }
    });

    // Calculate total hours and group by process
    const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
    
    const byProcess = timeEntries.reduce((acc: any, entry) => {
      const process = entry.process;
      if (!acc[process]) {
        acc[process] = { process, hours: 0, entries: [] };
      }
      acc[process].hours += Number(entry.hours);
      acc[process].entries.push(entry);
      return acc;
    }, {});

    // Get or create timesheet record
    let timesheet = await prisma.timesheet.findUnique({
      where: {
        tenantId_userId_weekStartDate: {
          tenantId,
          userId,
          weekStartDate: start
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        signedOffBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!timesheet && timeEntries.length > 0) {
      // Auto-create timesheet if there are time entries
      timesheet = await prisma.timesheet.create({
        data: {
          tenantId,
          userId,
          weekStartDate: start,
          weekEndDate: end,
          totalHours,
          status: "pending"
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          signedOffBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    } else if (timesheet && timesheet.status === "pending") {
      // Update total hours if still pending
      timesheet = await prisma.timesheet.update({
        where: { id: timesheet.id },
        data: { totalHours },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          signedOffBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    }

    return res.json({
      ok: true,
      timesheet,
      timeEntries,
      byProcess: Object.values(byProcess),
      weekStart: start,
      weekEnd: end,
      totalHours
    });
  } catch (e: any) {
    console.error("[GET /timesheets/week/:date] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /timesheets/:id/sign-off - Sign off a timesheet
router.post("/:id/sign-off", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;
    const role = req.auth?.role;
    
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
    
    // Only workshop managers can sign off
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ error: "only_managers_can_sign_off" });
    }

    const { id } = req.params;
    const { notes } = req.body;

    // Verify the signing user exists and belongs to this tenant
    const signingUser = await prisma.user.findFirst({
      where: { id: userId, tenantId }
    });

    if (!signingUser) {
      console.error(`[POST /timesheets/:id/sign-off] Signing user ${userId} not found in tenant ${tenantId}`);
      return res.status(403).json({ error: "user_not_found_in_tenant" });
    }

    const timesheet = await prisma.timesheet.findFirst({
      where: { id, tenantId }
    });

    if (!timesheet) {
      return res.status(404).json({ error: "timesheet_not_found" });
    }

    if (timesheet.status === "signed_off") {
      return res.status(400).json({ error: "already_signed_off" });
    }

    const updated = await prisma.timesheet.update({
      where: { id },
      data: {
        status: "signed_off",
        signedOffById: userId,
        signedOffAt: new Date(),
        notes
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        signedOffBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.json({ ok: true, timesheet: updated });
  } catch (e: any) {
    console.error("[POST /timesheets/:id/sign-off] failed:", e);
    return res.status(500).json({ error: "internal_error", message: e.message });
  }
});

// POST /timesheets/:id/reject - Reject a timesheet
router.post("/:id/reject", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;
    const role = req.auth?.role;
    
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
    
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ error: "only_managers_can_reject" });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const updated = await prisma.timesheet.update({
      where: { id, tenantId },
      data: {
        status: "rejected",
        notes
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.json({ ok: true, timesheet: updated });
  } catch (e: any) {
    console.error("[POST /timesheets/:id/reject] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /timesheets/export/payroll - Export payroll data
router.get("/export/payroll", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { weekStart, weekEnd } = req.query;

    const where: any = {
      tenantId,
      status: "signed_off"
    };

    if (weekStart) {
      where.weekStartDate = { gte: new Date(weekStart) };
    }
    if (weekEnd) {
      where.weekEndDate = { lte: new Date(weekEnd) };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { weekStartDate: "asc" },
        { user: { name: "asc" } }
      ]
    });

    // Get detailed time entries for each timesheet
    const payrollData = await Promise.all(
      timesheets.map(async (ts) => {
        const entries = await prisma.timeEntry.findMany({
          where: {
            tenantId,
            userId: ts.userId,
            date: {
              gte: ts.weekStartDate,
              lte: ts.weekEndDate
            }
          }
        });

        const byProcess = entries.reduce((acc: any, entry) => {
          const process = entry.process;
          if (!acc[process]) acc[process] = 0;
          acc[process] += Number(entry.hours);
          return acc;
        }, {});

        return {
          timesheetId: ts.id,
          userName: ts.user.name,
          userEmail: ts.user.email,
          weekStart: ts.weekStartDate,
          weekEnd: ts.weekEndDate,
          totalHours: Number(ts.totalHours),
          byProcess,
          signedOffAt: ts.signedOffAt
        };
      })
    );

    // Generate CSV
    const csv = [
      ["Employee Name", "Email", "Week Start", "Week End", "Total Hours", "Process Breakdown", "Signed Off"].join(","),
      ...payrollData.map(row => [
        `"${row.userName}"`,
        row.userEmail,
        row.weekStart.toISOString().split("T")[0],
        row.weekEnd.toISOString().split("T")[0],
        row.totalHours,
        `"${Object.entries(row.byProcess).map(([k, v]) => `${k}: ${v}h`).join("; ")}"`,
        row.signedOffAt?.toISOString().split("T")[0] || ""
      ].join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=payroll-export.csv");
    return res.send(csv);
  } catch (e: any) {
    console.error("[GET /timesheets/export/payroll] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
