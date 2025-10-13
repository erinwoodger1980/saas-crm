import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /public/signup
 * body: { company: string, email: string, password?: string, plan: "monthly"|"annual", promotionCode?: string }
 * Creates Tenant + Admin user, then returns a Stripe Checkout URL.
 */
router.post("/signup", async (req, res) => {
  try {
    const { company, email, password, plan, promotionCode } = req.body || {};
    if (!company || !email || !plan) {
      return res.status(400).json({ error: "company, email and plan are required" });
    }

    // 1) Create tenant + admin user
    const tenant = await prisma.tenant.create({
      data: { name: company },
    });

    const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        role: "owner",
        passwordHash,
        name: company + " Admin",
      },
    });

    // 2) Create short-lived JWT (for Setup Wizard after redirect)
    const setupToken = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

    // 3) Stripe Customer
    const customer = await stripe.customers.create({
      email,
      name: company,
      metadata: { tenantId: tenant.id, userId: user.id },
    });
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customer.id },
    });

    // 4) Resolve price + (optional) founders code -> promotion_code id
    const priceId =
      plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) return res.status(500).json({ error: "missing_price_id" });

    const founders = process.env.FOUNDERS_PROMO_CODE;
    const promoInput = (promotionCode || founders || "").trim() || undefined;

    let promotionCodeId: string | null = null;
    if (promoInput) {
      const list = await stripe.promotionCodes.list({ code: promoInput, active: true, limit: 1 });
      promotionCodeId = list.data[0]?.id ?? null;
    }

    const appUrl = (process.env.APP_URL || "").trim();
    if (!/^https?:\/\//i.test(appUrl)) {
      return res.status(500).json({ error: "APP_URL must be absolute (http/https)" });
    }

    // 5) Checkout Session (include tenant metadata for webhook)
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenantId: tenant.id, userId: user.id },
      },
      // allow or apply promo
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      success_url: `${appUrl}/billing/success?setup_jwt=${encodeURIComponent(setupToken)}`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { tenantId: tenant.id, userId: user.id }, // session-level metadata too
    };

    const session = await stripe.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (e: any) {
    console.error("[public/signup]", e);
    return res.status(500).json({ error: process.env.NODE_ENV === "production" ? "internal_error" : (e?.raw?.message || e?.message || "internal_error") });
  }
});

export default router;