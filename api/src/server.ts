import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fetch from "node-fetch";
import { env } from "./env";
import { prisma } from "./prisma";

/* Routers */
import authRouter from "./routes/auth";
import aiRouter from "./routes/ai";
import reportsRouter from "./routes/reports";
import leadsRouter from "./routes/leads";
import mailRouter from "./routes/mail";
import gmailRouter from "./routes/gmail";
import leadsAiRouter from "./routes/leads-ai";
import ms365Router from "./routes/ms365";
import tenantsRouter from "./routes/tenants";
import publicRouter from "./routes/public";
import aiFollowupRouter from "./routes/ai-followup";
import opportunitiesRouter from "./routes/opportunities";
import settingsInboxRouter from "./routes/settings-inbox";
import sourceCostsRouter from "./routes/source-costs";
import analyticsRouter from "./routes/analytics";
import billingRouter, { webhook as stripeWebhook } from "./routes/billing";
import quotesRouter from "./routes/quotes";
import publicSignupRouter from "./routes/public-signup";
import authSetupRouter from "./routes/auth-setup";
import analyticsDashboardRouter from "./routes/analytics-dashboard";

/** ML proxy (→ forwards to FastAPI) */
import mlProxyRouter from "./routes/ml";

const app = express();

/* ------------------------------------------------------
 * Core app setup
 * ---------------------------------------------------- */
app.set("trust proxy", 1);

/** ---------- CORS (allow cookies + Authorization header) ---------- */
const ORIGINS_RAW =
  process.env.WEB_ORIGIN || process.env.ALLOWED_ORIGINS || "http://localhost:3000";

const ALLOWED_ORIGINS = ORIGINS_RAW.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin or server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // Loose host match (helps with http/https discrepancies)
    const host = origin.replace(/^https?:\/\//, "");
    if (ALLOWED_ORIGINS.some((o) => o.includes(host))) return cb(null, true);

    cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // preflight for all routes

/** ---------- Stripe webhook (raw body) BEFORE express.json() ---------- */
app.post("/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);

/** JSON parser comes after potential raw webhook route */
app.use(express.json({ limit: "2mb" }));

/** Quick probe to test CORS/headers from the browser */
app.get("/api-check", (req, res) => {
  res.json({
    ok: true,
    originReceived: req.headers.origin || null,
    allowList: ALLOWED_ORIGINS,
  });
});

/** ---------- Public (no auth required) ---------- */
app.use("/public", publicRouter);
/** public-signup exposes /public/signup and friends */
app.use("/public", publicSignupRouter);

/** ---------- ML proxy (no auth; read-only) ----------
 *  /ml/health and /ml/predict forward to your FastAPI service.
 *  Make sure ML_URL is set on Render (e.g. https://ml-web-tann.onrender.com)
 */
app.use("/ml", mlProxyRouter);

/** ---------- JWT decode middleware (Authorization header or jwt cookie) ---------- */
app.use((req, _res, next) => {
  let token: string | null = null;

  // Authorization: Bearer <token>
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) token = h.slice(7);

  // Fallback: jwt cookie
  if (!token && req.headers.cookie) {
    const m = req.headers.cookie.match(/(?:^|;\s*)jwt=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }

  if (token) {
    try {
      (req as any).auth = jwt.verify(token, env.APP_JWT_SECRET);
    } catch {
      console.warn("[auth] invalid or expired JWT");
    }
  }
  next();
});

/* ------------------ Debug helpers (safe to keep) ------------------ */
app.use((req, _res, next) => {
  (req as any).__rawAuthHeader = req.headers.authorization || "";
  next();
});

app.get("/__debug/token", (req, res) => {
  const raw: string = (req as any).__rawAuthHeader || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;

  let verified: any = null;
  let verifyError: string | null = null;

  if (token) {
    try {
      verified = jwt.verify(token, env.APP_JWT_SECRET);
    } catch (e: any) {
      verifyError = e?.message || String(e);
    }
  } else {
    verifyError = "no Authorization: Bearer <token> header";
  }

  res.json({
    receivedAuthHeader: !!raw,
    tokenPreview: token ? token.slice(0, 20) + "…" : null,
    usingSecretPreview: (env.APP_JWT_SECRET || "").slice(0, 6) + "…",
    verifyError,
    verified,
  });
});

app.get("/__debug/whoami", (req, res) => {
  res.json({
    auth: (req as any).auth ?? null,
    sawAuthHeader: !!req.headers.authorization,
    hasJwtCookie: !!(req.headers.cookie || "").match(/(?:^|;\s*)jwt=/),
  });
});

/** Healthcheck */
app.get("/healthz", (_req, res) => res.send("ok"));

/** Small auth guard for protected routers */
function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/* ---------------- Dev bootstrap (idempotent) ---------------- */
async function ensureDevData() {
  let tenant = await prisma.tenant.findFirst({ where: { name: "Demo Tenant" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: "Demo Tenant" } });
  }

  const demoEmail = "erin@acme.test";
  let user = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!user) {
    const passwordHash = await bcrypt.hash("secret12", 10);
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: demoEmail,
        name: "Demo User",
        role: "owner",
        passwordHash,
      },
    });
  }

  return { tenant, user };
}

