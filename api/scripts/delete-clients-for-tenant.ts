/*
  Purge all clients for tenant "Erin Woodger".
  - Loads DATABASE_URL from api/.env
  - Finds tenant by name or slug
  - Nulls out clientId on dependent relations (Leads, Opportunities)
  - Deletes clients and cascaded contacts
*/

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['info', 'warn', 'error'] });
  const TENANT_NAME = 'Erin Woodger';
  const TENANT_SLUG = 'erin-woodger';

  try {
    // Verify DB connection
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set. Ensure api/.env contains live DB credentials.');
    }
    // adapter already configured above

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ name: TENANT_NAME }, { slug: TENANT_SLUG }],
      },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found by name '${TENANT_NAME}' or slug '${TENANT_SLUG}'.`);
    }

    console.log(`Found tenant: id=${tenant.id} name=${tenant.name} slug=${tenant.slug}`);

    const clientIds = (
      await prisma.client.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      })
    ).map((c) => c.id);

    const clientCount = clientIds.length;
    console.log(`Clients to purge for tenant ${tenant.id}: ${clientCount}`);

    if (clientCount === 0) {
      console.log('No clients found for tenant. Nothing to delete.');
      return;
    }

    // Null out references in related tables to avoid FK issues
    const [leadUpdate, oppUpdate] = await prisma.$transaction([
      prisma.lead.updateMany({
        where: { tenantId: tenant.id, clientId: { in: clientIds } },
        data: { clientId: null },
      }),
      prisma.opportunity.updateMany({
        where: { tenantId: tenant.id, clientId: { in: clientIds } },
        data: { clientId: null },
      }),
    ]);

    console.log(`Leads clientId nulled: ${leadUpdate.count}`);
    console.log(`Opportunities clientId nulled: ${oppUpdate.count}`);

    // Delete clients (contacts will cascade via onDelete: Cascade)
    const delClients = await prisma.client.deleteMany({ where: { tenantId: tenant.id } });
    console.log(`Clients deleted: ${delClients.count}`);

    console.log('Purge complete.');
  } catch (err) {
    console.error('Error during purge:', err);
    process.exitCode = 1;
  }
}

main();
