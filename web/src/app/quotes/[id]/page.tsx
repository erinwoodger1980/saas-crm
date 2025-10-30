"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [pricingMode, setPricingMode] = useState<"ml" | "margin">("ml");
  const [mapping, setMapping] = useState<Record<string, string | "">>({});
  const [savingMap, setSavingMap] = useState(false);
  const [pricingBusy, setPricingBusy] = useState<"margin" | "ml" | null>(null);
  const [parsing, setParsing] = useState(false);
  const autoAppliedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rendering, setRendering] = useState(false);

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
      // Normalize questionnaire to only client-facing fields
      const normalizeFields = (cfg: any): Array<{ key: string; label: string }> => {
        if (!cfg) return [];
        const rawList = Array.isArray(cfg)
          ? cfg
          : (Array.isArray(cfg?.questions) ? cfg.questions : []);
        return rawList
          .filter((f: any) => {
            // Only show questions visible to the client
            const askInQuestionnaire = f?.askInQuestionnaire !== false;
            const internalOnly = f?.internalOnly === true;
            const visibleAfterOrder = f?.visibleAfterOrder === true;
            return askInQuestionnaire && !internalOnly && !visibleAfterOrder;
          })
          .map((f: any) => ({
            key: typeof f?.key === "string" && f.key.trim() ? f.key.trim() : String(f?.id || ""),
            label:
              (typeof f?.label === "string" && f.label.trim()) ||
              (typeof f?.key === "string" && f.key.trim()) ||
              String(f?.id || "Field"),
          }))
          .filter((f: any) => f.key);
      };
      setQuestionnaire(normalizeFields(settings?.questionnaire));

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

      // Default margin and pricing mode from quote if available
      if (q?.markupDefault != null) {
        const m = Number(q.markupDefault);
        if (isFinite(m)) setMargins(m);
      }
      const mode = (q?.meta as any)?.pricingMode;
      if (mode === "margin" || mode === "ml") setPricingMode(mode);

      // Auto-apply preferred pricing once when lines are available
      try {
        const hasLines = Array.isArray(q?.lines) && q.lines.length > 0;
        if (hasLines && !autoAppliedRef.current && !pricingBusy && !parsing) {
          autoAppliedRef.current = true;
          await applyPreferredPricing();
        }
      } catch {}
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
      const out = await apiFetch<any>(`/quotes/${id}/parse`, { method: "POST" });
      // If async mode, poll the quote directly (not state) for a short window
      if (out && out.async) {
        for (let i = 0; i < 16; i++) {
          await new Promise((r) => setTimeout(r, 750));
          const q = await apiFetch<any>(`/quotes/${id}`);
          setQuote(q);
          if (Array.isArray(q?.lines) && q.lines.length > 0) break;
          const lp = (q?.meta as any)?.lastParse;
          if (lp?.state === "error") {
            const fails = Array.isArray(lp?.fails) ? ` (${lp.fails.length} file errors)` : "";
            setError(`Parse failed${fails}. Try a different PDF or ensure the ML service can fetch the file URL.`);
            break;
          }
        }
      } else if (typeof out?.created === "number" && out.created === 0) {
        setError("No lines parsed. Check the PDF is a supplier quote and that ML is online.");
      } else {
        await loadAll();
      }
    } catch (e: any) {
      const msg = e?.details?.error === "parse_failed"
        ? "Parse failed: ML service unavailable or file not parsable."
        : (e?.message || "Parse failed");
      setError(msg);
    } finally {
      setParsing(false);
    }
  }

  async function uploadSupplierFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      // Use apiFetch for consistent cookies and base URL handling
      await apiFetch(`/quotes/${id}/files`, { method: "POST", body: fd as any } as any);
      // Immediately parse after successful upload
      await runParse();
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function renderProposalPdf() {
    if (!id) return;
    setRendering(true);
    setError(null);
    try {
      await apiFetch(`/quotes/${id}/render-pdf`, { method: "POST" });
      const signed = await apiFetch<{ url: string }>(`/quotes/${id}/proposal/signed`);
      if (signed?.url) window.open(signed.url, "_blank");
    } catch (e: any) {
      setError(e?.message || "Failed to render proposal");
    } finally {
      setRendering(false);
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
      // Treat values > 1 as percent for convenience (e.g., 30 → 0.3)
      const norm = margins > 1 ? margins / 100 : margins;
      await apiFetch(`/quotes/${id}/price`, { method: "POST", json: { method: "margin", margin: norm } });
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

  async function savePreference(nextMode: "ml" | "margin") {
    try {
      setPricingMode(nextMode);
      await apiFetch(`/quotes/${id}/preference`, { method: "PATCH", json: { pricingMode: nextMode, margin: margins } });
      // Auto-apply immediately after saving preference
      if (!pricingBusy && !parsing) {
        await applyPreferredPricing();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save preference");
    }
  }

  async function applyPreferredPricing() {
    if (pricingMode === "ml") return priceByML();
    return priceByMargin();
  }

  const lineCount = quote?.lines?.length || 0;
  const lastParse = (quote?.meta as any)?.lastParse;

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
          <Button onClick={renderProposalPdf} disabled={rendering}>
            {rendering ? "Rendering…" : "Render proposal PDF"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => uploadSupplierFiles(e.target.files)}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload supplier PDF
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
                  <label className="text-sm text-slate-700">Preferred</label>
                  <select
                    className="h-8 rounded-md border px-2 text-sm"
                    value={pricingMode}
                    onChange={(e) => savePreference(e.target.value as any)}
                  >
                    <option value="ml">ML estimate (default)</option>
                    <option value="margin">Purchase-in (apply margin)</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={applyPreferredPricing}>
                    Apply now
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700">Margin</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={margins}
                    onChange={(e) => setMargins(parseFloat(e.target.value))}
                    onBlur={() => savePreference(pricingMode)}
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
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{lineCount} lines</span>
                    {lastParse?.state === 'running' && <span className="text-amber-600">Parsing…</span>}
                    {lastParse?.state === 'error' && <span className="text-red-600">Last parse failed</span>}
                    {lastParse?.state === 'ok' && <span className="text-emerald-600">Last parse ok</span>}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {/* Debug: show parse details when present */}
                {lastParse && (
                  <div className="mx-3 my-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Status: <span className="font-medium">{lastParse.state}</span></span>
                      {lastParse.created != null && <span>Created: {String(lastParse.created)}</span>}
                      {Array.isArray(lastParse.fails) && <span>Failures: {lastParse.fails.length}</span>}
                      {lastParse.timeoutMs && <span>Timeout: {lastParse.timeoutMs}ms</span>}
                      {lastParse.startedAt && <span>Started: {new Date(lastParse.startedAt).toLocaleTimeString()}</span>}
                      {lastParse.finishedAt && <span>Finished: {new Date(lastParse.finishedAt).toLocaleTimeString()}</span>}
                      <Button size="sm" variant="outline" onClick={() => apiFetch(`/quotes/${id}/parse?async=0`, { method: 'POST' }).then(loadAll).catch((e)=> setError(e?.message || 'Debug parse failed'))}>Parse (debug)</Button>
                    </div>
                    {Array.isArray(lastParse.fails) && lastParse.fails.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {lastParse.fails.map((f: any, i: number) => (
                          <div key={i} className="rounded border border-slate-200 bg-white p-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-medium">{f?.name || f?.fileId || 'file'}</span>
                              {f?.status && <span className="text-slate-500">{f.status}</span>}
                            </div>
                            {f?.error && (
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-700">{JSON.stringify(f.error, null, 2)}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  <li key={f.id} className="flex items-center justify-between gap-2 truncate py-1">
                    <div className="min-w-0 truncate">
                      {f.name} <span className="text-slate-400">({f.mimeType || ""}, {f.sizeBytes || 0} bytes)</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const out = await apiFetch<{ ok: boolean; url: string }>(`/quotes/${id}/files/${encodeURIComponent(f.id)}/signed`);
                          if (out?.url) {
                            const win = window.open(out.url, "_blank");
                            // If the file layer returns JSON with {error:"missing_file"}, show guidance
                            setTimeout(async () => {
                              try {
                                const r = await fetch(out.url, { credentials: "include" });
                                if (!r.ok) return; // will show itself in tab
                                const ct = r.headers.get("content-type") || "";
                                if (ct.includes("application/json")) {
                                  const j = await r.json().catch(() => null);
                                  if (j && j.error === "missing_file") {
                                    setError("File is missing on the server. Please re-upload the PDF (server storage is ephemeral without a persistent disk).");
                                  }
                                }
                              } catch {}
                            }, 300);
                          }
                        } catch (e: any) {
                          setError(e?.message || "Could not open file");
                        }
                      }}
                    >
                      View
                    </Button>
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
