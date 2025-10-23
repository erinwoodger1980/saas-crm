// api/src/routes/billing.ts
import express, { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { normalizeEmail } from "../lib/email";
import { generateSignupToken, signupTokenExpiresAt } from "../lib/crypto";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/* ---------- helpers ---------- */
async function resolvePromotionCodeId(codeOrId?: string | null): Promise<string | null> {
  if (!codeOrId) return null;
  if (codeOrId.startsWith("promo_")) return codeOrId; // already an ID
  const list = await stripe.promotionCodes.list({ code: codeOrId, active: true, limit: 1 });
  return list.data[0]?.id ?? null;
}

/* ---------- routes ---------- */
/**
 * POST /billing/checkout
 * body: { plan: "monthly" | "annual", promotionCode?: string }
 * Requires req.auth.tenantId
 */

// GET /billing/status  -> current tenant’s subscription snapshot
router.get("/status", async (req: any, res) => {
  const tenantId = req.auth?.tenantId as string | undefined;
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      subscriptionStatus: true,
      plan: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      discountCodeUsed: true,
    },
  });

  if (!t) return res.status(404).json({ error: "tenant_not_found" });
  res.json(t);
});

router.post("/checkout", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { plan, promotionCode } = req.body || {};
    const priceId =
      plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) return res.status(400).json({ error: "missing_price_id" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, stripeCustomerId: true },
    });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    let customerId = tenant.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId },
      });
      customerId = customer.id;
      await prisma.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customerId } });
    }

    // founders fallback if none provided
    const founders = process.env.FOUNDERS_PROMO_CODE;
    const promoInput = (promotionCode || founders || "").trim() || undefined;
    const promotionCodeId = promoInput ? await resolvePromotionCodeId(promoInput) : null;

    // Build params conditionally to avoid the Stripe error
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId!,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      success_url: `${process.env.APP_URL}/billing/success`,
      cancel_url: `${process.env.APP_URL}/billing/cancel`,
    };

    if (promotionCodeId) {
      // We are applying a code ourselves → DO NOT include allow_promotion_codes
      params.discounts = [{ promotion_code: promotionCodeId }];
    } else {
      // We are not applying a code → allow customer to enter one at checkout
      params.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(params);
    res.json({ url: session.url });
  } catch (e: any) {
    console.error("[billing/checkout]", e);
    const msg = e?.raw?.message || e?.message || "internal_error";
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? "internal_error" : msg });
  }
});

/**
 * Stripe webhook — mounted with express.raw() in server.ts
 */
export const webhook = async (req: express.Request, res: express.Response) => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer, // express.raw()
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const session = await stripe.checkout.sessions.retrieve(cs.id, { expand: ["customer"] });

        const metadata = (session.metadata || {}) as Record<string, unknown>;
        const metadataTenantId = typeof metadata.tenantId === "string" ? metadata.tenantId : undefined;
        const metadataUserId = typeof metadata.userId === "string" ? metadata.userId : undefined;
        const metadataCompany = typeof metadata.company === "string" ? metadata.company : undefined;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer && typeof session.customer === "object"
            ? (session.customer as Stripe.Customer).id
            : null;

        const emailCandidate =
          metadata.email ||
          session.customer_details?.email ||
          session.customer_email ||
          (session.customer && typeof session.customer === "object"
            ? (session.customer as Stripe.Customer).email
            : undefined);

        const customerEmail = normalizeEmail(emailCandidate);

        let tenant = metadataTenantId
          ? await prisma.tenant.findUnique({ where: { id: metadataTenantId } })
          : null;

        if (!tenant && metadataCompany) {
          tenant = await prisma.tenant.findFirst({ where: { name: metadataCompany } });
        }

        if (!tenant && customerId) {
          tenant = await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
        }

        if (!tenant) {
          tenant = await prisma.tenant.create({
            data: {
              name: metadataCompany || customerEmail || `Tenant ${cs.id}`,
              stripeCustomerId: customerId || undefined,
            },
          });
        } else if (customerId && tenant.stripeCustomerId !== customerId) {
          tenant = await prisma.tenant.update({
            where: { id: tenant.id },
            data: { stripeCustomerId: customerId },
          });
        }

        let user = metadataUserId
          ? await prisma.user.findUnique({ where: { id: metadataUserId } })
          : null;

        if (!user && customerEmail) {
          user = await prisma.user.findFirst({
            where: { email: { equals: customerEmail, mode: "insensitive" } },
          });
        }

        if (!user && customerEmail) {
          user = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email: customerEmail,
              role: "owner",
              passwordHash: null,
              signupCompleted: false,
              name: metadataCompany ? `${metadataCompany} Admin` : null,
            },
          });
        }

        if (user && user.tenantId !== tenant.id) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { tenantId: tenant.id },
          });
        }

        if (user && !user.signupCompleted) {
          const existingToken = await prisma.signupToken.findFirst({
            where: {
              userId: user.id,
              consumedAt: null,
              expiresAt: { gt: new Date() },
            },
          });
          if (!existingToken) {
            const token = generateSignupToken();
            await prisma.signupToken.deleteMany({ where: { userId: user.id } });
            await prisma.signupToken.create({
              data: {
                userId: user.id,
                token,
                expiresAt: signupTokenExpiresAt(),
              },
            });
          }
        }

        const discountId =
          (session.total_details as any)?.breakdown?.discounts?.[0]?.discount?.id ?? null;

        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: "trialing",
              discountCodeUsed: discountId,
            },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const metaTenantId = (sub.metadata as any)?.tenantId as string | undefined;

        const data = {
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status as any,
          plan:
            sub.items.data[0]?.price?.id === process.env.STRIPE_PRICE_ANNUAL
              ? ("annual" as any)
              : ("monthly" as any),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        };

        if (metaTenantId) {
          // update this specific tenant directly
          await prisma.tenant.update({
            where: { id: metaTenantId },
            data,
          });
        } else {
          // fallback: update by Stripe customer id (legacy/older tenants)
          await prisma.tenant.updateMany({
            where: { stripeCustomerId: customerId },
            data,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const metaTenantId = (sub.metadata as any)?.tenantId as string | undefined;

        if (metaTenantId) {
          await prisma.tenant.update({
            where: { id: metaTenantId },
            data: { subscriptionStatus: "canceled" },
          });
        } else {
          await prisma.tenant.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: "canceled" },
          });
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook]", e?.message || e);
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
};
export default router;
