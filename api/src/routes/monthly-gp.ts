// api/src/routes/monthly-gp.ts
import { Router } from 'express';
import { prisma } from '../prisma';
import { monthlyGPCalculator } from '../services/monthly-gp-calculator';

const router = Router();

/**
 * GET /api/monthly-gp/:month
 * Calculate and return monthly GP summary for a specific month
 */
router.get('/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    const summary = await monthlyGPCalculator.calculateMonthlyGP({
      tenantId,
      month
    });

    res.json(summary);
  } catch (error: any) {
    console.error('Error calculating monthly GP:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monthly-gp/wage-bill
 * Get all wage bill entries
 */
router.get('/wage-bill/list', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const wageBills = await prisma.monthlyWageBill.findMany({
      where: { tenantId },
      orderBy: { month: 'desc' }
    });

    res.json(wageBills);
  } catch (error: any) {
    console.error('Error fetching wage bills:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monthly-gp/wage-bill
 * Add or update wage bill for a month
 */
router.post('/wage-bill', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { month, wageBill } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!month || !wageBill) {
      return res.status(400).json({ error: 'Month and wageBill are required' });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    const record = await prisma.monthlyWageBill.upsert({
      where: {
        tenantId_month: { tenantId, month }
      },
      create: {
        tenantId,
        month,
        wageBill
      },
      update: {
        wageBill
      }
    });

    res.json(record);
  } catch (error: any) {
    console.error('Error saving wage bill:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monthly-gp/months
 * Get list of months with GP data
 */
router.get('/months/list', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get distinct months from time entries and wage bills
    const timeEntryMonths = await prisma.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') as month
      FROM "TimeEntry"
      WHERE "tenantId" = ${tenantId}
      ORDER BY month DESC
      LIMIT 24
    `;

    res.json(timeEntryMonths.map(m => m.month));
  } catch (error: any) {
    console.error('Error fetching months:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
