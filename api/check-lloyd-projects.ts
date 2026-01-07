// Check which fire door projects actually belong to Lloyd Worrall
import { prisma } from './src/prisma';

async function checkLloydProjects() {
  try {
    console.log('🔍 Checking fire door projects...\n');
    
    const allProjects = await prisma.fireDoorScheduleProject.findMany({
      select: {
        id: true,
        mjsNumber: true,
        clientName: true,
        jobName: true,
        project: {
          select: {
            id: true,
            opportunity: {
              select: {
                clientAccount: {
                  select: {
                    companyName: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { mjsNumber: 'asc' }
    });

    console.log('Total projects:', allProjects.length);
    console.log('\nProjects by client name in FireDoorScheduleProject:');
    
    const grouped = allProjects.reduce((acc, p) => {
      const client = p.clientName || 'Unknown';
      if (!acc[client]) acc[client] = [];
      acc[client].push(p);
      return acc;
    }, {} as Record<string, typeof allProjects>);

    for (const [clientName, projects] of Object.entries(grouped)) {
      console.log(`\n${clientName}: ${projects.length} projects`);
      projects.slice(0, 3).forEach(p => {
        const linkedTo = p.project?.opportunity?.clientAccount?.companyName || 'Not linked';
        console.log(`  - ${p.mjsNumber || 'No MJS#'} (${p.jobName || 'No job name'}) -> Linked to: ${linkedTo}`);
      });
      if (projects.length > 3) {
        console.log(`  ... and ${projects.length - 3} more`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLloydProjects();
