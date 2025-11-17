import { PrismaClient } from "@prisma/client";

const DATABASE_URL = "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function main() {
  const email = process.argv[2] || "erin@erinwoodger.com";
  
  console.log(`🔍 Checking user: ${email}`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isDeveloper: true,
      signupCompleted: true,
      passwordHash: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!user) {
    console.log(`❌ User ${email} not found`);
    return;
  }

  console.log(`✅ User found:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name || 'N/A'}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Developer: ${user.isDeveloper ? 'YES' : 'NO'}`);
  console.log(`   Signup Complete: ${user.signupCompleted ? 'YES' : 'NO'}`);
  console.log(`   Has Password: ${user.passwordHash ? 'YES' : 'NO'}`);
  console.log(`   Tenant: ${user.tenant.name} (${user.tenant.slug})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
