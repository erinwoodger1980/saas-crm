// api/src/server.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { env } from "./env";
import { prisma } from "./prisma";
import { normalizeEmail } from "./lib/email";

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
import tenantDeclineRouter from "./routes/tenant-decline-email";
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
import analyticsBusinessRouter from "./routes/analytics-business";
import quoteDefaultsRouter from "./routes/quote-defaults";
import questionnaireFillRouter from "./routes/questionnaire-fill";
import mlParseRouter from "./routes/ml-parse";
import mlInternalRouter from "./routes/ml-internal";
import gmailAttachmentsRouter from "./routes/gmail-attachments";
import mlSamples from "./routes/ml-samples";
import mlOpsRouter from "./routes/ml-ops";
import mlInsightsRouter from "./routes/ml-insights";
import featureFlagsRouter from "./routes/feature-flags";
import workshopRouter from "./routes/workshop";

/** ML proxy (→ forwards to FastAPI) */
import mlProxyRouter from "./routes/ml";
import feedbackRouter from "./routes/feedback";
import filesRouter from "./routes/files";
import tasksRouter from "./routes/tasks";
import eventsRouter from "./routes/events";
import notificationsRouter from "./routes/notifications";
import streaksRouter from "./routes/streaks";

const app = express();

/* ------------------------------------------------------
 * Core app setup
 * ---------------------------------------------------- */

// Allow ?jwt=<token> on attachment fetches (for ML server)
app.use((req, _res, next) => {
  const forAttachment =
    req.path.startsWith("/gmail/message/") && req.path.includes("/attachments/");
  if (!forAttachment) return next();

  if ((req as any).auth) return next();

  const qJwt = (req.query.jwt as string | undefined) || undefined;
  if (qJwt) {
    try {
      (req as any).auth = jwt.verify(qJwt, env.APP_JWT_SECRET);
    } catch {
      // ignore; request will 401 in the handler like normal
    }
  }
  next();
});

/** Trust proxy so Secure cookies work behind Render/Cloudflare */
app.set("trust proxy", 1);

/** ---------- CORS (allow localhost + prod, WITH cookies) ---------- */
const rawConfiguredOrigins =
  (Array.isArray((env as any).WEB_ORIGIN)
    ? (env as any).WEB_ORIGIN
    : String((env as any).WEB_ORIGIN || "")
  ) as string | string[];

const configuredOrigins = (Array.isArray(rawConfiguredOrigins)
  ? rawConfiguredOrigins
  : String(rawConfiguredOrigins)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
) as string[];

const defaultOrigins = [
  "https://joineryai.app",
  "https://www.joineryai.app",
  // Common subdomains for web/app/api separation
  "https://app.joineryai.app",
  "https://api.joineryai.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const allowedOriginsSet = new Set<string>([...defaultOrigins, ...configuredOrigins]);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / Postman
    const norm = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const match = [...allowedOriginsSet].some(
      (o) => o.replace(/^https?:\/\//, "").replace(/\/$/, "") === norm
    );
    if (match) return cb(null, true);

    // Allow any localhost origin when not in production (dev convenience)
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd && (norm.startsWith("localhost") || norm.startsWith("127.0.0.1"))) {
      return cb(null, true);
    }

    cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: true, // ✅ allow cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Tenant-Id",
    "X-User-Id",
    "X-Requested-With",
    "x-tenant-id",
    "x-user-id",
  ],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // preflight for all routes

/** ---------- Stripe webhook (raw body) BEFORE express.json() ---------- */
app.post("/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);

/** Parsers */
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

/** Quick probe to test CORS/headers from the browser */
app.get("/api-check", (req, res) => {
  res.json({
    ok: true,
    originReceived: req.headers.origin || null,
    allowList: [...allowedOriginsSet],
  });
});

/** ---------- Public (no auth required) ---------- */
app.use("/public", publicRouter);
/** public-signup exposes /public/signup and friends */
app.use("/public", publicSignupRouter);

/** ---------- JWT decode middleware (Authorization header OR cookies) ---------- */
app.use((req, _res, next) => {
  let token: string | null = null;

  // 1) Authorization: Bearer <token>
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) token = h.slice(7);

  // 2) Cookie: jauth=<token> (preferred)
  if (!token && (req as any).cookies?.jauth) {
    token = (req as any).cookies.jauth;
  }

  // 3) Legacy cookie name: jwt
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
    hasJwtCookie:
      !!(req as any).cookies?.jauth || !!(req.headers.cookie || "").match(/(?:^|;\s*)jwt=/),
  });
});

