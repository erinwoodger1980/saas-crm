import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

export const env = {
  // core
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),
  APP_JWT_SECRET: requireEnv("APP_JWT_SECRET"),
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
} as const;