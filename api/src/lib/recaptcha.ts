import fetch from "node-fetch";
import { ENV } from "./env";

export async function verifyRecaptcha(token?: string) {
  if (!ENV.RECAPTCHA_ENABLED) return { ok: true, score: 1 };
  if (!token) return { ok: false, score: 0, error: "missing_token" };
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: ENV.RECAPTCHA_SECRET,
      response: token,
    }),
  });
  const data: any = await res.json();
  return { ok: !!data.success, score: data.score ?? 0, error: data["error-codes"]?.join(",") };
}
