#!/usr/bin/env node
// Check if password reset token was created
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL },
  },
});

const EMAIL = process.argv[2] || 'erin@erinwoodger.com';

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: EMAIL.toLowerCase().trim() },
      select: { 
        id: true, 
        email: true, 
        name: true
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${EMAIL}`);
      process.exit(1);
    }

    console.log(`\n✅ User found: ${user.name} (${user.email})`);
    
    // Fetch password reset token separately
    const token = await prisma.passwordResetToken.findUnique({
      where: { userId: user.id }
    });
    
    if (token) {
      const isExpired = new Date(token.expiresAt) < new Date();
      
      console.log(`\n📧 Password Reset Token Status:`);
      console.log(`   Token: ${token.token.substring(0, 20)}...`);
      console.log(`   Created: ${new Date(token.createdAt).toLocaleString()}`);
      console.log(`   Expires: ${new Date(token.expiresAt).toLocaleString()}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
      
      if (!isExpired) {
        const resetUrl = `https://app.joineryai.app/reset-password?token=${token.token}`;
        console.log(`\n🔗 Manual Reset Link:\n   ${resetUrl}`);
        console.log(`\n💡 You can use this link directly since email wasn't sent.`);
      }
    } else {
      console.log(`\n⚠️  No password reset token found.`);
      console.log(`   This could mean:`);
      console.log(`   1. The forgot-password request failed`);
      console.log(`   2. The token has been used and deleted`);
      console.log(`   3. No request was made for this user`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
