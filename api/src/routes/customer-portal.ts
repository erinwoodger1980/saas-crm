/**
 * Customer Portal API
 * 
 * Authenticated routes for customers to view their quotes, opportunities, and fire door jobs.
 * Customers can only see data linked to their ClientAccount.
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

// Customer authentication middleware
function requireCustomerAuth(req: any, res: any, next: any) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded: any = jwt.verify(token, env.APP_JWT_SECRET);
    
    if (decoded.type !== "customer") {
      return res.status(403).json({ error: "Customer access required" });
    }

    req.customerAuth = {
      clientUserId: decoded.clientUserId,
      clientAccountId: decoded.clientAccountId,
      tenantId: decoded.tenantId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * GET /api/customer-portal/quotes
 * Get all quotes for the customer's account
 */
router.get("/quotes", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const quotes = await prisma.quote.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        totalGBP: true,
        currency: true,
        proposalPdfUrl: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ quotes });
  } catch (error) {
    console.error("[customer-portal/quotes] Error:", error);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

/**
 * GET /api/customer-portal/quotes/:id
 * Get detailed quote information
 */
router.get("/quotes/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const quote = await prisma.quote.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        lines: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    res.json({ quote });
  } catch (error) {
    console.error("[customer-portal/quotes/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

/**
 * GET /api/customer-portal/opportunities
 * Get all opportunities (projects) for the customer's account
 */
router.get("/opportunities", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const opportunities = await prisma.opportunity.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        title: true,
        stage: true,
        valueGBP: true,
        startDate: true,
        deliveryDate: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ opportunities });
  } catch (error) {
    console.error("[customer-portal/opportunities] Error:", error);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

/**
 * GET /api/customer-portal/opportunities/:id
 * Get detailed opportunity information
 */
router.get("/opportunities/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ opportunity });
  } catch (error) {
    console.error("[customer-portal/opportunities/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

/**
 * GET /api/customer-portal/fire-door-jobs
 * Get all fire door jobs for the customer's account
 * Includes both FireDoorClientJob records and won Opportunities
 */
router.get("/fire-door-jobs", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    // Get fire door client jobs
    const fireDoorJobs = await prisma.fireDoorClientJob.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        jobName: true,
        projectReference: true,
        status: true,
        totalPrice: true,
        submittedAt: true,
        dateRequired: true,
        doorItems: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    // Get won opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        clientAccountId,
        stage: "WON",
      },
      select: {
        id: true,
        title: true,
        number: true,
        stage: true,
        valueGBP: true,
        createdAt: true,
        deliveryDate: true,
        installationStartDate: true,
        installationEndDate: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Combine and format both types
    const allJobs = [
      ...fireDoorJobs.map((job) => ({
        id: job.id,
        jobName: job.jobName,
        projectReference: job.projectReference,
        status: job.status || "PENDING",
        totalPrice: job.totalPrice,
        submittedAt: job.submittedAt,
        dateRequired: job.dateRequired,
        doorItemCount: job.doorItems.length,
        type: "fire-door-job" as const,
      })),
      ...opportunities.map((opp) => ({
        id: opp.id,
        jobName: opp.title,
        projectReference: opp.number,
        status: opp.stage,
        totalPrice: opp.valueGBP,
        submittedAt: opp.createdAt,
        dateRequired: opp.installationStartDate || opp.deliveryDate,
        doorItemCount: null,
        type: "opportunity" as const,
      })),
    ];

    // Sort by submission date
    allJobs.sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ jobs: allJobs });
  } catch (error) {
    console.error("[customer-portal/fire-door-jobs] Error:", error);
    res.status(500).json({ error: "Failed to fetch fire door jobs" });
  }
});

/**
 * GET /api/customer-portal/fire-door-jobs/:id
 * Get detailed fire door job information
 */
router.get("/fire-door-jobs/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const job = await prisma.fireDoorClientJob.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        doorItems: {
          orderBy: {
            sequence: "asc",
          },
        },
        rfis: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: "Fire door job not found" });
    }

    res.json({ job });
  } catch (error) {
    console.error("[customer-portal/fire-door-jobs/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch fire door job" });
  }
});

/**
 * GET /api/customer-portal/dashboard
 * Get dashboard summary for customer
 */
router.get("/dashboard", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const [quoteCount, opportunityCount, fireDoorJobCount, recentQuotes, recentOpportunities] =
      await Promise.all([
        prisma.quote.count({ where: { clientAccountId } }),
        prisma.opportunity.count({ where: { clientAccountId } }),
        prisma.fireDoorClientJob.count({ where: { clientAccountId } }),
        prisma.quote.findMany({
          where: { clientAccountId },
          select: {
            id: true,
            title: true,
            status: true,
            totalGBP: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.opportunity.findMany({
          where: { clientAccountId },
          select: {
            id: true,
            title: true,
            stage: true,
            valueGBP: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    res.json({
      summary: {
        quoteCount,
        opportunityCount,
        fireDoorJobCount,
      },
      recentQuotes,
      recentOpportunities,
    });
  } catch (error) {
    console.error("[customer-portal/dashboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

export default router;
