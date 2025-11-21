import { prisma } from '../prisma'

async function run() {
  const slug = 'tenant-cmgt7e'
  console.log(`🔍 Inspecting ML samples for slug: ${slug}`)
  const tenant = await prisma.tenant.findFirst({ where: { slug } })
  if (!tenant) {
    console.log('❌ Tenant not found for slug')
    return
  }
  console.log('✅ Tenant ID:', tenant.id)

  // Samples
  const samples = await prisma.mLTrainingSample.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })

  // Status distribution
  let statusDist: any[] = []
  try {
    statusDist = await (prisma.mLTrainingSample as any).groupBy({
      by: ['status'],
      where: { tenantId: tenant.id },
      _count: { _all: true },
    })
  } catch (e) {
    console.log('⚠️ groupBy failed (maybe no rows yet):', (e as any).message)
  }

  // Training events (recent)
  const events = await prisma.trainingEvent.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log('\nStatus Distribution:')
  if (statusDist.length === 0) {
    console.log('  (none)')
  } else {
    for (const row of statusDist) {
      console.log(`  ${row.status}: ${row._count._all}`)
    }
  }

  console.log('\nRecent Samples:')
  if (samples.length === 0) {
    console.log('  (no samples)')
  } else {
    for (const s of samples) {
      console.log(`  ${s.id} | ${s.status} | ${s.createdAt.toISOString()} | quoteId=${s.quoteId ?? '∅'} | url=${s.url}`)
    }
  }

  console.log('\nRecent Training Events:')
  if (events.length === 0) {
    console.log('  (none)')
  } else {
    for (const ev of events) {
      console.log(`  ${ev.id} | ${ev.module} | ${ev.kind} | ${ev.createdAt.toISOString()}`)
    }
  }
}

run()
  .catch(err => {
    console.error('❌ Inspection failed', err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
