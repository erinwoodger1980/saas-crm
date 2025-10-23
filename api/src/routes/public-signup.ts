// api/src/routes/public-signup.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";

const router = Router();

/* ---------------------- Env & Stripe setup ---------------------- */

function mustGet(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const STRIPE_SECRET_KEY = mustGet("STRIPE_SECRET_KEY");      // sk_test_...
const PRICE_MONTHLY     = mustGet("STRIPE_PRICE_MONTHLY");   // price_...
const PRICE_ANNUAL      = mustGet("STRIPE_PRICE_ANNUAL");    // price_...
const APP_URL           = mustGet("APP_URL");                // e.g. https://joineryai.app

if (!/^https?:\/\//i.test(APP_URL)) {
  throw new Error(`APP_URL must be absolute (http/https). Got: ${APP_URL}`);
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
 *   password?: string,           // optional; we auto-generate if omitted
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
      tenant = await prisma.tenant.create({ data: { name: company } });
    }

    /* 2) Find-or-create Admin user */
    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash(
        password || Math.random().toString(36).slice(2),
        10
      );
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          role: "owner",
          passwordHash,
          name: `${company} Admin`,
        },
      });
    }

    /* 3) Short-lived JWT to finish setup after Stripe redirect */
    const setupToken = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

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
    const successUrl = `${APP_URL}/signup/thank-you?session_id={CHECKOUT_SESSION_ID}&setup_jwt=${encodeURIComponent(
      setupToken
    )}`;
    const cancelUrl = `${APP_URL}/signup`;

    console.log("[signup] using APP_URL =", APP_URL);
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
      metadata: {
        tenantId: tenant.id,
        userId: user.id,
        plan: planNorm,
        setup_jwt: setupToken, // <-- fallback path used by /public/checkout-session
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
router.get("/checkout-session", async (req, res) => {
  try {
    const id = String(req.query.session_id || "");
    if (!id) return say(res, 400, "missing session_id");

    const s = await stripe.checkout.sessions.retrieve(id, { expand: ["customer"] });
    const setupJwt =
      (s.metadata as any)?.setup_jwt ||
      // defensive: if you ever copy this to customer metadata
      (s.customer && typeof s.customer === "object" && (s.customer as any).metadata?.setup_jwt) ||
      null;

    if (!setupJwt) return say(res, 404, "setup_jwt_not_found");
    return res.json({ setup_jwt: setupJwt });
  } catch (e: any) {
    console.error("[public/checkout-session] failed:", e?.message || e);
    return say(res, 500, "internal_error");
  }
});

export default router;