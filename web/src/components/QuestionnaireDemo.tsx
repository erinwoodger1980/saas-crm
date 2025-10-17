"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Defaults = Record<string, any>;

export default function QuestionnaireDemo() {
  const [product, setProduct] = useState<"Screen" | "Door">("Screen");
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [area, setArea] = useState<number>(12);
  const [grade, setGrade] = useState<"Basic" | "Standard" | "Premium">("Standard");
  const [loading, setLoading] = useState(false);
  const [ml, setMl] = useState<{ predicted_price?: number; win_probability?: number; error?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadDefaults() {
    setErr(null);
    setDefaults(null);
    setMl(null);
    try {
      const res = await apiFetch<{ ok: boolean; product: string; defaults: Defaults }>(
        `/questionnaire/fill?product=${encodeURIComponent(product)}`
      );
      setDefaults(res.defaults || {});
    } catch (e: any) {
      setErr(e?.message || "Failed to load defaults");
    }
  }

  async function predict() {
    setLoading(true);
    setMl(null);
    setErr(null);
    try {
      // Call your API proxy → FastAPI
      const res = await apiFetch<{ predicted_price: number; win_probability: number }>(`/ml/predict`, {
        method: "POST",
        json: {
          area_m2: area,
          materials_grade: grade,
          project_type: product,  // pass product through
          // You could also include some defaults in future if your model starts using them:
          // ...defaults
        },
      });
      setMl(res);
    } catch (e: any) {
      setErr(e?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  const defaultsList = useMemo(() => {
    if (!defaults) return null;
    return Object.entries(defaults).map(([k, v]) => (
      <div key={k} className="flex justify-between gap-3 text-sm">
        <div className="text-slate-500">{k}</div>
        <div className="font-medium">{String(v)}</div>
      </div>
    ));
  }, [defaults]);

  return (
    <Card className="p-4">
      <CardContent className="space-y-4 p-0">
        <div className="flex items-end gap-3">
          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Product</div>
            <select
              className="rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
              value={product}
              onChange={(e) => setProduct(e.target.value as any)}
            >
              <option>Screen</option>
              <option>Door</option>
            </select>
          </label>

          <Button onClick={loadDefaults} variant="outline">
            Load defaults
          </Button>
        </div>

        {defaults && (
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-xs font-semibold mb-2">Defaults for {product}</div>
            <div className="space-y-1">{defaultsList}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Area (m²)</div>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
              value={area}
              onChange={(e) => setArea(Math.max(1, Number(e.target.value || 1)))}
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Materials grade</div>
            <select
              className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
              value={grade}
              onChange={(e) => setGrade(e.target.value as any)}
            >
              <option>Basic</option>
              <option>Standard</option>
              <option>Premium</option>
            </select>
          </label>

          <div className="flex items-end">
            <Button className="w-full" onClick={predict} disabled={loading}>
              {loading ? "Predicting…" : "Predict"}
            </Button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {ml && (
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            {ml.error ? (
              <div className="text-red-600">Error: {ml.error}</div>
            ) : (
              <div className="space-y-1">
                <div>
                  💰 Predicted Price:{" "}
                  <b>£{Number(ml.predicted_price ?? 0).toLocaleString()}</b>
                </div>
                <div>
                  🎯 Win Probability:{" "}
                  <b>{Math.round(100 * Number(ml.win_probability ?? 0))}%</b>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-slate-500">
          Uses <code>/questionnaire/fill</code> → prefill defaults, then calls <code>/ml/predict</code>.
          We’ll wire this into the lead/quote editor next.
        </div>
      </CardContent>
    </Card>
  );
}
