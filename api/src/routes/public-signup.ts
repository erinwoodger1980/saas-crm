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

const STRIPE_SECRET_KEY = mustGet("STRIPE_SECRET_KEY");          // sk_test_...
const PRICE_MONTHLY = mustGet("STRIPE_PRICE_MONTHLY");           // price_...
const PRICE_ANNUAL  = mustGet("STRIPE_PRICE_ANNUAL");            // price_...
const APP_URL       = mustGet("APP_URL");                        // https://joineryai.app
if (!/^https?:\/\//i.test(APP_URL)) {
  throw new Error(`APP_URL must be absolute (http/https). Got: ${APP_URL}`);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

/**
 * POST /public/signup
 * body: { company: string, email: string, password?: string, plan: "monthly"|"annual", promotionCode?: string }
 */
router.post("/signup", async (req, res) => {
  // Quick flag to show real error messages in prod when VERBOSE_ERRORS=1
  const VERBOSE = process.env.VERBOSE_ERRORS === "1" || process.env.NODE_ENV !== "production";
  const say = (status: number, error: string, extra?: any) =>
    res.status(status).json(VERBOSE ? { error, ...extra } : { error: "internal_error" });

  try {
    const { company, email, password, plan, promotionCode } = req.body || {};
    if (!company || !email || !plan) {
      return res.status(400).json({ error: "company, email and plan are required" });
    }

    const planNorm = String(plan).toLowerCase();
    if (planNorm !== "monthly" && planNorm !== "annual") {
      return res.status(400).json({ error: "invalid_plan", detail: plan });
    }

    // 1) Find-or-create Tenant + Admin user (idempotent for retries)
    let tenant = await prisma.tenant.findFirst({ where: { name: company } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: company } });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          role: "owner",
          passwordHash,
          name: company + " Admin",
        },
      });
    }

    // 2) Short-lived JWT for setup wizard after success redirect
    const setupToken = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

    // 3) Stripe Customer (re-use if exists)
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

    // 4) Resolve price
    const priceId = planNorm === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;

    // 5) (Optional) founders / promo code → promotion_code id
    const founders = (process.env.FOUNDERS_PROMO_CODE || "").trim();
    const promoInput = (promotionCode || founders || "").trim() || undefined;

    let promotionCodeId: string | null = null;
    if (promoInput) {
      try {
        const list = await stripe.promotionCodes.list({ code: promoInput, active: true, limit: 1 });
        promotionCodeId = list.data[0]?.id ?? null;
        if (!promotionCodeId && VERBOSE) {
          console.warn(`[public/signup] promo code not found or inactive: "${promoInput}"`);
        }
      } catch (e: any) {
        // Don’t block signup if promo lookup fails—just allow user to enter it on Stripe
        console.warn("[public/signup] promo lookup failed:", e?.message || e);
      }
    }

    // 6) Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenantId: tenant.id, userId: user.id },
      },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      success_url: `${APP_URL}/signup/thank-you?session_id={CHECKOUT_SESSION_ID}&setup_jwt=${encodeURIComponent(setupToken)}`,
      cancel_url: `${APP_URL}/signup`,
      metadata: { tenantId: tenant.id, userId: user.id, plan: planNorm },
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    console.error("[public/signup] failed:", e);
    const msg = e?.raw?.message || e?.message || "internal_error";
    const code = e?.code || e?.raw?.code;
    return res.status(500).json(
      process.env.VERBOSE_ERRORS === "1" || process.env.NODE_ENV !== "production"
        ? { error: msg, code }
        : { error: "internal_error" }
    );
  }
});

export default router;