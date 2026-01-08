/*
  Purge all leads and emails for tenant "Erin Woodger".
  - Loads DATABASE_URL from api/.env
  - Finds tenant by name/slug
  - Deletes email messages/threads/ingests for the tenant
  - Cleans dependent records referencing leads
  - Deletes opportunities linked to leads
  - Finally deletes all leads for the tenant
*/

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set. Ensure api/.env contains live DB credentials.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });

  const TENANT_NAME = 'Erin Woodger';
  const TENANT_SLUG = 'erin-woodger';

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ name: TENANT_NAME }, { slug: TENANT_SLUG }] },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant not found by name '${TENANT_NAME}' or slug '${TENANT_SLUG}'.`);

    console.log(`Found tenant: id=${tenant.id} name=${tenant.name} slug=${tenant.slug}`);

    const leadIds = (
      await prisma.lead.findMany({ where: { tenantId: tenant.id }, select: { id: true } })
    ).map((l) => l.id);
    console.log(`Leads to purge: ${leadIds.length}`);

    // Count emails (messages)
    const emailMessageCount = await prisma.emailMessage.count({ where: { tenantId: tenant.id } });
    console.log(`Email messages to purge: ${emailMessageCount}`);

    // 1) Delete emails for tenant (messages then threads), and ingests
    const delEmails = await prisma.$transaction([
      prisma.emailMessage.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.emailThread.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.emailIngest.deleteMany({ where: { tenantId: tenant.id } }),
    ]);
    console.log(`Email messages deleted: ${delEmails[0].count}`);
    console.log(`Email threads deleted: ${delEmails[1].count}`);
    console.log(`Email ingests deleted: ${delEmails[2].count}`);

    if (leadIds.length === 0) {
      console.log('No leads found for tenant. Done.');
      return;
    }

    // Determine opportunities tied to these leads
    const oppIds = (
      await prisma.opportunity.findMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } }, select: { id: true } })
    ).map((o) => o.id);

    // 2) Clean dependent records referencing leads/opportunities
    const results = await prisma.$transaction([
      prisma.followUpEvent.deleteMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } } }),
      prisma.leadInteraction.deleteMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } } }),
      prisma.leadVisionInference.deleteMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } } }),
      prisma.quoteQuestionnaireMatch.updateMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } }, data: { leadId: null } }),
      prisma.quote.updateMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } }, data: { leadId: null } }),
      prisma.publicProject.updateMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } }, data: { leadId: null } }),
      prisma.followupExperiment.deleteMany({ where: { tenantId: tenant.id, opportunityId: { in: oppIds } } }),
    ]);
    console.log('Dependent cleanup results:', {
      followUpEventsDeleted: results[0].count,
      leadInteractionsDeleted: results[1].count,
      leadVisionDeleted: results[2].count,
      qMatchesLeadNull: results[3].count,
      quotesLeadNull: results[4].count,
      publicProjectsLeadNull: results[5].count,
      experimentsDeleted: results[6].count,
    });

    // 3) Delete opportunities tied to these leads
    const delOpps = await prisma.opportunity.deleteMany({ where: { tenantId: tenant.id, leadId: { in: leadIds } } });
    console.log(`Opportunities deleted: ${delOpps.count}`);

    // 4) Finally delete leads
    const delLeads = await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
    console.log(`Leads deleted: ${delLeads.count}`);

    console.log('Leads and emails purge complete.');
  } catch (err) {
    console.error('Error during leads/emails purge:', err);
    process.exitCode = 1;
  }
}

main();
