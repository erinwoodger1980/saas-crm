import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`❌ Missing required environment variable: ${name}`);
    console.error(`📋 Available env vars starting with ${name.slice(0, 3)}: ${Object.keys(process.env).filter(k => k.startsWith(name.slice(0, 3))).join(', ') || 'none'}`);
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

console.log('🔧 Loading environment configuration...');

const resolvedMlUrl = (
  process.env.ML_URL?.trim() ||
  process.env.ML_PARSER_URL?.trim() ||
  process.env.NEXT_PUBLIC_ML_URL?.trim() ||
  ""
);

let mlUrlHost = "";
let isProdMlHost = true;
let mlWarning: string | null = null;

if (resolvedMlUrl) {
  try {
    const parsed = new URL(resolvedMlUrl);
    mlUrlHost = parsed.host;
    const loweredHost = mlUrlHost.toLowerCase();
    if (/(local|test|stage)/.test(loweredHost)) {
      isProdMlHost = false;
      mlWarning = `ML host '${mlUrlHost}' appears non-production`;
      console.error("Non-prod ML URL");
    }
  } catch (err) {
    isProdMlHost = false;
    mlWarning = `Invalid ML URL configured: '${resolvedMlUrl}'`;
    console.error("[ml] Failed to parse ML URL", err);
  }
} else {
  mlWarning = "ML URL not configured";
  isProdMlHost = false;
  console.warn("[ml] ML URL not configured");
}

export const mlBootstrap = {
  resolvedMlUrl,
  mlUrlHost,
  isProdMlHost,
  warning: mlWarning,
} as const;

const rawJwtSecret =
  (process.env.APP_JWT_SECRET && process.env.APP_JWT_SECRET.trim()) ||
  (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) ||
  "";

if (!rawJwtSecret) {
  console.error("❌ Missing required environment variable: APP_JWT_SECRET or JWT_SECRET");
  console.error("📋 Available JWT-related env vars:", Object.keys(process.env).filter(k => k.includes('JWT') || k.includes('SECRET')).join(', ') || 'none');
  throw new Error("Missing required env var: APP_JWT_SECRET or JWT_SECRET");
}

const rawWebOrigin =
  process.env.WEB_ORIGIN ||
  process.env.ALLOWED_ORIGINS ||
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://app.joineryai.app",
    "https://joineryai.app",
    "https://www.joineryai.app",
  ].join(",");

const parsedWebOrigin = rawWebOrigin
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const billingEnabled = String(process.env.BILLING_ENABLED ?? "true").toLowerCase() !== "false";

export const env = {
  // core
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),
  APP_JWT_SECRET: rawJwtSecret,
  JWT_SECRET: rawJwtSecret,
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PARSER_MAX_PAGES: Math.max(1, Number(process.env.PARSER_MAX_PAGES ?? 3)),
  PARSER_OCR_ENABLED: String(process.env.PARSER_OCR_ENABLED ?? "true").toLowerCase() !== "false",
  BILLING_ENABLED: billingEnabled,

  // Gmail OAuth
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ?? "",
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ?? "",
  GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI ?? "",

  // Microsoft 365 / Outlook OAuth
  MS365_CLIENT_ID: process.env.MS365_CLIENT_ID ?? "",
  MS365_CLIENT_SECRET: process.env.MS365_CLIENT_SECRET ?? "",
  MS365_REDIRECT_URI:
    process.env.MS365_REDIRECT_URI ?? "http://localhost:4000/ms365/callback",
  MS365_TENANT: process.env.MS365_TENANT ?? "common",
  MS365_SCOPES:
    (process.env.MS365_SCOPES ?? "offline_access Mail.Read User.Read").split(
      /\s+/
    ),

  // Web origins allowlist for CORS
  WEB_ORIGIN: parsedWebOrigin,

  // ML safety
  ML_REDACT_PII: String(process.env.ML_REDACT_PII ?? "true").toLowerCase() !== "false",
} as const;

console.log('✅ Environment configuration loaded successfully');
console.log(`📡 PORT: ${env.PORT}`);
console.log(`🌐 WEB_ORIGIN: ${env.WEB_ORIGIN.join(', ')}`);
console.log(`🔐 JWT configured: ${!!env.APP_JWT_SECRET}`);
console.log(`🤖 OpenAI configured: ${!!env.OPENAI_API_KEY}`);
console.log(`📄 Parser pages: ${env.PARSER_MAX_PAGES}`);
console.log(`👁️‍🗨️ OCR enabled: ${env.PARSER_OCR_ENABLED}`);
console.log(`📧 Gmail configured: ${!!env.GMAIL_CLIENT_ID}`);
console.log(`📧 MS365 configured: ${!!env.MS365_CLIENT_ID}`);
console.log(`🛡️ ML redaction enabled: ${env.ML_REDACT_PII}`);
console.log(`💳 Billing enabled: ${env.BILLING_ENABLED}`);
