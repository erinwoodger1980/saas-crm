import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/link-lloyd-worrall', async (req, res) => {
  try {
    // Find Lloyd Worrall client account
    const client = await prisma.clientAccount.findFirst({
      where: {
        companyName: { contains: 'LLOYD WORRALL', mode: 'insensitive' }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Lloyd Worrall client not found' });
    }

    const results = {
      clientId: client.id,
      clientName: client.companyName,
      tenantId: client.tenantId,
      opportunitiesCreated: 0,
      projectsLinked: 0,
      details: [] as any[]
    };

    // Find all FireDoorScheduleProjects for this tenant that don't have Project links
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      where: {
        tenantId: client.tenantId,
        project: null // No existing Project link
      },
      select: {
        id: true,
        mjsNumber: true,
        clientName: true,
        jobName: true
      }
    });

    for (const fdp of fireDoorProjects) {
      const projectLabel = fdp.mjsNumber || fdp.jobName || fdp.clientName || fdp.id.substring(0, 8);
      
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
            createdById: 'system' // System-generated lead
          }
        });

        opportunity = await prisma.opportunity.create({
          data: {
            tenantId: client.tenantId,
            clientAccountId: client.id,
            leadId: lead.id,
            title: `Fire Door Project - ${projectLabel}`,
            stage: 'WON'
          }
        });
        results.opportunitiesCreated++;
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

      results.projectsLinked++;
      results.details.push({
        fireDoorId: fdp.id,
        mjsNumber: fdp.mjsNumber,
        clientName: fdp.clientName,
        jobName: fdp.jobName,
        opportunityId: opportunity.id,
        projectId: project.id
      });
    }

    // Verify the links work
    const verifyProjects = await prisma.project.findMany({
      where: {
        tenantId: client.tenantId,
        opportunity: { clientAccountId: client.id },
        fireDoorScheduleId: { not: null }
      }
    });

    results.details.push({
      verification: `Found ${verifyProjects.length} total linked projects for Lloyd Worrall`
    });

    res.json(results);

  } catch (error: any) {
    console.error('Error linking projects:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
