"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function fmtMoney(v: unknown) {
  const n = Number(v);
  if (!isFinite(n)) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export default function QuoteBuilderPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quote, setQuote] = useState<any | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Array<{ key: string; label: string }>>([]);
  const [lead, setLead] = useState<any | null>(null);

  const [margins, setMargins] = useState<number>(0.25);
  const [mapping, setMapping] = useState<Record<string, string | "">>({});
  const [savingMap, setSavingMap] = useState(false);
  const [pricingBusy, setPricingBusy] = useState<"margin" | "ml" | null>(null);
  const [parsing, setParsing] = useState(false);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [q, settings]: [any, any] = await Promise.all([
        apiFetch<any>(`/quotes/${id}`),
        apiFetch<any>(`/tenant/settings`),
      ]);
      setQuote(q);
      const fields = Array.isArray(settings?.questionnaire)
        ? settings.questionnaire.map((f: any) => ({ key: f.key, label: f.label }))
        : [];
      setQuestionnaire(fields);

      // Populate mapping from existing meta.questionKey
      const initial: Record<string, string | ""> = {};
      (q?.lines || []).forEach((ln: any) => {
        const key = ln?.meta?.questionKey || "";
        initial[ln.id] = key;
      });
      setMapping(initial);

      // If the quote is linked to a lead, fetch lead to show answers
      if (q?.leadId) {
        const ld: any = await apiFetch<any>(`/leads/${q.leadId}`);
        setLead(ld?.lead || null);
      } else {
        setLead(null);
      }

      // Default margin from quote if available
      if (q?.markupDefault != null) {
        const m = Number(q.markupDefault);
        if (isFinite(m)) setMargins(m);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runParse() {
    setParsing(true);
    setError(null);
    try {
      await apiFetch(`/quotes/${id}/parse`, { method: "POST" });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function saveMappings() {
    setSavingMap(true);
    setError(null);
    try {
      const mappings = Object.entries(mapping).map(([lineId, questionKey]) => ({ lineId, questionKey: questionKey || null }));
      await apiFetch(`/quotes/${id}/lines/map`, { method: "PATCH", json: { mappings } });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to save mappings");
    } finally {
      setSavingMap(false);
    }
  }

  async function priceByMargin() {
    setPricingBusy("margin");
    setError(null);
    try {
      await apiFetch(`/quotes/${id}/price`, { method: "POST", json: { method: "margin", margin: margins } });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to price by margin");
    } finally {
      setPricingBusy(null);
    }
  }

  async function priceByML() {
    setPricingBusy("ml");
    setError(null);
    try {
      await apiFetch(`/quotes/${id}/price`, { method: "POST", json: { method: "ml" } });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to price using ML");
    } finally {
      setPricingBusy(null);
    }
  }

  const lineCount = quote?.lines?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quote builder</h1>
          <p className="text-sm text-slate-500">Parse supplier PDFs, map to questionnaire, and create sell prices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runParse} disabled={parsing}>
            {parsing ? "Parsing…" : "Parse supplier PDFs"}
          </Button>
          <Button onClick={saveMappings} disabled={savingMap}>
            {savingMap ? "Saving…" : "Save mappings"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && quote && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: questionnaire */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Questionnaire</h2>
                <span className="text-xs text-slate-500">{questionnaire.length} fields</span>
              </div>
              <div className="mt-3 divide-y divide-slate-200">
                {questionnaire.map((f) => {
                  const answer = (lead?.custom && f.key in (lead.custom as any)) ? (lead.custom as any)[f.key] : "-";
                  return (
                    <div key={f.key} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{f.label}</div>
                        <div className="text-xs text-slate-500 break-words">{f.key}</div>
                      </div>
                      <div className="max-w-[50%] truncate text-sm text-slate-900">{String(answer ?? "-")}</div>
                    </div>
                  );
                })}
                {questionnaire.length === 0 && (
                  <div className="py-2 text-sm text-slate-500">No questionnaire configured yet.</div>
                )}
              </div>
            </div>

            {/* Pricing card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Pricing</h3>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700">Margin</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={margins}
                    onChange={(e) => setMargins(parseFloat(e.target.value))}
                    className="h-8 w-24"
                  />
                  <Button size="sm" onClick={priceByMargin} disabled={pricingBusy === "margin"}>
                    {pricingBusy === "margin" ? "Pricing…" : "Apply margin"}
                  </Button>
                </div>
                <div>
                  <Button size="sm" variant="outline" onClick={priceByML} disabled={pricingBusy === "ml"}>
                    {pricingBusy === "ml" ? "Pricing…" : "Use ML prediction"}
                  </Button>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold text-slate-900">{fmtMoney(quote.totalGBP)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: lines */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Parsed lines</h2>
                  <span className="text-xs text-slate-500">{lineCount} lines</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Cost/unit</th>
                      <th className="px-3 py-2">Map to question</th>
                      <th className="px-3 py-2">Sell/unit</th>
                      <th className="px-3 py-2">Sell total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(quote?.lines || []).map((ln: any) => {
                      const sellUnit = ln?.meta?.sellUnitGBP;
                      const sellTotal = ln?.meta?.sellTotalGBP;
                      const selected = mapping[ln.id] ?? "";
                      return (
                        <tr key={ln.id}>
                          <td className="px-3 py-2 font-medium text-slate-900">{ln.description || "-"}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">{ln.qty}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">{fmtMoney(ln.unitPrice)}</td>
                          <td className="px-3 py-2">
                            <Select
                              value={selected}
                              onValueChange={(v) => setMapping((m) => ({ ...m, [ln.id]: v }))}
                            >
                              <SelectTrigger className="h-8 w-72 text-left">
                                <SelectValue placeholder="Select field…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">— Not mapped —</SelectItem>
                                {questionnaire.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label} <span className="text-slate-400">({f.key})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">{fmtMoney(sellUnit)}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-900">{fmtMoney(sellTotal)}</td>
                        </tr>
                      );
                    })}
                    {lineCount === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                          No lines parsed yet. Upload supplier PDFs to the quote or click "Parse supplier PDFs".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supplier files */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Supplier files</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                {(quote?.supplierFiles || []).map((f: any) => (
                  <li key={f.id} className="truncate">
                    {f.name} <span className="text-slate-400">({f.mimeType || ""}, {f.sizeBytes || 0} bytes)</span>
                  </li>
                ))}
                {(!quote?.supplierFiles || quote.supplierFiles.length === 0) && (
                  <li className="text-slate-500">No files attached yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
