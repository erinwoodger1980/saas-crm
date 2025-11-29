const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  
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
  }
})();
