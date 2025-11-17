// api/src/routes/analytics-business.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// Helper function to extract authentication info
function getAuth(req: any) {
  const headerString = (req: any, key: string) => {
    const val = req.headers[key];
    return typeof val === "string" ? val : undefined;
  };
  
  return {
    tenantId:
      (req.auth?.tenantId as string | undefined) ?? headerString(req, "x-tenant-id"),
    userId:
      (req.auth?.userId as string | undefined) ?? headerString(req, "x-user-id"),
    email: (req.auth?.email as string | undefined) ?? headerString(req, "x-user-email"),
  };
}

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
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Get tenant's financial year end setting
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { financialYearEnd: true }
    });
    
    const financialYearEnd = tenant?.financialYearEnd || "12-31"; // Default to calendar year
    const currentFinancialYear = getCurrentFinancialYear(financialYearEnd);
    const fyProgress = getFinancialYearProgress(financialYearEnd);

    // Get current and previous financial year boundaries
    const currentFY = getFinancialYearBoundaries(financialYearEnd, currentFinancialYear);
    const previousFY = getFinancialYearBoundaries(financialYearEnd, currentFinancialYear - 1);

    // Get last 24 months of data (current + previous year for comparison)
    const monthlyData = [];
    for (let i = 23; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - i);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const { start, end } = getMonthBoundaries(year, month);

      // Enquiries (new leads) - use capturedAt from schema
      const enquiries = await prisma.lead.count({
        where: { 
          tenantId, 
          capturedAt: { gte: start, lte: end }
        }
      });

      // Quotes sent (count and value) - use dateQuoteSent from leads
      const leadsWithQuotes = await prisma.lead.findMany({
        where: { 
          tenantId,
          dateQuoteSent: { gte: start, lte: end }
        },
        select: { 
          dateQuoteSent: true,
          quotedValue: true,
          custom: true
        }
      });

      // Filter and aggregate quotes
      const validQuotes = leadsWithQuotes.filter(lead => {
        const custom = lead.custom as any;
        const dateQuoteSent = lead.dateQuoteSent;
        if (dateQuoteSent) {
          return dateQuoteSent >= start && dateQuoteSent <= end;
        }
        // Fallback: check custom.dateQuoteSent if database field is null
        if (custom?.dateQuoteSent) {
          const customDate = new Date(custom.dateQuoteSent);
          return customDate >= start && customDate <= end;
        }
        return false;
      });

      const quotesCount = validQuotes.length;
      const quotesValue = validQuotes.reduce((sum, lead) => {
        const value = Number(lead.quotedValue || 0);
        return sum + value;
      }, 0);

      // Sales (won opportunities) - use wonAt from schema
      const salesOpps = await prisma.opportunity.findMany({
        where: { 
          tenantId,
          wonAt: { gte: start, lte: end }
        },
        select: { valueGBP: true }
      });
      const salesCount = salesOpps.length;
      const salesValue = salesOpps.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0);

      // Conversion rates by source for this month
      const filteredLeads = await prisma.lead.findMany({
        where: { 
          tenantId, 
          capturedAt: { gte: start, lte: end }
        },
        select: { custom: true, status: true }
      });

      // Calculate conversion rates
      const sourceConversions: Record<string, { leads: number; wins: number; rate: number }> = {};
      
      filteredLeads.forEach(lead => {
        const custom = lead.custom as any;
        const source = custom?.source || 'Unknown';
        
        if (!sourceConversions[source]) {
          sourceConversions[source] = { leads: 0, wins: 0, rate: 0 };
        }
        
        sourceConversions[source].leads++;
        if (lead.status === 'WON') {
          sourceConversions[source].wins++;
        }
      });
      
      // Calculate conversion rates
      Object.keys(sourceConversions).forEach(source => {
        const data = sourceConversions[source];
        data.rate = data.leads > 0 ? data.wins / data.leads : 0;
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

    const ytdLeadsWithQuotes = await prisma.lead.findMany({
      where: { 
        tenantId,
        dateQuoteSent: { gte: fyStart, lte: fyEnd }
      },
      select: { 
        dateQuoteSent: true,
        quotedValue: true,
        custom: true
      }
    });

    const ytdValidQuotes = ytdLeadsWithQuotes.filter(lead => {
      const custom = lead.custom as any;
      if (lead.dateQuoteSent) {
        return lead.dateQuoteSent >= fyStart && lead.dateQuoteSent <= fyEnd;
      }
      if (custom?.dateQuoteSent) {
        const customDate = new Date(custom.dateQuoteSent);
        return customDate >= fyStart && customDate <= fyEnd;
      }
      return false;
    });

    const ytdQuotesCount = ytdValidQuotes.length;
    const ytdQuotesValue = ytdValidQuotes.reduce((sum, lead) => sum + Number(lead.quotedValue || 0), 0);

    const ytdSalesOpps = await prisma.opportunity.findMany({
      where: { 
        tenantId,
        wonAt: { gte: fyStart, lte: fyEnd }
      },
      select: { valueGBP: true }
    });
    const ytdSalesCount = ytdSalesOpps.length;
    const ytdSalesValue = ytdSalesOpps.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0);

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

    // Previous year comparison data
    const previousYearEnquiries = await prisma.lead.count({
      where: { 
        tenantId, 
        capturedAt: { gte: previousFY.start, lte: previousFY.end }
      }
    });

    const previousYearLeadsWithQuotes = await prisma.lead.findMany({
      where: { 
        tenantId,
        dateQuoteSent: { gte: previousFY.start, lte: previousFY.end }
      },
      select: { 
        dateQuoteSent: true,
        quotedValue: true,
        custom: true
      }
    });

    const previousYearValidQuotes = previousYearLeadsWithQuotes.filter(lead => {
      const custom = lead.custom as any;
      if (lead.dateQuoteSent) {
        return lead.dateQuoteSent >= previousFY.start && lead.dateQuoteSent <= previousFY.end;
      }
      if (custom?.dateQuoteSent) {
        const customDate = new Date(custom.dateQuoteSent);
        return customDate >= previousFY.start && customDate <= previousFY.end;
      }
      return false;
    });

    const previousYearSales = await prisma.opportunity.findMany({
      where: { 
        tenantId,
        wonAt: { gte: previousFY.start, lte: previousFY.end }
      },
      select: { valueGBP: true }
    });

    const previousYear = {
      enquiries: previousYearEnquiries,
      quotesCount: previousYearValidQuotes.length,
      quotesValue: previousYearValidQuotes.reduce((sum, lead) => sum + Number(lead.quotedValue || 0), 0),
      salesCount: previousYearSales.length,
      salesValue: previousYearSales.reduce((sum, s) => sum + Number(s.valueGBP || 0), 0),
      conversionRate: previousYearEnquiries > 0 ? previousYearSales.length / previousYearEnquiries : 0
    };

    // Calculate year-over-year changes
    const yoyChanges = {
      enquiries: previousYear.enquiries > 0 ? ((ytdEnquiries - previousYear.enquiries) / previousYear.enquiries) * 100 : 0,
      quotesCount: previousYear.quotesCount > 0 ? ((ytdQuotesCount - previousYear.quotesCount) / previousYear.quotesCount) * 100 : 0,
      quotesValue: previousYear.quotesValue > 0 ? ((ytdQuotesValue - previousYear.quotesValue) / previousYear.quotesValue) * 100 : 0,
      salesCount: previousYear.salesCount > 0 ? ((ytdSalesCount - previousYear.salesCount) / previousYear.salesCount) * 100 : 0,
      salesValue: previousYear.salesValue > 0 ? ((ytdSalesValue - previousYear.salesValue) / previousYear.salesValue) * 100 : 0,
      conversionRate: previousYear.conversionRate > 0 ? (((ytdEnquiries > 0 ? ytdSalesCount / ytdEnquiries : 0) - previousYear.conversionRate) / previousYear.conversionRate) * 100 : 0
    };

    res.json({
      monthlyData: monthlyData.slice(-12), // Return last 12 months for main view
      monthlyDataTwoYear: monthlyData, // Return 24 months for comparison charts
      yearToDate: {
        enquiries: ytdEnquiries,
        quotesCount: ytdQuotesCount,
        quotesValue: ytdQuotesValue,
        salesCount: ytdSalesCount,
        salesValue: ytdSalesValue,
        conversionRate: ytdEnquiries > 0 ? ytdSalesCount / ytdEnquiries : 0
      },
      previousYear,
      yoyChanges,
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
    const { tenantId } = getAuth(req);
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
    const { tenantId } = getAuth(req);
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
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

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
              createdById: userId,
              contactName: `Historical Import ${i + 1}`,
              email: `historical-${Date.now()}-${i}@example.com`,
              status: 'NEW',
              capturedAt: recordDate,
              custom: source ? { source } : undefined
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
            createdById: userId,
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