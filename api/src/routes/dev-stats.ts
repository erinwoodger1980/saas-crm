import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

function requireDeveloper(req: any, res: any, next: any) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
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

// Get developer statistics
router.get("/", requireDeveloper, async (req: any, res) => {
  try {
    const { period, startDate, endDate, developerId, type } = req.query;
    
    // Get all developers
    const developers = await prisma.user.findMany({
      where: { isDeveloper: true },
      select: {
        id: true,
        email: true,
        name: true,
        isDeveloper: true
      }
    });

    // Build date filter
    const dateFilter: any = {};
    if (period === 'day' && startDate) {
      dateFilter.startedAt = {
        gte: new Date(startDate),
        lt: new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (period === 'week' && startDate) {
      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 7);
      dateFilter.startedAt = { gte: new Date(startDate), lt: weekEnd };
    } else if (period === 'month' && startDate) {
      const monthStart = new Date(startDate);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      dateFilter.startedAt = { gte: monthStart, lt: monthEnd };
    } else if (period === 'year' && startDate) {
      const yearStart = new Date(startDate);
      const yearEnd = new Date(yearStart.getFullYear() + 1, 0, 1);
      dateFilter.startedAt = { gte: yearStart, lt: yearEnd };
    } else if (startDate && endDate) {
      dateFilter.startedAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    // Get time entries with task info
    const timeEntries = await prisma.devTimeEntry.findMany({
      where: {
        ...(developerId && { userId: developerId }),
        ...dateFilter
      },
      include: {
        devTask: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            assignee: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Calculate stats per developer per type
    const statsByDeveloper: any = {};
    
    developers.forEach(dev => {
      statsByDeveloper[dev.id] = {
        developer: dev,
        totalHours: 0,
        byType: {},
        taskCount: new Set(),
        completedTasks: 0
      };
    });

    // Process time entries
    timeEntries.forEach(entry => {
      if (!entry.endedAt || !entry.durationMs) return;
      
      const hours = entry.durationMs / (1000 * 60 * 60);
      const devId = entry.userId;
      const taskType = entry.devTask?.type || 'OTHER';
      
      if (statsByDeveloper[devId]) {
        statsByDeveloper[devId].totalHours += hours;
        statsByDeveloper[devId].taskCount.add(entry.devTaskId);
        
        if (!statsByDeveloper[devId].byType[taskType]) {
          statsByDeveloper[devId].byType[taskType] = {
            hours: 0,
            tasks: new Set()
          };
        }
        
        statsByDeveloper[devId].byType[taskType].hours += hours;
        statsByDeveloper[devId].byType[taskType].tasks.add(entry.devTaskId);
        
        if (entry.devTask?.status === 'DONE') {
          statsByDeveloper[devId].completedTasks++;
        }
      }
    });

    // Format output
    const stats = Object.values(statsByDeveloper).map((stat: any) => {
      const byType: any = {};
      Object.entries(stat.byType).forEach(([type, data]: [string, any]) => {
        byType[type] = {
          hours: Math.round(data.hours * 100) / 100,
          taskCount: data.tasks.size
        };
      });
      
      return {
        developer: stat.developer,
        totalHours: Math.round(stat.totalHours * 100) / 100,
        taskCount: stat.taskCount.size,
        completedTasks: stat.completedTasks,
        byType
      };
    });

    res.json({ ok: true, stats, period: period || 'all' });
  } catch (error: any) {
    console.error("Failed to fetch dev stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
