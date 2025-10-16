// web/src/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/* ---------------- Types ---------------- */
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
  introHtml?: string | null; // we’ll store plain text here
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
};
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number };
type CostRow = {
  id: string;
  tenantId: string;
  source: string;
  month: string; // ISO date (first of month)
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};

/* ---------------- Small UI bits ---------------- */
function Section({
  title,
  description,
  right,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-800">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

/* ---------------- Helpers ---------------- */
function defaultQuestions(): QField[] {
  return [
    { key: "contactName", label: "Your name", type: "text", required: true },
    { key: "email", label: "Email", type: "text", required: true },
    {
      key: "projectType",
      label: "Project type",
      type: "select",
      options: ["Windows", "Doors", "Conservatory", "Other"],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
}
function initials(name?: string | null) {
  if (!name) return "JB";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function firstOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/* ============================================================
   Page
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({
    gmail: false,
    ms365: false,
    intervalMinutes: 10,
  });
  const [savingInbox, setSavingInbox] = useState(false);

  // Costs
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [costDraft, setCostDraft] = useState<{
    id?: string | null;
    source: string;
    month: string; // YYYY-MM-01
    spend: string;
    leads: string;
    conversions: string;
    scalable: boolean;
  }>({
    id: null,
    source: "",
    month: firstOfMonthISO(),
    spend: "",
    leads: "",
    conversions: "",
    scalable: true,
  });
  const [savingCost, setSavingCost] = useState(false);

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
          // treat introHtml as plain text we can type freely
          introHtml: data.introHtml ?? "",
        });
        const inboxCfg = await apiFetch<InboxCfg>("/tenant/inbox");
        setInbox(inboxCfg);
        const costRows = await apiFetch<CostRow[]>("/tenant/costs");
        setCosts(costRows);
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

  /* ---------------- Actions: Brand ---------------- */
  async function saveBrand() {
    if (!s) return;
    try {
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: {
          ...s,
          links: s.links ?? [],
          questionnaire: s.questionnaire ?? [],
        },
      });
      setS({
        ...updated,
        links: (updated.links as any) ?? [],
        questionnaire: (updated.questionnaire as any) ?? [],
      });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "unknown",
        variant: "destructive",
      });
    }
  }

  async function pullFromWebsite() {
    if (!s?.website) {
      toast({
        title: "Add your website first",
        description: "Enter your website URL, then click Pull from website.",
      });
      return;
    }
    try {
      const res = await apiFetch<{ ok: boolean; settings: Settings }>(
        "/tenant/settings/enrich",
        { method: "POST", json: { website: s.website } }
      );
      const merged = {
        ...s,
        ...res.settings,
        // keep questionnaire as-is
        questionnaire: s.questionnaire,
      };
      setS(merged);
      toast({ title: "Branding imported", description: "Logo, links and intro updated." });
    } catch (e: any) {
      toast({
        title: "Couldn’t pull branding",
        description: e?.message || "Please check the website URL.",
        variant: "destructive",
      });
    }
  }

  /* ---------------- Actions: Inbox ---------------- */
  async function saveInboxCfg() {
    setSavingInbox(true);
    try {
      await apiFetch("/tenant/inbox", { method: "PUT", json: inbox });
      toast({ title: "Inbox watch updated" });
    } catch (e: any) {
      toast({
        title: "Failed to save inbox settings",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSavingInbox(false);
    }
  }

  async function connectGmail() {
    try {
      // Try a helper endpoint first
      const r1 = await apiFetch<{ authUrl?: string }>("/gmail/auth-url").catch(() => null as any);
      const url = r1?.authUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      // Fallback to a generic connect route
      const r2 = await apiFetch<{ authUrl?: string }>("/gmail/connect").catch(() => null as any);
      if (r2?.authUrl) {
        window.location.href = r2.authUrl;
        return;
      }
      toast({
        title: "Couldn’t start Gmail connect",
        description: "Auth URL not provided by API.",
        variant: "destructive",
      });
    } catch (e: any) {
      toast({
        title: "Gmail connect failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  }

  async function importNow(provider: "gmail" | "ms365") {
    try {
      await apiFetch("/" + (provider === "gmail" ? "gmail/import" : "ms365/import"), {
        method: "POST",
        json: provider === "gmail" ? { max: 25, q: "newer_than:30d" } : { max: 25 },
      });
      toast({ title: `Imported from ${provider.toUpperCase()}` });
    } catch (e: any) {
      toast({
        title: `Import from ${provider.toUpperCase()} failed`,
        description: e?.message,
        variant: "destructive",
      });
    }
  }

  /* ---------------- Actions: Costs ---------------- */
  async function refreshCosts() {
    const rows = await apiFetch<CostRow[]>("/tenant/costs");
    setCosts(rows);
  }

  async function saveCostRow() {
    if (!s) return;
    const { source, month, spend, leads, conversions, scalable } = costDraft;
    if (!source || !month) {
      toast({ title: "Source and month required", variant: "destructive" });
      return;
    }
    setSavingCost(true);
    try {
      await apiFetch<CostRow>("/tenant/costs", {
        method: "POST",
        json: {
          source,
          month,
          spend: Number(spend || 0),
          leads: Number(leads || 0),
          conversions: Number(conversions || 0),
          scalable,
        },
      });
      await refreshCosts();
      setCostDraft({
        id: null,
        source: "",
        month: firstOfMonthISO(),
        spend: "",
        leads: "",
        conversions: "",
        scalable: true,
      });
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "Could not save cost row.",
        variant: "destructive",
      });
    } finally {
      setSavingCost(false);
    }
  }

  async function deleteCostRow(id: string) {
    try {
      await apiFetch(`/tenant/costs/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshCosts();
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: e?.message || "Could not delete.",
        variant: "destructive",
      });
    }
  }

  /* ---------------- Derived ---------------- */
  const logoPreview = useMemo(() => {
    const url = s?.logoUrl?.trim();
    if (!url) return null;
    try {
      return new URL(url).toString();
    } catch {
      return null;
    }
  }, [s?.logoUrl]);

  if (loading || !s) {
    return <div className="p-6 text-sm text-slate-600">Loading…</div>;
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-sm text-slate-500">
            Brand, questionnaire, inbox, and cost tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => location.reload()}>Reload</Button>
          <Button onClick={saveBrand}>Save All</Button>
        </div>
      </div>

      {/* Brand */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
        <Section
          title="Brand & Identity"
          description="These details show on shared pages and emails."
          right={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={pullFromWebsite}>
                Pull from website
              </Button>
              <Button size="sm" onClick={saveBrand}>Save</Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name">
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.brandName || ""}
                onChange={(e) => setS({ ...s, brandName: e.target.value })}
              />
            </Field>

            <Field label="Public slug" hint="Used for your public questionnaire link.">
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.slug || ""}
                onChange={(e) => setS({ ...s, slug: e.target.value })}
              />
            </Field>

            <Field label="Website">
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.website || ""}
                onChange={(e) => setS({ ...s, website: e.target.value })}
                placeholder="https://your-site.com"
              />
            </Field>

            <Field label="Phone">
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.phone || ""}
                onChange={(e) => setS({ ...s, phone: e.target.value })}
                placeholder="+44 1234 567890"
              />
            </Field>

            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <Field label="Logo URL" hint="Paste a full HTTPS link to an image (PNG/SVG/JPG).">
                <input
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                  value={s.logoUrl || ""}
                  onChange={(e) => setS({ ...s, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.svg"
                />
              </Field>
              <div className="justify-self-end">
                <Button variant="outline" onClick={saveBrand}>Save</Button>
              </div>
            </div>

            <Field label="Intro (plain text)">
              <textarea
                className="min-h-[110px] w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.introHtml || ""}
                onChange={(e) => setS({ ...s, introHtml: e.target.value })}
                placeholder="A short welcome shown to new enquiries."
              />
            </Field>

            {/* Helpful links */}
            <div className="sm:col-span-2">
              <div className="mb-2 text-sm font-medium">Helpful links</div>
              <div className="space-y-2">
                {(s.links ?? []).map((lnk, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <input
                      className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                      placeholder="Label"
                      value={lnk.label}
                      onChange={(e) => {
                        const next = [...(s.links ?? [])];
                        next[i] = { ...next[i], label: e.target.value };
                        setS({ ...s, links: next });
                      }}
                    />
                    <input
                      className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                      placeholder="https://…"
                      value={lnk.url}
                      onChange={(e) => {
                        const next = [...(s.links ?? [])];
                        next[i] = { ...next[i], url: e.target.value };
                        setS({ ...s, links: next });
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const next = [...(s.links ?? [])];
                        next.splice(i, 1);
                        setS({ ...s, links: next });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setS({ ...s, links: [...(s.links ?? []), { label: "", url: "" }] })}
                >
                  Add link
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* Preview */}
        <Section title="Preview" description="How it may appear on shared pages.">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center overflow-hidden shadow-sm">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-semibold text-slate-600">
                    {initials(s.brandName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{s.brandName || "Your brand"}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {s.website || "www.example.com"} · {s.phone || "01234 567890"}
                </div>
              </div>
            </div>
            {s.introHtml && (
              <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700 line-clamp-5">
                {s.introHtml}
              </div>
            )}
            {(s.links?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.links!.map((l, i) => (
                  <span key={i} className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    {l.label || l.url || "Link"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Questionnaire */}
      <Section
        title="Questionnaire"
        description="Pick the fields you want to ask on the public form."
        right={<Button size="sm" onClick={saveBrand}>Save</Button>}
      >
        <div className="space-y-3">
          {(s.questionnaire ?? []).map((q, i) => (
            <div key={q.key + i} className="rounded-xl border p-3 bg-white hover:shadow-sm transition">
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
                <Field label="Key">
                  <input
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                    value={q.key}
                    onChange={(e) => {
                      const next = [...(s.questionnaire ?? [])];
                      next[i] = { ...next[i], key: e.target.value };
                      setS({ ...s, questionnaire: next });
                    }}
                  />
                </Field>
                <Field label="Label">
                  <input
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                    value={q.label}
                    onChange={(e) => {
                      const next = [...(s.questionnaire ?? [])];
                      next[i] = { ...next[i], label: e.target.value };
                      setS({ ...s, questionnaire: next });
                    }}
                  />
                </Field>
                <Field label="Type">
                  <select
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                    value={q.type}
                    onChange={(e) => {
                      const next = [...(s.questionnaire ?? [])];
                      next[i] = { ...next[i], type: e.target.value as QField["type"] };
                      setS({ ...s, questionnaire: next });
                    }}
                  >
                    <option value="text">text</option>
                    <option value="textarea">textarea</option>
                    <option value="select">select</option>
                    <option value="number">number</option>
                  </select>
                </Field>
                <div className="flex items-center gap-2">
                  <input
                    id={`req-${i}`}
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!q.required}
                    onChange={(e) => {
                      const next = [...(s.questionnaire ?? [])];
                      next[i] = { ...next[i], required: e.target.checked };
                      setS({ ...s, questionnaire: next });
                    }}
                  />
                  <label htmlFor={`req-${i}`} className="text-sm text-slate-700">
                    Required
                  </label>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const next = [...(s.questionnaire ?? [])];
                    next.splice(i, 1);
                    setS({ ...s, questionnaire: next });
                  }}
                >
                  Remove
                </Button>
              </div>

              {q.type === "select" && (
                <div className="mt-3">
                  <Field label="Options (comma-separated)">
                    <input
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                      value={(q.options ?? []).join(", ")}
                      onChange={(e) => {
                        const opts = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const next = [...(s.questionnaire ?? [])];
                        next[i] = { ...next[i], options: opts };
                        setS({ ...s, questionnaire: next });
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setS({
                  ...s,
                  questionnaire: [
                    ...(s.questionnaire ?? []),
                    {
                      key: `field${(s.questionnaire?.length ?? 0) + 1}`,
                      label: "New field",
                      type: "text",
                    },
                  ],
                })
              }
            >
              Add field
            </Button>
            <Button variant="ghost" onClick={() => setS({ ...s, questionnaire: defaultQuestions() })}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </Section>

      {/* Inbox */}
      <Section
        title="Inbox"
        description="Connect Gmail / Microsoft 365 and set an automatic import schedule."
        right={
          <Button size="sm" onClick={saveInboxCfg} disabled={savingInbox}>
            {savingInbox ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={inbox.gmail}
              onChange={(e) => setInbox({ ...inbox, gmail: e.target.checked })}
            />
            <span className="text-sm">Gmail</span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={inbox.ms365}
              onChange={(e) => setInbox({ ...inbox, ms365: e.target.checked })}
            />
            <span className="text-sm">Microsoft 365</span>
          </label>

          <Field label="Interval (minutes)">
            <input
              type="number"
              min={2}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              value={inbox.intervalMinutes}
              onChange={(e) =>
                setInbox({
                  ...inbox,
                  intervalMinutes: Math.max(2, Number(e.target.value || 10)),
                })
              }
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={connectGmail}>Connect Gmail</Button>
          <Button variant="outline" onClick={() => importNow("gmail")}>
            Import Gmail now
          </Button>
          <Button variant="outline" onClick={() => importNow("ms365")}>
            Import MS365 now
          </Button>
        </div>
      </Section>

      {/* Lead Source Costs (inline editor) */}
      <Section
        title="Lead Source Costs"
        description="Track monthly spend and results by source."
      >
        {/* Editor */}
        <div className="rounded-xl border bg-white p-3 mb-4">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1.1fr_repeat(3,0.8fr)_auto] items-end">
            <Field label="Source">
              <input
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                placeholder="Google Ads / Facebook / Referral"
                value={costDraft.source}
                onChange={(e) => setCostDraft({ ...costDraft, source: e.target.value })}
              />
            </Field>
            <Field label="Month (YYYY-MM-01)">
              <input
                type="date"
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.month}
                onChange={(e) => setCostDraft({ ...costDraft, month: e.target.value })}
              />
            </Field>
            <Field label="Spend">
              <input
                type="number"
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.spend}
                onChange={(e) => setCostDraft({ ...costDraft, spend: e.target.value })}
              />
            </Field>
            <Field label="Leads">
              <input
                type="number"
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.leads}
                onChange={(e) => setCostDraft({ ...costDraft, leads: e.target.value })}
              />
            </Field>
            <Field label="Sales">
              <input
                type="number"
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.conversions}
                onChange={(e) => setCostDraft({ ...costDraft, conversions: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={costDraft.scalable}
                onChange={(e) => setCostDraft({ ...costDraft, scalable: e.target.checked })}
              />
              <span className="text-sm text-slate-700">Scalable</span>
            </label>

            <Button onClick={saveCostRow} disabled={savingCost}>
              {savingCost ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Spend</th>
                <th className="text-right px-3 py-2">Leads</th>
                <th className="text-right px-3 py-2">Sales</th>
                <th className="text-center px-3 py-2">Scalable</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                    No rows yet.
                  </td>
                </tr>
              ) : (
                costs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.month).toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2 text-right">£{r.spend.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{r.leads}</td>
                    <td className="px-3 py-2 text-right">{r.conversions}</td>
                    <td className="px-3 py-2 text-center">{r.scalable ? "✓" : "–"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCostDraft({
                            id: r.id,
                            source: r.source,
                            month: new Date(r.month).toISOString().slice(0, 10),
                            spend: String(r.spend),
                            leads: String(r.leads),
                            conversions: String(r.conversions),
                            scalable: r.scalable,
                          })
                        }
                      >
                        Edit
                      </Button>{" "}
                      <Button variant="destructive" size="sm" onClick={() => deleteCostRow(r.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}