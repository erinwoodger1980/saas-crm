import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkLloydWorrallProjects() {
  try {
    // Find Lloyd Worrall client account
    const client = await prisma.clientAccount.findFirst({
      where: {
        companyName: { contains: 'LLOYD WORRALL', mode: 'insensitive' }
      }
    });

    if (!client) {
      console.log('Lloyd Worrall client not found');
      return;
    }

    console.log('Found client:', client.id, client.companyName);

    // Find all FireDoorScheduleProjects for this tenant that don't have Project links
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      where: {
        tenantId: client.tenantId,
        project: null // No existing Project link
      },
      select: {
        id: true,
        mjsNumber: true,
        clientName: true
      }
    });

    console.log(`Found ${fireDoorProjects.length} fire door projects without Project links`);

    let linked = 0;
    
    for (const fdp of fireDoorProjects) {
      // Create or find an Opportunity for this fire door project
      let opportunity = await prisma.opportunity.findFirst({
        where: {
          clientAccountId: client.id,
          title: `Fire Door Project - ${fdp.mjsNumber || fdp.clientName || fdp.id.substring(0, 8)}`
        }
      });

      if (!opportunity) {
        const lead: any = { id: `temp-lead-${Date.now()}`, tenantId: client.tenantId }; // Skip lead creation due to schema issues

        opportunity = await prisma.opportunity.create({
          data: {
            tenantId: client.tenantId,
            clientAccountId: client.id,
            leadId: lead.id,
            title: `Fire Door Project - ${fdp.mjsNumber || fdp.clientName || fdp.id.substring(0, 8)}`,
            stage: 'WON',
          }
        });
        console.log(`Created opportunity: ${opportunity.id}`);
      }

      // Create Project link
      const project = await prisma.project.create({
        data: {
          tenantId: client.tenantId,
          opportunityId: opportunity.id,
          fireDoorScheduleId: fdp.id,
          projectName: `Fire Door Project - ${fdp.mjsNumber || fdp.clientName || fdp.id.substring(0, 8)}`,
          projectType: 'FIRE_DOOR_SCHEDULE',
          status: 'Active'
        }
      });

      console.log(`Linked fire door project ${fdp.id} via Project ${project.id}`);
      linked++;
    }

    console.log(`\nSuccessfully linked ${linked} fire door projects to opportunities`);

    // Verify the links work
    const verifyProjects = await prisma.project.findMany({
      where: {
        tenantId: client.tenantId,
        opportunity: { clientAccountId: client.id },
        fireDoorScheduleId: { not: null }
      },
      include: {
        opportunity: { select: { title: true } },
      }
    });

    console.log(`\nVerification: Found ${verifyProjects.length} linked projects for Lloyd Worrall`);
    verifyProjects.forEach((p: any) => {
      console.log(`- Project ${p.id}: ${p.opportunity?.title}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkLloydWorrallProjects();
