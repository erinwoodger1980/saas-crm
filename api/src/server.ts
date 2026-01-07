// api/src/server.ts
import express from "express";
import type { Router } from "express";
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
import { startRecurringTaskProcessor } from "./services/recurring-task-processor";
import { initializeScheduler } from "./services/scheduler";

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

/* Routers */
import authRouter from "./routes/auth";
import aiRouter from "./routes/ai";
import aiAssistantRouter from "./routes/ai-assistant";
import aiComponentEstimatorRouter from "./routes/ai-component-estimator";
import reportsRouter from "./routes/reports";
import leadsRouter from "./routes/leads";
import clientsRouter from "./routes/clients";
import mailRouter from "./routes/mail";
import gmailRouter from "./routes/gmail";
import leadsAiRouter from "./routes/leads-ai";
import ms365Router from "./routes/ms365";
import tenantsRouter from "./routes/tenants";
import landingTenantsRouter from "./routes/landing-tenants";
import landingTenantsPublicRouter from "./routes/landing-tenants-public";
import adminLandingTenantsRouter from "./routes/admin-landing-tenants";
import adminImageUploadRouter from "./routes/admin-image-upload";
import tenantDeclineRouter from "./routes/tenant-decline-email";
import publicRouter from "./routes/public";
import aiFollowupRouter from "./routes/ai-followup";
import opportunitiesRouter from "./routes/opportunities";
import measurementsRouter from "./routes/measurements";
import settingsInboxRouter from "./routes/settings-inbox";
import sourceCostsRouter from "./routes/source-costs";
import analyticsRouter from "./routes/analytics";
import analyticsPublicRouter from "./routes/analytics-public";
import quotesRouter from "./routes/quotes";
import quotePricingRouter from "./routes/quote-pricing";
import authSetupRouter from "./routes/auth-setup";
import suppliersRouter from "./routes/suppliers";
import softwareProfilesRouter from "./routes/software-profiles";
import pdfTemplatesRouter from "./routes/pdf-templates";
import developersRouter from "./routes/developers";
import supplierQuoteRequestsRouter from "./routes/supplier-quote-requests";
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
import mlStatusRouter from "./routes/ml-status";
import mlTrainingUploadRouter from "./routes/ml-training-upload";
import featureFlagsRouter from "./routes/feature-flags";
import workshopRouter from "./routes/workshop";
import workshopProcessesRouter from "./routes/workshop-processes";
import timesheetsRouter from "./routes/timesheets";
import questionnaireResponsesRouter from "./routes/questionnaire-responses";
import questionnairePhotosRouter from "./routes/questionnaire-photos";
import fieldsRouter from "./routes/fields";
import questionsRouter from "./routes/questions";
import standardFieldMappingsRouter from "./routes/standard-field-mappings";
import flexibleFieldsRouter from "./routes/flexible-fields";

