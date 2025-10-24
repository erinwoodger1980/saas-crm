"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

async function getJSON<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { credentials: "omit" });
}
async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", json: body, credentials: "omit" });
}

type ListItem = {
  leadId: string;
  leadName: string;
  rfqId: string;
  createdAt: string | null;
  uploadedAt: string | null;
  quoteId: string | null;
  quoteStatus: string | null;
  quoteTitle: string | null;
  uploadToken: string;
};

type ListResponse = { ok: boolean; items: ListItem[] };

export default function SupplierDashboardPage() {
  const { tenant = "", token = "" } = (useParams() as { tenant?: string; token?: string }) ?? {};

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ListItem[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getJSON<ListResponse>(`/public/supplier/list?token=${encodeURIComponent(token)}`);
        if (!mounted) return;
        setItems(data.items || []);
      } catch (e: any) {
        setBanner(e?.message || "Failed to load requests");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function uploadFor(r: ListItem) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      try {
        const payload = await filesToBase64(files);
        await postJSON(`/public/supplier/rfq/${encodeURIComponent(r.uploadToken)}/upload`, { files: payload });
        // refresh list
        const data = await getJSON<ListResponse>(`/public/supplier/list?token=${encodeURIComponent(token)}`);
        setItems(data.items || []);
      } catch (e: any) {
        alert(e?.message || "Upload failed");
      }
    };
    input.click();
  }

  if (loading) return shell(<div className="text-sm text-slate-600">Loading…</div>);
  return shell(
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Quote Requests</h1>
        <p className="text-sm text-slate-600">Upload your prices and track status.</p>
      </div>
      {banner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{banner}</div>
      ) : null}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">No requests yet.</div>
      ) : (
        <div className="overflow-auto rounded-2xl border bg-white/80">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Requested</th>
                <th className="px-3 py-2 text-left">Uploaded</th>
                <th className="px-3 py-2 text-left">Quote</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={`${r.leadId}:${r.rfqId}`} className="border-t">
                  <td className="px-3 py-2">{r.leadName}</td>
                  <td className="px-3 py-2 text-slate-600">{fmt(r.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-600">{fmt(r.uploadedAt) || "—"}</td>
                  <td className="px-3 py-2">{r.quoteStatus ? r.quoteStatus.toLowerCase() : "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white"
                      onClick={() => uploadFor(r)}
                    >
                      {r.uploadedAt ? "Re-upload" : "Upload"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function shell(children: React.ReactNode) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[-10%] h-72 w-72 rounded-full bg-[rgb(var(--brand))/0.12] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-[-15%] h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </div>
    </div>
  );
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "";
}

async function filesToBase64(list: File[]) {
  const reads = list.map(
    (f) =>
      new Promise<{ filename: string; mimeType: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve({ filename: f.name, mimeType: f.type || "application/octet-stream", base64 });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(f);
      })
  );
  return Promise.all(reads);
}
