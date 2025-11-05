"use client";

import { useEffect, useState } from "react";
import { apiFetch, ensureDemoAuth, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type UploadedFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
};

type FilesList = { ok: boolean; count: number; items: UploadedFile[] };

type ProcessResult = any;

export default function ProcessQuotePage() {
  const [url, setUrl] = useState("");
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [vatPercent, setVatPercent] = useState<number>(20);
  const [markupDelivery, setMarkupDelivery] = useState<boolean>(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await ensureDemoAuth();
      await loadFiles();
    })();
  }, []);

  async function loadFiles() {
    setLoadingFiles(true);
    setError(null);
    try {
      const res = await apiFetch<FilesList>("/files?limit=25");
      setFiles(res?.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function processSignedUrl(signedPath: string) {
    setProcessing(true);
    setResult(null);
    setError(null);
    try {
      const payload = {
        url: signedPath.startsWith("http") ? signedPath : `${API_BASE || "/api"}${signedPath}`,
        markupPercent,
        vatPercent,
        markupDelivery,
      };
      const out = await apiFetch<ProcessResult>("/ml/process-quote", { method: "POST", json: payload });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || "Process failed");
    } finally {
      setProcessing(false);
    }
  }

  async function onProcessUrl() {
    if (!url.trim()) return;
    await processSignedUrl(url.trim());
  }

  async function onProcessFile(fileId: string) {
    try {
      const signed = await apiFetch<{ ok: boolean; url: string }>("/files/sign", {
        method: "POST",
        json: { fileId },
      });
      if (!signed?.url) throw new Error("Signing failed");
      await processSignedUrl(signed.url);
    } catch (e: any) {
      setError(e?.message || "Signing failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Process Supplier/Client Quotes</h1>
        <div className="text-sm text-muted-foreground">Classify → Parse → Mark up</div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1.5 md:col-span-2">
            <div className="text-xs text-slate-600">PDF URL or signed path</div>
            <Input placeholder="https://… or /files/:id?jwt=…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <div className="text-xs text-slate-600">Markup %</div>
            <Input type="number" value={String(markupPercent)} onChange={(e) => setMarkupPercent(Number(e.target.value || 0))} />
          </label>
          <label className="space-y-1.5">
            <div className="text-xs text-slate-600">VAT %</div>
            <Input type="number" value={String(vatPercent)} onChange={(e) => setVatPercent(Number(e.target.value || 0))} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markupDelivery} onChange={(e) => setMarkupDelivery(e.target.checked)} />
            Mark up delivery/shipping
          </label>
          <div className="flex-1" />
          <Button onClick={onProcessUrl} disabled={processing || !url.trim()}>
            {processing ? "Processing…" : "Process URL"}
          </Button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Your uploaded files</div>
          {loadingFiles ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : files.length === 0 ? (
            <div className="text-sm text-muted-foreground">No files yet.</div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded border p-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-slate-500">
                      {f.sizeBytes ? `${Math.round((f.sizeBytes as number) / 1024)} KB` : ""}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onProcessFile(f.id)} disabled={processing}>
                    Use
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Result</div>
          {!result ? (
            <div className="text-sm text-muted-foreground">No result yet.</div>
          ) : (
            <ResultView data={result} />
          )}
        </Card>
      </div>
    </div>
  );
}

function ResultView({ data }: { data: any }) {
  const qt = data?.quote_type || data?.quoteType || "unknown";
  const supplier = data?.supplier_parsed?.supplier || data?.supplier || null;
  const client = data?.client_quote || null;
  const training = data?.training_candidate || null;

  return (
    <div className="space-y-3">
      <div className="text-sm">Quote type: <strong>{qt}</strong>{supplier ? ` · Supplier: ${supplier}` : ""}</div>
      {client ? (
        <div className="space-y-2">
          <div className="text-sm">
            Subtotal: <strong>{fmtCurrency(client.currency, client.subtotal)}</strong>
            {client.vat_percent ? (
              <> · VAT ({client.vat_percent}%): <strong>{fmtCurrency(client.currency, client.vat_amount)}</strong></>
            ) : null}
            <> · Total: <strong>{fmtCurrency(client.currency, client.grand_total)}</strong></>
          </div>
          <div className="max-h-72 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Unit (orig)</th>
                  <th className="text-right p-2">Unit (marked)</th>
                  <th className="text-right p-2">Total (marked)</th>
                </tr>
              </thead>
              <tbody>
                {(client.lines || []).map((ln: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 align-top">{ln.description}</td>
                    <td className="p-2 text-right">{ln.qty}</td>
                    <td className="p-2 text-right">{fmtCurrency(client.currency, ln.unit_price)}</td>
                    <td className="p-2 text-right">{fmtCurrency(client.currency, ln.unit_price_marked_up)}</td>
                    <td className="p-2 text-right">{fmtCurrency(client.currency, ln.total_marked_up)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : training ? (
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(training, null, 2)}</pre>
      ) : (
        <div className="text-sm text-muted-foreground">No details available.</div>
      )}
    </div>
  );
}

function fmtCurrency(cur: string | null | undefined, v: number | string | null | undefined) {
  if (v == null || v === "") return "-";
  const n = typeof v === "string" ? Number(v) : v;
  const sym = cur === "GBP" || cur === "£" ? "£" : cur === "EUR" || cur === "€" ? "€" : cur === "$" || cur === "USD" ? "$" : "";
  return `${sym}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