/** ML proxy (→ forwards to FastAPI) */
import mlProxyRouter from "./routes/ml";
import feedbackRouter from "./routes/feedback";
import filesRouter from "./routes/files";
import tasksRouter from "./routes/tasks";
import eventsRouter from "./routes/events";
import notificationsRouter from "./routes/notifications";
import streaksRouter from "./routes/streaks";
import followupsRouter from "./routes/followups";
import followUpRulesRouter from "./routes/follow-up-rules";
import marketingRoiRouter from "./routes/marketing-roi";
import interestRouter from "./routes/interest";
import earlyAccessRouter from "./routes/early-access";
import keywordsRouter from "./routes/keywords";
import aggregateReviewsRouter from "./routes/aggregate-reviews";
import webhooksRouter from "./routes/webhooks";
import adsRouter from "./routes/ads";
import featureRequestsRouter from "./routes/featureRequests";
import makeMeAdminRouter from "./routes/make-me-admin";
import codexRunRouter from "./routes/codexRun";
import aiLoopRouter from "./routes/ai/loop";
import devRouter from "./routes/dev";
import mlActualsRouter from "./routes/ml-actuals";
import purchaseOrderUploadRouter from "./routes/purchase-order-upload";
import automationRulesRouter from "./routes/automation-rules";
import automationFieldLinksRouter from "./routes/automation-field-links";
import estimatorAiRouter from "./routes/estimator-ai";
import quoteApprovalRouter from "./routes/quote-approval";
import schedulerRouter from "./routes/scheduler";
import mlTrainingRouter from "./routes/ml-training";
import examplePhotosRouter from "./routes/example-photos";
import fireDoorsRouter from "./routes/fire-doors";
import fireDoorScheduleRouter from "./routes/fire-door-schedule";
import adminLinkProjectsRouter from "./routes/admin-link-projects";
import fireDoorScheduleSyncRouter from "./routes/fire-door-schedule-sync";
import fireDoorImportBomRouter from "./routes/fire-door-import-bom";
import fireDoorImportTriggerRouter from "./routes/fire-door-import-trigger";
import fireDoorEnableRouter from "./routes/fire-door-enable";
import fireDoorProductionRouter from "./routes/fire-door-production";
import fireDoorLineItemLayoutRouter from "./routes/fire-door-line-item-layout";
import fireDoorQuotesRouter from "./routes/fire-door-quotes";
import publicFireDoorsRouter from "./routes/public-fire-doors";
import customerAuthRouter from "./routes/customer-auth";
import customerPortalRouter from "./routes/customer-portal";
import materialDebugRouter from "./routes/material-debug";
import monthlyGPRouter from "./routes/monthly-gp";
import doorCoresRouter from "./routes/door-cores";
import ironmongeryItemsRouter from "./routes/ironmongery-items";
import rfisRouter from "./routes/rfis";
import coachingRouter from "./routes/coaching";
import fireDoorQRRouter from "./routes/fire-door-qr";
import lookupRouter from "./routes/lookup";
import wealdenRouter from "./routes/wealden";
import lippingLookupRouter from "./routes/lipping-lookup";
import componentsRouter from "./routes/components";
import componentProcessesRouter from "./routes/component-processes";
import componentAttributesRouter from "./routes/component-attributes";
import componentVariantsRouter from "./routes/component-variants";
import productTypeComponentsRouter from "./routes/product-type-components";
import productTypesRouter from "./routes/product-types";
import materialsRouter from "./routes/materials";
import sceneStateRouter from "./routes/scene-state";
import assetsRouter from "./routes/assets";
import profilesRouter from "./routes/profiles";
import accountingSageRouter from "./routes/accounting-sage";
import fireDoorRfisRouter from "./routes/fire-door-rfis";
import fireDoorComponentsRouter from "./routes/fire-door-components";

type BillingModule = typeof import("./routes/billing");
type PublicSignupModule = typeof import("./routes/public-signup");

let billingRouter: Router | null = null;
let stripeWebhook: BillingModule["webhook"] | null = null;
let publicSignupRouter: Router | null = null;

if (env.BILLING_ENABLED) {
  const billingModule = require("./routes/billing") as BillingModule;
  billingRouter = billingModule.default;
  stripeWebhook = billingModule.webhook;

  const publicSignupModule = require("./routes/public-signup") as PublicSignupModule;
  publicSignupRouter = publicSignupModule.default;
} else {
  console.log("💳 Billing disabled; skipping billing/public signup routes");
}

const app = express();

/** Trust proxy so Secure cookies work behind Render/Cloudflare */
app.set("trust proxy", 1);

/** ---------- CORS - MUST BE FIRST ---------- */
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

console.log('[CORS] Allowed origins:', [...allowedOriginsSet]);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / Postman
    const norm = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const match = [...allowedOriginsSet].some(
      (o) => o.replace(/^https?:\/\//, "").replace(/\/$/, "") === norm
    );
    if (match) {
      console.log(`[CORS] ✅ Allowed origin: ${origin}`);
      return cb(null, true);
    }

    // Allow any localhost origin when not in production (dev convenience)
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd && (norm.startsWith("localhost") || norm.startsWith("127.0.0.1"))) {
      console.log(`[CORS] ✅ Allowed localhost origin: ${origin}`);
      return cb(null, true);
    }

    console.error(`[CORS] ❌ Rejected origin: ${origin}`, {
      allowedOrigins: [...allowedOriginsSet],
      normalized: norm,
      isProd
    });
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
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

