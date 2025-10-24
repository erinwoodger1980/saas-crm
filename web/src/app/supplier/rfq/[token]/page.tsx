"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function SupplierRfqUploadPage() {
  const params = useParams<{ token: string }>();
  const token = (params?.token as string) || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ok: boolean; lead?: { id: string; contactName?: string }; supplierEmail?: string; rfqId?: string; alreadyUploaded?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiFetch<any>(`/public/supplier/rfq/${encodeURIComponent(token)}`);
        if (!cancel) setInfo(data);
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Invalid or expired link");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [token]);

  async function onUpload(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const files = (ev.currentTarget.elements.namedItem("files") as HTMLInputElement)?.files;
    if (!files || files.length === 0) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const payload: any[] = [];
      for (const f of Array.from(files)) {
        const base64 = await fileToBase64(f);
        payload.push({ filename: f.name, mimeType: f.type || "application/pdf", base64 });
      }
      const resp = await apiFetch<any>(`/public/supplier/rfq/${encodeURIComponent(token)}/upload`, {
        method: "POST",
        json: { files: payload },
      });
      setResult(`Uploaded ${Array.isArray(resp?.files) ? resp.files.length : 0} file(s).`);
      // Re-check state
      try {
        const data = await apiFetch<any>(`/public/supplier/rfq/${encodeURIComponent(token)}`);
        setInfo(data);
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-xl p-6">Loading…</div>;
  if (error) return <div className="mx-auto max-w-xl p-6 text-rose-700">{error}</div>;

  const name = info?.lead?.contactName || info?.lead?.id || "your project";

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Upload your quote</h1>
      <p className="text-sm text-slate-600">Please upload your quotation PDF for {name}.</p>
      {info?.alreadyUploaded && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">We have a file already, you can upload a newer version to replace it.</div>
      )}
      {result && <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">{result}</div>}
      {error && !loading && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
      <form className="space-y-3" onSubmit={onUpload}>
        <input type="file" name="files" multiple accept="application/pdf" className="block w-full rounded border p-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
      <p className="pt-2 text-xs text-slate-500">By uploading, you confirm you have permission to share this document.</p>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
