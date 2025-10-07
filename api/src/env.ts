import "dotenv/config";

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  APP_JWT_SECRET: process.env.APP_JWT_SECRET!,
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL!,
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID!,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET!,
  GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI!,
};