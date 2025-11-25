/**
 * Sync Fire Door Schedule Projects to Opportunities
 * 
 * This script creates/updates opportunities for all fire door schedule projects:
 * - Sets stage to WON
 * - Maps signOffDate -> startDate (manufacture start)
 * - Maps approxDeliveryDate -> deliveryDate
 * - Links the fire door project to the opportunity via projectId
 */

import { OppStage } from '@prisma/client';
import { prisma } from '../src/prisma';

async function syncFireDoorToOpportunities() {
  try {
    console.log('Starting fire door schedule to opportunities sync...');

    // Get all fire door schedule projects
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      include: {
        tenant: true,
      },
    });

    console.log(`Found ${fireDoorProjects.length} fire door projects to process`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const project of fireDoorProjects) {
      try {
        // Check if opportunity already exists via projectId
        let opportunity = project.projectId
          ? await prisma.opportunity.findFirst({
              where: {
                id: project.projectId,
                tenantId: project.tenantId,
              },
              include: { lead: true },
            })
          : null;

        // If no opportunity linked, try to find or create one
        if (!opportunity) {
          // First, we need a lead for the opportunity
          // Check if there's an existing lead with matching client name
          let lead = await prisma.lead.findFirst({
            where: {
              tenantId: project.tenantId,
              companyName: project.clientName || undefined,
            },
          });

          // If no lead exists, create one
          if (!lead && project.clientName) {
            lead = await prisma.lead.create({
              data: {
                tenantId: project.tenantId,
                companyName: project.clientName,
                name: project.clientName,
                source: 'Fire Door Schedule Import',
                createdAt: project.dateReceived || new Date(),
              },
            });
            console.log(`  Created lead for ${project.clientName} (${lead.id})`);
          }

          if (!lead) {
            console.log(`  ⚠️  Skipping project ${project.mjsNumber || project.id} - no client name`);
            skipped++;
            continue;
          }

          // Create the opportunity
          opportunity = await prisma.opportunity.create({
            data: {
              tenantId: project.tenantId,
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
            data: { projectId: opportunity.id },
          });

          console.log(`  ✅ Created opportunity ${opportunity.id} for ${project.mjsNumber || project.jobName}`);
          created++;
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
        }
      } catch (error) {
        console.error(`  ❌ Error processing project ${project.id}:`, error);
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${fireDoorProjects.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncFireDoorToOpportunities()
  .then(() => {
    console.log('Sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
