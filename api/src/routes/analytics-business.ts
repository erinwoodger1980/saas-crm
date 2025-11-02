// api/src/routes/analytics-business.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// Helper function to get financial year boundaries based on tenant's year end
function getFinancialYearBoundaries(yearEnd: string, year: number) {
  // yearEnd is in MM-DD format, e.g., "03-31" for March 31st
  const [month, day] = yearEnd.split('-').map(Number);
  
  // Financial year starts after the year end date of the previous year
  const start = new Date(year - 1, month - 1, day + 1);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  return { start, end };
}

// Helper function to get current financial year based on tenant's year end
function getCurrentFinancialYear(yearEnd: string): number {
  const today = new Date();
  const [month, day] = yearEnd.split('-').map(Number);
  
  // If we're past the year end date, we're in the next financial year
  const thisYearEnd = new Date(today.getFullYear(), month - 1, day);
  
  if (today > thisYearEnd) {
    return today.getFullYear() + 1;
  } else {
    return today.getFullYear();
  }
}

// Helper function to get progress through financial year
function getFinancialYearProgress(yearEnd: string): number {
  const today = new Date();
  const currentFY = getCurrentFinancialYear(yearEnd);
  const { start, end } = getFinancialYearBoundaries(yearEnd, currentFY);
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  return Math.max(0, Math.min(1, daysPassed / totalDays));
}