// CORS: Apply BEFORE all routes and endpoints
app.use(cors(corsOptions));

// Safety net: Explicitly set CORS headers on all responses
app.use((req: any, res: any, next: any) => {
  const origin = req.get("origin");
  const isOptions = req.method === "OPTIONS";
  
  if (origin) {
    const norm = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const isAllowed = [...allowedOriginsSet].some(
      (o) => o.replace(/^https?:\/\//, "").replace(/\/$/, "") === norm
    );
    
    if (isAllowed) {
      // Set CORS headers on ALL responses (including OPTIONS)
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id, X-User-Id, X-Requested-With");
      res.setHeader("Access-Control-Max-Age", "86400");
      res.setHeader("Vary", "Origin");
      
      if (isOptions) {
        console.log(`[CORS] ✅ Preflight (OPTIONS) handled for origin: ${origin}`);
        return res.sendStatus(200);
      }
    } else {
      // Log rejections for debugging
      if (isOptions) {
        console.warn(`[CORS] ⚠️ Preflight (OPTIONS) rejected for origin: ${origin}`, {
          normalized: norm,
          allowed: [...allowedOriginsSet].map(o => o.replace(/^https?:\/\//, "").replace(/\/$/, ""))
        });
      }
    }
  }
  
  next();
});

/* -------------------------------------------------------
 * Health check endpoint (after CORS setup)
 * ------------------------------------------------------ */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    port: env.PORT,
    uptime: process.uptime()
  });
});

/* -------------------------------------------------------
 * Attachment JWT query param (for ML server)
 * ------------------------------------------------------ */
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

