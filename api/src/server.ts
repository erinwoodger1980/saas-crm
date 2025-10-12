// api/src/server.ts
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
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

// ------------------------------------------------------
// App Setup
// ------------------------------------------------------
const app = express();

/** ✅ CORS (allow cookies + auth header) */
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/** ✅ Body parser should come before routers */
app.use(express.json({ limit: "2mb" }));

/** ✅ Public (no auth required) */
app.use("/public", publicRouter);

/** ✅ JWT decode middleware — reads header or cookie, sets req.auth */
app.use((req, _res, next) => {
  let token: string | null = null;

  // 1) Authorization: Bearer <jwt>
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) token = h.slice(7);

  // 2) Fallback: jwt cookie
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

// --- JWT DEBUG HELPERS (optional) ---
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
// --- end debug helpers ---

/** ✅ Healthcheck */
app.get("/healthz", (_req, res) => res.send("ok"));

/** Small auth guard for protected routers */
function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * -------- Dev bootstrap (idempotent) --------
 */
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

// Auto-seed dev data
if (process.env.NODE_ENV !== "production") {
  ensureDevData()
    .then(({ user }) => console.log(`[dev] bootstrap ready for ${user.email}`))
    .catch((e) => console.error("[dev] bootstrap failed:", e));
}

/** ✅ Dev seed endpoint */
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

/** ✅ Dev Login route (for local use only) */
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

/** ✅ Routers (protected ones mounted AFTER JWT middleware) */
app.use("/auth", authRouter);
app.use("/leads", leadsRouter);
app.use("/ai", aiRouter);
app.use("/reports", reportsRouter);
app.use("/mail", mailRouter);
app.use("/gmail", gmailRouter);
app.use("/leads/ai", leadsAiRouter);
app.use("/ms365", ms365Router);

// 🔒 Tenant settings require a valid JWT
app.use("/tenant", requireAuth, tenantsRouter);

/** ✅ DB Debug */
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

/** ✅ 404 handler */
app.use((_req, res) => res.status(404).json({ error: "not found" }));

/** ✅ Start server */
app.listen(env.PORT, () => {
  console.log(`API running at http://localhost:${env.PORT}`);
});