// Helper function to get month boundaries
function getMonthBoundaries(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// Helper function to get year boundaries
function getYearBoundaries(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

// GET /analytics/business-metrics
router.get("/business-metrics", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Get tenant's financial year end setting
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { financialYearEnd: true }
    });
    
    const financialYearEnd = tenant?.financialYearEnd || "12-31"; // Default to calendar year
    const currentFinancialYear = getCurrentFinancialYear(financialYearEnd);
    const fyProgress = getFinancialYearProgress(financialYearEnd);

    // Get last 12 months of data
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - i);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const { start, end } = getMonthBoundaries(year, month);

      // Enquiries (new leads)
      const enquiries = await prisma.lead.count({
        where: { 
          tenantId, 
          capturedAt: { gte: start, lte: end }
        }
      });

      // Quotes sent (count and value)
      const quotes = await prisma.quote.findMany({
        where: { 
          tenantId, 
          createdAt: { gte: start, lte: end },
          status: { not: "DRAFT" }
        },
        select: { totalGBP: true }
      });

      const quotesCount = quotes.length;
      const quotesValue = quotes.reduce((sum, q) => sum + Number(q.totalGBP || 0), 0);

      // Sales (won opportunities)
      const sales = await prisma.opportunity.findMany({
        where: { 
          tenantId, 
          wonAt: { gte: start, lte: end }
        },
        select: { valueGBP: true }
      });

      const salesCount = sales.length;
      const salesValue = sales.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0);

      // Conversion rates by source for this month
      const leadsBySource = await prisma.lead.groupBy({
        by: ['custom'],
        where: { 
          tenantId, 
          capturedAt: { gte: start, lte: end }
        },
        _count: true
      });

      const wonBySource = await prisma.lead.groupBy({
        by: ['custom'],
        where: { 
          tenantId, 
          capturedAt: { gte: start, lte: end },
          status: 'WON' as any
        },
        _count: true
      });

      // Calculate conversion rates
      const sourceConversions: Record<string, { leads: number; wins: number; rate: number }> = {};
      
      leadsBySource.forEach(item => {
        const source = (item.custom as any)?.source || 'Unknown';
        sourceConversions[source] = {
          leads: item._count,
          wins: 0,
          rate: 0
        };
      });

      wonBySource.forEach(item => {
        const source = (item.custom as any)?.source || 'Unknown';
        if (sourceConversions[source]) {
          sourceConversions[source].wins = item._count;
          sourceConversions[source].rate = sourceConversions[source].wins / sourceConversions[source].leads;
        }
      });

      monthlyData.push({
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
        enquiries,
        quotesCount,
        quotesValue,
        salesCount,
        salesValue,
        conversionRate: enquiries > 0 ? salesCount / enquiries : 0,
        sourceConversions
      });
    }

    // Financial year-to-date totals
    const { start: fyStart, end: fyEnd } = getFinancialYearBoundaries(financialYearEnd, currentFinancialYear);

    const ytdEnquiries = await prisma.lead.count({
      where: { 
        tenantId, 
        capturedAt: { gte: fyStart, lte: fyEnd }
      }
    });

    const ytdQuotes = await prisma.quote.findMany({
      where: { 
        tenantId, 
        createdAt: { gte: fyStart, lte: fyEnd },
        status: { not: "DRAFT" }
      },
      select: { totalGBP: true }
    });

    const ytdQuotesCount = ytdQuotes.length;
    const ytdQuotesValue = ytdQuotes.reduce((sum, q) => sum + Number(q.totalGBP || 0), 0);

    const ytdSales = await prisma.opportunity.findMany({
      where: { 
        tenantId, 
        wonAt: { gte: fyStart, lte: fyEnd }
      },
      select: { valueGBP: true }
    });

    const ytdSalesCount = ytdSales.length;
    const ytdSalesValue = ytdSales.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0);

    // Get or create targets for current financial year
    let targets = await prisma.target.findUnique({
      where: { 
        tenantId_year: { tenantId, year: currentFinancialYear }
      }
    });

    if (!targets) {
      targets = await prisma.target.create({
        data: {
          tenantId,
          year: currentFinancialYear,
          enquiriesTarget: 120,      // Default: 10 per month
          quotesValueTarget: 120000, // Default: £10k per month
          quotesCountTarget: 48,     // Default: 4 per month
          salesValueTarget: 60000,   // Default: £5k per month
          salesCountTarget: 24       // Default: 2 per month
        }
      });
    }

    // Cost analysis by source (COL = Cost of Lead, COS = Cost of Sale)
    const sourceCosts = await prisma.leadSourceCost.findMany({
      where: { tenantId }
    });

    const sourceAnalysis: Record<string, { 
      totalSpend: number; 
      totalLeads: number; 
      totalWins: number; 
      costPerLead: number; 
      costPerSale: number 
    }> = {};

    sourceCosts.forEach(cost => {
      const source = cost.source;
      if (!sourceAnalysis[source]) {
        sourceAnalysis[source] = {
          totalSpend: 0,
          totalLeads: 0,
          totalWins: 0,
          costPerLead: 0,
          costPerSale: 0
        };
      }
      sourceAnalysis[source].totalSpend += Number(cost.spend || 0);
      sourceAnalysis[source].totalLeads += cost.leads || 0;
      sourceAnalysis[source].totalWins += cost.conversions || 0;
    });

    // Calculate COL and COS
    Object.keys(sourceAnalysis).forEach(source => {
      const data = sourceAnalysis[source];
      data.costPerLead = data.totalLeads > 0 ? data.totalSpend / data.totalLeads : 0;
      data.costPerSale = data.totalWins > 0 ? data.totalSpend / data.totalWins : 0;
    });

    res.json({
      monthlyData,
      yearToDate: {
        enquiries: ytdEnquiries,
        quotesCount: ytdQuotesCount,
        quotesValue: ytdQuotesValue,
        salesCount: ytdSalesCount,
        salesValue: ytdSalesValue,
        conversionRate: ytdEnquiries > 0 ? ytdSalesCount / ytdEnquiries : 0
      },
      targets: {
        enquiriesTarget: Number(targets.enquiriesTarget || 0),
        quotesValueTarget: Number(targets.quotesValueTarget || 0),
        quotesCountTarget: Number(targets.quotesCountTarget || 0),
        salesValueTarget: Number(targets.salesValueTarget || 0),
        salesCountTarget: Number(targets.salesCountTarget || 0),
        // Calculate prorated targets for financial year-to-date
        ytdEnquiriesTarget: Math.round((Number(targets.enquiriesTarget || 0)) * fyProgress),
        ytdQuotesValueTarget: Math.round((Number(targets.quotesValueTarget || 0)) * fyProgress),
        ytdQuotesCountTarget: Math.round((Number(targets.quotesCountTarget || 0)) * fyProgress),
        ytdSalesValueTarget: Math.round((Number(targets.salesValueTarget || 0)) * fyProgress),
        ytdSalesCountTarget: Math.round((Number(targets.salesCountTarget || 0)) * fyProgress)
      },
      sourceAnalysis,
      currentYear: currentFinancialYear,
      currentMonth: new Date().getMonth() + 1,
      financialYear: {
        current: currentFinancialYear,
        yearEnd: financialYearEnd,
        progress: fyProgress,
        progressPercent: Math.round(fyProgress * 100)
      }
    });

  } catch (err: any) {
    console.error("[analytics-business] failed:", err);
    res.status(500).json({ error: err?.message || "business metrics failed" });
  }
});

