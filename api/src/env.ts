import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

const rawJwtSecret =
  (process.env.APP_JWT_SECRET && process.env.APP_JWT_SECRET.trim()) ||
  (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) ||
  "";

if (!rawJwtSecret) {
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

export const env = {
  // core
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),
  APP_JWT_SECRET: rawJwtSecret,
  JWT_SECRET: rawJwtSecret,
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: requireEnv("DATABASE_URL"),

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
} as const;