if (process.env.NODE_ENV !== "production") {
  ensureDevData()
    .then(({ user }) => console.log(`[dev] bootstrap ready for ${user.email}`))
    .catch((e) => console.error("[dev] bootstrap failed:", e));
}

/** Dev seed endpoint */
app.post("/seed", async (_req, res) => {
  try {
    const out = await ensureDevData();
    const jwtToken = jwt.sign(
      { userId: out.user.id, tenantId: out.tenant.id, email: out.user.email },
      env.APP_JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({ ...out, jwt: jwtToken });
  } catch (err: any) {
    console.error("[seed] failed:", err);
    res.status(500).json({ error: err?.message ?? "seed failed" });
  }
});

/** Dev login (local only) */
app.post("/auth/dev-login", async (req, res) => {
  try {
    const email = req.body.email || "erin@acme.test";
    const tenant = await prisma.tenant.findFirst({ where: { name: "Demo Tenant" } });
    const user = await prisma.user.findUnique({ where: { email } });

    if (!tenant || !user) {
      return res.status(404).json({ error: "demo tenant or user not found" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
      },
      env.APP_JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ token });
  } catch (err: any) {
    console.error("[dev-login] failed:", err);
    res.status(500).json({ error: err?.message || "dev-login failed" });
  }
});

/* ---------------- Protected Routers ---------------- */
app.use("/auth", authRouter);
app.use("/leads", leadsRouter);
app.use("/ai", aiRouter);
app.use("/reports", reportsRouter);
app.use("/mail", mailRouter);
app.use("/gmail", gmailRouter);
app.use("/leads/ai", leadsAiRouter);
app.use("/ms365", ms365Router);
app.use("/ai/followup", aiFollowupRouter);
app.use("/opportunities", opportunitiesRouter);
app.use("/settings/inbox", requireAuth, settingsInboxRouter);
app.use("/source-costs", requireAuth, sourceCostsRouter);
app.use("/analytics", requireAuth, analyticsRouter);
app.use("/tenant", requireAuth, tenantsRouter);
app.use("/billing", billingRouter);
app.use("/quotes", quotesRouter);
app.use("/auth/setup", authSetupRouter);
app.use("/analytics/dashboard", requireAuth, analyticsDashboardRouter);

/** DB Debug */
app.get("/__debug/db", async (_req, res) => {
  const url = process.env.DATABASE_URL || "";
  const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@");

  try {
    const rows = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    res.json({ databaseUrl: masked, tables: rows.map((r) => r.table_name) });
  } catch (e: any) {
    res.status(500).json({ databaseUrl: masked, error: e?.message || String(e) });
  }
});

/* ---------------- Background Inbox Watcher ---------------- */
function signSystemToken(tenantId: string) {
  return jwt.sign(
    { tenantId, userId: "system", email: "system@local" },
    env.APP_JWT_SECRET,
    { expiresIn: "5m" }
  );
}

function startInboxWatcher() {
  const API_ORIGIN = `http://localhost:${env.PORT}`;
  let busy = false;

  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const all = await prisma.tenantSettings.findMany({
        where: {
          OR: [
            { inbox: { path: ["gmail"], equals: true } },
            { inbox: { path: ["ms365"], equals: true } },
          ],
        },
        select: { tenantId: true, inbox: true },
      });

      const now = Date.now();
      for (const s of all) {
        const inbox = (s.inbox as any) || {};
        const intervalMin = Math.max(2, Number(inbox.intervalMinutes) || 10);
        const shouldRun = Math.floor(now / 60000) % intervalMin === 0;
        if (!shouldRun) continue;

        const token = signSystemToken(s.tenantId);
        const common = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        } as const;

        if (inbox.gmail) {
          try {
            await fetch(`${API_ORIGIN}/gmail/import`, {
              ...common,
              body: JSON.stringify({ max: 25, q: "newer_than:30d" }),
            } as any);

            await fetch(`${API_ORIGIN}/opportunities/reconcile-replies`, {
              ...common,
              method: "POST",
            } as any);
          } catch {}
        }

        if (inbox.ms365) {
          try {
            await fetch(`${API_ORIGIN}/ms365/import`, {
              ...common,
              body: JSON.stringify({ max: 25 }),
            } as any);

            await fetch(`${API_ORIGIN}/opportunities/reconcile-replies`, {
              ...common,
              method: "POST",
            } as any);
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[inbox watcher] tick failed:", (e as any)?.message || e);
    } finally {
      busy = false;
    }
  }, 60_000);
}

startInboxWatcher();

/* ---------------- 404 + Error handlers ---------------- */
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

/** Start server */
app.listen(env.PORT, () => {
  console.log(`API running at http://localhost:${env.PORT}`);
});