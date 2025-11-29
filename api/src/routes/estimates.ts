import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

/**
 * GET /estimates/:leadId
 * Fetch ML estimate for a lead (from database or generate placeholder)
 */
router.get("/:leadId", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { leadId } = req.params;
  if (!leadId) return res.status(400).json({ error: "leadId required" });

  try {
    // Find lead and related questionnaire items
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        questionnaireItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    // Check if we have a stored ML estimate in lead.computed or lead.mlEstimate
    const computed = (lead.computed as any) || {};
    let estimate = computed.mlEstimate || null;

    // If no stored estimate, generate a placeholder from questionnaire items
    if (!estimate && lead.questionnaireItems?.length > 0) {
      const items = lead.questionnaireItems.map((item: any, idx: number) => {
        const answers = (item.answers as any) || {};
        const width = answers.door_width_mm || answers.width || null;
        const height = answers.door_height_mm || answers.height || null;
        
        // Simple placeholder pricing logic (can be replaced with real ML)
        const area = width && height ? (width * height) / 1_000_000 : 1.5; // m²
        const basePrice = area * 300; // £300/m² placeholder
        const netGBP = Math.round(basePrice * 100) / 100;
        const vatGBP = Math.round(netGBP * 0.2 * 100) / 100;
        const totalGBP = netGBP + vatGBP;

        return {
          id: item.id,
          itemNumber: idx + 1,
          description: answers.description || `Door ${idx + 1} - ${width || "?"}mm x ${height || "?"}mm`,
          netGBP,
          vatGBP,
          totalGBP,
          width,
          height,
        };
      });

      const totalNet = items.reduce((sum: number, it: any) => sum + it.netGBP, 0);
      const totalVat = items.reduce((sum: number, it: any) => sum + it.vatGBP, 0);
      const totalGross = items.reduce((sum: number, it: any) => sum + it.totalGBP, 0);

      estimate = {
        leadId,
        items,
        totalNet: Math.round(totalNet * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalGross: Math.round(totalGross * 100) / 100,
        generatedAt: new Date().toISOString(),
      };

      // Store the generated estimate in lead.computed for future retrieval
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          computed: {
            ...(computed || {}),
            mlEstimate: estimate,
          } as any,
        },
      });
    }

    return res.json(estimate || { leadId, items: [], totalNet: 0, totalVat: 0, totalGross: 0 });
  } catch (error: any) {
    console.error("[estimates/:leadId] error:", error);
    return res.status(500).json({ error: error?.message || "internal error" });
  }
});

/**
 * POST /estimates/:leadId/update
 * Save amended estimate changes to database
 */
router.post("/:leadId/update", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { leadId } = req.params;
  const { estimate } = req.body || {};

  if (!leadId || !estimate) {
    return res.status(400).json({ error: "leadId and estimate required" });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, tenantId: true, computed: true },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    // Update the stored estimate in lead.computed
    const computed = (lead.computed as any) || {};
    computed.mlEstimate = {
      ...estimate,
      updatedAt: new Date().toISOString(),
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: { computed: computed as any },
    });

    return res.json({ success: true, estimate: computed.mlEstimate });
  } catch (error: any) {
    console.error("[estimates/:leadId/update] error:", error);
    return res.status(500).json({ error: error?.message || "internal error" });
  }
});

/**
 * POST /estimates/:leadId/confirm
 * Confirm estimate, sync to public estimator project, send email notification
 */
router.post("/:leadId/confirm", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const { leadId } = req.params;
  const { estimate, tenant: tenantSlug } = req.body || {};

  if (!leadId) {
    return res.status(400).json({ error: "leadId required" });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { tenant: { select: { slug: true, brandName: true } } },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    const totalGross = estimate?.totalGross || 0;

    // 1. Update lead.computed with confirmed estimate
    const computed = (lead.computed as any) || {};
    computed.mlEstimate = {
      ...(estimate || computed.mlEstimate || {}),
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        computed: computed as any,
        estimatedValue: totalGross > 0 ? totalGross : undefined,
      },
    });

    // 2. Find or create public estimator project for this lead
    let project = await prisma.publicEstimatorProject.findFirst({
      where: {
        tenantId,
        OR: [
          { leadId },
          { email: lead.email || undefined },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (project) {
      // Update existing project with estimate ready flag and totals
      await prisma.publicEstimatorProject.update({
        where: { id: project.id },
        data: {
          estimateReady: true,
          totalGross: totalGross > 0 ? totalGross : undefined,
          leadId: lead.id,
        },
      });
    } else if (lead.email) {
      // Create new project if lead has email
      project = await prisma.publicEstimatorProject.create({
        data: {
          tenantId,
          email: lead.email,
          contactName: lead.contactName || undefined,
          phone: lead.phone || undefined,
          leadId: lead.id,
          estimateReady: true,
          totalGross: totalGross > 0 ? totalGross : undefined,
          answers: {},
        },
      });
    }

    // 3. Send "estimate ready" email notification
    if (lead.email && project) {
      const brandName = lead.tenant?.brandName || "Your Company";
      const slug = lead.tenant?.slug || tenantSlug || "demo";
      const projectUrl = `${process.env.APP_ORIGIN || "https://app.joineryai.uk"}/tenant/${slug}/estimator?project=${project.id}`;

      // Queue email via email service or mail router
      // For now, we'll just log it - you can integrate with your mail service
      console.log(`[estimates/:leadId/confirm] Would send email to ${lead.email}:`);
      console.log(`  Subject: Your estimate from ${brandName} is ready`);
      console.log(`  Body: Your personalized estimate of £${totalGross.toFixed(2)} is now available.`);
      console.log(`  Link: ${projectUrl}`);

      // TODO: Integrate with mail service
      // await sendEstimateReadyEmail({
      //   to: lead.email,
      //   contactName: lead.contactName,
      //   brandName,
      //   totalGross,
      //   projectUrl,
      // });
    }

    return res.json({
      success: true,
      estimate: computed.mlEstimate,
      projectId: project?.id,
      projectUrl: project
        ? `${process.env.APP_ORIGIN || "https://app.joineryai.uk"}/tenant/${lead.tenant?.slug || tenantSlug || "demo"}/estimator?project=${project.id}`
        : null,
    });
  } catch (error: any) {
    console.error("[estimates/:leadId/confirm] error:", error);
    return res.status(500).json({ error: error?.message || "internal error" });
  }
});

export default router;
