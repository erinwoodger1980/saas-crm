// web/src/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SourceCosts from "./SourceCosts";

/* -------- Helpers -------- */
function firstOfMonthInput(d: Date): string {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const y = first.getFullYear();
  const m = String(first.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
function addMonths(d: Date, n: number): Date {
  const dt = new Date(d.getTime());
  dt.setMonth(dt.getMonth() + n);
  return dt;
}
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

/* -------- Types -------- */
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
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number };

/* -------- Little UI atoms -------- */
function Section({
  title,
  description,
  children,
  right,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
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
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

/* -------- Page -------- */
export default function SettingsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Settings | null>(null);

  // Inbox watching
  const [inbox, setInbox] = useState<InboxCfg>({
    gmail: false,
    ms365: false,
    intervalMinutes: 10,
  });
  const [savingInbox, setSavingInbox] = useState(false);

  // (kept for potential future use)
  const [_month, _setMonth] = useState(firstOfMonthInput(new Date()));

  // Force-refresh SourceCosts after a recalc
  const [costsKey, setCostsKey] = useState(0);

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
        const inboxCfg = await apiFetch<InboxCfg>("/tenant/inbox");
        setInbox(inboxCfg);
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

  async function saveBrand() {
    if (!s) return;
    try {
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: { ...s, links: s.links ?? [], questionnaire: s.questionnaire ?? [] },
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

  async function recalcCosts(months = 3) {
    try {
      await apiFetch("/source-costs/recalc", {
        method: "POST",
        json: { months },
      });
      toast({
        title: "Recalculated",
        description: `Leads & sales recomputed from the last ${months} month(s).`,
      });
      setCostsKey((k) => k + 1);
    } catch (e: any) {
      toast({
        title: "Recalculation failed",
        description: e?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  }

  const logoPreview = useMemo(() => {
    const url = s?.logoUrl?.trim();
    if (!url) return null;
    try {
      // crude validation
      return new URL(url).toString();
    } catch {
      return null;
    }
  }, [s?.logoUrl]);

  if (loading || !s) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-sm text-slate-500">
            Manage your brand, intake questionnaire, inbox imports, and tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => location.reload()}>
            Reload
          </Button>
          <Button onClick={saveBrand}>Save All</Button>
        </div>
      </div>

      {/* Brand & preview - two columns */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
        <Section
          title="Brand & Identity"
          description="These details appear on your public questionnaire and emails."
          right={<Button size="sm" onClick={saveBrand}>Save</Button>}
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
              />
            </Field>

            <Field label="Phone">
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.phone || ""}
                onChange={(e) => setS({ ...s, phone: e.target.value })}
              />
            </Field>

            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <Field label="Logo URL" hint="Paste an absolute HTTPS link to an image (PNG/SVG/JPG).">
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

            <Field label="Intro (HTML or text)" >
              <textarea
                className="min-h-[110px] w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.introHtml || ""}
                onChange={(e) => setS({ ...s, introHtml: e.target.value })}
              />
            </Field>

            {/* Links editor */}
            <div className="sm:col-span-2">
              <div className="mb-2 text-sm font-medium">Links</div>
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
                  onClick={() =>
                    setS({ ...s, links: [...(s.links ?? []), { label: "", url: "" }] })
                  }
                >
                  Add link
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* Live Preview / Brand card */}
        <Section
          title="Preview"
          description="How your header might appear on shared pages."
        >
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center overflow-hidden shadow-sm">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-600">
                    {initials(s.brandName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {s.brandName || "Your brand"}
                </div>
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
        description="Fields shown on your public enquiry form."
        right={<Button size="sm" onClick={saveBrand}>Save</Button>}
      >
        <div className="space-y-3">
          {(s.questionnaire ?? []).map((q, i) => (
            <div
              key={q.key + i}
              className="rounded-xl border p-3 bg-white hover:shadow-sm transition"
            >
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
            <Button
              variant="ghost"
              onClick={() => setS({ ...s, questionnaire: defaultQuestions() })}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      </Section>

      {/* Inbox settings */}
      <Section
        title="Inbox Import"
        description="Connect and schedule inbox imports so replies and enquiries stay in sync."
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
          <Button variant="outline" onClick={() => importNow("gmail")}>
            Import Gmail now
          </Button>
          <Button variant="outline" onClick={() => importNow("ms365")}>
            Import MS365 now
          </Button>
        </div>
      </Section>

      {/* Lead Source Costs */}
      <Section
        title="Lead Source Costs"
        description="Track monthly spend and cost per sale by source."
        right={
          <Button
            variant="outline"
            onClick={() => recalcCosts(3)}
            title="Recalculate leads & sales from the last 3 months"
          >
            Recalculate recent history
          </Button>
        }
      >
        <SourceCosts key={costsKey} />
      </Section>
    </div>
  );
}

/* -------- tiny util -------- */
function initials(name?: string | null) {
  if (!name) return "JB";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}