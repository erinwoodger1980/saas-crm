/**
 * Sync Fire Door Schedule Projects to Won Opportunities
 * 
 * POST /fire-door-schedule/sync-to-opportunities
 * Creates/updates opportunities for fire door schedule projects
 */

import express, { Response } from "express";
import { prisma } from "../prisma";
import { OppStage } from "@prisma/client";

const router = express.Router();

router.post("/sync-to-opportunities", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId || req.auth?.id;
    
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`Starting sync for tenant ${tenantId}...`);

    // Get all fire door schedule projects for this tenant
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      where: { tenantId },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const project of fireDoorProjects) {
      try {
        // Check if opportunity already exists via projectId
        let opportunity = project.projectId
          ? await prisma.opportunity.findFirst({
              where: {
                id: project.projectId,
                tenantId,
              },
            })
          : null;

        // If no opportunity linked, try to find or create one
        if (!opportunity) {
          // First, we need a lead for the opportunity
          // Check if there's an existing lead with matching client name
          let lead = await prisma.lead.findFirst({
            where: {
              tenantId,
              contactName: project.clientName || undefined,
            },
          });

          // If no lead exists, create one
          if (!lead && project.clientName) {
            lead = await prisma.lead.create({
              data: {
                tenantId,
                createdById: userId,
                contactName: project.clientName,
                capturedAt: project.dateReceived || new Date(),
              },
            });
            console.log(`  Created lead for ${project.clientName} (${lead.id})`);
          }

          if (!lead) {
            console.log(`  ⚠️  Skipping project ${project.mjsNumber || project.id} - no client name`);
            skipped++;
            results.push({
              project: project.mjsNumber || project.id,
              status: 'skipped',
              reason: 'no client name',
            });
            continue;
          }

          // Create the opportunity
          const newOpportunity = await prisma.opportunity.create({
            data: {
              tenantId,
              leadId: lead.id,
              title: project.jobName || `Fire Door Project - ${project.mjsNumber || 'Untitled'}`,
              stage: OppStage.WON,
              startDate: project.signOffDate, // Manufacture start date
              deliveryDate: project.approxDeliveryDate, // Delivery date
              valueGBP: project.netValue,
              wonAt: project.signOffDate || project.dateReceived || new Date(),
              createdAt: project.dateReceived || project.createdAt,
            },
          });

          // Link the fire door project to the opportunity
          await prisma.fireDoorScheduleProject.update({
            where: { id: project.id },
            data: { projectId: newOpportunity.id },
          });

          console.log(`  ✅ Created opportunity ${newOpportunity.id} for ${project.mjsNumber || project.jobName}`);
          created++;
          results.push({
            project: project.mjsNumber || project.jobName,
            status: 'created',
            opportunityId: newOpportunity.id,
          });
        } else {
          // Update existing opportunity
          await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: OppStage.WON,
              startDate: project.signOffDate,
              deliveryDate: project.approxDeliveryDate,
              valueGBP: project.netValue,
              wonAt: project.signOffDate || opportunity.wonAt || new Date(),
              title: project.jobName || opportunity.title,
            },
          });

          console.log(`  🔄 Updated opportunity ${opportunity.id} for ${project.mjsNumber || project.jobName}`);
          updated++;
          results.push({
            project: project.mjsNumber || project.jobName,
            status: 'updated',
            opportunityId: opportunity.id,
          });
        }
      } catch (error) {
        console.error(`  ❌ Error processing project ${project.id}:`, error);
        results.push({
          project: project.mjsNumber || project.id,
          status: 'error',
          error: String(error),
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: fireDoorProjects.length,
        created,
        updated,
        skipped,
      },
      results,
    });
  } catch (error) {
    console.error("Error syncing fire door projects:", error);
    res.status(500).json({ error: "Failed to sync fire door projects" });
  }
});

export default router;
