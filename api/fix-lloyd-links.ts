// Fix: Delete Project links for non-Lloyd Worrall projects
import { prisma } from './src/prisma';

async function fixProjectLinks() {
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

    console.log(`✅ Found client: ${client.companyName} (${client.id})\n`);

    // Find all Project links for Lloyd Worrall
    const lloydProjects = await prisma.project.findMany({
      where: {
        tenantId: client.tenantId,
        opportunity: { clientAccountId: client.id },
        fireDoorScheduleId: { not: null }
      },
      include: {
        fireDoorSchedule: {
          select: {
            id: true,
            mjsNumber: true,
            clientName: true
          }
        }
      }
    });

    console.log(`Found ${lloydProjects.length} Project links to Lloyd Worrall`);

    // Separate correct vs incorrect links
    const correctLinks = lloydProjects.filter(p => 
      p.fireDoorSchedule?.clientName?.toUpperCase().includes('LLOYD WORRALL') ||
      p.fireDoorSchedule?.clientName?.toUpperCase().includes('LLOYD WORRAL')
    );

    const incorrectLinks = lloydProjects.filter(p => 
      !p.fireDoorSchedule?.clientName?.toUpperCase().includes('LLOYD WORRALL') &&
      !p.fireDoorSchedule?.clientName?.toUpperCase().includes('LLOYD WORRAL') &&
      p.fireDoorSchedule?.clientName !== null
    );

    console.log(`\n✅ Correct links (should keep): ${correctLinks.length}`);
    console.log(`❌ Incorrect links (should delete): ${incorrectLinks.length}\n`);

    if (incorrectLinks.length > 0) {
      console.log('Deleting incorrect links:');
      
      for (const project of incorrectLinks) {
        console.log(`  Deleting: ${project.fireDoorSchedule?.mjsNumber} (${project.fireDoorSchedule?.clientName})`);
        
        // Delete the Project
        await prisma.project.delete({
          where: { id: project.id }
        });

        // Also delete the Opportunity and Lead if they were auto-created
        if (project.opportunityId) {
          const opp = await prisma.opportunity.findUnique({
            where: { id: project.opportunityId },
            select: { leadId: true }
          });
          
          await prisma.opportunity.delete({ where: { id: project.opportunityId } });
          
          if (opp?.leadId) {
            await prisma.lead.delete({ where: { id: opp.leadId } });
          }
        }
      }

      console.log(`\n✅ Deleted ${incorrectLinks.length} incorrect links`);
    }

    // Verify final count
    const finalCount = await prisma.project.count({
      where: {
        tenantId: client.tenantId,
        opportunity: { clientAccountId: client.id },
        fireDoorScheduleId: { not: null }
      }
    });

    console.log(`\n🔍 Final verification: ${finalCount} Project links for Lloyd Worrall`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProjectLinks();
