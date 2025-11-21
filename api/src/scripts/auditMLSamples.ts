import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Args {
  slug: string
  days: number
  limit: number
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let slug = 'tenant-cmgt7e'
  let days = 30
  let limit = 200
  for (const arg of argv) {
    if (arg.startsWith('--slug=')) slug = arg.split('=')[1]
    else if (arg.startsWith('--days=')) days = Number(arg.split('=')[1] || days)
    else if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1] || limit)
  }
  return { slug, days, limit }
}

async function main() {
  const { slug, days, limit } = parseArgs()
  console.log(`\n🔍 ML Sample Audit for slug='${slug}' (lookback ${days}d, limit ${limit})`)

  const tenant = await prisma.tenant.findFirst({ where: { slug } })
  if (!tenant) {
    console.log('❌ Tenant not found')
    return
  }
  const tenantId = tenant.id
  console.log(`✅ Tenant ID: ${tenantId}`)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Counts by status
  const statusGroups = await prisma.mLTrainingSample.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { _all: true },
  })

  // Counts by sourceType
  const sourceGroups = await prisma.mLTrainingSample.groupBy({
    by: ['sourceType'],
    where: { tenantId },
    _count: { _all: true },
  })

  // Recent samples (show pending first)
  const recent = await prisma.mLTrainingSample.findMany({
    where: { tenantId, createdAt: { gte: since } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      status: true,
      sourceType: true,
      messageId: true,
      attachmentId: true,
      quoteId: true,
      fileId: true,
      url: true,
      createdAt: true,
      quotedAt: true,
    },
  })

  // Orphan detection: samples with quoteId but quote missing
  const quoteIds = [...new Set(recent.filter(r => r.quoteId).map(r => r.quoteId!))]
  let missingQuotes: Set<string> = new Set()
  if (quoteIds.length) {
    const existingQuotes = await prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true } })
    const existingSet = new Set(existingQuotes.map(q => q.id))
    for (const qid of quoteIds) if (!existingSet.has(qid)) missingQuotes.add(qid)
  }

  console.log('\n=== Status Distribution ===')
  if (!statusGroups.length) console.log('  (none)')
  for (const g of statusGroups) console.log(`  ${g.status}: ${g._count._all}`)

  console.log('\n=== Source Distribution ===')
  if (!sourceGroups.length) console.log('  (none)')
  for (const g of sourceGroups) console.log(`  ${g.sourceType || '(null)'}: ${g._count._all}`)

  console.log('\n=== Recent Samples (chronological by status then createdAt) ===')
  if (!recent.length) console.log('  (none)')
  for (const r of recent) {
    const ts = r.createdAt.toISOString()
    console.log(`  ${r.id} | ${r.status} | ${r.sourceType} | m=${r.messageId} a=${r.attachmentId} q=${r.quoteId || '∅'} f=${r.fileId || '∅'} | ${ts}`)
  }

  if (missingQuotes.size) {
    console.log('\n⚠️ Missing Quotes referenced by samples:')
    for (const q of missingQuotes) console.log('  -', q)
  }

  // Approval readiness: how many pending
  const pending = statusGroups.find(g => g.status === 'PENDING')?._count._all || 0
  console.log(`\n📝 Approval Pending Samples: ${pending}`)
  if (pending > 0) console.log('   -> Use /internal/ml/samples and PATCH status=APPROVED to include in training dataset.')

  console.log('\n✅ Audit complete')
}

main().catch(err => {
  console.error('❌ Audit failed', err)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
