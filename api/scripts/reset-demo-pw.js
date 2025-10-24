const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
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
  }
})();
