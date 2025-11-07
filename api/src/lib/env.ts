export const ENV = {
  PORT: Number(process.env.PORT || 4000),
  WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:3000",
  RECAPTCHA_ENABLED: (process.env.RECAPTCHA_ENABLED || "false").toLowerCase() === "true",
  RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || "",
  SALES_NOTIFY_EMAIL: process.env.SALES_NOTIFY_EMAIL || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_SECURE: (process.env.SMTP_SECURE || "false").toLowerCase() === "true",
};
