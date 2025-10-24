"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

async function getJSON<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { credentials: "omit" });
}
async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", json: body, credentials: "omit" });
}

type RFQInfo = {
  ok: boolean;
  lead: { id: string; contactName: string };
  supplierEmail: string;
  rfqId: string;
  alreadyUploaded?: boolean;
};

export default function SupplierUploadPage() {
  const { tenant = "", token = "" } = (useParams() as { tenant?: string; token?: string }) ?? {};
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RFQInfo | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getJSON<RFQInfo>(`/public/supplier/rfq/${encodeURIComponent(token)}`);
        if (!mounted) return;
        setInfo(data);
        // Prefetch a session token so we can link to the dashboard
        try {
          const sess = await postJSON<{ ok: boolean; sessionToken: string }>(
            `/public/supplier/session-from/${encodeURIComponent(token)}`,
            {}
          );
          if (sess?.sessionToken) setSessionToken(sess.sessionToken);
        } catch {
          // non-fatal
        }
      } catch (e: any) {
        setBanner(e?.message || "Link invalid or expired");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !files.length) {
      setBanner("Please choose at least one file");
      return;
    }
    try {
      setUploading(true);
      setBanner(null);
      const payload = await filesToBase64(files);
      await postJSON(`/public/supplier/rfq/${encodeURIComponent(token)}/upload`, { files: payload });
      setDone(true);
    } catch (e: any) {
      setBanner(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return renderShell(<div className="text-sm text-slate-600">Loading…</div>);
  if (!info) return renderShell(<div className="text-sm text-rose-600">{banner || "Link invalid"}</div>);
  if (done) return renderShell(
    <div className="space-y-3 rounded-3xl border bg-white/90 p-6 shadow">
      <div className="text-lg font-semibold">Thanks!</div>
      <div className="text-sm text-slate-600">
        Your quote has been uploaded.
        {" "}
        If you are quoting off a specification, please confirm any lead times and delivery terms in your notes.
      </div>
      {sessionToken ? (
        <div className="pt-2">
          <button
            onClick={() => router.push(`/sup/${encodeURIComponent(tenant)}/me/${encodeURIComponent(sessionToken)}`)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Go to my dashboard
          </button>
        </div>
      ) : null}
    </div>
  );

  return renderShell(
    <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border bg-white/90 p-6 shadow max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Upload your quote</h1>
        <p className="text-sm text-slate-600">For: {info.lead.contactName || info.lead.id}</p>
      </div>
      {banner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{banner}</div>
      ) : null}
      <div className="space-y-2">
        <input
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.currentTarget.files || []))}
        />
        {!!files.length && (
          <div className="text-xs text-slate-600">{files.length} file(s) ready</div>
        )}
        <div className="text-xs text-slate-500">PDF or images are fine. Max 10MB each recommended.</div>
        <div className="text-xs text-slate-500">
          Tip: If your price is based on an alternative spec, mention lead times and delivery terms so we can compare fairly.
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand))] px-6 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload quote"}
        </button>
        {sessionToken ? (
          <button
            type="button"
            onClick={() => router.push(`/sup/${encodeURIComponent(tenant)}/me/${encodeURIComponent(sessionToken)}`)}
            className="ml-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            View my dashboard
          </button>
        ) : null}
      </div>
    </form>
  );
}

function renderShell(children: React.ReactNode) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[-10%] h-72 w-72 rounded-full bg-[rgb(var(--brand))/0.12] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-[-15%] h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </div>
    </div>
  );
}
