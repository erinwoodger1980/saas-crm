import prisma from '../src/prisma';
import { execSync } from 'child_process';

const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: tsx scripts/find-and-import.ts <csv-path>');
  process.exit(1);
}

console.log('Finding LAJ Joinery tenant...');

prisma.tenant.findFirst({ 
  where: { 
    OR: [
      { name: { contains: 'LAJ', mode: 'insensitive' } },
      { name: { contains: 'Joinery', mode: 'insensitive' } }
    ]
  },
  select: { id: true, name: true } 
})
  .then(async (tenant) => {
    if (!tenant) {
      console.error('No LAJ Joinery tenant found!');
      const allTenants = await prisma.tenant.findMany({ select: { id: true, name: true }, take: 10 });
      console.log('\nAvailable tenants:');
      allTenants.forEach(t => console.log(`  ${t.name} (${t.id})`));
      process.exit(1);
    }
    
    console.log(`Found tenant: ${tenant.name} (${tenant.id})\n`);
    console.log('Starting import...\n');
    
    // Run the import script
    execSync(`pnpm tsx scripts/import-fire-door-bom.ts "${csvPath}" "${tenant.id}"`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
