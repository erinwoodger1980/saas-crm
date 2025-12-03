import { prisma } from './api/src/prisma';

async function check() {
  // Get Lewis Aldridge tenant
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Lewis Aldridge', mode: 'insensitive' } }
  });
  
  if (!tenant) {
    console.log('Tenant not found');
    return;
  }
  
  console.log('Tenant:', tenant.name, tenant.id);
  
  // Check opportunities
  const opps = await prisma.opportunity.findMany({
    where: { tenantId: tenant.id, stage: 'WON' },
    include: { lead: { select: { contactName: true, status: true } } },
    take: 5
  });
  
  console.log('\nWON Opportunities:', opps.length);
  opps.forEach(o => {
    console.log('- Opp:', o.title, '| Lead status:', o.lead?.status || 'NO LEAD');
  });
  
  // Check leads with WON status
  const wonLeads = await prisma.lead.findMany({
    where: { tenantId: tenant.id, status: 'WON' },
    take: 5
  });
  
  console.log('\nLeads with WON status:', wonLeads.length);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
