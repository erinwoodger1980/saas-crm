"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type PredictIn = {
  area_m2: number;
  materials_grade: string;
  project_type?: string | null;
  lead_source?: string | null;
  region?: string | null;
};

export default function PredictionCard({
  getPayload,
  className = "",
}: {
  // Provide a function so we always read latest form state from the parent
  getPayload: () => PredictIn | null;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    const body = getPayload();
    if (!body) return;
    setLoading(true);
    setErr(null);
    setPrice(null);
    setWin(null);
    try {
      const res = await apiFetch<{ predicted_price: number; win_probability: number }>("/ml/predict", {
        method: "POST",
        json: body,
      });
      setPrice(res?.predicted_price ?? null);
      setWin(res?.win_probability ?? null);
    } catch (e: any) {
      setErr(e?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  // Optional: auto-run once on mount if data looks complete
  useEffect(() => {
    const b = getPayload();
    if (b && b.area_m2 && b.materials_grade) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className={`border bg-white/90 shadow-sm ${className}`}>
      <CardContent className="p-4">
        <div className="mb-2 text-sm font-semibold">ML Prediction</div>

        <div className="flex items-center gap-2 mb-3">
          <Button size="sm" variant="outline" disabled={loading} onClick={run}>
            {loading ? "Predicting…" : "Get prediction"}
          </Button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] text-slate-500">Suggested Price</div>
            <div className="text-lg font-semibold">
              {price != null ? `£${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] text-slate-500">Win Probability</div>
            <div className="text-lg font-semibold">
              {win != null ? `${Math.round(win * 100)}%` : "—"}
            </div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Uses your trained model hosted on the ML service.
        </div>
      </CardContent>
    </Card>
  );
}
