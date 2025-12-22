export type OrderFlowContext = Record<string, any>;

/**
 * Dev-only trace helper for enquiry -> quote -> order -> workshop flow.
 * Logs with a consistent prefix so we can filter in logs.
 */
export function logOrderFlow(stage: string, ctx: OrderFlowContext = {}): void {
  if (process.env.NODE_ENV === "production") return;
  const payload = { stage, ...ctx };
  try {
    console.log(`[ORDER_FLOW] ${stage}`, JSON.stringify(payload));
  } catch (_err) {
    console.log(`[ORDER_FLOW] ${stage}`, payload);
  }
}
