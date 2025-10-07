// api/src/env.ts
import 'dotenv/config';

function req(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    // Only throw for truly required vars
    if (name === 'DATABASE_URL' || name === 'APP_JWT_SECRET') {
      throw new Error(`[env] Missing required ${name}`);
    }
    console.warn(`[env] ${name} is missing or empty`);
  }
  return v as string;
}

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',   // optional in dev; warn above
  APP_JWT_SECRET: req('APP_JWT_SECRET', 'dev_secret'),
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: req('DATABASE_URL'),
};