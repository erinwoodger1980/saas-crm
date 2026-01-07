import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function findTenant() {
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { name: { contains: 'laj', mode: 'insensitive' }},
        { name: { contains: 'joinery', mode: 'insensitive' }}
      ]
    },
    select: { id: true, name: true }
  });
  
  console.log(JSON.stringify(tenants, null, 2));
  await prisma.$disconnect();
}

findTenant();
