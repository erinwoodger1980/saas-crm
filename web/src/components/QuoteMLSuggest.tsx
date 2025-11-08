"use client";

import { useState } from "react";
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

export default function QuoteMLSuggest({
  getPayload,
  onApplyPrice,
  onAddLine,
  className = "",
}: {
  /** Read current quote/lead fields at click time */
  getPayload: () => PredictIn | null;
  /** Called when user clicks "Apply to quote total" */
  onApplyPrice?: (_priceGBP: number) => void;
  /** Called when user clicks "Add line item" */
  onAddLine?: (_line: { description: string; qty: number; unitPrice: number; currency?: string }) => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function predict() {
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

  return (
    <Card className={`border bg-white/90 shadow-sm ${className}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">ML Suggestion</div>
          <Button size="sm" variant="outline" onClick={predict} disabled={loading}>
            {loading ? "Predicting…" : "Get suggestion"}
          </Button>
        </div>

        {err && <div className="text-xs text-red-600">{err}</div>}

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

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => price != null && onApplyPrice?.(price)}
            disabled={price == null}
          >
            Apply to quote total
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              price != null &&
              onAddLine?.({ description: "ML suggested price", qty: 1, unitPrice: price, currency: "GBP" })
            }
            disabled={price == null}
          >
            Add as line item
          </Button>
        </div>

        <div className="text-[11px] text-slate-500">
          Based on area + materials (and optional project/source).
        </div>
      </CardContent>
    </Card>
  );
}