/** ---------- Stripe webhook (raw body) BEFORE express.json() ---------- */
if (stripeWebhook) {
  app.post("/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);
} else {
  app.post("/billing/webhook", (_req, res) => {
    res.status(503).json({ error: "billing_disabled" });
  });
}

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
if (publicSignupRouter) {
  app.use("/public", publicSignupRouter);
}
/** Public estimator AI assistant */
app.use("/public/estimator-ai", estimatorAiRouter);
/** Public landing tenant APIs for SEO pages */
app.use("/api/landing-tenants", landingTenantsPublicRouter);
app.use("/api/aggregate-reviews", aggregateReviewsRouter);
/** Wealden Joinery image uploads */
app.use("/api/wealden", wealdenRouter);
app.use("/api/scene-state", sceneStateRouter);
// Admin editor APIs
app.use("/api/admin/landing-tenants", adminLandingTenantsRouter);
app.use("/api/admin/landing-tenants", adminImageUploadRouter);
app.use("/api/admin/link-projects", adminLinkProjectsRouter);
/** Interest registration (pre-launch waitlist) */
app.use("/api/interest", interestRouter);
/** Early adopter signup */
app.use("/api/early-access", earlyAccessRouter);

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

/** Database health check */
app.get("/health/db", async (_req, res) => {
  const start = Date.now();
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1 as connected`;
    const duration = Date.now() - start;
    
    res.json({ 
      ok: true, 
      database: "connected",
      latency_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    const duration = Date.now() - start;
    console.error('[health/db] Database connection failed:', {
      error: e.message,
      code: e.code,
      latency_ms: duration,
      timestamp: new Date().toISOString()
    });
    
    res.status(503).json({ 
      ok: false, 
      database: "disconnected",
      error: e.message,
      code: e.code,
      latency_ms: duration,
      timestamp: new Date().toISOString()
    });
  }
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
async function requireAuth(req: any, res: any, next: any) {
  // In dev mode, bypass auth and use LAJ Joinery tenant automatically
  if (process.env.NODE_ENV !== "production" && !req.auth?.tenantId) {
    try {
      const lajTenant = await prisma.tenant.findUnique({ where: { slug: "laj-joinery" } });
      if (lajTenant) {
        req.auth = { tenantId: lajTenant.id, userId: null, email: "dev@laj.local", role: "owner" };
        return next();
      }
    } catch (e) {
      console.error("[requireAuth] Failed to load LAJ tenant in dev mode:", e);
    }
  }
  
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/* ---------------- Dev bootstrap (idempotent) ---------------- */
async function ensureDevData() {
  let tenant = await prisma.tenant.findFirst({ where: { name: "Demo Tenant" } });
  if (!tenant) {
    const slug = await generateUniqueSlug("Demo Tenant");
    tenant = await prisma.tenant.create({ data: { name: "Demo Tenant", slug } });
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

const shouldBootstrapDevData =
  process.env.NODE_ENV !== "production" && env.BILLING_ENABLED && process.env.SKIP_DEV_BOOTSTRAP !== "1";

if (shouldBootstrapDevData) {
  ensureDevData()
    .then(({ user }) => console.log(`[dev] bootstrap ready for ${user.email}`))
    .catch((e) => console.error("[dev] bootstrap failed:", e));
} else if (process.env.NODE_ENV !== "production") {
  console.log("[dev] Skipping bootstrap (billing disabled or explicitly skipped)");
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

/* ---------------- Public Fire Door Portal ---------------- */
app.use("/public/fire-doors", publicFireDoorsRouter);

/* ---------------- Customer Portal (Public Auth + Authenticated Routes) ---------------- */
app.use("/customer-auth", customerAuthRouter);
app.use("/customer-portal", customerPortalRouter);

/* ---------------- Protected Routers ---------------- */
app.use("/auth", authRouter);
app.use("/leads", leadsRouter);
app.use("/clients", clientsRouter);
app.use("/ai", aiRouter);
app.use("/ai", requireAuth, aiComponentEstimatorRouter);
app.use("/reports", reportsRouter);
app.use("/mail", mailRouter);
app.use("/gmail", gmailRouter);
app.use("/leads/ai", leadsAiRouter);
app.use("/ms365", ms365Router);
app.use("/accounting/sage", accountingSageRouter);
app.use("/ai/followup", aiFollowupRouter);
app.use("/opportunities", opportunitiesRouter);
app.use("/settings/inbox", requireAuth, settingsInboxRouter);
app.use("/source-costs", requireAuth, sourceCostsRouter);
app.use("/analytics", requireAuth, analyticsRouter);
app.use("/public/analytics", analyticsPublicRouter);
app.use("/analytics/business", requireAuth, analyticsBusinessRouter);
app.use("/tenant", requireAuth, tenantsRouter);
app.use("/landing-tenants", landingTenantsRouter); // Public + admin with x-admin-key
app.use("/admin/landing-tenants", requireAuth, adminLandingTenantsRouter); // New admin WYSIWYG routes
app.use("/admin/landing-tenants", requireAuth, adminImageUploadRouter); // Image upload routes
app.use("/tenants", requireAuth, tenantDeclineRouter);
if (billingRouter) {
  app.use("/billing", billingRouter);
}
app.use("/quotes", quotesRouter);
// Additional quote pricing routes (questionnaire + door engine)
app.use("/quotes", quotePricingRouter);
// Deprecation: questionnaire-fields now aliases /fields for backwards compatibility
app.use("/questionnaire-fields", requireAuth, fieldsRouter);
app.use("/questionnaire-responses", questionnaireResponsesRouter);
app.use("/questionnaire-photos", requireAuth, questionnairePhotosRouter);
app.use("/fields", requireAuth, fieldsRouter);
app.use("/flexible-fields", requireAuth, flexibleFieldsRouter);
app.use("/auth/setup", authSetupRouter);
app.use("/suppliers", requireAuth, suppliersRouter);
app.use("/software-profiles", requireAuth, softwareProfilesRouter);
app.use("/pdf-templates", requireAuth, pdfTemplatesRouter);
// Developer management (list/add developer emails)
app.use("/developers", requireAuth, developersRouter);
app.use("/supplier-quote-requests", requireAuth, supplierQuoteRequestsRouter);
app.use("/analytics/dashboard", requireAuth, analyticsDashboardRouter);
app.use("/quote-defaults", requireAuth, quoteDefaultsRouter);
app.use("/questionnaire/fill", requireAuth, questionnaireFillRouter);
app.use("/internal/ml", requireAuth, mlInternalRouter);
app.use("/gmail", gmailAttachmentsRouter);
app.use("/internal/ml", requireAuth, mlOpsRouter);
// Move ML insights under a distinct prefix so it doesn't intercept /ml proxy routes
// This avoids accidental 401s for public ML health/proxy endpoints like /ml/health and /ml/parse-quote.
app.use("/ml/insights", requireAuth, mlInsightsRouter);
app.use("/ml/status", requireAuth, mlStatusRouter);
app.use("/ml-actuals", requireAuth, mlActualsRouter);
app.use("/purchase-orders/upload", requireAuth, purchaseOrderUploadRouter);
app.use("/feature-flags", featureFlagsRouter);
app.use("/feedback", feedbackRouter);
app.use("/webhook", webhooksRouter);
app.use("/files", filesRouter);
app.use("/tasks", requireAuth, tasksRouter);
app.use("/questions", requireAuth, questionsRouter);
app.use("/standard-field-mappings", requireAuth, standardFieldMappingsRouter);
app.use("/ai", requireAuth, aiAssistantRouter);
app.use("/automation-rules", requireAuth, automationRulesRouter);
app.use("/automation", requireAuth, automationFieldLinksRouter);
app.use("/scheduler", requireAuth, schedulerRouter);
app.use("/events", eventsRouter);
app.use("/notifications", notificationsRouter);
app.use("/streaks", streaksRouter);
app.use("/followups", followupsRouter);
app.use("/follow-up-rules", requireAuth, followUpRulesRouter);
app.use("/marketing/roi", marketingRoiRouter);
app.use("/keywords", requireAuth, keywordsRouter);
app.use("/ads", requireAuth, adsRouter);
app.use("/feature-requests", featureRequestsRouter);
// Photo measurement endpoint powers public questionnaire uploads, so keep it unauthenticated.
app.use("/measurements", measurementsRouter);
app.use("/workshop", requireAuth, workshopRouter);
app.use("/workshop-processes", requireAuth, workshopProcessesRouter);
app.use("/timesheets", requireAuth, timesheetsRouter);
app.use("/coaching", requireAuth, coachingRouter);
app.use("/auth", makeMeAdminRouter);
// ML trust and approval workflows
app.use("/quote-approval", requireAuth, quoteApprovalRouter);
app.use("/ml", mlTrainingRouter);
// Example photos (public browsing + admin management)
app.use("/example-photos", examplePhotosRouter);
// Fire door import system (requires fire door manufacturer access)
app.use("/fire-doors", requireAuth, fireDoorsRouter);
// Fire door schedule (unified project tracking for fire door manufacturers)
// Register specific routers first, then the main router as catch-all
app.use("/fire-door-schedule", requireAuth, fireDoorScheduleSyncRouter);
app.use("/fire-door-schedule", requireAuth, fireDoorImportBomRouter);
app.use("/fire-door-schedule", requireAuth, fireDoorImportTriggerRouter);
app.use("/fire-door-schedule", requireAuth, fireDoorEnableRouter);
app.use("/fire-door-schedule", requireAuth, fireDoorScheduleRouter);
app.use("/fire-door-production", requireAuth, fireDoorProductionRouter);
// Monthly GP calculation and dashboard
app.use("/api/monthly-gp", requireAuth, monthlyGPRouter);
// Fire door line item layout configuration (customizable field display for QR scans)
app.use("/fire-door-line-item-layout", requireAuth, fireDoorLineItemLayoutRouter);
// Fire door quotes (dedicated quote builder for fire doors)
app.use("/fire-door-quotes", requireAuth, fireDoorQuotesRouter);
// Fire door QR code system (workshop process tracking, dispatch, maintenance)
app.use("/fire-door-qr", fireDoorQRRouter); // Public scans + protected management
// Fire door lookup tables (door cores, ironmongery)
app.use("/door-cores", requireAuth, doorCoresRouter);
app.use("/ironmongery-items", requireAuth, ironmongeryItemsRouter);
app.use("/rfis", requireAuth, rfisRouter);
app.use("/api/fire-door-rfis", fireDoorRfisRouter);
// Fire door components (BOM generation and component management)
app.use("/api/fire-door-components", requireAuth, fireDoorComponentsRouter);
// Generic lookup API for calculated fields
app.use("/api/lookup", requireAuth, lookupRouter);
// Lipping lookup table (door manufacturing lipping specifications)
app.use("/lipping-lookup", requireAuth, lippingLookupRouter);
// Component catalog and product type configuration
app.use("/components", requireAuth, componentsRouter);
// Product types (categories, types, options tree)
app.use("/product-types", requireAuth, productTypesRouter);
// Product type component assignments (assign specific components to product types)
app.use("/product-type-components", requireAuth, productTypeComponentsRouter);
// Component process tracking, ML timing predictions, and cost calculations
app.use("/component-processes", requireAuth, componentProcessesRouter);
app.use("/component-attributes", requireAuth, componentAttributesRouter); // Component attribute management (timber types, dimensions, etc)
app.use("/component-variants", requireAuth, componentVariantsRouter); // Component variants with specific specifications
// Material library (timber, boards, finishes with textures and costs)
app.use("/materials", requireAuth, materialsRouter);
// 3D asset storage (GLB/GLTF models for ironmongery, etc.)
app.use("/assets", requireAuth, assetsRouter);
// 2D profile storage (SVG/DXF files for component extrusion)
app.use("/profiles", requireAuth, profilesRouter);
// Material cost debug routes (internal debugging tool)
app.use("/material-debug", requireAuth, materialDebugRouter);
// Developer Console routes
app.use("/dev", requireAuth, devRouter);
app.use("/ai/codex", codexRunRouter);
app.use("/ai/loop", aiLoopRouter);

/**
 * Minimal migration trigger endpoint.
 * Protected: requires developer role.
 * Runs `prisma migrate deploy` and returns status JSON.
 * Useful for one-click healing when new tables are added.
 * MOVED to /dev/db/migrate but kept for backwards compatibility
 */
import { execSync } from "child_process";
app.post("/admin/run-migrations", requireAuth, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user?.isDeveloper) {
      return res.status(403).json({ error: "Developer access required" });
    }
    const outGenerate = execSync("npx prisma generate", { stdio: "pipe" }).toString();
    const outDeploy = execSync("npx prisma migrate deploy", { stdio: "pipe" }).toString();
    return res.json({ ok: true, generate: outGenerate, deploy: outDeploy });
  } catch (e: any) {
    console.error("[/admin/run-migrations] failed:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/** ---------- Auth required from here ---------- */
app.use((req, _res, next) => {
  next();
});

/** ---------- ML parse + proxy (public endpoints used by server-side flows) ---------- */
app.use("/ml", mlParseRouter);

/** ---------- ML training upload (manual PDF uploads for training data) ---------- */
app.use("/ml/training", requireAuth, mlTrainingUploadRouter);

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
  let lastInboxFlagSyncMin = -1;

  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const now = Date.now();

      // QoL: every 15 minutes, if a tenant has user-level connections and inbox flags are unset, enable them
      const nowMin = Math.floor(now / 60000);
      if (nowMin % 15 === 0 && nowMin !== lastInboxFlagSyncMin) {
        lastInboxFlagSyncMin = nowMin;
        try {
          const tenantIds = await prisma.tenant.findMany({ select: { id: true } });
          for (const t of tenantIds) {
            try {
              const [gCount, mCount, settings] = await Promise.all([
                (prisma as any).gmailUserConnection.count({ where: { tenantId: t.id } }),
                (prisma as any).ms365UserConnection.count({ where: { tenantId: t.id } }),
                prisma.tenantSettings.findUnique({ where: { tenantId: t.id }, select: { inbox: true, slug: true, brandName: true } }),
              ]);
              const inbox = ((settings?.inbox as any) || {}) as Record<string, any>;
              let changed = false;
              if (gCount > 0 && typeof inbox.gmail === "undefined") { inbox.gmail = true; changed = true; }
              if (mCount > 0 && typeof inbox.ms365 === "undefined") { inbox.ms365 = true; changed = true; }
              if (changed) {
                await prisma.tenantSettings.upsert({
                  where: { tenantId: t.id },
                  update: { inbox },
                  create: {
                    tenantId: t.id,
                    slug: settings?.slug || `tenant-${t.id.slice(0, 6)}`,
                    brandName: settings?.brandName || "Your Company",
                    inbox,
                  },
                });
                console.log(`[inbox watcher] enabled inbox flags for tenant ${t.id} (gmail=${inbox.gmail ? "true" : String(inbox.gmail)} ms365=${inbox.ms365 ? "true" : String(inbox.ms365)})`);
              }
            } catch (e) {
              console.warn("[inbox watcher] inbox flag sync failed for tenant", t.id, (e as any)?.message || e);
            }
          }
        } catch (e) {
          console.warn("[inbox watcher] inbox flag sync loop failed:", (e as any)?.message || e);
        }
      }

      const all = await prisma.tenantSettings.findMany({
        where: {
          OR: [
            { inbox: { path: ["gmail"], equals: true } },
            { inbox: { path: ["ms365"], equals: true } },
          ],
        },
        select: { tenantId: true, inbox: true },
      });

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
            // Import from all admin users with Gmail connections
            await fetch(`${API_ORIGIN}/gmail/import-all-users`, {
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
            // Import from all admin users with MS365 connections
            await fetch(`${API_ORIGIN}/ms365/import-all-users`, {
              ...common,
              body: JSON.stringify({ max: 25 }),
            } as any);

            await fetch(`${API_ORIGIN}/opportunities/reconcile-replies`, {
              ...common,
              method: "POST",
            } as any);
          } catch {}
        }

        // Optional: periodically collect Sent-folder quotes for ML training across all connections
        // Controlled by env ML_AUTO_COLLECT_SENT (default: enabled in prod), runs roughly hourly per tenant
        const autoCollect = String(process.env.ML_AUTO_COLLECT_SENT || (process.env.NODE_ENV === 'production' ? '1' : '0')) === '1';
        const sentEveryMin = Math.max(30, Number(process.env.ML_SENT_COLLECT_EVERY_MIN || 60));
        const shouldCollectSent = autoCollect && (Math.floor(now / 60000) % sentEveryMin === 0);
        if (shouldCollectSent) {
          try {
            // Gmail Sent ingestion/training (aggregates tenant + all user connections)
            if (inbox.gmail) {
              await fetch(`${API_ORIGIN}/internal/ml/collect-train-save`, {
                ...common,
                body: JSON.stringify({ limit: 100 }),
              } as any);
            }
          } catch {}
          try {
            // MS365 Sent ingestion/training (aggregates tenant + all user connections)
            if (inbox.ms365) {
              await fetch(`${API_ORIGIN}/internal/ml/collect-train-save-ms365`, {
                ...common,
                body: JSON.stringify({ limit: 100 }),
              } as any);
            }
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
startRecurringTaskProcessor(60); // Check every 60 minutes

// Start AI follow-up trigger engine - scans for events that need follow-up
import { scanForFollowUpTriggers } from "./services/followUpTriggerEngine";
function startFollowUpEngine() {
  console.log("[follow-up-engine] Starting...");
  // Run immediately
  scanForFollowUpTriggers().catch((err) => {
    console.error("[follow-up-engine] Initial scan failed:", err);
  });
  // Then every 30 minutes
  setInterval(() => {
    scanForFollowUpTriggers().catch((err) => {
      console.error("[follow-up-engine] Interval scan failed:", err);
    });
  }, 30 * 60 * 1000);
}
startFollowUpEngine();

/* ---------------- Request timeout middleware ---------------- */
const REQUEST_TIMEOUT_MS = 25000; // 25 seconds (Render has 30s timeout)
app.use((req, res, next) => {
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[timeout] Request timeout: ${req.method} ${req.path}`, {
        tenantId: (req as any).auth?.tenantId,
        userId: (req as any).auth?.userId,
        timestamp: new Date().toISOString(),
      });
      res.status(504).json({ 
        error: "request_timeout", 
        message: "Request took too long to process",
        path: req.path 
      });
    }
  }, REQUEST_TIMEOUT_MS);

  const originalSend = res.send;
  res.send = function(data: any) {
    clearTimeout(timeoutId);
    return originalSend.call(this, data);
  };

  next();
});