/** 🔎 Cookie sanity tester */
app.get("/__debug/set-test-cookie", (_req, res) => {
  res.cookie("jauth", "TEST", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    domain: ".joineryai.app",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  res.json({ ok: true });
});

/** Healthchecks */
app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/** Storage health: verifies UPLOAD_DIR exists and is writable */
app.get("/health/storage", (_req, res) => {
  const configured = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);

  let exists = false;
  let writable = false;
  let testFileOk = false;
  let error: string | null = null;

  try {
    // Ensure directory exists
    fs.mkdirSync(resolved, { recursive: true });
    exists = fs.existsSync(resolved);
    try {
      fs.accessSync(resolved, fs.constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }

    if (writable) {
      try {
        const probe = path.join(resolved, `.probe_${Date.now()}.tmp`);
        fs.writeFileSync(probe, "ok");
        fs.unlinkSync(probe);
        testFileOk = true;
      } catch (e: any) {
        error = e?.message || String(e);
      }
    }
  } catch (e: any) {
    error = e?.message || String(e);
  }

  res.json({
    ok: exists && (writable || testFileOk),
    uploadDir: configured,
    resolved,
    exists,
    writable,
    testFileOk,
    error,
  });
});

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
  const normalizedDemoEmail = normalizeEmail(demoEmail) || demoEmail;
  let user = await prisma.user.findFirst({
    where: { email: { equals: normalizedDemoEmail, mode: "insensitive" } },
  });
  if (!user) {
    const passwordHash = await bcrypt.hash("secret12", 10);
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: normalizedDemoEmail,
        name: "Wealden Joinery",
        role: "owner",
        passwordHash,
        isEarlyAdopter: true,
      },
    });
  } else {
    const nextName = !user.name || user.name === "Demo User" ? "Wealden Joinery" : user.name;
    if (user.name !== nextName || !user.isEarlyAdopter) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: nextName,
          isEarlyAdopter: true,
        },
      });
    }
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
    res.json({ ...out, token: jwtToken, jwt: jwtToken });
  } catch (err: any) {
    console.error("[seed] failed:", err);
    res.status(500).json({ error: err?.message ?? "seed failed" });
  }
});

/** Dev login (local only) */
app.post("/auth/dev-login", async (req, res) => {
  try {
    const requestedEmail = normalizeEmail((req.body || {}).email);
    const email = requestedEmail || "erin@acme.test";
    const tenant = await prisma.tenant.findFirst({ where: { name: "Demo Tenant" } });
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

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

    return res.json({ token, jwt: token });
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
app.use("/analytics/business", requireAuth, analyticsBusinessRouter);
app.use("/tenant", requireAuth, tenantsRouter);
app.use("/tenants", requireAuth, tenantDeclineRouter);
app.use("/billing", billingRouter);
app.use("/quotes", quotesRouter);
app.use("/auth/setup", authSetupRouter);
app.use("/analytics/dashboard", requireAuth, analyticsDashboardRouter);
app.use("/quote-defaults", requireAuth, quoteDefaultsRouter);
app.use("/questionnaire/fill", requireAuth, questionnaireFillRouter);
app.use("/internal/ml", requireAuth, mlInternalRouter);
app.use("/gmail", gmailAttachmentsRouter);
app.use("/internal/ml", requireAuth, mlOpsRouter);
// Move ML insights under a distinct prefix so it doesn't intercept /ml proxy routes
// This avoids accidental 401s for public ML health/proxy endpoints like /ml/health and /ml/parse-quote.
app.use("/ml/insights", requireAuth, mlInsightsRouter);
app.use("/feature-flags", featureFlagsRouter);
app.use("/feedback", feedbackRouter);
app.use("/files", filesRouter);
app.use("/tasks", tasksRouter);
app.use("/events", eventsRouter);
app.use("/notifications", notificationsRouter);
app.use("/streaks", streaksRouter);
app.use("/workshop", requireAuth, workshopRouter);

/** ---------- Auth required from here ---------- */
app.use((req, _res, next) => {
  next();
});

/** ---------- ML parse + proxy (public endpoints used by server-side flows) ---------- */
app.use("/ml", mlParseRouter);

/** ---------- ML proxy (forwards to FastAPI) - requires auth ---------- */
app.use("/ml", requireAuth, mlProxyRouter);

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
  // Log storage config
  const configuredUpload = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const resolvedUpload = path.isAbsolute(configuredUpload)
    ? configuredUpload
    : path.join(process.cwd(), configuredUpload);
  try { fs.mkdirSync(resolvedUpload, { recursive: true }); } catch {}
  let writable = true;
  try { fs.accessSync(resolvedUpload, fs.constants.W_OK); } catch { writable = false; }
  console.log(`[storage] UPLOAD_DIR -> ${resolvedUpload} (writable=${writable})`);
  const mlEnv = ((process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "").trim());
  if (!mlEnv) {
    console.warn("[ml] ML_URL not set; ML proxy will default to http://localhost:8000 (dev only)");
  } else if (process.env.NODE_ENV === "production" && /(localhost|127\.0\.0\.1)/i.test(mlEnv)) {
    console.warn(`[ml] ML_URL is '${mlEnv}' which points to localhost in production — update your API env to the deployed ML service URL.`);
  } else {
    console.log(`[ml] ML proxy target: ${mlEnv}`);
  }
});