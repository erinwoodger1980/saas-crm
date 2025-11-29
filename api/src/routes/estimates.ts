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
 * Fetch ML estimate for a lead (from database or generate using ML)
 */
router.get("/:leadId", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { leadId } = req.params;
  if (!leadId) return res.status(400).json({ error: "leadId required" });

  try {
    // Find lead and its quote with questionnaire response
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        Quote: {
          include: {
            questionnaireResponse: {
              include: {
                answers: {
                  include: {
                    field: true,
                  },
                },
              },
            },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    // Check if we have a stored ML estimate in lead.custom.mlEstimate
    const custom = (lead.custom as any) || {};
    let estimate = custom.mlEstimate || null;

    // Get questionnaire data from quote or lead.custom
    const quote = lead.Quote?.[0];
    const questionnaireAnswers = quote?.questionnaireResponse?.answers || [];
    const customItems = custom.items || [];

    // If no stored estimate, generate using ML predict-lines
    if (!estimate && (questionnaireAnswers.length > 0 || customItems.length > 0)) {
      // Build lines array from questionnaire answers or custom items
      let lines: any[] = [];

      if (questionnaireAnswers.length > 0) {
        // Group answers by item (assuming grouped structure or single item)
        const answerMap: any = {};
        questionnaireAnswers.forEach((answer: any) => {
          const fieldKey = answer.field?.key || "";
          const value = answer.value;
          answerMap[fieldKey] = value;
        });

        lines = [{
          itemNumber: 1,
          description: answerMap.description || "Door",
          quantity: answerMap.quantity || 1,
          widthMm: answerMap.width_mm || answerMap.width || null,
          heightMm: answerMap.height_mm || answerMap.height || null,
          material: answerMap.material_type || answerMap.material || answerMap.wood_type || "oak",
          finish: answerMap.finish || answerMap.paint_colour || null,
          glazing: answerMap.glazing || null,
          hardwareType: answerMap.hardware_type || answerMap.ironmongery || null,
          fireRated: answerMap.fire_rated === true || answerMap.fire_rated === "true" || answerMap.fire_rated === "yes",
        }];
      } else if (customItems.length > 0) {
        lines = customItems.map((item: any, idx: number) => ({
          itemNumber: idx + 1,
          description: item.description || `Door ${idx + 1}`,
          quantity: item.quantity || 1,
          widthMm: item.width_mm || item.width || null,
          heightMm: item.height_mm || item.height || null,
          material: item.material_type || item.material || item.wood_type || "oak",
          finish: item.finish || item.paint_colour || null,
          glazing: item.glazing || null,
          hardwareType: item.hardware_type || item.ironmongery || null,
          fireRated: item.fire_rated === true || item.fire_rated === "true" || item.fire_rated === "yes",
        }));
      }

      // Call ML service for accurate pricing
      const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
        .trim()
        .replace(/\/$/, "");
      
      try {
        const mlResponse = await fetch(`${ML_URL}/predict-lines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines,
            currency: "GBP",
            vatPercent: 20,
            markupPercent: 0, // Lead estimate, no markup yet
          }),
        });

        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          const items = (mlData.lines || []).map((line: any, idx: number) => ({
            id: `item-${idx}`,
            itemNumber: line.itemNumber || idx + 1,
            description: line.description || lines[idx]?.description || `Door ${idx + 1}`,
            netGBP: line.netGBP || 0,
            vatGBP: line.vatGBP || 0,
            totalGBP: line.totalGBP || 0,
            width: lines[idx]?.widthMm || null,
            height: lines[idx]?.heightMm || null,
            mlConfidence: line.confidence,
          }));

          estimate = {
            leadId,
            items,
            totalNet: mlData.totalNet || 0,
            totalVat: mlData.totalVat || 0,
            totalGross: mlData.totalGross || 0,
            generatedAt: new Date().toISOString(),
            mlPowered: true,
          };
        } else {
          // Fallback to simple calculation if ML unavailable
          const items = lines.map((line: any, idx: number) => {
            const width = line.widthMm || null;
            const height = line.heightMm || null;
            const area = width && height ? (width * height) / 1_000_000 : 1.5;
            const basePrice = area * 300;
            const netGBP = Math.round(basePrice * 100) / 100;
            const vatGBP = Math.round(netGBP * 0.2 * 100) / 100;
            const totalGBP = netGBP + vatGBP;

            return {
              id: `item-${idx}`,
              itemNumber: idx + 1,
              description: line.description || `Door ${idx + 1} - ${width || "?"}mm x ${height || "?"}mm`,
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
            mlPowered: false,
          };
        }
      } catch (mlError) {
        console.error("[estimates/:leadId] ML prediction failed:", mlError);
        // Fallback to simple calculation
        const items = lines.map((line: any, idx: number) => {
          const width = line.widthMm || null;
          const height = line.heightMm || null;
          const area = width && height ? (width * height) / 1_000_000 : 1.5;
          const basePrice = area * 300;
          const netGBP = Math.round(basePrice * 100) / 100;
          const vatGBP = Math.round(netGBP * 0.2 * 100) / 100;
          const totalGBP = netGBP + vatGBP;

          return {
            id: `item-${idx}`,
            itemNumber: idx + 1,
            description: line.description || `Door ${idx + 1} - ${width || "?"}mm x ${height || "?"}mm`,
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
          mlPowered: false,
        };
      }

      // Store the generated estimate in lead.custom for future retrieval
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          custom: {
            ...(custom || {}),
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
      select: { id: true, tenantId: true, custom: true },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    // Update the stored estimate in lead.custom
    const custom = (lead.custom as any) || {};
    custom.mlEstimate = {
      ...estimate,
      updatedAt: new Date().toISOString(),
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: { custom: custom as any },
    });

    return res.json({ success: true, estimate: custom.mlEstimate });
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
      include: { tenant: { select: { slug: true } } },
    });

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    const totalGross = estimate?.totalGross || 0;

    // 1. Update lead.custom with confirmed estimate
    const custom = (lead.custom as any) || {};
    custom.mlEstimate = {
      ...(estimate || custom.mlEstimate || {}),
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        custom: custom as any,
        estimatedValue: totalGross > 0 ? totalGross : undefined,
      },
    });

    // 2. Find or create public estimator project for this lead
    let project = await (prisma as any).publicEstimatorProject?.findFirst({
      where: {
        tenantId,
        OR: [
          { leadId },
          { email: lead.email || undefined },
        ],
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null);

    if (project) {
      // Update existing project with estimate ready flag and totals
      await (prisma as any).publicEstimatorProject?.update({
        where: { id: project.id },
        data: {
          estimateReady: true,
          totalGross: totalGross > 0 ? totalGross : undefined,
          leadId: lead.id,
        },
      }).catch(() => null);
    } else if (lead.email && (prisma as any).publicEstimatorProject) {
      // Create new project if lead has email
      project = await (prisma as any).publicEstimatorProject.create({
        data: {
          tenantId,
          email: lead.email,
          contactName: lead.contactName || undefined,
          phone: null,
          leadId: lead.id,
          estimateReady: true,
          totalGross: totalGross > 0 ? totalGross : undefined,
          answers: {},
        },
      }).catch(() => null);
    }

    // 3. Send "estimate ready" email notification
    if (lead.email && project) {
      const slug = lead.tenant?.slug || tenantSlug || "demo";
      const projectUrl = `${process.env.APP_ORIGIN || "https://app.joineryai.uk"}/tenant/${slug}/estimator?project=${project.id}`;

      // Log email notification (TODO: integrate with mail service)
      console.log(`[estimates/:leadId/confirm] Would send email to ${lead.email}:`);
      console.log(`  Subject: Your estimate is ready`);
      console.log(`  Body: Your personalized estimate of £${totalGross.toFixed(2)} is now available.`);
      console.log(`  Link: ${projectUrl}`);

      // TODO: Integrate with mail service
      // await sendEstimateReadyEmail({
      //   to: lead.email,
      //   contactName: lead.contactName,
      //   totalGross,
      //   projectUrl,
      // });
    }

    return res.json({
      success: true,
      estimate: custom.mlEstimate,
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
