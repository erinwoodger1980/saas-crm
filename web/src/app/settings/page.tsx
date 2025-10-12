"use client";

import { useEffect, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import Image from "next/image";

type QField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
};

type Settings = {
  tenantId: string;
  slug: string;
  brandName: string;
  introHtml?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoImport, setAutoImport] = useState<boolean>(
    typeof window !== "undefined" ? localStorage.getItem("autoImportInbox") === "true" : false
  );

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      try {
        const data = await apiFetch<Settings>("/tenant/settings");
        setS({
          ...data,
          links: (data.links as any) ?? [],
          questionnaire: (data.questionnaire as any) ?? defaultQuestions(),
        });
      } catch (e: any) {
        toast({
          title: "Failed to load settings",
          description: e?.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function save() {
    if (!s) return;
    try {
      const body = { ...s, links: s.links ?? [], questionnaire: s.questionnaire ?? [] };
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: body,
      });
      setS({
        ...updated,
        links: (updated.links as any) ?? [],
        questionnaire: (updated.questionnaire as any) ?? [],
      });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "unknown", variant: "destructive" });
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("autoImportInbox", String(autoImport));
  }, [autoImport]);

  if (loading || !s) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  return (
    <div className="max-w-4xl p-6 space-y-6">
      <h1 className="text-xl font-semibold mb-2">Company Settings</h1>

      <div className="flex items-center gap-4">
        {s.logoUrl ? (
          <Image
            src={s.logoUrl}
            alt={`${s.brandName} logo`}
            width={48}
            height={48}
            className="rounded-md border"
            unoptimized
          />
        ) : (
          <div className="h-12 w-12 rounded-md border grid place-items-center text-slate-400">
            Logo
          </div>
        )}
        <div className="text-sm text-slate-600">
          <div className="font-medium">{s.brandName}</div>
          <div className="text-xs">Public form: <code>/q/{s.slug}/&lt;leadId&gt;</code></div>
        </div>
      </div>

      {/* Brand + URLs */}
      <section className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Brand name">
            <input
              className="input"
              value={s.brandName}
              onChange={(e) => setS({ ...s, brandName: e.target.value })}
            />
          </Field>

          <Field label="Public slug (URL)">
            <input
              className="input"
              value={s.slug}
              onChange={(e) =>
                setS({
                  ...s,
                  slug: e.target.value.trim().toLowerCase().replace(/\s+/g, "-"),
                })
              }
            />
            <div className="hint">
              Public questionnaire: <code>/q/{s.slug}/&lt;leadId&gt;</code>
            </div>
          </Field>

          <Field label="Website">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={s.website ?? ""}
                onChange={(e) => setS({ ...s, website: e.target.value })}
                placeholder="https://www.example.com"
              />
              <Button
                variant="outline"
                onClick={async () => {
                  if (!s.website) return toast({ title: "Please enter a website first." });
                  toast({ title: "Fetching info…", description: "Hold on a moment." });
                  try {
                    const enriched = await apiFetch<{ ok: boolean; settings: Settings }>(
                      "/tenant/settings/enrich",
                      { method: "POST", json: { website: s.website } }
                    );
                    setS((prev) => ({ ...prev!, ...enriched.settings }));
                    toast({ title: "Info imported successfully!" });
                  } catch (err: any) {
                    toast({ title: "Enrich failed", description: err?.message, variant: "destructive" });
                  }
                }}
              >
                Fetch Info
              </Button>
            </div>
          </Field>

          <Field label="Phone">
            <input
              className="input"
              value={s.phone ?? ""}
              onChange={(e) => setS({ ...s, phone: e.target.value })}
            />
          </Field>

          <Field label="Logo URL">
            <input
              className="input"
              value={s.logoUrl ?? ""}
              onChange={(e) => setS({ ...s, logoUrl: e.target.value })}
              placeholder="https://…/logo.png"
            />
            <div className="hint">Paste a direct image URL (PNG/SVG/ICO).</div>
          </Field>
        </div>

        <Field label="Questionnaire intro (HTML allowed)">
          <textarea
            className="input min-h-[160px]"
            value={s.introHtml ?? ""}
            onChange={(e) => setS({ ...s, introHtml: e.target.value })}
            placeholder="Paste your intro text or HTML…"
          />
        </Field>

        <Field label="Helpful links">
          <LinksEditor
            value={(s.links as any) as { label: string; url: string }[]}
            onChange={(links) => setS({ ...s, links })}
          />
        </Field>
      </section>

      {/* Email import (moved here) */}
      <section className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Email import</h2>
          <label className="text-sm inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoImport}
              onChange={(e) => setAutoImport(e.target.checked)}
            />
            Auto-watch inbox every 10 minutes
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="btn"
            onClick={async () => {
              try {
                await apiFetch("/gmail/import", { method: "POST", json: { max: 10, q: "newer_than:30d" } });
                toast({ title: "Gmail import complete" });
              } catch (e: any) {
                toast({ title: "Gmail import failed", description: e?.message, variant: "destructive" });
              }
            }}
            title="Import recent emails from Gmail"
          >
            Import Gmail
          </Button>

          <Button
            className="btn"
            onClick={async () => {
              try {
                await apiFetch("/ms365/import", { method: "POST", json: { max: 10 } });
                toast({ title: "Outlook import complete" });
              } catch (e: any) {
                toast({ title: "Outlook import failed", description: e?.message, variant: "destructive" });
              }
            }}
            title="Import recent emails from Outlook 365"
          >
            Import Outlook
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          When “Auto-watch inbox” is enabled, the Leads board will check for new emails and refresh every 10 minutes while you have the app open.
        </div>
      </section>

      {/* Questionnaire editor */}
      <section className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Default questionnaire</h2>
          <Button
            variant="outline"
            onClick={() => setS({ ...s, questionnaire: [...(s.questionnaire ?? []), emptyQ()] })}
          >
            + Add question
          </Button>
        </div>

        <QuestionnaireEditor
          value={(s.questionnaire ?? []) as QField[]}
          onChange={(q) => setS({ ...s, questionnaire: q })}
        />
      </section>

      <div className="pt-2">
        <Button onClick={save}>Save</Button>
      </div>

      <style jsx global>{`
        .input { @apply w-full rounded-lg border bg-white p-2 text-sm outline-none focus:ring-2; }
        .hint { @apply text-xs text-slate-500 mt-1; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function LinksEditor({
  value,
  onChange,
}: {
  value: { label: string; url: string }[];
  onChange: (v: { label: string; url: string }[]) => void;
}) {
  const list = value || [];
  const add = () => onChange([...list, { label: "", url: "" }]);
  const set = (i: number, patch: Partial<{ label: string; url: string }>) =>
    onChange(list.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const del = (i: number) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {list.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <div className="text-xs text-slate-500">Label</div>
            <input className="input" value={l.label} onChange={(e) => set(i, { label: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-slate-500">URL</div>
            <input className="input" value={l.url} onChange={(e) => set(i, { url: e.target.value })} />
          </div>
          <Button variant="outline" onClick={() => del(i)}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={add}>
        + Add link
      </Button>
    </div>
  );
}

function QuestionnaireEditor({
  value,
  onChange,
}: {
  value: QField[];
  onChange: (v: QField[]) => void;
}) {
  const set = (i: number, patch: Partial<QField>) =>
    onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const del = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={i} className="rounded-lg border p-3 grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <div className="text-xs text-slate-500">Field key</div>
            <input className="input" value={q.key} onChange={(e) => set(i, { key: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <div className="text-xs text-slate-500">Label</div>
            <input className="input" value={q.label} onChange={(e) => set(i, { label: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500">Type</div>
            <select
              className="input"
              value={q.type}
              onChange={(e) => set(i, { type: e.target.value as QField["type"], options: [] })}
            >
              <option value="text">Text</option>
              <option value="textarea">Textarea</option>
              <option value="number">Number</option>
              <option value="select">Select (dropdown)</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!q.required}
                onChange={(e) => set(i, { required: e.target.checked })}
              />
              Required
            </label>
          </div>
          <div className="md:col-span-11">
            {q.type === "select" ? (
              <>
                <div className="text-xs text-slate-500">Options (comma-separated)</div>
                <input
                  className="input"
                  value={(q.options ?? []).join(", ")}
                  onChange={(e) =>
                    set(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })
                  }
                  placeholder="e.g. Sash, Casement, French, Bi-fold"
                />
              </>
            ) : null}
          </div>
          <div className="md:col-span-1 flex items-end justify-end">
            <Button variant="outline" onClick={() => del(i)}>Remove</Button>
          </div>
        </div>
      ))}
      {!value.length && (
        <div className="text-xs text-slate-500">No questions yet — add your first one.</div>
      )}
    </div>
  );
}

function defaultQuestions(): QField[] {
  return [
    { key: "source", label: "Source", type: "select", options: ["Website", "Phone", "Referral", "Showroom"], required: true },
    { key: "productType", label: "Product type", type: "select", options: ["Sash Window", "Casement Window", "Front Door", "French Doors", "Bi-fold Doors"], required: true },
    { key: "roughSizes", label: "Rough sizes", type: "textarea" },
    { key: "address", label: "Property address", type: "text" },
    { key: "postcode", label: "Postcode", type: "text" },
    { key: "expectedDelivery", label: "Expected delivery date", type: "text" },
    { key: "photos", label: "Do you have photos?", type: "select", options: ["Yes", "No"] },
  ];
}

function emptyQ(): QField {
  return { key: "", label: "", type: "text", required: false, options: [] };
}