"use client";
import { useEffect, useState } from "react";
import { apiFetch } from '@/lib/api';

type Summary = {
  counts: {
    impressions: number;
    landings: number;
    estimatorStart: number;
    estimatorComplete: number;
  };
  sourceBreakdown: Record<string, number>;
  stepCounts: Record<string, number>;
  totalEvents: number;
};

type DailyPoint = { date: string; landing: number; start: number; complete: number; impressions: number };
type Daily = {
  days: number;
  series: DailyPoint[];
  totals: { landing: number; start: number; complete: number; impressions: number };
  conversion: { landingToStart: number | null; startToComplete: number | null; landingToComplete: number | null };
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);

  // Tenant derived from auth; we don't pass tenantId in query to avoid spoofing
  const [tenantLabel, setTenantLabel] = useState<string>('current');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const summaryPromise = apiFetch('/analytics/summary')
      .then(async (r) => {
        const data = await r.json();
        if (!cancelled) setSummary(data);
      })
      .catch(e => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    apiFetch('/analytics/daily?days=30')
      .then(async (r) => {
        const data = await r.json();
        if (!cancelled) setDaily(data);
      })
      .catch(e => !cancelled && setError(String(e)));

    Promise.all([summaryPromise]);
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Tenant Analytics</h1>
      <p>Tenant: {tenantLabel}</p>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {summary && (
        <div style={{ display: 'grid', gap: 12 }}>
          <section>
            <h2>Counts</h2>
            <ul>
              <li>Ad Impressions: {summary.counts.impressions}</li>
              <li>Landings: {summary.counts.landings}</li>
              <li>Estimator Starts: {summary.counts.estimatorStart}</li>
              <li>Estimator Completions: {summary.counts.estimatorComplete}</li>
            </ul>
          </section>
          <section>
            <h2>Source Breakdown</h2>
            <ul>
              {Object.entries(summary.sourceBreakdown).map(([src, count]) => (
                <li key={src}>{src}: {count}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Estimator Funnel</h2>
            <ul>
              {Object.entries(summary.stepCounts).map(([step, count]) => (
                <li key={step}>Step {step}: {count}</li>
              ))}
            </ul>
          </section>
          {daily && (
            <section>
              <h2>Daily Funnel (30d)</h2>
              <p>
                Landing→Start: {daily.conversion.landingToStart ? (daily.conversion.landingToStart * 100).toFixed(1) + '%' : '—'} |
                Start→Complete: {daily.conversion.startToComplete ? (daily.conversion.startToComplete * 100).toFixed(1) + '%' : '—'} |
                Landing→Complete: {daily.conversion.landingToComplete ? (daily.conversion.landingToComplete * 100).toFixed(1) + '%' : '—'}
              </p>
              <DailyChart series={daily.series} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DailyChart({ series }: { series: DailyPoint[] }) {
  if (!series.length) return <p>No daily data.</p>;
  // Simple inline SVG line chart for landing/start/complete. Normalize heights.
  const max = Math.max(...series.map(p => Math.max(p.landing, p.start, p.complete)));
  const h = 120;
  const w = 600;
  const pad = 10;
  const xStep = (w - pad * 2) / Math.max(series.length - 1, 1);
  const makePath = (key: keyof DailyPoint, color: string) => {
    const pts = series.map((p, i) => {
      const x = pad + i * xStep;
      const v = (p[key] / (max || 1));
      const y = h - pad - v * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    return <path d={pts} fill="none" stroke={color} strokeWidth={2} />;
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} style={{ background: '#f8fafc', borderRadius: 8 }}>
        {makePath('landing', '#0ea5e9')}
        {makePath('start', '#6366f1')}
        {makePath('complete', '#10b981')}
        {/* Axes */}
        <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#94a3b8" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#94a3b8" strokeWidth={1} />
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, marginTop: 4 }}>
        <span style={{ color: '#0ea5e9' }}>Landing</span>
        <span style={{ color: '#6366f1' }}>Start</span>
        <span style={{ color: '#10b981' }}>Complete</span>
      </div>
    </div>
  );
}
