// api/src/env.ts
import dotenv from "dotenv";
dotenv.config(); // loads api/.env

// small helper to read optional envs
const opt = (k: string, fallback = "") => process.env[k] ?? fallback;

export const env = {
  PORT: Number(process.env.PORT || 4000),

  DATABASE_URL: opt("DATABASE_URL"),
  APP_JWT_SECRET: opt("APP_JWT_SECRET"),
  OPENAI_API_KEY: opt("OPENAI_API_KEY", ""),

  // ✅ make sure these are exported so the callback can read them
  GMAIL_CLIENT_ID: opt("GMAIL_CLIENT_ID", ""),
  GMAIL_CLIENT_SECRET: opt("GMAIL_CLIENT_SECRET", ""),
  GMAIL_REDIRECT_URI: opt(
    "GMAIL_REDIRECT_URI",
    "http://localhost:4000/gmail/oauth/callback"
  ),
};