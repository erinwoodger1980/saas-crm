import { prisma } from './api/src/prisma';

async function migrateClientsFromLeads() {
  try {
    console.log('🔄 Migrating existing Leads to Client records...\n');
    
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`Found ${tenants.length} tenants\n`);
    
    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name}`);
      
      // Get all leads grouped by contactName
      const leads = await prisma.lead.findMany({
        where: {
          tenantId: tenant.id,
          contactName: { not: '' },
          clientId: null, // Only migrate leads that don't have a client yet
        },
        orderBy: { capturedAt: 'asc' },
      });
      
      console.log(`  Found ${leads.length} leads to process`);
      
      // Group leads by contactName
      const leadsByName = new Map<string, typeof leads>();
      for (const lead of leads) {
        const name = lead.contactName.trim();
        if (!leadsByName.has(name)) {
          leadsByName.set(name, []);
        }
        leadsByName.get(name)!.push(lead);
      }
      
      console.log(`  Grouped into ${leadsByName.size} unique clients`);
      
      let created = 0;
      let linked = 0;
      
      // Create a Client for each unique contactName
      for (const [name, clientLeads] of leadsByName.entries()) {
        try {
          // Get first non-null email
          const email = clientLeads.find(l => l.email)?.email || null;
          const phone = clientLeads.find(l => l.number)?.number || null;
          
          // Check if client already exists
          let client = await prisma.client.findFirst({
            where: {
              tenantId: tenant.id,
              name: name,
            }
          });
          
          if (!client) {
            // Create new client
            client = await prisma.client.create({
              data: {
                tenantId: tenant.id,
                name: name,
                email: email,
                phone: phone,
                createdAt: clientLeads[0].capturedAt,
              }
            });
            created++;
            console.log(`    ✨ Created client: ${name}`);
          }
          
          // Link all leads to this client
          for (const lead of clientLeads) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { clientId: client.id }
            });
            linked++;
          }
          
          // Link all opportunities for these leads to the client
          const opportunities = await prisma.opportunity.findMany({
            where: {
              leadId: { in: clientLeads.map(l => l.id) },
              clientId: null,
            }
          });
          
          for (const opp of opportunities) {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: { clientId: client.id }
            });
          }
          
        } catch (error) {
          console.error(`    ❌ Error processing ${name}:`, error);
        }
      }
      
      console.log(`  ✅ Created ${created} new clients, linked ${linked} leads`);
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    
    // Show summary
    const clientCount = await prisma.client.count();
    const leadsWithClient = await prisma.lead.count({ where: { clientId: { not: null } } });
    const oppsWithClient = await prisma.opportunity.count({ where: { clientId: { not: null } } });
    
    console.log('📊 Summary:');
    console.log(`   Total Clients: ${clientCount}`);
    console.log(`   Leads linked to Clients: ${leadsWithClient}`);
    console.log(`   Opportunities linked to Clients: ${oppsWithClient}\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateClientsFromLeads()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
