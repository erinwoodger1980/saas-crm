// api/src/routes/public-signup.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { normalizeEmail } from "../lib/email";

const router = Router();

/* ---------------------- Env & Stripe setup ---------------------- */

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

function mustGet(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const STRIPE_SECRET_KEY = mustGet("STRIPE_SECRET_KEY"); // sk_test_...
const PRICE_MONTHLY = mustGet("STRIPE_PRICE_MONTHLY"); // price_...
const PRICE_ANNUAL = mustGet("STRIPE_PRICE_ANNUAL"); // price_...
const WEB_ORIGIN = mustGet("WEB_ORIGIN"); // e.g. https://www.joineryai.app

if (!/^https?:\/\//i.test(WEB_ORIGIN)) {
  throw new Error(`WEB_ORIGIN must be absolute (http/https). Got: ${WEB_ORIGIN}`);
}

// use SDK’s pinned version (don’t pass apiVersion literal to avoid TS churn)
const stripe = new Stripe(STRIPE_SECRET_KEY);

const VERBOSE =
  process.env.VERBOSE_ERRORS === "1" || process.env.NODE_ENV !== "production";
const say = (res: any, status: number, error: string, extra?: any) =>
  res.status(status).json(VERBOSE ? { error, ...extra } : { error: "internal_error" });

/* ---------------------- POST /public/signup ---------------------- */
/**
 * body: {
 *   company: string,
 *   email: string,
 *   password?: string,           // optional; if provided we complete signup immediately
 *   plan: "monthly" | "annual",
 *   promotionCode?: string       // optional code users may have
 * }
 *
 * Returns: { url: string }  → Stripe Checkout redirect URL
 */
router.post("/signup", async (req, res) => {
  try {
    const { company, email, password, plan, promotionCode } = (req.body || {}) as {
      company?: string;
      email?: unknown;
      password?: string;
      plan?: string;
      promotionCode?: string;
    };

    const normalizedEmail = normalizeEmail(email);

    if (!company || !normalizedEmail || !plan) {
      return say(res, 400, "company, email and plan are required");
    }

    const planNorm = String(plan).toLowerCase();
    if (planNorm !== "monthly" && planNorm !== "annual") {
      return say(res, 400, "invalid_plan", { plan });
    }

    /* 1) Find-or-create Tenant */
    let tenant = await prisma.tenant.findFirst({ where: { name: company } });
    if (!tenant) {
      const slug = await generateUniqueSlug(company);
      tenant = await prisma.tenant.create({ data: { name: company, slug } });

      // Initialize new tenant with seed template data
      try {
        const { initializeTenantWithSeedData } = await import('../services/seed-template');
        await initializeTenantWithSeedData(tenant.id);
        console.log(`✅ Initialized tenant ${tenant.id} with seed data`);
      } catch (error) {
        console.error(`⚠️  Failed to initialize tenant ${tenant.id} with seed data:`, error);
        // Don't fail the signup process if seed data fails
      }
    }

    /* 2) Find-or-create Admin user */
    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          role: "owner",
          passwordHash: password ? await bcrypt.hash(password, 10) : null,
          signupCompleted: Boolean(password),
          name: `${company} Admin`,
        },
      });
    }

    /* 4) Ensure Stripe Customer (re-use if present) */
    let customerId = tenant.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        name: company,
        metadata: { tenantId: tenant.id, userId: user.id },
      });
      customerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }

    /* 5) Resolve & preflight price */
    const priceId = planNorm === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price?.id) return say(res, 500, "stripe_price_lookup_failed", { priceId, reason: "no id" });
      if (!price.active) return say(res, 500, "price_inactive", { priceId });
    } catch (e: any) {
      return say(res, 500, "stripe_price_lookup_failed", {
        priceId,
        message: e?.message || String(e),
      });
    }

    /* 6) Optional promo code (non-fatal) */
    const founders = (process.env.FOUNDERS_PROMO_CODE || "").trim();
    const promoInput = (promotionCode || founders || "").trim() || undefined;

    let promotionCodeId: string | null = null;
    if (promoInput) {
      try {
        const list = await stripe.promotionCodes.list({ code: promoInput, active: true, limit: 1 });
        promotionCodeId = list.data[0]?.id ?? null;
        if (!promotionCodeId && VERBOSE) {
          console.warn(`[public/signup] promo not found or inactive: "${promoInput}"`);
        }
      } catch (e: any) {
        if (VERBOSE) console.warn("[public/signup] promo lookup failed:", e?.message || e);
      }
    }

    /* 7) Checkout Session — success URL includes setup_jwt AND we
          also store setup_jwt in metadata as a fallback for recovery */
    const successUrl = `${WEB_ORIGIN.replace(/\/+$/, "")}/signup/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${WEB_ORIGIN.replace(/\/+$/, "")}/signup/cancelled`;

    console.log("[signup] using WEB_ORIGIN =", WEB_ORIGIN);
    console.log("[signup] success_url:", successUrl, "cancel_url:", cancelUrl);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId!,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenantId: tenant.id, userId: user.id },
      },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        tenantId: tenant.id,
        userId: user.id,
        plan: planNorm,
        email: normalizedEmail,
        company,
      },
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    console.error("[public/signup] failed:", e);
    const msg = e?.raw?.message || e?.message || "internal_error";
    const code = e?.code || e?.raw?.code;
    return res
      .status(500)
      .json(VERBOSE ? { error: msg, code } : { error: "internal_error" });
  }
});

/* ---------------- GET /public/checkout-session ----------------- */
/**
 * Fallback to recover the setup_jwt if it wasn't carried in the URL.
 * Client calls: /public/checkout-session?session_id=cs_123
 * Returns: { setup_jwt: string }
 */
router.get("/checkout-session", (_req, res) => {
  return res
    .status(410)
    .json({ error: "deprecated", message: "Use /auth/issue-signup-token with session_id." });
});

export default router;