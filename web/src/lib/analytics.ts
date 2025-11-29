export function parseUtmParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search || (typeof window !== 'undefined' ? window.location.search : ''));
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export async function emitPublicAnalyticsEvent(payload: {
  tenantId: string;
  type: 'ad_impression' | 'landing' | 'estimator_start' | 'estimator_step' | 'estimator_complete';
  source?: 'facebook' | 'instagram' | 'other' | string;
  utm?: Record<string, string>;
  stepIndex?: number;
  timestamp?: number;
}) {
  try {
    await fetch('/public/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: payload.timestamp ?? Date.now() }),
    });
  } catch {}
}