// POST/PUT /analytics/targets - Set targets for a year
router.post("/targets", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { 
      year, 
      enquiriesTarget, 
      quotesValueTarget, 
      quotesCountTarget, 
      salesValueTarget, 
      salesCountTarget 
    } = req.body;

    if (!year || year < 2020 || year > 2030) {
      return res.status(400).json({ error: "Invalid year" });
    }

    const targets = await prisma.target.upsert({
      where: { 
        tenantId_year: { tenantId, year }
      },
      create: {
        tenantId,
        year,
        enquiriesTarget: Number(enquiriesTarget) || 0,
        quotesValueTarget: Number(quotesValueTarget) || 0,
        quotesCountTarget: Number(quotesCountTarget) || 0,
        salesValueTarget: Number(salesValueTarget) || 0,
        salesCountTarget: Number(salesCountTarget) || 0
      },
      update: {
        enquiriesTarget: Number(enquiriesTarget) || 0,
        quotesValueTarget: Number(quotesValueTarget) || 0,
        quotesCountTarget: Number(quotesCountTarget) || 0,
        salesValueTarget: Number(salesValueTarget) || 0,
        salesCountTarget: Number(salesCountTarget) || 0
      }
    });

    res.json(targets);

  } catch (err: any) {
    console.error("[analytics-targets] failed:", err);
    res.status(500).json({ error: err?.message || "targets update failed" });
  }
});

// POST /analytics/business/financial-year - Set financial year end
router.post("/financial-year", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { financialYearEnd } = req.body;
    
    // Validate format MM-DD
    if (!/^\d{2}-\d{2}$/.test(financialYearEnd)) {
      return res.status(400).json({ error: "Financial year end must be in MM-DD format" });
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { financialYearEnd },
      select: { financialYearEnd: true }
    });

    res.json(tenant);

  } catch (err: any) {
    console.error("[analytics-financial-year] failed:", err);
    res.status(500).json({ error: err?.message || "financial year update failed" });
  }
});

// POST /analytics/business/import-historical - Import historical data
router.post("/import-historical", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { data, type } = req.body;
    // data should be array of records with date and values
    // type should be 'leads', 'quotes', or 'sales'
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Data must be an array" });
    }

    let imported = 0;
    
    for (const record of data) {
      const { date, value, count, source } = record;
      const recordDate = new Date(date);
      
      if (isNaN(recordDate.getTime())) {
        continue; // Skip invalid dates
      }

      if (type === 'leads') {
        // Create historical lead records
        for (let i = 0; i < (count || 1); i++) {
          await prisma.lead.create({
            data: {
              tenantId,
              contactName: `Historical Import ${i + 1}`,
              email: `historical-${Date.now()}-${i}@example.com`,
              status: 'NEW',
              capturedAt: recordDate,
              custom: source ? { source } : null
            }
          });
        }
        imported += count || 1;
      } else if (type === 'quotes') {
        // Create historical quote records
        await prisma.quote.create({
          data: {
            tenantId,
            title: `Historical Quote - ${recordDate.toISOString().split('T')[0]}`,
            status: 'SENT',
            totalGBP: value || 0,
            createdAt: recordDate
          }
        });
        imported++;
      } else if (type === 'sales') {
        // Create historical opportunity records
        const lead = await prisma.lead.create({
          data: {
            tenantId,
            contactName: `Historical Sale`,
            email: `historical-sale-${Date.now()}@example.com`,
            status: 'WON',
            capturedAt: recordDate
          }
        });

        await prisma.opportunity.create({
          data: {
            tenantId,
            leadId: lead.id,
            title: `Historical Sale - ${recordDate.toISOString().split('T')[0]}`,
            valueGBP: value || 0,
            stage: 'WON',
            wonAt: recordDate,
            createdAt: recordDate
          }
        });
        imported++;
      }
    }

    res.json({ 
      success: true, 
      imported,
      message: `Imported ${imported} ${type} records` 
    });

  } catch (err: any) {
    console.error("[analytics-import-historical] failed:", err);
    res.status(500).json({ error: err?.message || "historical import failed" });
  }
});

export default router;