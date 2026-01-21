const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  
  try {
    // Insert test record
    await prisma.analyticsEvent.create({
      data: {
        tenantId: 'demo',
        type: 'landing',
        source: 'test_verification',
        timestamp: new Date(),
      }
    });
    
    // Count records
    const count = await prisma.analyticsEvent.count();
    console.log('✅ AnalyticsEvent table working! Total rows:', count);
    
    // Show latest records
    const latest = await prisma.analyticsEvent.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, source: true, tenantId: true }
    });
    console.log('📊 Latest records:', JSON.stringify(latest, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
