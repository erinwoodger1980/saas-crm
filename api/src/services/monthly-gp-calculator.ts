// api/src/services/monthly-gp-calculator.ts
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

interface MonthlyGPInput {
  tenantId: string;
  month: string; // Format: YYYY-MM
}

interface ProjectGPResult {
  projectId: string;
  projectName: string;
  hoursThisMonth: number;
  hoursToDate: number;
  budgetHours: number;
  percentCompleteThisMonth: number;
  percentCompleteToDate: number;
  revenueThisMonth: number;
  labourCostThisMonth: number;
  materialsCostThisMonth: number;
  totalCostThisMonth: number;
  grossProfitThisMonth: number;
  grossProfitPercent: number;
}

interface MonthlyGPSummary {
  month: string;
  totalRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  grossProfitPercent: number;
  projects: ProjectGPResult[];
}

export class MonthlyGPCalculator {
  /**
   * Calculate gross profit for all projects in a given month
   */
  async calculateMonthlyGP(input: MonthlyGPInput): Promise<MonthlyGPSummary> {
    const { tenantId, month } = input;

    // Get wage bill for the month
    const wageBillRecord = await prisma.monthlyWageBill.findUnique({
      where: {
        tenantId_month: { tenantId, month }
      }
    });

    if (!wageBillRecord) {
      throw new Error(`No wage bill found for ${month}. Please add monthly wage data first.`);
    }

    const monthlyWageBill = Number(wageBillRecord.wageBill);

    // Get start and end of month
    const monthStart = new Date(`${month}-01T00:00:00Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    // Get all projects with activity this month
    const projectsWithTime = await prisma.opportunity.findMany({
      where: {
        tenantId,
        timeEntries: {
          some: {
            date: {
              gte: monthStart,
              lt: monthEnd
            }
          }
        }
      },
      include: {
        timeEntries: {
          where: {
            date: {
              gte: monthStart,
              lt: monthEnd
            }
          }
        },
        _count: {
          select: {
            timeEntries: true
          }
        }
      }
    });

    // Calculate total hours across all projects this month
    let totalHoursThisMonth = 0;
    for (const project of projectsWithTime) {
      const projectHours = project.timeEntries.reduce(
        (sum, entry) => sum + Number(entry.hours),
        0
      );
      totalHoursThisMonth += projectHours;
    }

    if (totalHoursThisMonth === 0) {
      return {
        month,
        totalRevenue: 0,
        totalCost: 0,
        totalGrossProfit: 0,
        grossProfitPercent: 0,
        projects: []
      };
    }

    // Calculate effective hourly rate for the month
    const effectiveHourlyRate = monthlyWageBill / totalHoursThisMonth;

    // Calculate GP for each project
    const projectResults: ProjectGPResult[] = [];
    let totalRevenue = 0;
    let totalCost = 0;

    for (const project of projectsWithTime) {
      const result = await this.calculateProjectGP({
        tenantId,
        projectId: project.id,
        month,
        monthStart,
        monthEnd,
        effectiveHourlyRate,
        project
      });

      if (result) {
        projectResults.push(result);
        totalRevenue += result.revenueThisMonth;
        totalCost += result.totalCostThisMonth;
      }
    }

    const totalGrossProfit = totalRevenue - totalCost;
    const grossProfitPercent = totalRevenue > 0 
      ? (totalGrossProfit / totalRevenue) * 100 
      : 0;

    return {
      month,
      totalRevenue,
      totalCost,
      totalGrossProfit,
      grossProfitPercent,
      projects: projectResults
    };
  }

  /**
   * Calculate GP for a single project in a given month
   */
  private async calculateProjectGP(params: {
    tenantId: string;
    projectId: string;
    month: string;
    monthStart: Date;
    monthEnd: Date;
    effectiveHourlyRate: number;
    project: any;
  }): Promise<ProjectGPResult | null> {
    const { 
      tenantId, 
      projectId, 
      month, 
      monthStart, 
      monthEnd, 
      effectiveHourlyRate,
      project 
    } = params;

    // Get budget hours and contract value
    const budgetHours = project.budgetHours ? Number(project.budgetHours) : null;
    const contractValue = project.contractValue ? Number(project.contractValue) : null;

    if (!budgetHours || !contractValue) {
      // Skip projects without budget data
      return null;
    }

    // Calculate hours this month
    const hoursThisMonth = project.timeEntries.reduce(
      (sum: number, entry: any) => sum + Number(entry.hours),
      0
    );

    // Calculate hours to date (all time entries up to end of this month)
    const allTimeEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        projectId,
        date: { lt: monthEnd }
      }
    });

    const hoursToDate = allTimeEntries.reduce(
      (sum, entry) => sum + Number(entry.hours),
      0
    );

    // Get previous month's completion percentage
    const previousMonth = this.getPreviousMonth(month);
    const previousMetrics = await prisma.monthlyProjectMetrics.findUnique({
      where: {
        tenantId_projectId_month: {
          tenantId,
          projectId,
          month: previousMonth
        }
      }
    });

    const percentCompletePriorMonth = previousMetrics 
      ? Number(previousMetrics.percentCompleteToDate) 
      : 0;

    // Calculate completion percentages
    const percentCompleteToDate = Math.min((hoursToDate / budgetHours) * 100, 100);
    const percentCompleteThisMonth = percentCompleteToDate - percentCompletePriorMonth;

    // Calculate revenue earned this month
    const revenueThisMonth = (contractValue * percentCompleteThisMonth) / 100;

    // Calculate labour cost this month
    const labourCostThisMonth = hoursThisMonth * effectiveHourlyRate;

    // Calculate materials cost this month
    const materialTotal = project.materialTotal ? Number(project.materialTotal) : 0;
    const materialsToDate = project.materialsToDate ? Number(project.materialsToDate) : null;

    let materialsCostThisMonth = 0;
    if (materialsToDate !== null) {
      // Use actual materials if available
      const materialsPriorMonth = previousMetrics 
        ? Number(previousMetrics.materialsCostThisMonth) 
        : 0;
      materialsCostThisMonth = materialsToDate - materialsPriorMonth;
    } else {
      // Allocate based on % complete
      materialsCostThisMonth = (materialTotal * percentCompleteThisMonth) / 100;
    }

    // Calculate total cost and GP
    const totalCostThisMonth = labourCostThisMonth + materialsCostThisMonth;
    const grossProfitThisMonth = revenueThisMonth - totalCostThisMonth;
    const grossProfitPercent = revenueThisMonth > 0 
      ? (grossProfitThisMonth / revenueThisMonth) * 100 
      : 0;

    // Cache the metrics
    await prisma.monthlyProjectMetrics.upsert({
      where: {
        tenantId_projectId_month: {
          tenantId,
          projectId,
          month
        }
      },
      create: {
        tenantId,
        projectId,
        month,
        hoursThisMonth: new Prisma.Decimal(hoursThisMonth),
        hoursToDate: new Prisma.Decimal(hoursToDate),
        percentCompleteThisMonth: new Prisma.Decimal(percentCompleteThisMonth),
        percentCompleteToDate: new Prisma.Decimal(percentCompleteToDate),
        revenueThisMonth: new Prisma.Decimal(revenueThisMonth),
        labourCostThisMonth: new Prisma.Decimal(labourCostThisMonth),
        materialsCostThisMonth: new Prisma.Decimal(materialsCostThisMonth),
        totalCostThisMonth: new Prisma.Decimal(totalCostThisMonth),
        grossProfitThisMonth: new Prisma.Decimal(grossProfitThisMonth),
        grossProfitPercent: new Prisma.Decimal(grossProfitPercent)
      },
      update: {
        hoursThisMonth: new Prisma.Decimal(hoursThisMonth),
        hoursToDate: new Prisma.Decimal(hoursToDate),
        percentCompleteThisMonth: new Prisma.Decimal(percentCompleteThisMonth),
        percentCompleteToDate: new Prisma.Decimal(percentCompleteToDate),
        revenueThisMonth: new Prisma.Decimal(revenueThisMonth),
        labourCostThisMonth: new Prisma.Decimal(labourCostThisMonth),
        materialsCostThisMonth: new Prisma.Decimal(materialsCostThisMonth),
        totalCostThisMonth: new Prisma.Decimal(totalCostThisMonth),
        grossProfitThisMonth: new Prisma.Decimal(grossProfitThisMonth),
        grossProfitPercent: new Prisma.Decimal(grossProfitPercent)
      }
    });

    return {
      projectId,
      projectName: project.title || 'Unnamed Project',
      hoursThisMonth,
      hoursToDate,
      budgetHours,
      percentCompleteThisMonth,
      percentCompleteToDate,
      revenueThisMonth,
      labourCostThisMonth,
      materialsCostThisMonth,
      totalCostThisMonth,
      grossProfitThisMonth,
      grossProfitPercent
    };
  }

  /**
   * Get previous month string in YYYY-MM format
   */
  private getPreviousMonth(month: string): string {
    const date = new Date(`${month}-01`);
    date.setMonth(date.getMonth() - 1);
    const year = date.getFullYear();
    const monthNum = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${monthNum}`;
  }
}

export const monthlyGPCalculator = new MonthlyGPCalculator();
