import type { Response } from "express";
import { env } from "../env";

const DEFAULT_TTL = "7d";
const COOKIE_NAME = "jauth";

function parseDurationToMs(value: string | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) {
    return Math.max(0, Math.round(Number(raw)));
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const multiplier = unitMs[unit];
  if (!multiplier) return 0;
  return Math.max(0, Math.round(amount * multiplier));
}

function isLocalHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  );
}

function determineCookieDomain(): string | undefined {
  const override = (process.env.AUTH_COOKIE_DOMAIN || "").trim();
  if (override) return override;

  for (const origin of env.WEB_ORIGIN) {
    try {
      const host = new URL(origin).hostname;
      if (!host || isLocalHost(host)) continue;
      const parts = host.split(".");
      if (parts.length <= 2) {
        return `.${host}`;
      }
      return `.${parts.slice(-2).join(".")}`;
    } catch {
      // ignore malformed origins
    }
  }
  return undefined;
}

const COOKIE_DOMAIN = determineCookieDomain();
const SHOULD_USE_SECURE_COOKIES =
  process.env.COOKIE_SECURE === "1" || process.env.NODE_ENV === "production";
const SAME_SITE: "lax" | "none" = SHOULD_USE_SECURE_COOKIES ? "none" : "lax";

const ttlEnv = process.env.JWT_TTL || DEFAULT_TTL;
const TTL_MS = parseDurationToMs(ttlEnv) || parseDurationToMs(DEFAULT_TTL);

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: SHOULD_USE_SECURE_COOKIES,
    sameSite: SAME_SITE,
    domain: COOKIE_DOMAIN,
    path: "/",
  } as const;
}

export function setAuthCookie(res: Response, token: string) {
  const options = baseCookieOptions();
  res.cookie(COOKIE_NAME, token, {
    ...options,
    maxAge: TTL_MS,
  });
}

export function clearAuthCookie(res: Response) {
  const options = baseCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    ...options,
    maxAge: 0,
  });
}

export { COOKIE_NAME, TTL_MS as AUTH_COOKIE_TTL_MS };
