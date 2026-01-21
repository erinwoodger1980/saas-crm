const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  try {
    const pwd = 'secret12';
    const hash = await bcrypt.hash(pwd, 10);
    const res = await prisma.user.updateMany({
      where: { email: { contains: 'erin@acme.test', mode: 'insensitive' } },
      data: { passwordHash: hash }
    });
    console.log('updatedCount:', res.count);
  } catch (e) {
    console.error('error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
