// Run this script to link Lloyd Worrall projects to opportunities
// Usage: DATABASE_URL="postgresql://..." npx tsx link-lloyd-prod.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkLloydWorrallProjects() {
  try {
    console.log('🔍 Finding Lloyd Worrall client account...');
    
    const client = await prisma.clientAccount.findFirst({
      where: {
        companyName: { contains: 'LLOYD WORRALL', mode: 'insensitive' }
      }
    });

    if (!client) {
      console.log('❌ Lloyd Worrall client not found');
      return;
    }

    console.log(`✅ Found client: ${client.companyName} (${client.id})`);
    console.log(`   Tenant ID: ${client.tenantId}`);

    // Find all FireDoorScheduleProjects for this tenant that don't have Project links
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      where: {
        tenantId: client.tenantId,
        project: null
      },
      select: {
        id: true,
        mjsNumber: true,
        clientName: true,
        jobName: true
      }
    });

    console.log(`\n📦 Found ${fireDoorProjects.length} fire door projects without Project links`);

    let opportunitiesCreated = 0;
    let projectsLinked = 0;

    for (const fdp of fireDoorProjects) {
      const projectLabel = fdp.mjsNumber || fdp.jobName || fdp.clientName || fdp.id.substring(0, 8);
      
      console.log(`\n🔗 Processing: ${projectLabel}`);
      
      // Create or find an Opportunity for this fire door project
      let opportunity = await prisma.opportunity.findFirst({
        where: {
          clientAccountId: client.id,
          title: `Fire Door Project - ${projectLabel}`
        }
      });

      if (!opportunity) {
        // Create a lead first (required for opportunity)
        const lead = await prisma.lead.create({
          data: {
            tenantId: client.tenantId,
            clientAccountId: client.id,
            contactName: `Fire Door Project - ${projectLabel}`,
            email: client.email || 'noemail@example.com',
            status: 'WON',
            createdById: 'system'
          }
        });
        console.log(`   ✅ Created lead: ${lead.id}`);

        opportunity = await prisma.opportunity.create({
          data: {
            tenantId: client.tenantId,
            clientAccountId: client.id,
            leadId: lead.id,
            title: `Fire Door Project - ${projectLabel}`,
            stage: 'WON'
          }
        });
        console.log(`   ✅ Created opportunity: ${opportunity.id}`);
        opportunitiesCreated++;
      } else {
        console.log(`   ℹ️  Using existing opportunity: ${opportunity.id}`);
      }

      // Create Project link
      const project = await prisma.project.create({
        data: {
          tenantId: client.tenantId,
          projectType: 'FIRE_DOOR_SCHEDULE',
          opportunityId: opportunity.id,
          fireDoorScheduleId: fdp.id,
          projectName: `Fire Door Project - ${projectLabel}`,
          status: 'Active'
        }
      });

      console.log(`   ✅ Created Project link: ${project.id}`);
      projectsLinked++;
    }

    console.log(`\n✅ Successfully completed!`);
    console.log(`   Opportunities created: ${opportunitiesCreated}`);
    console.log(`   Projects linked: ${projectsLinked}`);

    // Verify the links work
    const verifyProjects = await prisma.project.findMany({
      where: {
        tenantId: client.tenantId,
        opportunity: { clientAccountId: client.id },
        fireDoorScheduleId: { not: null }
      }
    });

    console.log(`\n🔍 Verification: Found ${verifyProjects.length} total linked projects for Lloyd Worrall`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

linkLloydWorrallProjects();
