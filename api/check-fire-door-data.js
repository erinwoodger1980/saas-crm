// Set to live database
process.env.DATABASE_URL = 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

// Import from compiled JS file
const { prisma } = require('./dist/prisma');

async function checkData() {
  try {
    // Find LAJ Joinery tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: 'LAJ', mode: 'insensitive' } },
          { name: { contains: 'Joinery', mode: 'insensitive' } }
        ]
      }
    });

    if (!tenant) {
      console.log('❌ LAJ Joinery tenant not found');
      return;
    }

    console.log('✅ Found tenant:', tenant.name, '(', tenant.id, ')');
    console.log('');

    // Count fire door projects
    const total = await prisma.fireDoorScheduleProject.count({
      where: { tenantId: tenant.id }
    });

    console.log('📊 Total Fire Door Projects:', total);
    console.log('');

    // Get location breakdown
    const projects = await prisma.fireDoorScheduleProject.findMany({
      where: { tenantId: tenant.id },
      select: { jobLocation: true }
    });

    const locationCounts = {};
    projects.forEach(p => {
      const loc = p.jobLocation || 'NULL';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    console.log('📍 Projects by Location:');
    Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([loc, count]) => {
        console.log(`   ${loc}: ${count}`);
      });
    console.log('');

    // Sample a few projects
    const samples = await prisma.fireDoorScheduleProject.findMany({
      where: { tenantId: tenant.id },
      select: {
        mjsNumber: true,
        jobName: true,
        clientName: true,
        jobLocation: true,
        signOffStatus: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    console.log('📋 Sample Projects (most recent):');
    samples.forEach(p => {
      console.log(`   ${p.mjsNumber || 'NO_MJS'}: ${p.clientName || 'NO_CLIENT'} - Location: ${p.jobLocation || 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
