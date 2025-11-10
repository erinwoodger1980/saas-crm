// api/src/routes/early-access.ts
import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";

const router = Router();
const JWT_SECRET = env.APP_JWT_SECRET;
const COOKIE_NAME = "jauth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProd = process.env.NODE_ENV === "production";
const cookieDomain = isProd ? ".joineryai.app" : undefined;

// Helper to generate unique tenant slug
async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let suffix = 0;
  let finalSlug = slug;
  
  while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
    suffix++;
    finalSlug = `${slug}-${suffix}`;
  }
  
  return finalSlug;
}

/**
 * POST /api/early-access/signup
 * Early adopter signup with 30-day free trial
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, company, name } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (!company || typeof company !== "string") {
      return res.status(400).json({ error: "Company name is required" });
    }

    const normalizedEmail = normalizeEmail(email) || email;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Create tenant with 30-day trial
    const tenantName = company;
    const slug = await generateUniqueSlug(tenantName);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        trialEndsAt,
        subscriptionStatus: "trialing",
      },
    });

    console.log(`✅ Created early adopter tenant: ${tenant.name} (${tenant.id}) - Trial ends: ${trialEndsAt.toISOString()}`);

    // Initialize tenant with Wealden Joinery seed data
    try {
      const { initializeTenantWithSeedData } = await import('../services/seed-template');
      const seedResult = await initializeTenantWithSeedData(tenant.id);
      console.log(`✅ Initialized tenant ${tenant.id} with seed data:`, seedResult);
    } catch (error) {
      console.error(`⚠️  Failed to initialize tenant ${tenant.id} with seed data:`, error);
      // Don't fail the signup process if seed data fails
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: normalizedEmail,
        name: name || company,
        passwordHash,
        role: "owner",
        isEarlyAdopter: true,
      },
    });

    console.log(`✅ Created early adopter user: ${user.email} (${user.id})`);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: COOKIE_MAX_AGE,
      domain: cookieDomain,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        isEarlyAdopter: true,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        trialEndsAt: tenant.trialEndsAt,
      },
    });
  } catch (error: any) {
    console.error("Failed to create early adopter account:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

export default router;
