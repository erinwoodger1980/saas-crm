import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ==================== ComponentProcess Routes ====================

// GET /component-processes - Get processes for a component
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentId } = req.query;

    if (!componentId) {
      return res.status(400).json({ error: 'componentId required' });
    }

    const processes = await prisma.componentProcess.findMany({
      where: {
        componentLookupId: componentId as string,
        component: { tenantId }
      },
      include: {
        processDefinition: true
      },
      orderBy: {
        sequence: 'asc'
      }
    });

    res.json(processes);
  } catch (error) {
    console.error('Error fetching component processes:', error);
    res.status(500).json({ error: 'Failed to fetch component processes' });
  }
});

// POST /component-processes - Link process to component
router.post('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      componentLookupId,
      processDefinitionId,
      sequence,
      baseTimeMinutes,
      timePerUnit,
      setupTimeMinutes,
      formulaEnabled,
      formulaExpression,
      isRequired,
      isActive
    } = req.body;

    if (!componentLookupId || !processDefinitionId) {
      return res.status(400).json({ 
        error: 'componentLookupId and processDefinitionId required' 
      });
    }

    // Verify component belongs to tenant
    const component = await prisma.componentLookup.findFirst({
      where: { id: componentLookupId, tenantId }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const componentProcess = await prisma.componentProcess.create({
      data: {
        componentLookupId,
        processDefinitionId,
        sequence: sequence || 0,
        baseTimeMinutes: baseTimeMinutes || 0,
        timePerUnit: timePerUnit || 0,
        setupTimeMinutes: setupTimeMinutes || 0,
        formulaEnabled: formulaEnabled || false,
        formulaExpression,
        isRequired: isRequired !== false,
        isActive: isActive !== false
      },
      include: {
        processDefinition: true
      }
    });

    res.status(201).json(componentProcess);
  } catch (error) {
    console.error('Error creating component process:', error);
    res.status(500).json({ error: 'Failed to create component process' });
  }
});

// PUT /component-processes/:id - Update component process
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    // Verify belongs to tenant
    const existing = await prisma.componentProcess.findFirst({
      where: {
        id,
        component: { tenantId }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Component process not found' });
    }

    const componentProcess = await prisma.componentProcess.update({
      where: { id },
      data: req.body,
      include: {
        processDefinition: true
      }
    });

    res.json(componentProcess);
  } catch (error) {
    console.error('Error updating component process:', error);
    res.status(500).json({ error: 'Failed to update component process' });
  }
});

// DELETE /component-processes/:id - Remove process from component
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.componentProcess.findFirst({
      where: {
        id,
        component: { tenantId }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Component process not found' });
    }

    await prisma.componentProcess.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting component process:', error);
    res.status(500).json({ error: 'Failed to delete component process' });
  }
});

// ==================== Process Cost Rates ====================

// GET /process-cost-rates - Get cost rates for processes
router.get('/cost-rates', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { processDefinitionId } = req.query;

    const where: any = { tenantId };
    if (processDefinitionId) {
      where.processDefinitionId = processDefinitionId;
    }

    // Get current rates (no effectiveTo or effectiveTo in future)
    where.OR = [
      { effectiveTo: null },
      { effectiveTo: { gte: new Date() } }
    ];

    const rates = await prisma.processCostRate.findMany({
      where,
      include: {
        processDefinition: true
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    });

    res.json(rates);
  } catch (error) {
    console.error('Error fetching cost rates:', error);
    res.status(500).json({ error: 'Failed to fetch cost rates' });
  }
});

