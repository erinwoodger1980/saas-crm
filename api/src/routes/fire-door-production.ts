// API Routes for Fire Door Production Logging
import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

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
  const receivedCount = bomItems.filter(status => 
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
  const completedCount = paperworkItems.filter(status => 
    status === 'In Factory' || 
    status === 'Printed in Office'
  ).length;
  const paperworkPercent = Math.round((completedCount / paperworkItems.length) * 100);

  // 3. Production Progress: average of 11 production processes
  const productionProcesses = [
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
  const totalProductionPercent = productionProcesses.reduce((sum, val) => sum + (val || 0), 0);
  const productionPercent = Math.round(totalProductionPercent / productionProcesses.length);

  return { bomPercent, paperworkPercent, productionPercent };
}

// Get production logs for a project
router.get('/:projectId/logs', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const logs = await prisma.fireDoorProductionLog.findMany({
      where: {
        tenantId,
        projectId,
      },
      orderBy: {
        loggedAt: 'desc',
      },
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching production logs:', error);
    res.status(500).json({ error: 'Failed to fetch production logs' });
  }
});

// Log production progress
router.post('/:projectId/logs', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { process, addedPercent, notes } = req.body;
    const tenantId = req.auth?.tenantId;
    const loggedBy = req.auth?.email || req.auth?.userId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current project to find previous percent
    const project = await prisma.fireDoorScheduleProject.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const fieldMap: Record<string, keyof typeof project> = {
      blanksCut: 'blanksCutPercent',
      edgeband: 'edgebandPercent',
      calibrate: 'calibratePercent',
      facings: 'facingsPercent',
      finalCnc: 'finalCncPercent',
      finish: 'finishPercent',
      sand: 'sandPercent',
      spray: 'sprayPercent',
      cut: 'cutPercent',
      cnc: 'cncPercent',
      build: 'buildPercent',
    };

    const fieldName = fieldMap[process];
    if (!fieldName) {
      return res.status(400).json({ error: 'Invalid process name' });
    }

    const previousPercent = (project[fieldName] as number) || 0;
    const newPercent = Math.min(100, previousPercent + addedPercent);

    // Create production log
    const log = await prisma.fireDoorProductionLog.create({
      data: {
        tenantId,
        projectId,
        process,
        previousPercent,
        addedPercent,
        newPercent,
        loggedBy,
        notes,
      },
    });

    // Calculate all progress percentages
    const updatedProject = { ...project, [fieldName]: newPercent };
    const { bomPercent, paperworkPercent, productionPercent } = calculateProgressPercentages(updatedProject);

    // Update project with new percentage and all calculated progress
    await prisma.fireDoorScheduleProject.update({
      where: { id: projectId },
      data: {
        [fieldName]: newPercent,
        overallProgress: productionPercent, // Keep overallProgress for backwards compatibility
        bomPercent,
        paperworkPercent,
        productionPercent,
        lastUpdatedBy: loggedBy,
        lastUpdatedAt: new Date(),
      },
    });

    res.json({ log, newPercent, bomPercent, paperworkPercent, productionPercent });
  } catch (error) {
    console.error('Error logging production:', error);
    res.status(500).json({ error: 'Failed to log production' });
  }
});

// Get monthly manufacturing value
router.get('/stats/monthly-value', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { year, month } = req.query;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get all production logs for the month
    const logs = await prisma.fireDoorProductionLog.findMany({
      where: {
        tenantId,
        loggedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            mjsNumber: true,
            jobName: true,
            netValue: true,
          },
        },
      },
    });

    // Calculate manufacturing value
    // Formula: (netValue / 11 processes) * (addedPercent / 100) for each log
    const processCount = 11; // blanksCut, edgeband, calibrate, facings, finalCnc, finish, sand, spray, cut, cnc, build
    
    let totalManufacturingValue = 0;
    const projectValues: Record<string, { value: number; logs: number }> = {};

    logs.forEach((log: any) => {
      if (log.project.netValue) {
        const netValue = parseFloat(log.project.netValue.toString());
        const valuePerProcess = netValue / processCount;
        const valueAdded = valuePerProcess * (log.addedPercent / 100);
        totalManufacturingValue += valueAdded;

        const projectId = log.project.id;
        if (!projectValues[projectId]) {
          projectValues[projectId] = { value: 0, logs: 0 };
        }
        projectValues[projectId].value += valueAdded;
        projectValues[projectId].logs += 1;
      }
    });

    res.json({
      month: targetMonth,
      year: targetYear,
      totalManufacturingValue: totalManufacturingValue.toFixed(2),
      logCount: logs.length,
      projectCount: Object.keys(projectValues).length,
      projectBreakdown: projectValues,
    });
  } catch (error) {
    console.error('Error calculating monthly value:', error);
    res.status(500).json({ error: 'Failed to calculate monthly value' });
  }
});

export default router;
