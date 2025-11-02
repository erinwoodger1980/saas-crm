// api/src/routes/analytics-business.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

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

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

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

    // Year-to-date totals
    const { start: yearStart, end: yearEnd } = getYearBoundaries(currentYear);

    const ytdEnquiries = await prisma.lead.count({
      where: { 
        tenantId, 
        capturedAt: { gte: yearStart, lte: yearEnd }
      }
    });

    const ytdQuotes = await prisma.quote.findMany({
      where: { 
        tenantId, 
        createdAt: { gte: yearStart, lte: yearEnd },
        status: { not: "DRAFT" }
      },
      select: { totalGBP: true }
    });

    const ytdQuotesCount = ytdQuotes.length;
    const ytdQuotesValue = ytdQuotes.reduce((sum, q) => sum + Number(q.totalGBP || 0), 0);

    const ytdSales = await prisma.opportunity.findMany({
      where: { 
        tenantId, 
        wonAt: { gte: yearStart, lte: yearEnd }
      },
      select: { valueGBP: true }
    });

    const ytdSalesCount = ytdSales.length;
    const ytdSalesValue = ytdSales.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0);

    // Get or create targets for current year
    // TODO: Uncomment after migration is deployed
    /*
    let targets = await prisma.target.findUnique({
      where: { 
        tenantId_year: { tenantId, year: currentYear }
      }
    });

    if (!targets) {
      targets = await prisma.target.create({
        data: {
          tenantId,
          year: currentYear,
          enquiriesTarget: 120,      // Default: 10 per month
          quotesValueTarget: 120000, // Default: £10k per month
          quotesCountTarget: 48,     // Default: 4 per month
          salesValueTarget: 60000,   // Default: £5k per month
          salesCountTarget: 24       // Default: 2 per month
        }
      });
    }
    */

    // Temporary default targets until migration is deployed
    const targets = {
      enquiriesTarget: 120,
      quotesValueTarget: 120000,
      quotesCountTarget: 48,
      salesValueTarget: 60000,
      salesCountTarget: 24
    };

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
        // Calculate prorated targets for year-to-date
        ytdEnquiriesTarget: Math.round((Number(targets.enquiriesTarget || 0) / 12) * currentMonth),
        ytdQuotesValueTarget: Math.round((Number(targets.quotesValueTarget || 0) / 12) * currentMonth),
        ytdQuotesCountTarget: Math.round((Number(targets.quotesCountTarget || 0) / 12) * currentMonth),
        ytdSalesValueTarget: Math.round((Number(targets.salesValueTarget || 0) / 12) * currentMonth),
        ytdSalesCountTarget: Math.round((Number(targets.salesCountTarget || 0) / 12) * currentMonth)
      },
      sourceAnalysis,
      currentYear,
      currentMonth
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

    // TODO: Implement after migration is deployed
    res.status(501).json({ error: "Targets management coming soon" });

    /*
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
    */

  } catch (err: any) {
    console.error("[analytics-targets] failed:", err);
    res.status(500).json({ error: err?.message || "targets update failed" });
  }
});

export default router;