// POST /process-cost-rates - Set new cost rate
router.post('/cost-rates', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      processDefinitionId,
      costPerHour,
      effectiveFrom,
      effectiveTo,
      currency,
      notes
    } = req.body;

    if (!processDefinitionId || costPerHour == null) {
      return res.status(400).json({ 
        error: 'processDefinitionId and costPerHour required' 
      });
    }

    // Verify process belongs to tenant
    const process = await prisma.workshopProcessDefinition.findFirst({
      where: { id: processDefinitionId, tenantId }
    });

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    // End any existing current rates when adding new one
    if (!effectiveFrom || new Date(effectiveFrom) <= new Date()) {
      await prisma.processCostRate.updateMany({
        where: {
          tenantId,
          processDefinitionId,
          effectiveTo: null
        },
        data: {
          effectiveTo: effectiveFrom ? new Date(effectiveFrom) : new Date()
        }
      });
    }

    const rate = await prisma.processCostRate.create({
      data: {
        tenantId,
        processDefinitionId,
        costPerHour,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        currency: currency || 'GBP',
        notes
      },
      include: {
        processDefinition: true
      }
    });

    res.status(201).json(rate);
  } catch (error) {
    console.error('Error creating cost rate:', error);
    res.status(500).json({ error: 'Failed to create cost rate' });
  }
});

// ==================== Process Timing Predictions (ML) ====================

// GET /timing-predictions - Get ML timing predictions
router.get('/timing-predictions', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentType, productType, processDefinitionId } = req.query;

    const where: any = { tenantId };
    
    if (componentType) {
      where.componentType = componentType;
    }
    if (productType) {
      where.productType = productType;
    }
    if (processDefinitionId) {
      where.processDefinitionId = processDefinitionId;
    }

    const predictions = await prisma.processTimingPrediction.findMany({
      where,
      include: {
        processDefinition: true
      },
      orderBy: [
        { confidenceScore: 'desc' },
        { sampleSize: 'desc' }
      ]
    });

    res.json(predictions);
  } catch (error) {
    console.error('Error fetching timing predictions:', error);
    res.status(500).json({ error: 'Failed to fetch timing predictions' });
  }
});

// POST /timing-predictions/learn - Trigger ML learning from workshop timers
router.post('/timing-predictions/learn', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentType, productType, processDefinitionId } = req.body;

    // Get all completed workshop timers for this component/process combination
    const timers = await prisma.$queryRaw<any[]>`
      SELECT 
        wt."process",
        wt."startedAt",
        te."hours",
        te."process" as time_entry_process
      FROM "WorkshopTimer" wt
      LEFT JOIN "TimeEntry" te ON te."userId" = wt."userId" 
        AND te."projectId" = wt."projectId" 
        AND te."process" = wt."process"
        AND DATE(te."date") = DATE(wt."startedAt")
      WHERE wt."tenantId" = ${tenantId}
        AND wt."projectId" IS NOT NULL
      ORDER BY wt."startedAt" DESC
      LIMIT 1000
    `;

    if (timers.length === 0) {
      return res.json({ 
        message: 'No timer data available for learning',
        predictions: []
      });
    }

    // Group by process and calculate statistics
    const processStats = new Map<string, number[]>();
    
    for (const timer of timers) {
      const process = timer.process || timer.time_entry_process;
      if (!process) continue;
      
      const hours = timer.hours ? parseFloat(timer.hours) : 0;
      if (hours > 0) {
        if (!processStats.has(process)) {
          processStats.set(process, []);
        }
        processStats.get(process)!.push(hours * 60); // Convert to minutes
      }
    }

    const updatedPredictions = [];

    for (const [processCode, durations] of processStats.entries()) {
      if (durations.length < 3) continue; // Need at least 3 samples

      // Find process definition
      const processDef = await prisma.workshopProcessDefinition.findFirst({
        where: { tenantId, code: processCode }
      });

      if (!processDef) continue;

      // Calculate statistics
      const sum = durations.reduce((a, b) => a + b, 0);
      const avg = sum / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      // Calculate standard deviation
      const variance = durations.reduce((acc, val) => 
        acc + Math.pow(val - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Calculate confidence score (higher with more samples, lower variance)
      const sampleScore = Math.min(durations.length / 50, 1); // Max at 50 samples
      const varianceScore = 1 - Math.min(stdDev / avg, 1); // Lower variance = higher score
      const confidenceScore = (sampleScore * 0.6 + varianceScore * 0.4);

      // Upsert prediction
      const prediction = await prisma.processTimingPrediction.upsert({
        where: {
          tenantId_processDefinitionId_componentType_productType: {
            tenantId,
            processDefinitionId: processDef.id,
            componentType: componentType || 'GENERAL',
            productType: productType || null
          }
        },
        create: {
          tenantId,
          processDefinitionId: processDef.id,
          componentType: componentType || 'GENERAL',
          productType: productType || null,
          predictedMinutes: avg,
          confidenceScore,
          sampleSize: durations.length,
          averageActualMinutes: avg,
          minActualMinutes: min,
          maxActualMinutes: max,
          stdDeviation: stdDev,
          lastLearnedAt: new Date()
        },
        update: {
          predictedMinutes: avg,
          confidenceScore,
          sampleSize: durations.length,
          averageActualMinutes: avg,
          minActualMinutes: min,
          maxActualMinutes: max,
          stdDeviation: stdDev,
          lastLearnedAt: new Date()
        },
        include: {
          processDefinition: true
        }
      });

      updatedPredictions.push(prediction);
    }

    res.json({
      message: `Learned from ${timers.length} timer entries`,
      predictions: updatedPredictions,
      processesUpdated: updatedPredictions.length
    });

  } catch (error) {
    console.error('Error learning from timers:', error);
    res.status(500).json({ error: 'Failed to learn from timer data' });
  }
});

