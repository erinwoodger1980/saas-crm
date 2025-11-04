const OPS_SLACK_WEBHOOK = process.env.OPS_SLACK_WEBHOOK;

function normaliseMessage(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export async function sendOpsAlert(message: string, options?: {
  emoji?: string;
  username?: string;
}): Promise<boolean> {
  const text = normaliseMessage(message);
  if (!text) return false;
  const webhook = OPS_SLACK_WEBHOOK;
  if (!webhook) {
    console.warn("[ops-alert] missing OPS_SLACK_WEBHOOK", text);
    return false;
  }

  try {
    const payload = {
      text: `${options?.emoji ?? ":rotating_light:"} ${text}`.trim(),
      username: options?.username ?? "Parser Alerts",
    };
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.warn("[ops-alert] webhook failed", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[ops-alert] webhook error", err?.message || err);
    return false;
  }
}

export async function sendParserErrorAlert(tenantId: string, quoteId: string, reason: string) {
  const cleanTenant = tenantId || "unknown";
  const cleanQuote = quoteId || "unknown";
  const cleanReason = normaliseMessage(reason || "unknown");
  await sendOpsAlert(`Parser error tenant=${cleanTenant} quote=${cleanQuote} reason=${cleanReason}`);
}

export async function sendParserFallbackAlert(ratio: number, counts: {
  fallback: number;
  total: number;
}) {
  const pct = Math.round(ratio * 1000) / 10;
  const text = `Parser fallback ratio high ${pct}% (${counts.fallback}/${counts.total}) in last 24h`;
  await sendOpsAlert(text, { emoji: ":warning:" });
}
