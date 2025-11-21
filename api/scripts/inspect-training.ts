import { prisma } from '../src/prisma';

async function run() {
  const slug = process.env.TENANT_SLUG || 'tenant-cmgt7e';
  console.log('🔍 Inspecting training data for slug:', slug);
  const settings = await prisma.tenantSettings.findFirst({ where: { slug }, select: { tenantId: true, slug: true, brandName: true } });
  if (!settings) {
    console.log('❌ No TenantSettings row found for slug');
    return;
  }
  const tenantId = settings.tenantId;
  console.log('✅ tenantId:', tenantId, 'brandName:', settings.brandName);

  // Recent ML training samples
  const samples = await prisma.mLTrainingSample.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const statusCounts: Record<string, number> = {};
  for (const s of samples) {
    statusCounts[s as any].status = (statusCounts[(s as any).status] || 0) + 1;
  }

  console.log('\n=== Recent Samples (latest 5) ===');
  for (const s of samples.slice(0,5)) {
    console.log({
      id: s.id,
      messageId: s.messageId,
      attachmentId: s.attachmentId,
      status: (s as any).status,
      quotedAt: s.quotedAt,
      createdAt: s.createdAt,
      sourceType: s.sourceType,
      url: s.url,
    });
  }

  console.log('\nStatus distribution:', statusCounts);

  // Training events
  const events = await prisma.trainingEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\n=== Recent Training Events ===');
  events.forEach(e => console.log({ id: e.id, kind: e.kind, createdAt: e.createdAt, result: e.result }));

  // Insights
  const insights = await prisma.trainingInsights.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log('\n=== Recent Training Insights ===');
  insights.forEach(i => console.log({ id: i.id, module: i.module, confidence: i.confidence, createdAt: i.createdAt }));
}

run().catch(e => {
  console.error('Script failed:', e);
}).finally(() => prisma.$disconnect());