// POST /calculate-component-cost - Calculate total cost for a component
router.post('/calculate-component-cost', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentId, quantity, productType } = req.body;

    if (!componentId) {
      return res.status(400).json({ error: 'componentId required' });
    }

    // Get component with processes
    const component = await prisma.componentLookup.findFirst({
      where: { id: componentId, tenantId },
      include: {
        componentProcesses: {
          where: { isActive: true },
          include: {
            processDefinition: true
          },
          orderBy: {
            sequence: 'asc'
          }
        }
      }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Calculate costs for each process
    const processCalculations = [];
    let totalLaborCost = 0;
    let totalLaborMinutes = 0;

    for (const cp of component.componentProcesses) {
      // Get current cost rate
      const costRate = await prisma.processCostRate.findFirst({
        where: {
          tenantId,
          processDefinitionId: cp.processDefinitionId,
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } }
          ]
        },
        orderBy: {
          effectiveFrom: 'desc'
        }
      });

      // Get ML prediction if available
      const prediction = await prisma.processTimingPrediction.findFirst({
        where: {
          tenantId,
          processDefinitionId: cp.processDefinitionId,
          componentType: component.componentType,
          productType: productType || null
        }
      });

      // Calculate time (use prediction if available and confident, otherwise base time)
      let timeMinutes = cp.baseTimeMinutes;
      if (prediction && prediction.confidenceScore > 0.6) {
        timeMinutes = prediction.predictedMinutes;
      }

      // Add setup time and time per unit
      timeMinutes += cp.setupTimeMinutes + (cp.timePerUnit * (quantity || 1));

      // Calculate cost
      const costPerHour = costRate?.costPerHour || 0;
      const laborCost = (timeMinutes / 60) * costPerHour;

      totalLaborMinutes += timeMinutes;
      totalLaborCost += laborCost;

      processCalculations.push({
        process: cp.processDefinition.name,
        processCode: cp.processDefinition.code,
        timeMinutes,
        costPerHour,
        laborCost,
        usedPrediction: prediction && prediction.confidenceScore > 0.6,
        predictionConfidence: prediction?.confidenceScore || null
      });
    }

    res.json({
      component: {
        id: component.id,
        code: component.code,
        name: component.name,
        basePrice: component.basePrice
      },
      quantity: quantity || 1,
      materialCost: component.basePrice * (quantity || 1),
      laborMinutes: totalLaborMinutes,
      laborHours: totalLaborMinutes / 60,
      laborCost: totalLaborCost,
      totalCost: (component.basePrice * (quantity || 1)) + totalLaborCost,
      processes: processCalculations
    });

  } catch (error) {
    console.error('Error calculating component cost:', error);
    res.status(500).json({ error: 'Failed to calculate component cost' });
  }
});

export default router;
