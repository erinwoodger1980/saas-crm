// api/src/routes/public-signup.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

/* ------------ Env validation (once) ------------ */
function mustGet(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const STRIPE_SECRET_KEY = mustGet("STRIPE_SECRET_KEY");      // sk_test_... or sk_live_...
const PRICE_MONTHLY     = mustGet("STRIPE_PRICE_MONTHLY");   // price_...
const PRICE_ANNUAL      = mustGet("STRIPE_PRICE_ANNUAL");    // price_...
const APP_URL           = mustGet("APP_URL");                // e.g. https://joineryai.app

if (!/^https?:\/\//i.test(APP_URL)) {
  throw new Error(`APP_URL must be absolute (http/https). Got: ${APP_URL}`);
}

// Note: omit apiVersion to use the SDK’s pinned version (avoids TS literal mismatch)
const stripe = new Stripe(STRIPE_SECRET_KEY);

/**
 * POST /public/signup
 * body: { company: string, email: string, password?: string, plan: "monthly"|"annual", promotionCode?: string }
 */
router.post("/signup", async (req, res) => {
  // Make errors readable while debugging. Set VERBOSE_ERRORS=1 in Render to keep this in prod.
  const VERBOSE = process.env.VERBOSE_ERRORS === "1" || process.env.NODE_ENV !== "production";
  const say = (status: number, error: string, extra?: any) =>
    res.status(status).json(VERBOSE ? { error, ...extra } : { error: "internal_error" });

  try {
    const { company, email, password, plan, promotionCode } = req.body || {};

    if (!company || !email || !plan) {
      return say(400, "company, email and plan are required");
    }
    const planNorm = String(plan).toLowerCase();
    if (planNorm !== "monthly" && planNorm !== "annual") {
      return say(400, "invalid_plan", { plan });
    }

    /* ---------- 1) Find-or-create Tenant ---------- */
    let tenant = await prisma.tenant.findFirst({ where: { name: company } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: company } });
    }

    /* ---------- 2) Find-or-create Admin User ---------- */
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          role: "owner",
          passwordHash,
          name: `${company} Admin`,
        },
      });
    }

    /* ---------- 3) Short-lived JWT for setup after success ---------- */
    const setupToken = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

    /* ---------- 4) Ensure Stripe Customer (reuse if present) ---------- */
    let customerId = tenant.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: company,
        metadata: { tenantId: tenant.id, userId: user.id },
      });
      customerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }

    /* ---------- 5) Resolve & preflight Price (fast fail on mismatch) ---------- */
    const priceId = planNorm === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price?.id) return say(500, "stripe_price_lookup_failed", { priceId, message: "no id returned" });
      if (!price.active) return say(500, "price_inactive", { priceId });
    } catch (e: any) {
      return say(500, "stripe_price_lookup_failed", {
        priceId,
        message: e?.message || String(e),
      });
    }

    /* ---------- 6) Optional promotion code (non-fatal if not found) ---------- */
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

    /* ---------- 7) Stripe Checkout Session ---------- */
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
      success_url: `${APP_URL}/signup/thank-you?session_id={CHECKOUT_SESSION_ID}&setup_jwt=${encodeURIComponent(
        setupToken
      )}`,
      cancel_url: `${APP_URL}/signup`,
      metadata: { tenantId: tenant.id, userId: user.id, plan: planNorm },
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    console.error("[public/signup] failed:", e);
    const msg = e?.raw?.message || e?.message || "internal_error";
    const code = e?.code || e?.raw?.code;
    return res.status(500).json(VERBOSE ? { error: msg, code } : { error: "internal_error" });
  }
});

export default router;