/* ---------------- 404 + Error handlers ---------------- */
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));
app.use((err: any, req: any, res: any, _next: any) => {
  // Structured error logging
  const errorContext = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    tenantId: req.auth?.tenantId,
    userId: req.auth?.userId,
    errorType: err.name || 'UnknownError',
    errorMessage: err.message,
    stack: err.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
  };
  
  console.error('[error-handler]', JSON.stringify(errorContext, null, 2));
  
  // Don't send error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ 
    error: "internal_error",
    ...(isDev ? { details: err.message, type: err.name } : {})
  });
});

/** Start server with error handling */
function startServer() {
  try {
    const port = env.PORT;
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 API running at http://0.0.0.0:${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 Process PID: ${process.pid}`);
      
      // Log storage config
      const configuredUpload = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
      const resolvedUpload = path.isAbsolute(configuredUpload)
        ? configuredUpload
        : path.join(process.cwd(), configuredUpload);
      try { fs.mkdirSync(resolvedUpload, { recursive: true }); } catch {}
      let writable = true;
      try { fs.accessSync(resolvedUpload, fs.constants.W_OK); } catch { writable = false; }
      console.log(`[storage] UPLOAD_DIR -> ${resolvedUpload} (writable=${writable})`);
      
      // Validate AI/ML service configuration
      const isProd = process.env.NODE_ENV === "production";
      const mlEnv = ((process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "").trim());
      const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
      
      // ML service validation
      if (!mlEnv) {
        if (isProd) {
          console.error("[ml] ❌ CRITICAL: ML_URL not set in production - ML features will fail");
          console.error("[ml] Set ML_URL environment variable to your deployed ML service URL");
        } else {
          console.warn("[ml] ML_URL not set; ML proxy will default to http://localhost:8000 (dev only)");
        }
      } else if (isProd && /(localhost|127\.0\.0\.1)/i.test(mlEnv)) {
        console.error(`[ml] ❌ CRITICAL: ML_URL is '${mlEnv}' which points to localhost in production`);
        console.error("[ml] Update your API env to the deployed ML service URL");
      } else {
        console.log(`[ml] ✅ ML proxy target: ${mlEnv}`);
      }
      
      // OpenAI API key validation
      if (!openaiKey) {
        if (isProd) {
          console.warn("[ai] ⚠️  OPENAI_API_KEY not set in production - some AI features will be limited");
          console.warn("[ai] Set OPENAI_API_KEY for supplier quote structuring and AI code generation");
        } else {
          console.log("[ai] OPENAI_API_KEY not set - some AI features disabled in dev mode");
        }
      } else {
        console.log(`[ai] ✅ OpenAI API configured (key: ${openaiKey.slice(0, 7)}...)`);
      }
      
      // Summary of AI service status
      if (isProd) {
        const mlOk = mlEnv && !/(localhost|127\.0\.0\.1)/i.test(mlEnv);
        const aiOk = !!openaiKey;
        if (mlOk && aiOk) {
          console.log("[services] ✅ All AI services configured for production");
        } else if (!mlOk && !aiOk) {
          console.error("[services] ❌ CRITICAL: ML and OpenAI services not configured - most AI features will fail");
        } else if (!mlOk) {
          console.error("[services] ❌ CRITICAL: ML service not configured - parsing and estimation features will fail");
        } else if (!aiOk) {
          console.warn("[services] ⚠️  OpenAI not configured - structuring and code generation features limited");
        }
      }
      
      // Initialize scheduled jobs (cron tasks)
      try {
        initializeScheduler();
        console.log('⏰ Scheduled jobs initialized');
      } catch (error: any) {
        console.error('❌ Failed to initialize scheduler:', error.message);
      }
    });

    // Handle server errors
    server.on('error', (error: any) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
